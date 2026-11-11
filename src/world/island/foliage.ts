/**
 * Instanced foliage: grass tufts, flowers and segmented bamboo (one draw call each).
 * Instances are generated in random order, so lowering `count` thins density uniformly.
 */
import * as THREE from 'three';
import { merge, piece, trs } from '../geom';
import { mulberry32, smoothstep } from '../random';
import { BAMBOO, OBSTACLES, POND, edgeRadius, heightAt, pondDistance } from './layout';

export interface InstanceSet {
  geometry: THREE.BufferGeometry;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

function gradientY(bottom: string, top: string, h: number) {
  const b = new THREE.Color(bottom);
  const t = new THREE.Color(top);
  return (p: THREE.Vector3) => b.clone().lerp(t, smoothstep(0, h, p.y));
}

function nearObstacle(x: number, z: number, pad: number): boolean {
  for (const o of OBSTACLES.slice(1)) if (Math.hypot(x - o.x, z - o.z) < o.r * 0.75 + pad) return true;
  return false;
}

function onIsland(x: number, z: number, inset: number): boolean {
  return Math.hypot(x, z) < edgeRadius(Math.atan2(z, x)) - inset;
}

// ---------------- Grass ----------------
function tuftGeometry(): THREE.BufferGeometry {
  const blade = new THREE.ConeGeometry(0.032, 0.27, 5, 3);
  blade.translate(0, 0.135, 0);
  const parts: THREE.BufferGeometry[] = [];
  const paint = gradientY('#5f9c5c', '#c6e9a2', 0.27);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.4;
    const lean = 0.28 + (i % 3) * 0.12;
    const s = 0.75 + ((i * 37) % 10) / 22;
    parts.push(
      piece(blade, trs(Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035, 1, s, 1, Math.sin(a) * lean, 0, -Math.cos(a) * lean), paint),
    );
  }
  return merge(parts);
}

export function buildGrass(max = 560): InstanceSet {
  const rnd = mulberry32(9001);
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  let guard = 0;
  while (matrices.length < max && guard++ < max * 40) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 6.2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!onIsland(x, z, 0.32)) continue;
    const pd = pondDistance(x, z);
    if (pd < POND.r * 1.08) continue;
    if (nearObstacle(x, z, 0.02)) continue;
    // Denser near the rim, the pond shore and around obstacles.
    let near = 0;
    for (const o of OBSTACLES) near = Math.max(near, 1 - smoothstep(o.r, o.r + 1.1, Math.hypot(x - o.x, z - o.z)));
    const rim = smoothstep(3.6, 5.6, r);
    if (rnd() > 0.28 + near * 0.6 + rim * 0.4) continue;
    const s = 0.75 + rnd() * 0.7;
    matrices.push(trs(x, heightAt(x, z) - 0.02, z, s, s * (0.8 + rnd() * 0.5), s, 0, rnd() * Math.PI * 2, 0));
    const k = 0.88 + rnd() * 0.22;
    colors.push(new THREE.Color(k, k * (0.98 + rnd() * 0.06), k * 0.95));
  }
  return { geometry: tuftGeometry(), matrices, colors };
}

// ---------------- Flowers ----------------
function flowerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = new THREE.CylinderGeometry(0.007, 0.009, 0.17, 5);
  parts.push(piece(stem, trs(0, 0.085, 0), '#6fa864', { aTint: 0 }));
  const petal = new THREE.SphereGeometry(1, 10, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(
      piece(petal, trs(Math.cos(a) * 0.032, 0.172, Math.sin(a) * 0.032, 0.034, 0.012, 0.022, 0, -a, 0.15), '#ffffff', {
        aTint: 1,
      }),
    );
  }
  parts.push(piece(petal, trs(0, 0.18, 0, 0.019, 0.014, 0.019), '#ffd36b', { aTint: 0 }));
  const leaf = new THREE.SphereGeometry(1, 8, 5);
  parts.push(piece(leaf, trs(0.03, 0.05, 0, 0.04, 0.006, 0.016, 0, 0, 0.5), '#79b46a', { aTint: 0 }));
  return merge(parts);
}

const FLOWER_COLORS = ['#ffb3c7', '#f7a6b8', '#c9b5f2', '#ffe08f', '#ffffff', '#ffc8a2', '#b8d8ff'];

export function buildFlowers(max = 190): InstanceSet {
  const rnd = mulberry32(4242);
  const patches: { x: number; z: number; c: number }[] = [];
  while (patches.length < 16) {
    const a = rnd() * Math.PI * 2;
    const r = 1 + Math.sqrt(rnd()) * 4.3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (pondDistance(x, z) < POND.r * 1.5 || nearObstacle(x, z, 0.2)) continue;
    patches.push({ x, z, c: Math.floor(rnd() * FLOWER_COLORS.length) });
  }
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  let guard = 0;
  while (matrices.length < max && guard++ < max * 30) {
    const p = patches[Math.floor(rnd() * patches.length)];
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * 0.75;
    const x = p.x + Math.cos(a) * d;
    const z = p.z + Math.sin(a) * d;
    if (!onIsland(x, z, 0.45) || pondDistance(x, z) < POND.r * 1.2 || nearObstacle(x, z, 0.05)) continue;
    const s = 0.8 + rnd() * 0.55;
    matrices.push(trs(x, heightAt(x, z) - 0.01, z, s, s * (0.85 + rnd() * 0.4), s, (rnd() - 0.5) * 0.3, rnd() * 6.28, (rnd() - 0.5) * 0.3));
    const ci = rnd() < 0.8 ? p.c : Math.floor(rnd() * FLOWER_COLORS.length);
    colors.push(new THREE.Color(FLOWER_COLORS[ci]));
  }
  return { geometry: flowerGeometry(), matrices, colors };
}

// ---------------- Bamboo ----------------
const SEG_LEN = 0.34;

function segmentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stalk = new THREE.CylinderGeometry(0.047, 0.052, SEG_LEN, 10, 2, true);
  parts.push(piece(stalk, trs(0, SEG_LEN / 2, 0), gradientY('#7fbb5e', '#a4d57c', SEG_LEN)));
  const node = new THREE.CylinderGeometry(0.058, 0.058, 0.03, 10, 1, false);
  parts.push(piece(node, trs(0, SEG_LEN - 0.012, 0), '#c3e39a'));
  return merge(parts);
}

function leafGeometry(): THREE.BufferGeometry {
  const leaf = new THREE.SphereGeometry(1, 10, 6);
  return merge([
    piece(leaf, trs(0.15, 0, 0, 0.16, 0.012, 0.036), (p) =>
      new THREE.Color('#6fb257').lerp(new THREE.Color('#b0dc84'), smoothstep(0, 0.3, p.x)),
    ),
  ]);
}

export function buildBamboo(): { segments: InstanceSet; leaves: InstanceSet } {
  const seg: THREE.Matrix4[] = [];
  const segC: THREE.Color[] = [];
  const leaves: THREE.Matrix4[] = [];
  const leafC: THREE.Color[] = [];
  const q = new THREE.Quaternion();
  const ql = new THREE.Quaternion();
  const e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  for (const clump of BAMBOO) {
    const rnd = mulberry32(clump.seed * 131);
    for (let i = 0; i < clump.stalks; i++) {
      const a = (i / clump.stalks) * Math.PI * 2 + rnd() * 0.8;
      const d = i === 0 ? 0.05 : clump.r * (0.35 + rnd() * 0.45);
      const bx = clump.x + Math.cos(a) * d;
      const bz = clump.z + Math.sin(a) * d;
      const by = heightAt(bx, bz) - 0.05;
      const tilt = 0.04 + (d / clump.r) * 0.14 + rnd() * 0.04;
      q.setFromEuler(e.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt));
      const axis = up.clone().applyQuaternion(q);
      const n = 5 + Math.floor(rnd() * 4);
      const tint = 0.9 + rnd() * 0.18;
      for (let s = 0; s < n; s++) {
        const p = new THREE.Vector3(bx, by, bz).addScaledVector(axis, s * SEG_LEN);
        const taper = 1 - (s / n) * 0.25;
        seg.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(taper, 1, taper)));
        segC.push(new THREE.Color(tint, tint, tint * 0.96));
        const isTop = s === n - 1;
        if (s >= n - 3) {
          const count = isTop ? 4 : 2;
          for (let l = 0; l < count; l++) {
            const yaw = rnd() * Math.PI * 2;
            const droop = isTop ? 0.2 + rnd() * 0.5 : -0.25 - rnd() * 0.45;
            ql.setFromEuler(e.set(0, yaw, droop, 'YXZ'));
            const lp = p.clone().addScaledVector(axis, SEG_LEN * (isTop ? 1 : 0.95));
            const sc = 0.8 + rnd() * 0.45;
            leaves.push(new THREE.Matrix4().compose(lp, q.clone().multiply(ql), new THREE.Vector3(sc, 1, sc)));
            const lk = 0.88 + rnd() * 0.2;
            leafC.push(new THREE.Color(lk, lk, lk));
          }
        }
      }
    }
  }
  return {
    segments: { geometry: segmentGeometry(), matrices: seg, colors: segC },
    leaves: { geometry: leafGeometry(), matrices: leaves, colors: leafC },
  };
}
