/** Procedural geometry helpers: transform, vertex-paint and merge primitives. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Paint = THREE.ColorRepresentation | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color);

const tmpP = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const tmpC = new THREE.Color();

/**
 * Clone `src`, transform it, paint vertex colours and attach extra float attributes.
 * The result has only position/normal/color (+extras) so pieces can be merged.
 */
export function piece(
  src: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  paint: Paint,
  extras: Record<string, number> = {},
): THREE.BufferGeometry {
  let g = src.clone();
  if (!g.index) g = indexed(g);
  g.applyMatrix4(matrix);
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const fixed = typeof paint === 'function' ? null : new THREE.Color(paint);
  for (let i = 0; i < pos.count; i++) {
    let c: THREE.Color;
    if (fixed) c = fixed;
    else {
      tmpP.fromBufferAttribute(pos, i);
      tmpN.fromBufferAttribute(nor, i);
      c = (paint as (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)(tmpP, tmpN);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  for (const [name, value] of Object.entries(extras)) {
    g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(pos.count).fill(value), 1));
  }
  return g;
}

function indexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = g.attributes.position.count;
  const idx = new Array<number>(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

export function merge(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(pieces, false);
  if (!g) throw new Error('mergeGeometries failed');
  for (const p of pieces) p.dispose();
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

/** Compose a TRS matrix (rotation as Euler XYZ). */
export function trs(
  px: number,
  py: number,
  pz: number,
  sx = 1,
  sy = sx,
  sz = sx,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Matrix4 {
  q.setFromEuler(e.set(rx, ry, rz));
  return m4.clone().compose(v.set(px, py, pz), q, s.set(sx, sy, sz));
}

/** Compose with an explicit quaternion. */
export function trq(pos: THREE.Vector3, quat: THREE.Quaternion, scale: THREE.Vector3): THREE.Matrix4 {
  return new THREE.Matrix4().compose(pos, quat, scale);
}

export function shade(hex: THREE.ColorRepresentation, k: number): THREE.Color {
  return tmpC.set(hex).multiplyScalar(k).clone();
}

export function mix(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

/** Cheap smooth 3D value-ish noise from sines (deterministic, no tables). */
export function snoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 1.7 + Math.sin(z * 1.3) * 1.1) * 0.5 +
    Math.sin(y * 2.3 + x * 0.7 + 1.3) * 0.3 +
    Math.sin(z * 2.9 - y * 1.1 + 2.1) * 0.2
  );
}
