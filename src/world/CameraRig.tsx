import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, type ComponentRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { HerdApi } from './herd/Herd';
import { clamp, easeInOutCubic } from './random';

type Controls = ComponentRef<typeof OrbitControls>;

const TARGET = new THREE.Vector3(0, 0.1, 0);
const POLAR = 1.0; // default view angle from vertical
const IDLE_BEFORE_ROTATE = 6;
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
}

export function CameraRig({ herd, arrivalPandaId, onArrivalDone, reducedMotion }: CameraRigProps) {
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

  // Fit the view to the canvas aspect.
  useLayoutEffect(() => {
    const d = fitDistance(aspect, camera.fov);
    base.current = d;
    const c = controls.current;
    if (c) {
      c.minDistance = d * 0.62;
      c.maxDistance = d * 1.2;
    }
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
      return;
    }

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
      zoomSpeed={0.6}
      minDistance={d * 0.62}
      maxDistance={d * 1.2}
      minPolarAngle={0.5}
      maxPolarAngle={1.24}
      autoRotateSpeed={0.35}
      onStart={() => {
        idle.current = 0;
      }}
    />
  );
}
