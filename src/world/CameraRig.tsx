import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, type ComponentRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { HerdApi } from './herd/Herd';
import { clamp, damp, easeInOutCubic, smoothstep } from './random';

type Controls = ComponentRef<typeof OrbitControls>;

const TARGET = new THREE.Vector3(0, 0.1, 0);
const POLAR = 1.0; // default view angle from vertical
const IDLE_BEFORE_ROTATE = 6;
const MAX_POLAR = 1.24;
/** Zoom limits: never closer than this many units, never further than the framed view × ZOOM_OUT. */
const MIN_DISTANCE = 5.4;
const ZOOM_IN = 0.3;
const ZOOM_OUT = 1.22;
/** How far the look-at point may wander from the island centre when fully zoomed in. */
const ROAM = 4.2;
/** The camera never drops below this height, so it can't dip into the ground or the bushes. */
const MIN_CAMERA_HEIGHT = 2.3;

const minDistance = (fit: number) => Math.max(MIN_DISTANCE, fit * ZOOM_IN);
const maxDistance = (fit: number) => fit * ZOOM_OUT;

/** Imperative handle for the on-screen zoom buttons. */
export interface CameraApi {
  /** Smoothly zoom by a factor (< 1 zooms in). */
  zoomBy(factor: number): void;
  /** The child did something: hold off the idle camera drift. */
  poke(): void;
}

const tmpOffset = new THREE.Vector3();
const tmpShift = new THREE.Vector3();
/** Half-extent of the island we want in frame (world units). */
const FRAME_HALF = 7.4;

/** Distance that frames the island for a given aspect ratio and vertical fov. */
function fitDistance(aspect: number, fovDeg: number): number {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
  const tanH = tanV * aspect;
  const byWidth = FRAME_HALF / Math.max(0.05, tanH);
  const byHeight = (FRAME_HALF * 0.82) / tanV;
  // On narrow portrait screens we accept a slight crop rather than a tiny island.
  return clamp(Math.max(byWidth * (aspect < 1 ? 0.74 : 1), byHeight), 15, 30);
}

interface ArrivalTimeline {
  inEnd: number;
  holdEnd: number;
  outEnd: number;
}
// The drop lands at ~1.6s (behaviour.ts); hold ~1.5s on the landed panda.
const TIMELINE: ArrivalTimeline = { inEnd: 1.35, holdEnd: 3.15, outEnd: 4.5 };
const TIMELINE_REDUCED: ArrivalTimeline = { inEnd: 0.45, holdEnd: 2.4, outEnd: 2.85 };
/** Give up waiting for an arrival panda that never appears. */
const MISSING_TIMEOUT = 1.2;

interface ArrivalRun {
  id: string;
  t: number;
  missing: number;
  startPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  focus: THREE.Vector3;
  shot: THREE.Vector3;
  haveFocus: boolean;
}

export interface CameraRigProps {
  herd: RefObject<HerdApi | null>;
  arrivalPandaId?: string;
  onArrivalDone?: () => void;
  reducedMotion: boolean;
  apiRef?: RefObject<CameraApi | null>;
}

export function CameraRig({ herd, arrivalPandaId, onArrivalDone, reducedMotion, apiRef }: CameraRigProps) {
  const controls = useRef<Controls>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const idle = useRef(0);
  const run = useRef<ArrivalRun | null>(null);
  const doneRef = useRef(onArrivalDone);
  useEffect(() => {
    doneRef.current = onArrivalDone;
  }, [onArrivalDone]);
  const base = useRef(fitDistance(aspect, camera.fov));
  /** Distance the +/- buttons are easing towards (null when not zooming). */
  const zoomGoal = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      zoomBy(factor) {
        const c = controls.current;
        if (!c || run.current) return;
        const from = zoomGoal.current ?? camera.position.distanceTo(c.target);
        zoomGoal.current = clamp(from * factor, minDistance(base.current), maxDistance(base.current));
        idle.current = 0;
      },
      poke() {
        idle.current = 0;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera]);

  // Fit the view to the canvas aspect.
  useLayoutEffect(() => {
    const d = fitDistance(aspect, camera.fov);
    base.current = d;
    const c = controls.current;
    if (c) {
      c.minDistance = minDistance(d);
      c.maxDistance = maxDistance(d);
    }
    zoomGoal.current = null;
    if (run.current) return;
    const dir = camera.position.clone().sub(TARGET);
    if (dir.lengthSq() < 1e-6 || !c) {
      // Initial placement: front-right three-quarter view.
      dir.setFromSphericalCoords(1, POLAR, 0.55);
    }
    dir.normalize().multiplyScalar(d);
    camera.position.copy(TARGET).add(dir);
    camera.lookAt(TARGET);
    c?.target.copy(TARGET);
    c?.update();
  }, [aspect, camera]);

  // Start / abort arrivals when the prop changes.
  useEffect(() => {
    const c = controls.current;
    if (!arrivalPandaId) {
      if (run.current && c) {
        camera.position.copy(run.current.startPos);
        c.target.copy(run.current.startTarget);
        c.enabled = true;
      }
      run.current = null;
      return;
    }
    if (run.current?.id === arrivalPandaId) return;
    const prev = run.current;
    run.current = {
      id: arrivalPandaId,
      t: 0,
      missing: 0,
      startPos: prev ? prev.startPos : camera.position.clone(),
      startTarget: prev ? prev.startTarget : (c?.target.clone() ?? TARGET.clone()),
      focus: new THREE.Vector3(),
      shot: new THREE.Vector3(),
      haveFocus: false,
    };
    idle.current = 0;
  }, [arrivalPandaId, camera]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(delta, 0.1);
    const r = run.current;
    if (!r) {
      idle.current += dt;
      c.autoRotate = !reducedMotion && idle.current > IDLE_BEFORE_ROTATE;

      // Button zoom: ease the distance towards the goal along the current view direction.
      tmpOffset.copy(camera.position).sub(c.target);
      let dist = tmpOffset.length();
      const goal = zoomGoal.current;
      if (goal !== null && dist > 1e-3) {
        const next = Math.abs(goal - dist) < 0.02 ? goal : damp(dist, goal, reducedMotion ? 30 : 7, dt);
        camera.position.copy(c.target).addScaledVector(tmpOffset, next / dist);
        dist = next;
        if (next === goal) zoomGoal.current = null;
      }

      // Zooming in may pull the view towards a panda, but the look-at point stays over the
      // island, and slides back to the centre as the view zooms out again.
      const min = c.minDistance;
      const near = 1 - smoothstep(min, Math.max(min + 0.1, base.current), dist);
      const roam = ROAM * near;
      tmpShift.set(-c.target.x, TARGET.y - c.target.y, -c.target.z);
      const off = Math.hypot(c.target.x, c.target.z);
      const pull = off > roam ? 1 - roam / off : 0;
      tmpShift.x *= pull;
      tmpShift.z *= pull;
      if (tmpShift.lengthSq() > 1e-10) {
        c.target.add(tmpShift);
        camera.position.add(tmpShift);
      }
      // Up close, keep the camera above the meadow.
      c.maxPolarAngle = Math.min(MAX_POLAR, Math.acos(clamp(MIN_CAMERA_HEIGHT / Math.max(dist, 0.1), 0, 1)));
      return;
    }

    zoomGoal.current = null;
    c.autoRotate = false;
    c.enabled = false;
    const tl = reducedMotion ? TIMELINE_REDUCED : TIMELINE;
    r.t += dt;

    const p = new THREE.Vector3();
    if (herd.current?.getPandaPosition(r.id, p)) {
      r.focus.set(p.x, p.y + 0.62, p.z);
      // Approach along the current viewing direction, a little lower than the overview.
      const dir = r.startPos.clone().sub(r.focus);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      r.shot.copy(r.focus).addScaledVector(dir, 4.4);
      r.shot.y += 1.9;
      r.haveFocus = true;
    } else if (!r.haveFocus) {
      r.missing += dt;
      if (r.missing > MISSING_TIMEOUT) {
        finish(r, c);
      }
      return;
    }

    let w: number;
    if (r.t < tl.inEnd) w = easeInOutCubic(r.t / tl.inEnd);
    else if (r.t < tl.holdEnd) w = 1;
    else if (r.t < tl.outEnd) w = 1 - easeInOutCubic((r.t - tl.holdEnd) / (tl.outEnd - tl.holdEnd));
    else {
      finish(r, c);
      return;
    }
    camera.position.lerpVectors(r.startPos, r.shot, w);
    c.target.lerpVectors(r.startTarget, r.focus, w);
    camera.lookAt(c.target);
  });

  function finish(r: ArrivalRun, c: Controls) {
    camera.position.copy(r.startPos);
    c.target.copy(r.startTarget);
    c.enabled = true;
    c.update();
    run.current = null;
    idle.current = 0;
    doneRef.current?.();
  }

  const d = base.current;
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      zoomToCursor
      minDistance={minDistance(d)}
      maxDistance={maxDistance(d)}
      minPolarAngle={0.5}
      autoRotateSpeed={0.35}
      onStart={() => {
        idle.current = 0;
        zoomGoal.current = null;
      }}
    />
  );
}
