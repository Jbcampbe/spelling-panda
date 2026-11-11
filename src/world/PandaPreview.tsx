import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PandaColor } from '../types';
import { getBlobMaterial, tickWorldTime } from './materials';
import { animateRig, createPose } from './panda/animate';
import { PREVIEW_BEHAVIOUR, createBrain, startReaction, stepBrain, type Environment } from './panda/behaviour';
import { createPandaRig, setRigColor } from './panda/rig';
import './world.css';

export interface PandaPreviewProps {
  color: PandaColor;
  name?: string;
}

const OPEN_GROUND: Environment = {
  isWalkable: () => true,
  obstaclePush: () => ({ x: 0, z: 0 }),
  segmentClear: () => true,
  randomPoint: () => ({ x: 0, z: 0 }),
};

function PreviewPanda({ color }: { color: PandaColor }) {
  const rig = useMemo(() => createPandaRig(color), []); // eslint-disable-line react-hooks/exhaustive-deps
  const brain = useMemo(() => createBrain(0, 0, 0, 0x51a7e), []);
  const pose = useMemo(() => createPose(0), []);
  const gl = useThree((s) => s.gl);
  const first = useRef(true);

  // Live colour swap with a happy hop.
  useEffect(() => {
    setRigColor(rig, color);
    if (first.current) {
      first.current = false;
      return;
    }
    startReaction(brain, 'hop');
  }, [color, rig, brain]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    stepBrain(brain, dt, [], OPEN_GROUND, PREVIEW_BEHAVIOUR);
    brain.x = 0;
    brain.z = 0;
    // Slow, gentle turn so every side of the panda gets shown.
    if (brain.activity !== 'react') brain.heading = Math.sin(t * 0.35) * 0.75;
    animateRig(rig, brain, pose, dt, t);
    if (gl.toneMapping !== THREE.NeutralToneMapping) gl.toneMapping = THREE.NeutralToneMapping;
  });

  return (
    <primitive
      object={rig.root}
      dispose={null}
      onClick={(e: { stopPropagation: () => void; delta: number }) => {
        e.stopPropagation();
        if (e.delta < 8 && brain.activity !== 'react') startReaction(brain);
      }}
    />
  );
}

function Pedestal() {
  const top = useMemo(() => new THREE.CylinderGeometry(0.82, 0.74, 0.16, 48), []);
  const blob = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.25, 1.25);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={top} position={[0, -0.08, 0]}>
        <meshStandardMaterial color="#c7ebb5" roughness={0.9} />
      </mesh>
      <mesh geometry={blob} position={[0, 0.004, 0]} material={getBlobMaterial()} />
    </group>
  );
}

function Time() {
  useFrame(() => tickWorldTime(), -2);
  return null;
}

/** A small self-contained 3D preview of one idling panda (lazy-loadable). */
export default function PandaPreview({ color, name }: PandaPreviewProps) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return (
    <div className="pw-preview">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 30, position: [0, 1.3, 4.6], near: 0.1, far: 20 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Time />
        <hemisphereLight args={['#fff3e6', '#b9d4b0', 1.2]} />
        <ambientLight intensity={0.3} color="#f3ecff" />
        <directionalLight position={[2.5, 4, 3]} intensity={2.1} color="#fff1dc" />
        <directionalLight position={[-3, 2, -3]} intensity={0.6} color="#d8dcff" />
        <Pedestal />
        <PreviewPanda color={color} />
      </Canvas>
      {name && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div className="pw-label">{name}</div>
        </div>
      )}
    </div>
  );
}
