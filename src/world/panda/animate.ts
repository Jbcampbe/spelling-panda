/**
 * Procedural animation: maps a Brain (behaviour state) onto a PandaRig every frame.
 * Continuous poses (sit / lie / walk / eat) are blended with frame-rate independent
 * damping so every transition is soft; reactions and arrivals use eased envelopes.
 */
import type { Brain } from './behaviour';
import { ARRIVAL_DROP_START, ARRIVAL_DROP_TIME, WALK_SPEED, blinkAmount } from './behaviour';
import type { PandaRig } from './rig';
import { NECK, PIVOT_Y } from './geometry';
import { clamp, damp, easeInOutSine, smoothstep } from '../random';

export interface PoseState {
  sit: number;
  lie: number;
  walk: number;
  eat: number;
  sleepy: number;
  yaw: number;
  pitch: number;
  /** Per-panda phase offset so the herd never breathes in sync. */
  phase: number;
  /** 0..1 eviction shrink ("poof" back to the Book). */
  leave: number;
  /** 0..1 picked up and dangling from the child's finger. */
  held: number;
  /** 0..1 floating in the pond (the herd also sinks the root by this). */
  swim: number;
  /** Dangle swing while carried, in the panda's own frame (set by the herd). */
  swayX: number;
  swayZ: number;
}

export function createPose(phase: number): PoseState {
  return { sit: 0, lie: 0, walk: 0, eat: 0, sleepy: 0, yaw: 0, pitch: 0, phase, leave: 0, held: 0, swim: 0, swayX: 0, swayZ: 0 };
}

/** Short hop curve: 0 → 1 → 0 over v ∈ [0,1]. */
const arc = (v: number) => (v <= 0 || v >= 1 ? 0 : 4 * v * (1 - v));

/** Height of the drop-in at a given arrival time (exported for the camera). */
export function arrivalLift(elapsed: number): number {
  const k = (elapsed - ARRIVAL_DROP_START) / ARRIVAL_DROP_TIME;
  if (k < 0) return 3;
  if (k < 1) return 3 * (1 - k * k);
  return 0;
}

export function animateRig(rig: PandaRig, b: Brain, p: PoseState, dt: number, t: number): void {
  const a = b.activity;
  const tp = t + p.phase;

  // ---- Continuous pose weights ----
  const munch = a === 'munch';
  p.sit = damp(p.sit, a === 'sit' || a === 'eat' || munch ? 1 : 0, munch ? 6 : 3.2, dt);
  p.lie = damp(p.lie, a === 'nap' ? 1 : 0, 1.7, dt);
  p.walk = damp(p.walk, a === 'walk' || a === 'climb' ? clamp((b.speed / WALK_SPEED) * 1.3, 0, 1) : 0, 6, dt);
  const eating =
    (a === 'eat' && b.elapsed > 0.7 && b.elapsed < b.duration - 0.6) ||
    (munch && b.elapsed > 0.25 && b.elapsed < b.duration - 0.45);
  p.eat = damp(p.eat, eating ? 1 : 0, munch ? 5 : 3, dt);
  p.held = damp(p.held, a === 'held' ? 1 : 0, a === 'held' ? 12 : 7, dt);
  p.swim = damp(p.swim, a === 'swim' ? 1 : 0, a === 'swim' ? 6 : 2.4, dt);
  p.sleepy = damp(p.sleepy, a === 'nap' && b.elapsed > 0.9 && b.elapsed < b.duration - 0.8 ? 1 : 0, 2.5, dt);
  const lookScale = a === 'nap' ? 0.1 : a === 'eat' || munch ? 0.35 : 1;
  p.yaw = damp(p.yaw, b.lookYaw * lookScale, 2.2, dt);
  p.pitch = damp(p.pitch, b.lookPitch * lookScale, 2.2, dt);

  const { sit, lie, walk, eat, held, swim } = p;
  const phase = b.walkPhase;
  const sw = Math.sin(phase);

  // ---- Reaction / arrival envelopes ----
  let lift = 0;
  let squash = 0;
  let roll = 0;
  let spin = 0;
  let wave = 0;
  let cheer = 0;
  let tuck = 0;
  let happy = 0;
  let visible = true;
  if (a === 'react' && b.reaction) {
    const u = b.elapsed / b.duration;
    const env = smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u));
    if (b.reaction === 'hop') {
      const h1 = arc((u - 0.08) / 0.42);
      const h2 = arc((u - 0.55) / 0.36);
      lift = h1 * 0.34 + h2 * 0.2;
      // Squash just before take-off and on landing, stretch in the air.
      const ground = (u > 0.02 && u < 0.1) || (u > 0.47 && u < 0.58) || (u > 0.88 && u < 0.98) ? 1 : 0;
      squash = ground * 0.14 - (h1 + h2) * 0.06;
      cheer = env;
      happy = env;
    } else if (b.reaction === 'roll') {
      const r = clamp((u - 0.1) / 0.75, 0, 1);
      roll = easeInOutSine(r) * Math.PI * 2;
      lift = Math.sin(Math.PI * r) * 0.42;
      tuck = Math.sin(Math.PI * clamp(r * 1.1 - 0.05, 0, 1));
      squash = u > 0.86 && u < 0.97 ? 0.12 : 0;
      happy = env * 0.6;
    } else {
      wave = env;
      happy = env * 0.8;
    }
  } else if (a === 'arrive') {
    const e = b.elapsed;
    const k = (e - ARRIVAL_DROP_START) / ARRIVAL_DROP_TIME;
    if (k < 0) visible = false;
    else if (k < 1) {
      lift = arrivalLift(e);
      spin = (1 - easeInOutSine(k)) * Math.PI * 1.5;
      squash = -0.1 * k;
      cheer = 0.6;
    } else {
      const tl = e - ARRIVAL_DROP_START - ARRIVAL_DROP_TIME;
      squash = Math.exp(-tl * 5) * Math.sin(tl * 15 + 1.2) * 0.2;
      lift = arc((tl - 0.45) / 0.38) * 0.22 + arc((tl - 0.95) / 0.32) * 0.13;
      happy = 1;
      wave = smoothstep(1.2, 1.4, tl) * (1 - smoothstep(1.7, 1.8, tl));
      cheer = arc((tl - 0.4) / 0.9);
    }
  }

  if (a === 'drop') {
    // Glide down, with a little arc when it has to travel to a valid spot, then a soft landing.
    const u = clamp(b.elapsed / b.duration, 0, 1);
    const far = clamp(Math.hypot(b.targetX - b.fromX, b.targetZ - b.fromZ) / 1.5, 0, 1);
    lift = arc(u) * 0.3 * far;
    squash = u > 0.62 ? Math.sin(((u - 0.62) / 0.38) * Math.PI) * 0.15 : 0;
  }
  if (munch) happy = Math.max(happy, eat * 0.55);
  lift += held * 0.55;
  squash -= held * 0.05;
  const paddle = Math.sin(phase);
  // Now and then a curious head tilt while standing or sitting about.
  const curio = Math.sin(tp * 0.23) * Math.sin(tp * 0.37 + 1);
  const calm = (1 - walk) * (1 - lie) * (1 - eat) * (1 - held) * (1 - swim);
  const tilt = Math.sign(curio) * smoothstep(0.5, 0.8, Math.abs(curio)) * 0.24 * calm;
  const dangle = Math.sin(t * 8.5 + p.phase);

  const leaveK = p.leave * p.leave;
  rig.root.visible = visible && p.leave < 0.999;
  rig.root.rotation.y = b.heading + spin + leaveK * Math.PI * 2;

  // ---- Mover: vertical + squash & stretch ----
  const breathRate = a === 'nap' ? 1.35 : 2.1;
  const br = Math.sin(tp * breathRate);
  rig.mover.position.y =
    Math.abs(sw) * 0.035 * walk - 0.11 * sit * (1 - lie) - 0.075 * lie + lift + Math.sin(tp * 2.4) * 0.03 * swim;
  const sq = squash;
  const shrink = 1 - leaveK;
  rig.mover.scale.set((1 + sq * 0.55) * shrink, (1 - sq) * shrink + leaveK * 0.0001, (1 + sq * 0.55) * shrink);

  // ---- Pivot: waddle, lie, roll ----
  rig.pivot.rotation.set(
    -0.13 * sit * (1 - lie) + roll + Math.sin(tp * 2.4) * 0.015 * walk + p.swayX * held + 0.2 * swim,
    Math.sin(phase * 0.5) * 0.04 * walk + paddle * 0.07 * swim,
    sw * 0.075 * walk + lie * 1.36 + Math.sin(t * 7.5) * 0.06 * wave + p.swayZ * held + paddle * 0.05 * swim,
  );
  rig.pivot.position.y = PIVOT_Y;

  // ---- Breathing ----
  const bAmp = a === 'nap' ? 0.022 : 0.013;
  rig.body.scale.set(1 + br * bAmp, 1 + br * bAmp * 1.25, 1 + br * bAmp);

  // ---- Head ----
  const chew = Math.sin(t * 7.5) * 0.045 * eat;
  rig.neck.position.y = NECK.y - PIVOT_Y + br * 0.006;
  rig.neck.rotation.set(
    p.pitch + chew + 0.12 * eat + 0.18 * p.sleepy - 0.08 * cheer + 0.55 * tuck - 0.16 * swim - p.swayX * held * 0.5,
    p.yaw * (1 - lie * 0.8) + Math.sin(t * 6) * 0.05 * wave,
    Math.sin(tp * 0.55) * 0.045 - 0.25 * p.sleepy + 0.12 * wave + tilt - p.swayZ * held * 0.5,
  );

  // ---- Eyes ----
  const closed = Math.max(blinkAmount(b) * (1 - p.sleepy), p.sleepy, happy * 0.5);
  rig.eyes.scale.set(1, Math.max(0.06, 1 - closed * 0.94), 1);

  // ---- Arms ----
  const armSwing = -sw * 0.42 * walk;
  const armUp = cheer * 1.7;
  const waveArm = wave * (2.55 + Math.sin(t * 10) * 0.32);
  rig.armL.rotation.set(
    0.05 + armSwing - 0.4 * sit - 0.55 * lie - 1.95 * eat - 1.2 * tuck - (1.15 + paddle * 0.6) * swim,
    0,
    -0.2 - 0.18 * sit - armUp + 0.52 * eat - (0.85 + dangle * 0.18) * held - 0.3 * swim,
  );
  rig.armR.rotation.set(
    0.05 - armSwing - 0.4 * sit - 0.55 * lie - 1.8 * eat - 1.2 * tuck - (1.15 - paddle * 0.6) * swim,
    0,
    0.2 + 0.18 * sit + armUp - 0.48 * eat + waveArm * (1 - eat) + (0.85 - dangle * 0.18) * held + 0.3 * swim,
  );

  // ---- Legs ----
  const legSwing = sw * 0.55 * walk;
  // Dangling legs kick when carried; a slow flutter kick in the water.
  const kick = dangle * 0.5 * held + paddle * 0.4 * swim;
  const hang = 0.12 * held + 0.25 * swim;
  rig.legL.rotation.set(legSwing - 1.42 * sit * (1 - lie) - 0.5 * lie - 0.9 * tuck + kick + hang, 0, -0.24 * sit - 0.1 * held);
  rig.legR.rotation.set(-legSwing - 1.42 * sit * (1 - lie) - 0.35 * lie - 0.9 * tuck - kick + hang, 0, 0.24 * sit + 0.1 * held);

  // ---- Bamboo snack ----
  rig.bamboo.visible = eat > 0.02;
  if (rig.bamboo.visible) {
    const s = smoothstep(0, 1, eat);
    rig.bamboo.scale.setScalar(s);
    rig.bamboo.position.set(0.02, 0.3 + Math.sin(t * 7.5) * 0.012, 0.37);
    rig.bamboo.rotation.set(0.25, 0, 0.62);
  }
}
