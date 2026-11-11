/**
 * Floating-island terrain: one indexed, vertex-coloured surface swept around the
 * outline — grassy meadow top, rounded rim, then layered earthy strata tapering to a tip.
 * Baked vertex-colour darkening near decor bases gives a soft ambient-occlusion feel.
 */
import * as THREE from 'three';
import { smoothstep } from '../random';
import { snoise } from '../geom';
import {
  BAMBOO,
  BUSHES,
  POND,
  RIM,
  ROCKS,
  TREES,
  edgeRadius,
  heightAt,
  pondDistance,
} from './layout';

const SEG = 128;
const TOP_RINGS = 22;
const RIM_STEPS = 6;

const GRASS_A = new THREE.Color('#a6d98c');
const GRASS_B = new THREE.Color('#8fcb7e');
const GRASS_LIGHT = new THREE.Color('#bfe6a0');
const GRASS_EDGE = new THREE.Color('#86c078');
const SAND = new THREE.Color('#eedcb2');
const POND_BED = new THREE.Color('#9fcfc0');

/** Strata from top (just under the grass lip) to the tip. */
const LAYERS = [
  { h: 0.5, rf: 0.985, color: '#a67c63' },
  { h: 0.75, rf: 0.9, color: '#c8977a' },
  { h: 0.8, rf: 0.76, color: '#e1b48d' },
  { h: 0.85, rf: 0.58, color: '#eccaa0' },
  { h: 0.9, rf: 0.38, color: '#c4a593' },
  { h: 0.75, rf: 0.18, color: '#a9918a' },
];

const AO_SOURCES = [
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: t.r * 1.35, k: 0.32 })),
  ...BAMBOO.map((b) => ({ x: b.x, z: b.z, r: b.r * 1.3, k: 0.28 })),
  ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: r.r * 1.1, k: 0.3 })),
  ...BUSHES.map((b) => ({ x: b.x, z: b.z, r: b.r * 1.15, k: 0.28 })),
];

function topColor(x: number, z: number, edgeT: number): THREE.Color {
  const n = snoise(x * 0.55, 0.3, z * 0.55) * 0.5 + 0.5;
  const n2 = snoise(x * 1.7 + 3, 1.1, z * 1.7 - 2) * 0.5 + 0.5;
  const c = GRASS_A.clone().lerp(GRASS_B, smoothstep(0.35, 0.75, n));
  c.lerp(GRASS_LIGHT, smoothstep(0.62, 0.95, n2) * 0.45);
  // Darker grass rolling over the rim.
  c.lerp(GRASS_EDGE, edgeT * 0.6);
  // Sandy shore around the pond.
  const pd = pondDistance(x, z);
  const shore = smoothstep(POND.r * 1.42, POND.r * 1.02, pd);
  c.lerp(SAND, shore * 0.9);
  c.lerp(POND_BED, smoothstep(POND.r * 0.92, POND.r * 0.62, pd));
  // Baked contact darkening around decor bases.
  let ao = 1;
  for (const s of AO_SOURCES) {
    const d = Math.hypot(x - s.x, z - s.z);
    ao -= s.k * (1 - smoothstep(s.r * 0.6, s.r * 1.9, d));
  }
  return c.multiplyScalar(Math.max(0.6, ao));
}

export function buildTerrain(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const rows: number[] = []; // start index of each ring
  const push = (x: number, y: number, z: number, c: THREE.Color) => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b);
  };

  // Centre pole.
  push(0, heightAt(0, 0), 0, topColor(0, 0, 0));
  const theta = (k: number) => (k / SEG) * Math.PI * 2;

  // Meadow rings.
  for (let i = 1; i <= TOP_RINGS; i++) {
    rows.push(positions.length / 3);
    const f = i / TOP_RINGS;
    for (let k = 0; k < SEG; k++) {
      const th = theta(k);
      const r = f * (edgeRadius(th) - RIM);
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      push(x, heightAt(x, z), z, topColor(x, z, smoothstep(0.9, 1, f) * 0.3));
    }
  }

  // Rounded rim (quarter circle).
  for (let j = 1; j <= RIM_STEPS; j++) {
    rows.push(positions.length / 3);
    const ang = (j / RIM_STEPS) * (Math.PI / 2);
    for (let k = 0; k < SEG; k++) {
      const th = theta(k);
      const re = edgeRadius(th);
      const ex = Math.cos(th) * (re - RIM);
      const ez = Math.sin(th) * (re - RIM);
      const y0 = heightAt(ex, ez);
      const r = re - RIM + RIM * Math.sin(ang);
      const y = y0 - RIM * (1 - Math.cos(ang));
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const c = topColor(ex, ez, 0.3 + 0.7 * (j / RIM_STEPS));
      push(x, y, z, c.multiplyScalar(1 - 0.12 * (j / RIM_STEPS)));
    }
  }

  // Underside strata. Each layer bulges slightly then tucks in, giving soft ledges.
  let depth = 0;
  const STEPS = 6;
  for (let li = 0; li < LAYERS.length; li++) {
    const L = LAYERS[li];
    const nextRf = li + 1 < LAYERS.length ? LAYERS[li + 1].rf : 0.02;
    const base = new THREE.Color(L.color);
    for (let s = 1; s <= STEPS; s++) {
      rows.push(positions.length / 3);
      const u = s / STEPS;
      const d = depth + u * L.h;
      const rf = L.rf + (nextRf - L.rf) * Math.pow(u, 2.2) + 0.03 * Math.sin(Math.PI * u) * L.rf;
      for (let k = 0; k < SEG; k++) {
        const th = theta(k);
        const re = edgeRadius(th);
        const ex = Math.cos(th) * (re - RIM);
        const ez = Math.sin(th) * (re - RIM);
        const yTop = heightAt(ex, ez) - RIM;
        const lump =
          1 +
          smoothstep(0, 0.6, d) *
            (0.05 * Math.sin(7 * th + d * 2.1) +
              0.035 * Math.sin(13 * th - d * 3.7 + 1.3) +
              0.02 * Math.sin(23 * th + d * 5.1));
        const r = re * rf * lump;
        const y = yTop - d - 0.06 * Math.sin(5 * th + li);
        const c = base.clone();
        // Soft shading: darker just under each ledge, lighter towards its bulge.
        c.multiplyScalar(0.84 + 0.2 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
        c.multiplyScalar(0.96 + 0.08 * snoise(th * 4, d * 2, li));
        if (li === 0 && u < 0.35) c.lerp(GRASS_EDGE, (1 - u / 0.35) * 0.55);
        push(Math.cos(th) * r, y, Math.sin(th) * r, c);
      }
    }
    depth += L.h;
  }
  // Bottom tip pole.
  const tip = positions.length / 3;
  push(0.15, heightAt(0, 0) - RIM - depth - 0.25, -0.1, new THREE.Color('#9a8580'));

  const index: number[] = [];
  // Top fan.
  for (let k = 0; k < SEG; k++) {
    const k1 = (k + 1) % SEG;
    index.push(0, rows[0] + k1, rows[0] + k);
  }
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    for (let k = 0; k < SEG; k++) {
      const k1 = (k + 1) % SEG;
      index.push(a + k, b + k1, b + k);
      index.push(a + k, a + k1, b + k1);
    }
  }
  const last = rows[rows.length - 1];
  for (let k = 0; k < SEG; k++) {
    const k1 = (k + 1) % SEG;
    index.push(last + k, last + k1, tip);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
