import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { merge, mix, piece, trs } from '../geom';
import { mulberry32 } from '../random';

const SPHERE = new THREE.SphereGeometry(1, 18, 12);

function cloudGeometry(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const puffs: THREE.BufferGeometry[] = [];
  const n = 4 + Math.floor(rand() * 3);
  const paint = (p: THREE.Vector3) => mix('#e9e2fb', '#ffffff', THREE.MathUtils.clamp((p.y + 0.15) * 1.6, 0, 1));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    const r = 0.42 + rand() * 0.3 + (1 - Math.abs(u) * 1.6) * 0.25;
    puffs.push(piece(SPHERE, trs(u * 1.9, r * 0.35 - 0.05, (rand() - 0.5) * 0.4, r, r * 0.86, r), paint));
  }
  // Flat-ish base so clouds read as cartoon cumulus.
  puffs.push(piece(SPHERE, trs(0, -0.02, 0, 1.25, 0.28, 0.55), paint));
  const g = merge(puffs);
  // Flatten the underside.
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.12) pos.setY(i, -0.12 + (pos.getY(i) + 0.12) * 0.25);
  g.computeVertexNormals();
  return g;
}

interface CloudDef {
  radius: number;
  height: number;
  angle: number;
  scale: number;
  speed: number;
  seed: number;
}

const CLOUDS: CloudDef[] = [
  { radius: 14, height: 3.4, angle: 0.4, scale: 1.25, speed: 0.012, seed: 11 },
  { radius: 15.5, height: 1.6, angle: 1.9, scale: 1.0, speed: 0.009, seed: 23 },
  { radius: 14.5, height: 4.4, angle: 3.1, scale: 1.4, speed: 0.011, seed: 37 },
  { radius: 18.5, height: -3.2, angle: 4.0, scale: 1.5, speed: 0.007, seed: 41 },
  { radius: 15.5, height: -2.2, angle: 5.2, scale: 1.0, speed: 0.01, seed: 53 },
  { radius: 17.5, height: 2.6, angle: 5.9, scale: 1.2, speed: 0.008, seed: 67 },
  { radius: 17.5, height: -4.2, angle: 2.4, scale: 1.3, speed: 0.006, seed: 79 },
];

let cloudMat: THREE.MeshStandardMaterial | null = null;
function getCloudMaterial() {
  if (!cloudMat) {
    cloudMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      emissive: '#f4efff',
      emissiveIntensity: 0.35,
    });
  }
  return cloudMat;
}

export function Clouds({ count, animate }: { count: number; animate: boolean }) {
  const geos = useMemo(() => CLOUDS.map((c) => cloudGeometry(c.seed)), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    CLOUDS.forEach((c, i) => {
      const m = refs.current[i];
      if (!m) return;
      const a = c.angle + (animate ? t * c.speed : 0);
      m.position.set(Math.cos(a) * c.radius, c.height + Math.sin(t * 0.25 + c.seed) * (animate ? 0.15 : 0), Math.sin(a) * c.radius);
      m.rotation.y = -a + Math.PI / 2;
    });
  });
  return (
    <group>
      {CLOUDS.slice(0, count).map((c, i) => (
        <mesh
          key={c.seed}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={geos[i]}
          material={getCloudMaterial()}
          scale={c.scale}
        />
      ))}
    </group>
  );
}
