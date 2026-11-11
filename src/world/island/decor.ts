/**
 * Static decor merged into a single vertex-coloured mesh (one draw call): rounded trees,
 * bushes, rocks, mushrooms, pond pebbles and lily pads. Vertex colours carry a soft
 * top-light gradient plus contact darkening near the ground (baked AO feel).
 */
import * as THREE from 'three';
import { merge, piece, snoise, trs } from '../geom';
import { mulberry32, smoothstep } from '../random';
import {
  BUSHES,
  MUSHROOMS,
  POND,
  ROCKS,
  TREES,
  WATER_LEVEL,
  heightAt,
  type TreeKind,
} from './layout';

const FOLIAGE: Record<TreeKind, [string, string]> = {
  green: ['#6fb36d', '#b4e08f'],
  blossom: ['#eea0b6', '#ffd9e2'],
  mint: ['#6fbf9d', '#bdebc9'],
};
const BUSH: Record<string, [string, string]> = {
  green: ['#78b96e', '#b9e293'],
  sage: ['#8fb68a', '#cde2b6'],
  berry: ['#7fb873', '#bfe39a'],
};

/** Gradient paint: dark underside → light crown, with ground contact AO. */
function gradient(dark: string, light: string, aoStrength = 0.35) {
  const cd = new THREE.Color(dark);
  const cl = new THREE.Color(light);
  return (p: THREE.Vector3, n: THREE.Vector3) => {
    const t = smoothstep(-0.6, 0.9, n.y * 0.8 + 0.15 * snoise(p.x * 3, p.y * 3, p.z * 3));
    const c = cd.clone().lerp(cl, t);
    const h = p.y - heightAt(p.x, p.z);
    return c.multiplyScalar(1 - aoStrength * (1 - smoothstep(0.0, 0.45, h)));
  };
}

function lumpy(detail: number, seed: number, amount: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const merged = new THREE.BufferGeometry();
  // Icosahedron is non-indexed; weld vertices so displacement keeps it watertight.
  const pos = g.attributes.position as THREE.BufferAttribute;
  const map = new Map<string, number>();
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let j = map.get(key);
    if (j === undefined) {
      const n = snoise(x * 2.1 + seed, y * 2.1 - seed, z * 2.1 + seed * 0.5);
      const k = 1 + n * amount;
      j = verts.length / 3;
      verts.push(x * k, y * k, z * k);
      map.set(key, j);
    }
    idx.push(j);
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  merged.setIndex(idx);
  merged.computeVertexNormals();
  g.dispose();
  return merged;
}

export function buildStaticDecor(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const sphere = new THREE.SphereGeometry(1, 22, 16);
  const smallSphere = new THREE.SphereGeometry(1, 14, 10);

  // ---- Trees ----
  for (const [i, t] of TREES.entries()) {
    const rnd = mulberry32(100 + i);
    const y0 = heightAt(t.x, t.z);
    const s = t.s;
    const trunkH = 1.05 * s;
    const trunk = new THREE.CylinderGeometry(0.1 * s, 0.17 * s, trunkH, 12, 4);
    parts.push(piece(trunk, trs(t.x, y0 + trunkH / 2 - 0.05, t.z), gradient('#8d6a55', '#b8917a', 0.3)));
    // Root flare.
    parts.push(piece(smallSphere, trs(t.x, y0, t.z, 0.24 * s, 0.1 * s, 0.24 * s), '#9c7863'));
    const [dark, light] = FOLIAGE[t.kind];
    const crownY = y0 + trunkH + 0.35 * s;
    const blobs = [
      [0, 0.2, 0, 0.72],
      [0.42, -0.05, 0.18, 0.52],
      [-0.38, -0.02, -0.12, 0.55],
      [0.05, -0.1, -0.42, 0.5],
      [-0.1, 0.62, 0.08, 0.46],
    ];
    for (const [bx, by, bz, br] of blobs) {
      const j = 0.9 + rnd() * 0.2;
      parts.push(
        piece(
          sphere,
          trs(t.x + bx * s, crownY + by * s, t.z + bz * s, br * s * j, br * s * j * 0.92, br * s * j),
          gradient(dark, light, 0),
        ),
      );
    }
  }

  // ---- Bushes ----
  for (const b of BUSHES) {
    const rnd = mulberry32(200 + b.seed);
    const y0 = heightAt(b.x, b.z);
    const [dark, light] = BUSH[b.tint];
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const d = i === 0 ? 0 : b.r * 0.55;
      const r = b.r * (i === 0 ? 0.85 : 0.6 + rnd() * 0.15);
      parts.push(
        piece(
          sphere,
          trs(b.x + Math.cos(a) * d, y0 + r * 0.55, b.z + Math.sin(a) * d, r, r * 0.82, r),
          gradient(dark, light),
        ),
      );
    }
    if (b.tint === 'berry') {
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2;
        const el = 0.3 + rnd() * 0.8;
        const r = b.r * 0.86;
        parts.push(
          piece(
            smallSphere,
            trs(b.x + Math.cos(a) * Math.cos(el) * r, y0 + 0.3 + Math.sin(el) * r * 0.7, b.z + Math.sin(a) * Math.cos(el) * r, 0.045),
            '#f08ea0',
          ),
        );
      }
    }
  }

  // ---- Rocks ----
  for (const r of ROCKS) {
    const y0 = heightAt(r.x, r.z);
    const g = lumpy(2, r.seed * 1.7, 0.16);
    parts.push(
      piece(g, trs(r.x, y0 + r.h * 0.35, r.z, r.r, r.h, r.r * 0.85, 0, r.seed, 0), gradient('#a9a39f', '#e7e1da', 0.25)),
    );
    g.dispose();
  }

  // ---- Mushrooms ----
  const stem = new THREE.CylinderGeometry(0.035, 0.045, 0.14, 10);
  const cap = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const m of MUSHROOMS) {
    const y0 = heightAt(m.x, m.z);
    parts.push(piece(stem, trs(m.x, y0 + 0.07 * m.s, m.z, m.s), '#fbf1e2'));
    parts.push(piece(cap, trs(m.x, y0 + 0.13 * m.s, m.z, 0.1 * m.s, 0.075 * m.s, 0.1 * m.s), gradient('#e8877c', '#f7b2a3', 0)));
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + m.x;
      parts.push(
        piece(
          smallSphere,
          trs(m.x + Math.cos(a) * 0.055 * m.s, y0 + 0.19 * m.s, m.z + Math.sin(a) * 0.055 * m.s, 0.017 * m.s, 0.008 * m.s, 0.017 * m.s),
          '#fff6ea',
        ),
      );
    }
  }

  // ---- Pond pebbles ----
  const rnd = mulberry32(77);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.15;
    const d = POND.r * (1.04 + rnd() * 0.12);
    const x = POND.x + Math.cos(a) * d;
    const z = POND.z + Math.sin(a) * d;
    const s = 0.06 + rnd() * 0.07;
    parts.push(
      piece(
        smallSphere,
        trs(x, heightAt(x, z) + s * 0.15, z, s, s * 0.55, s * 0.85, 0, a, 0),
        gradient('#b9b2ad', '#f2ede6', 0.15),
      ),
    );
  }

  // ---- Lily pads + a lotus ----
  const pad = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0.3, Math.PI * 2 - 0.6);
  const pads = [
    [POND.x - 0.35, POND.z + 0.25, 0.22, 0.4],
    [POND.x + 0.4, POND.z - 0.3, 0.18, 2.2],
    [POND.x + 0.1, POND.z + 0.55, 0.15, 4.1],
  ];
  for (const [x, z, r, rot] of pads) {
    parts.push(piece(pad, trs(x, WATER_LEVEL + 0.012, z, r, 0.018, r, 0, rot, 0), gradient('#6fb779', '#a6dc96', 0)));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(
      piece(
        smallSphere,
        trs(POND.x - 0.35 + Math.cos(a) * 0.05, WATER_LEVEL + 0.07, POND.z + 0.25 + Math.sin(a) * 0.05, 0.05, 0.035, 0.03, 0.5, -a, 0),
        '#f9c3d2',
      ),
    );
  }
  parts.push(piece(smallSphere, trs(POND.x - 0.35, WATER_LEVEL + 0.09, POND.z + 0.25, 0.03), '#ffe08a'));

  return merge(parts);
}
