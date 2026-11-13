import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { sfx } from '../audio/sfxEngine';
import { CameraRig, type CameraApi } from './CameraRig';
import { Herd, type HerdApi } from './herd/Herd';
import { Clouds } from './island/Clouds';
import { Island } from './island/Island';
import { Lights } from './Lights';
import { tickWorldTime } from './materials';
import { MAX_TIER, QUALITY_TIERS, clampTier, initialTierIndex, tierDpr } from './quality';
import type { WorldProps } from './types';
import './world.css';

export type { WorldProps } from './types';

const CLOUD_COUNT = [7, 6, 5, 4];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/** Drives shared shader time and enforces our tone mapping. */
function FrameSetup() {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    tickWorldTime();
    if (gl.toneMapping !== THREE.NeutralToneMapping) {
      gl.toneMapping = THREE.NeutralToneMapping;
      gl.toneMappingExposure = 1.0;
    }
  }, -2);
  return null;
}

/** Gentle floating bob for the whole diorama. */
function Bob({ amount, children }: { amount: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = Math.sin(t * 0.42) * 0.09 * amount;
    g.rotation.z = Math.sin(t * 0.31 + 1.1) * 0.006 * amount;
    g.rotation.x = Math.sin(t * 0.27) * 0.005 * amount;
  });
  return <group ref={ref}>{children}</group>;
}

function BambooIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g transform="rotate(24 24 24)">
        <path d="M33 13c7-5 12-3 13-2-2 5-7 7-13 5z" fill="#8ed06c" />
        <path d="M15 20C8 16 3 18 2 20c3 4 8 5 13 3z" fill="#74bf58" />
        <rect x="19" y="3" width="10" height="42" rx="5" fill="#7cc35c" />
        <rect x="19" y="3" width="4" height="42" rx="2" fill="#a4dc7f" />
        <rect x="18" y="15" width="12" height="3.4" rx="1.7" fill="#4f9a45" />
        <rect x="18" y="29" width="12" height="3.4" rx="1.7" fill="#4f9a45" />
      </g>
    </svg>
  );
}

/** How far (px) the finger must travel before a press on the bamboo button becomes a drag. */
const FOOD_DRAG_PX = 10;

/**
 * Child controls drawn over the island: a bamboo snack (tap to feed a panda, or drag it
 * onto the one you want) and +/- zoom buttons.
 */
function Controls({ herd, rig }: { herd: RefObject<HerdApi | null>; rig: RefObject<CameraApi | null> }) {
  const ghost = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const [miss, setMiss] = useState(0);

  const place = (x: number, y: number) => {
    const g = ghost.current;
    if (g) g.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -70%)`;
  };
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current) return;
    sfx.unlock();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > FOOD_DRAG_PX) {
      p.dragging = true;
      ghost.current?.classList.add('is-on');
      rig.current?.poke();
    }
    if (p.dragging) place(e.clientX, e.clientY);
  };
  const end = (e: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    ghost.current?.classList.remove('is-on');
    if (cancelled) return;
    const fed = p.dragging ? herd.current?.feedAt(e.clientX, e.clientY) : herd.current?.feedAny();
    if (!fed) {
      sfx.play('tap');
      setMiss((n) => n + 1);
    }
  };
  const zoom = (factor: number) => {
    sfx.play('tap');
    rig.current?.zoomBy(factor);
  };

  return (
    <div className="pw-controls">
      <button
        key={miss}
        type="button"
        className={miss ? 'pw-btn pw-food pw-food--miss' : 'pw-btn pw-food'}
        aria-label="Feed a panda"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <BambooIcon size={40} />
      </button>
      <div className="pw-zoom">
        <button type="button" className="pw-btn" aria-label="Zoom in" onClick={() => zoom(0.7)}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="pw-btn" aria-label="Zoom out" onClick={() => zoom(1 / 0.7)}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div ref={ghost} className="pw-food-ghost">
        <BambooIcon size={64} />
      </div>
    </div>
  );
}

export default function World(props: WorldProps) {
  const {
    pandas,
    paused,
    dimmed = false,
    arrivalPandaId,
    onArrivalDone,
    evictedPandaIds,
    onPandaTap,
    onPandaCapChange,
    forceQualityTier,
  } = props;
  const prefersReduced = usePrefersReducedMotion();
  const reducedMotion = props.reducedMotion ?? prefersReduced;
  const visible = usePageVisible();

  const forced = forceQualityTier === undefined ? null : clampTier(forceQualityTier);
  const [startTier] = useState(initialTierIndex);
  const [adaptiveTier, setAdaptiveTier] = useState(startTier);
  const tierIndex = forced ?? adaptiveTier;
  const tier = QUALITY_TIERS[tierIndex];
  // Grass/flower density is fixed at the starting tier: changing it mid-session makes a chunk of
  // the foliage pop out of view, and the instanced draw cost it saves is tiny (DPR and shadows do
  // the real work when the adaptive tier drops).
  const decorDensity = QUALITY_TIERS[forced ?? startTier].decorDensity;

  const capRef = useRef(onPandaCapChange);
  useEffect(() => {
    capRef.current = onPandaCapChange;
  }, [onPandaCapChange]);
  useEffect(() => {
    capRef.current?.(tier.pandaCap);
  }, [tier.pandaCap]);

  // Never render more than the tier's cap (keep an arriving panda in view).
  const shown = useMemo(() => {
    if (pandas.length <= tier.pandaCap) return pandas;
    const head = pandas.slice(0, tier.pandaCap);
    if (arrivalPandaId && !head.some((p) => p.id === arrivalPandaId)) {
      const arriving = pandas.find((p) => p.id === arrivalPandaId);
      if (arriving) head[head.length - 1] = arriving;
    }
    return head;
  }, [pandas, tier.pandaCap, arrivalPandaId]);

  const herd = useRef<HerdApi | null>(null);
  const rig = useRef<CameraApi | null>(null);
  // Play controls only while the island is the thing on screen.
  const playable = !paused && !dimmed && !arrivalPandaId;
  const frameloop = paused || !visible ? 'never' : 'always';

  return (
    <div className={dimmed ? 'pw-world pw-world--dimmed' : 'pw-world'}>
      <Canvas
        frameloop={frameloop}
        dpr={tierDpr(tier)}
        shadows="percentage"
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true }}
        camera={{ fov: 36, near: 0.5, far: 120, position: [9, 9, 13] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {forced === null && (
          <PerformanceMonitor
            flipflops={3}
            bounds={(refresh) => (refresh > 90 ? [50, 90] : [42, 58])}
            onDecline={() => setAdaptiveTier((t) => clampTier(t + 1))}
            onIncline={() => setAdaptiveTier((t) => clampTier(t - 1))}
            onFallback={() => setAdaptiveTier(MAX_TIER - 1)}
          />
        )}
        <FrameSetup />
        <Lights shadows={tier.shadows} mapSize={tier.shadowMapSize} />
        <Bob amount={reducedMotion ? 0.3 : 1}>
          <Island decorDensity={decorDensity} shadows={tier.shadows} />
          <Herd
            pandas={shown}
            arrivalPandaId={arrivalPandaId}
            evictedPandaIds={evictedPandaIds}
            onPandaTap={onPandaTap}
            pandaShadows={tier.pandaShadows}
            apiRef={herd}
            onInteract={() => rig.current?.poke()}
          />
        </Bob>
        <Clouds count={CLOUD_COUNT[tierIndex]} animate={!reducedMotion} />
        <CameraRig
          herd={herd}
          arrivalPandaId={arrivalPandaId}
          onArrivalDone={onArrivalDone}
          reducedMotion={reducedMotion}
          apiRef={rig}
        />
      </Canvas>
      {playable && <Controls herd={herd} rig={rig} />}
    </div>
  );
}
