/**
 * Pure panda behaviour state machine (R-PND-2, R-PND-3). No three.js / React here:
 * a Brain is plain data, stepped by `stepBrain` with an injectable environment.
 * Randomness comes from a seeded generator stored in the brain, so behaviour is
 * deterministic for a given seed and sequence of steps.
 */
import { angleDelta, clamp, mulberryStep } from '../random';

export type Activity =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'eat'
  | 'nap'
  | 'react'
  | 'arrive'
  /** Picked up by the child; the herd moves it, the brain only blinks. */
  | 'held'
  /** Let go: glides from where it was released to `target` and lands. */
  | 'drop'
  /** Paddling around the pond. */
  | 'swim'
  /** Wading out of the pond to `target`. */
  | 'climb'
  /** Fed by the child: sits and munches bamboo. */
  | 'munch';
export type Reaction = 'wave' | 'roll' | 'hop';
export const REACTIONS: readonly Reaction[] = ['wave', 'roll', 'hop'];

export interface Brain {
  x: number;
  z: number;
  /** Facing angle; 0 faces +z. */
  heading: number;
  /** Current forward speed (units/s). */
  speed: number;
  activity: Activity;
  reaction: Reaction | null;
  /** Seconds spent in the current activity. */
  elapsed: number;
  /** Planned length of the current activity (walk: timeout). */
  duration: number;
  targetX: number;
  targetZ: number;
  /** Where a 'drop' started. */
  fromX: number;
  fromZ: number;
  /** Accumulated stride phase (radians) for the walk cycle. */
  walkPhase: number;
  lookYaw: number;
  lookPitch: number;
  lookTimer: number;
  /** Seconds until the next blink. */
  blinkIn: number;
  /** Seconds since the current blink started (>= BLINK_TIME when not blinking). */
  blinkAge: number;
  rng: number;
}

export interface Environment {
  /** True when a panda centre at (x,z) is on open ground with `margin` clearance. */
  isWalkable(x: number, z: number, margin: number): boolean;
  /** Repulsion vector pushing (x,z) away from obstacles / the rim (zero when clear). */
  obstaclePush(x: number, z: number): { x: number; z: number };
  /** True if a straight walk from a to b stays clear of obstacles. */
  segmentClear(ax: number, az: number, bx: number, bz: number, margin: number): boolean;
  /** A uniformly random point on the island (may be unwalkable; caller filters). */
  randomPoint(rand: () => number): { x: number; z: number };
  /** The pond pandas can swim in (omit when there is no water). */
  water?: { x: number; z: number; r: number };
}

export interface BehaviourOptions {
  /** Pandas may walk to new spots (false for the single-panda preview). */
  wander: boolean;
  /** Pandas may lie down for a nap. */
  nap: boolean;
  /** Pandas may sit and eat bamboo. */
  eat: boolean;
}

export const ISLAND_BEHAVIOUR: BehaviourOptions = { wander: true, nap: true, eat: true };
export const PREVIEW_BEHAVIOUR: BehaviourOptions = { wander: false, nap: false, eat: true };

export const WALK_SPEED = 0.42;
export const TURN_RATE = 1.9;
export const STRIDE = 0.4;
export const BLINK_TIME = 0.16;
export const SEPARATION = 0.95;
export const REACTION_TIME: Record<Reaction, number> = { wave: 2.1, roll: 1.5, hop: 1.35 };
export const ARRIVAL_TIME = 3.4;
/** Seconds into an arrival when the panda starts dropping in. */
export const ARRIVAL_DROP_START = 0.75;
export const ARRIVAL_DROP_TIME = 0.85;
export const SWIM_SPEED = 0.26;
export const MUNCH_TIME = 5.5;
/** Fraction of the pond radius swimmers stay inside. */
const SWIM_REACH = 0.6;

function rand(b: Brain): number {
  const [v, n] = mulberryStep(b.rng);
  b.rng = n;
  return v;
}
const range = (b: Brain, lo: number, hi: number) => lo + (hi - lo) * rand(b);

export function createBrain(x: number, z: number, heading: number, seed: number): Brain {
  const b: Brain = {
    x,
    z,
    heading,
    speed: 0,
    activity: 'idle',
    reaction: null,
    elapsed: 0,
    duration: 1,
    targetX: x,
    targetZ: z,
    fromX: x,
    fromZ: z,
    walkPhase: 0,
    lookYaw: 0,
    lookPitch: 0,
    lookTimer: 1,
    blinkIn: 1,
    blinkAge: BLINK_TIME,
    rng: seed >>> 0,
  };
  b.duration = range(b, 1.5, 5);
  b.blinkIn = range(b, 0.5, 3);
  b.lookTimer = range(b, 0.5, 2.5);
  return b;
}

function begin(b: Brain, activity: Activity, duration: number): void {
  b.activity = activity;
  b.elapsed = 0;
  b.duration = duration;
  if (activity !== 'react') b.reaction = null;
}

function pickWeighted<T extends string>(b: Brain, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand(b) * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/** Choose a reachable wander target; returns false if none was found. */
function chooseTarget(b: Brain, env: Environment): boolean {
  for (let i = 0; i < 24; i++) {
    const p = env.randomPoint(() => rand(b));
    const dist = Math.hypot(p.x - b.x, p.z - b.z);
    if (dist < 1.2 || dist > 4.5) continue;
    if (!env.isWalkable(p.x, p.z, 0.15)) continue;
    if (!env.segmentClear(b.x, b.z, p.x, p.z, 0.1)) continue;
    b.targetX = p.x;
    b.targetZ = p.z;
    return true;
  }
  return false;
}

/** Decide what to do after the current activity finishes. */
function chooseNext(b: Brain, env: Environment, opts: BehaviourOptions): void {
  const prev = b.activity;
  const w: Partial<Record<Activity, number>> = {};
  const eat = opts.eat ? 1 : 0;
  const nap = opts.nap ? 1 : 0;
  const walk = opts.wander ? 1 : 0;
  switch (prev) {
    case 'walk':
      Object.assign(w, { idle: 0.55, sit: 0.25, eat: 0.2 * eat, walk: 0.15 * walk });
      break;
    case 'sit':
      Object.assign(w, { idle: 0.35, eat: 0.3 * eat, walk: 0.35 * walk, nap: 0.12 * nap });
      break;
    case 'eat':
      Object.assign(w, { sit: 0.45, idle: 0.35, nap: 0.12 * nap, walk: 0.2 * walk });
      break;
    case 'nap':
      Object.assign(w, { sit: 0.65, idle: 0.35 });
      break;
    default:
      Object.assign(w, { walk: 0.5 * walk, sit: 0.22, eat: 0.16 * eat, nap: 0.07 * nap, idle: 0.14 });
  }
  let next = pickWeighted(b, w);
  if (next === 'walk' && !chooseTarget(b, env)) next = 'idle';
  switch (next) {
    case 'walk':
      begin(b, 'walk', 14);
      break;
    case 'sit':
      begin(b, 'sit', range(b, 5, 10));
      break;
    case 'eat':
      begin(b, 'eat', range(b, 7, 12));
      break;
    case 'nap':
      begin(b, 'nap', range(b, 9, 15));
      break;
    default:
      begin(b, 'idle', range(b, 2.5, 6));
  }
}

/** Interrupt with a tap reaction. Returns the chosen reaction. */
export function startReaction(b: Brain, forced?: Reaction): Reaction {
  const r = forced ?? REACTIONS[Math.floor(rand(b) * REACTIONS.length) % REACTIONS.length];
  begin(b, 'react', REACTION_TIME[r]);
  b.reaction = r;
  b.speed = 0;
  return r;
}

/** Begin the drop-in arrival (R-NEW-4). `faceHeading` usually points at the camera. */
export function startArrival(b: Brain, faceHeading: number): void {
  begin(b, 'arrive', ARRIVAL_TIME);
  b.heading = faceHeading;
  b.speed = 0;
  b.lookYaw = 0;
  b.lookPitch = 0.12;
}

export function isBusy(b: Brain): boolean {
  return b.activity === 'react' || b.activity === 'arrive';
}

/** The child picked the panda up. */
export function startHold(b: Brain): void {
  begin(b, 'held', Infinity);
  b.speed = 0;
  b.lookYaw = 0;
  b.lookPitch = -0.05;
}

/** Let go of a held panda: it glides to (x,z) and lands there. */
export function startDrop(b: Brain, x: number, z: number): void {
  const dist = Math.hypot(x - b.x, z - b.z);
  begin(b, 'drop', 0.5 + Math.min(0.7, dist * 0.22));
  b.fromX = b.x;
  b.fromZ = b.z;
  b.targetX = x;
  b.targetZ = z;
  b.speed = 0;
}

/** Start paddling around the pond (the caller has put the panda in the water). */
export function startSwim(b: Brain): void {
  begin(b, 'swim', range(b, 9, 14));
  b.targetX = b.x;
  b.targetZ = b.z;
  b.speed = 0;
}

/** Feed the panda: it sits down and munches. False if it can't eat right now. */
export function startMunch(b: Brain): boolean {
  if (!canFeed(b)) return false;
  begin(b, 'munch', MUNCH_TIME);
  b.speed = 0;
  b.lookYaw = 0;
  b.lookPitch = 0.05;
  return true;
}

export function canFeed(b: Brain): boolean {
  const a = b.activity;
  return a === 'idle' || a === 'walk' || a === 'sit' || a === 'eat' || a === 'nap' || a === 'react';
}

function turnToward(b: Brain, desired: number, rate: number, dt: number): number {
  const dh = angleDelta(b.heading, desired);
  const maxTurn = rate * dt;
  b.heading += clamp(dh, -maxTurn, maxTurn);
  return Math.max(0, Math.cos(dh));
}

/** Child-driven activities; returns true when it handled this step. */
function stepSpecial(b: Brain, dt: number, env: Environment): boolean {
  const a = b.activity;
  if (a === 'held') return true;
  if (a === 'drop') {
    const u = clamp(b.elapsed / b.duration, 0, 1);
    const k = u * u * (3 - 2 * u);
    b.x = b.fromX + (b.targetX - b.fromX) * k;
    b.z = b.fromZ + (b.targetZ - b.fromZ) * k;
    if (u >= 1) begin(b, 'idle', range(b, 1.5, 3));
    return true;
  }
  if (a === 'munch') {
    if (b.elapsed >= b.duration) startReaction(b, 'hop');
    return true;
  }
  if (a === 'swim') {
    const w = env.water;
    if (!w) {
      begin(b, 'idle', 1);
      return true;
    }
    if (b.elapsed >= b.duration) {
      // Wade out towards the nearest bit of open shore.
      const base = Math.atan2(b.z - w.z, b.x - w.x);
      for (let i = 0; i < 24; i++) {
        const ang = base + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 0.28;
        const r = w.r + 0.75;
        const x = w.x + Math.cos(ang) * r;
        const z = w.z + Math.sin(ang) * r;
        if (!env.isWalkable(x, z, 0.05)) continue;
        b.targetX = x;
        b.targetZ = z;
        begin(b, 'climb', 8);
        return true;
      }
      b.duration += 3;
    }
    let dx = b.targetX - b.x;
    let dz = b.targetZ - b.z;
    let dist = Math.hypot(dx, dz);
    if (dist < 0.12) {
      const ang = rand(b) * Math.PI * 2;
      const r = Math.sqrt(rand(b)) * w.r * SWIM_REACH;
      b.targetX = w.x + Math.cos(ang) * r;
      b.targetZ = w.z + Math.sin(ang) * r;
      dx = b.targetX - b.x;
      dz = b.targetZ - b.z;
      dist = Math.hypot(dx, dz);
    }
    const align = dist > 1e-4 ? turnToward(b, Math.atan2(dx, dz), TURN_RATE * 0.8, dt) : 0;
    b.speed += (SWIM_SPEED * align - b.speed) * (1 - Math.exp(-3 * dt));
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    // Never drift out of the deep part.
    const ox = b.x - w.x;
    const oz = b.z - w.z;
    const od = Math.hypot(ox, oz);
    const lim = w.r * (SWIM_REACH + 0.08);
    if (od > lim) {
      // Eased, so a panda dropped at the pond's edge drifts in rather than snapping.
      const pull = ((od - lim) / od) * Math.min(1, 5 * dt);
      b.x -= ox * pull;
      b.z -= oz * pull;
    }
    b.walkPhase += dt * 5.5;
    return true;
  }
  if (a === 'climb') {
    const dx = b.targetX - b.x;
    const dz = b.targetZ - b.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1 || b.elapsed >= b.duration) {
      if (dist < 0.1 || env.isWalkable(b.x, b.z, -0.1)) begin(b, 'idle', range(b, 1.5, 3));
      else {
        // Ran out of time in a bad spot: finish with a glide to the target.
        startDrop(b, b.targetX, b.targetZ);
      }
      return true;
    }
    const align = turnToward(b, Math.atan2(dx, dz), TURN_RATE * 1.4, dt);
    b.speed += (WALK_SPEED * align * align - b.speed) * (1 - Math.exp(-4 * dt));
    b.x += Math.sin(b.heading) * b.speed * dt;
    b.z += Math.cos(b.heading) * b.speed * dt;
    b.walkPhase += ((b.speed * dt) / STRIDE) * Math.PI;
    return true;
  }
  return false;
}

export interface Neighbour {
  x: number;
  z: number;
}

/**
 * Advance a brain by dt seconds. Mutates and returns the brain.
 * `neighbours` are the other pandas' positions (for separation steering).
 */
export function stepBrain(
  b: Brain,
  dt: number,
  neighbours: readonly Neighbour[],
  env: Environment,
  opts: BehaviourOptions = ISLAND_BEHAVIOUR,
): Brain {
  dt = clamp(dt, 0, 0.1);
  b.elapsed += dt;

  // Blinking (eyes stay shut while napping; handled by the animator).
  b.blinkAge += dt;
  b.blinkIn -= dt;
  if (b.blinkIn <= 0) {
    b.blinkAge = 0;
    // Occasional double blink.
    b.blinkIn = rand(b) < 0.18 ? BLINK_TIME + 0.12 : range(b, 2.2, 6);
  }

  // Idle look-around.
  b.lookTimer -= dt;
  if (b.lookTimer <= 0) {
    const calm = b.activity === 'walk' ? 0.35 : 1;
    b.lookYaw = rand(b) < 0.3 ? 0 : range(b, -0.75, 0.75) * calm;
    b.lookPitch = range(b, -0.12, 0.18) * calm;
    b.lookTimer = range(b, 1.8, 5);
  }

  if (stepSpecial(b, dt, env)) return b;

  // Separation from neighbours (always on, gentle).
  let sx = 0;
  let sz = 0;
  for (const n of neighbours) {
    const dx = b.x - n.x;
    const dz = b.z - n.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4 && d < SEPARATION) {
      const k = (1 - d / SEPARATION) ** 2;
      sx += (dx / d) * k;
      sz += (dz / d) * k;
    } else if (d <= 1e-4) {
      sx += rand(b) - 0.5;
      sz += rand(b) - 0.5;
    }
  }

  let desiredSpeed = 0;
  let desiredHeading = b.heading;

  if (b.activity === 'walk') {
    const dx = b.targetX - b.x;
    const dz = b.targetZ - b.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2 || b.elapsed > b.duration) {
      chooseNext(b, env, opts);
    } else {
      // Seek + obstacle avoidance + separation, blended into a heading.
      const push = env.obstaclePush(b.x, b.z);
      let vx = dx / dist + push.x * 1.6 + sx * 1.4;
      let vz = dz / dist + push.z * 1.6 + sz * 1.4;
      // Slide around obstacles: add a tangential component when pushed head-on.
      const pl = Math.hypot(push.x, push.z);
      if (pl > 0.05) {
        const side = (dx / dist) * push.z - (dz / dist) * push.x >= 0 ? 1 : -1;
        vx += -push.z * side * 1.2;
        vz += push.x * side * 1.2;
      }
      desiredHeading = Math.atan2(vx, vz);
      const ease = Math.min(1, dist / 0.6) * 0.6 + 0.4;
      desiredSpeed = WALK_SPEED * ease;
    }
  } else if (b.elapsed >= b.duration) {
    chooseNext(b, env, opts);
  }

  // Turning: slow down while turning sharply so it never looks like skating.
  const dh = angleDelta(b.heading, desiredHeading);
  const maxTurn = TURN_RATE * dt;
  b.heading += clamp(dh, -maxTurn, maxTurn);
  const align = Math.max(0, Math.cos(dh));
  const targetSpeed = desiredSpeed * align * align;
  b.speed += (targetSpeed - b.speed) * (1 - Math.exp(-4 * dt));
  if (b.activity === 'react' && b.reaction === 'roll') {
    // A forward roll carries the panda a little way.
    const u = b.elapsed / b.duration;
    b.speed = u > 0.1 && u < 0.85 ? 0.55 : 0;
  }

  let nx = b.x + Math.sin(b.heading) * b.speed * dt;
  let nz = b.z + Math.cos(b.heading) * b.speed * dt;
  if (b.activity === 'walk') b.walkPhase += ((b.speed * dt) / STRIDE) * Math.PI;

  // Separation nudge (not during arrival so the drop spot is exact).
  if (b.activity !== 'arrive') {
    const settle = b.activity === 'walk' ? 0.9 : 0.35;
    nx += sx * settle * dt;
    nz += sz * settle * dt;
    const push = env.obstaclePush(nx, nz);
    nx += push.x * 1.5 * dt;
    nz += push.z * 1.5 * dt;
  }
  if (env.isWalkable(nx, nz, -0.15) || !env.isWalkable(b.x, b.z, -0.15)) {
    b.x = nx;
    b.z = nz;
  } else if (b.activity === 'walk') {
    // Blocked: give up on this target.
    begin(b, 'idle', range(b, 1, 2.5));
  }
  return b;
}

/** 0 = open … 1 = shut, for the blink curve. */
export function blinkAmount(b: Brain): number {
  if (b.blinkAge >= BLINK_TIME) return 0;
  const u = b.blinkAge / BLINK_TIME;
  return Math.sin(u * Math.PI);
}
