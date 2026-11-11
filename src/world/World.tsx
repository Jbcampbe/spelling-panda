import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
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
  const [adaptiveTier, setAdaptiveTier] = useState(initialTierIndex);
  const tierIndex = forced ?? adaptiveTier;
  const tier = QUALITY_TIERS[tierIndex];

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
          <Island decorDensity={tier.decorDensity} shadows={tier.shadows} />
          <Herd
            pandas={shown}
            arrivalPandaId={arrivalPandaId}
            evictedPandaIds={evictedPandaIds}
            onPandaTap={onPandaTap}
            pandaShadows={tier.pandaShadows}
            apiRef={herd}
          />
        </Bob>
        <Clouds count={CLOUD_COUNT[tierIndex]} animate={!reducedMotion} />
        <CameraRig
          herd={herd}
          arrivalPandaId={arrivalPandaId}
          onArrivalDone={onArrivalDone}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
