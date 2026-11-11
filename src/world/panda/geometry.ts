/**
 * Procedural panda geometry, built from smooth rounded primitives (R-PND-1).
 * Each rigid part is a single merged, vertex-coloured mesh so a panda costs only a
 * handful of draw calls. Geometry is cached per colour (the dark fur colour is baked
 * into vertex colours; `aFur` marks dark-fur vertices for the golden shimmer).
 */
import * as THREE from 'three';
import type { PandaColor } from '../../types';
import { PANDA_COLOR_HEX, WHITE_FUR_HEX } from '../colors';
import { merge, piece, trs, trq } from '../geom';

// ---- Rig proportions (root space: origin on the ground, facing +z) ----
export const PIVOT_Y = 0.42;
export const NECK = new THREE.Vector3(0, 0.68, 0.02);
export const HEAD_C = new THREE.Vector3(0, 0.27, 0.03); // relative to NECK
export const HEAD_R = new THREE.Vector3(0.37, 0.325, 0.315);
export const SHOULDER = new THREE.Vector3(0.245, 0.565, 0.075);
export const HIP = new THREE.Vector3(0.155, 0.2, 0.05);

const CREAM = '#fff8ef';
const NOSE = '#3a3138';
const BLUSH = '#f6b5c0';
const PAD = '#f3c9c6';
const EYE = '#211b26';

export interface PandaGeometries {
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
}

const unitSphere = new THREE.SphereGeometry(1, 40, 28);
const smallSphere = new THREE.SphereGeometry(1, 20, 14);
const tinySphere = new THREE.SphereGeometry(1, 12, 8);

/** Gentle pear shape + a soft belly bulge. */
function deformBody(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const u = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i);
    const len = u.length();
    const n = u.clone().divideScalar(len || 1);
    const k = 1 + 0.1 * -n.y;
    let z = u.z * k;
    if (n.z > 0) z *= 1 + 0.06 * (1 - n.y * n.y) * n.z;
    pos.setXYZ(i, u.x * k, u.y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Chubby cheeks: widen the lower half of the head a touch. */
function deformHead(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const u = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i);
    const k = u.y < 0 ? 1 + 0.075 * Math.sin(Math.PI * -u.y) : 1;
    pos.setXYZ(i, u.x * k, u.y, u.z * (1 + (k - 1) * 0.4));
  }
  g.computeVertexNormals();
  return g;
}

const bodySphere = deformBody(new THREE.SphereGeometry(1, 40, 28));
const bandShell = deformBody(new THREE.SphereGeometry(1.03, 40, 12, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.28));
const headSphere = deformHead(new THREE.SphereGeometry(1, 44, 30));

const Z = new THREE.Vector3(0, 0, 1);

/** Point + orientation on the head ellipsoid along a direction (head-relative space). */
export function onHead(dx: number, dy: number, dz: number, out = 0) {
  const d = new THREE.Vector3(dx, dy, dz).normalize();
  const normal = new THREE.Vector3(d.x / HEAD_R.x, d.y / HEAD_R.y, d.z / HEAD_R.z).normalize();
  const pos = new THREE.Vector3(d.x * HEAD_R.x, d.y * HEAD_R.y, d.z * HEAD_R.z)
    .add(HEAD_C)
    .addScaledVector(normal, out);
  const quat = new THREE.Quaternion().setFromUnitVectors(Z, normal);
  return { pos, normal, quat };
}

function surfacePiece(
  src: THREE.BufferGeometry,
  at: ReturnType<typeof onHead>,
  scale: [number, number, number],
  tilt: number,
  color: THREE.ColorRepresentation,
  fur: number,
) {
  const q = at.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, tilt));
  return piece(src, trq(at.pos, q, new THREE.Vector3(...scale)), color, { aFur: fur });
}

function buildBody(dark: string): THREE.BufferGeometry {
  return merge([
    piece(bodySphere, trs(0, 0.4, 0, 0.34, 0.37, 0.31), WHITE_FUR_HEX, { aFur: 0 }),
    piece(bandShell, trs(0, 0.4, 0, 0.34, 0.37, 0.31), dark, { aFur: 1 }),
    piece(smallSphere, trs(0, 0.22, -0.305, 0.075), WHITE_FUR_HEX, { aFur: 0 }),
  ]);
}

function buildHead(dark: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    piece(headSphere, trs(HEAD_C.x, HEAD_C.y, HEAD_C.z, HEAD_R.x, HEAD_R.y, HEAD_R.z), WHITE_FUR_HEX, { aFur: 0 }),
    // Muzzle, nose and a tiny smile.
    piece(smallSphere, trs(0, HEAD_C.y - 0.1, HEAD_C.z + 0.232, 0.155, 0.1, 0.12), CREAM, { aFur: 0 }),
    piece(smallSphere, trs(0, HEAD_C.y - 0.06, HEAD_C.z + 0.342, 0.052, 0.034, 0.03, -0.2), NOSE, { aFur: 0 }),
  ];
  const smile = new THREE.TorusGeometry(0.019, 0.0052, 6, 14, Math.PI);
  for (const sx of [-1, 1]) {
    parts.push(
      piece(smile, trs(sx * 0.019, HEAD_C.y - 0.112, HEAD_C.z + 0.346, 1, 1, 1, -0.25, 0, Math.PI), NOSE, {
        aFur: 0,
      }),
    );
    // Eye patches: tilted teardrops, top leaning in.
    parts.push(surfacePiece(smallSphere, onHead(sx * 0.4, 0.02, 0.92, -0.012), [0.088, 0.118, 0.05], sx * 0.52, dark, 1));
    // Ears.
    parts.push(surfacePiece(smallSphere, onHead(sx * 0.66, 0.7, -0.1, -0.02), [0.118, 0.115, 0.078], 0, dark, 1));
    // Blush.
    parts.push(surfacePiece(smallSphere, onHead(sx * 0.66, -0.3, 0.7, -0.004), [0.062, 0.038, 0.02], 0, BLUSH, 0));
  }
  return merge(parts);
}

/** Eye mesh geometry (both eyes), authored relative to EYE_PIVOT so scale.y blinks. */
function buildEyes(): { geo: THREE.BufferGeometry; pivotY: number } {
  const parts: THREE.BufferGeometry[] = [];
  let pivotY = 0;
  for (const sx of [-1, 1]) {
    const at = onHead(sx * 0.385, 0.06, 0.92, 0.004);
    pivotY = at.pos.y;
    parts.push(surfacePiece(smallSphere, at, [0.047, 0.054, 0.03], 0, EYE, 0));
    const hl = at.pos.clone().addScaledVector(at.normal, 0.024).add(new THREE.Vector3(-0.012, 0.017, 0));
    parts.push(piece(tinySphere, trs(hl.x, hl.y, hl.z, 0.0155), '#ffffff', { aFur: 0 }));
    const hl2 = at.pos.clone().addScaledVector(at.normal, 0.024).add(new THREE.Vector3(0.014, -0.016, 0));
    parts.push(piece(tinySphere, trs(hl2.x, hl2.y, hl2.z, 0.0075), '#ffffff', { aFur: 0 }));
  }
  const geo = merge(parts);
  geo.translate(0, -pivotY, 0);
  return { geo, pivotY };
}

function buildArm(dark: string): THREE.BufferGeometry {
  return merge([piece(unitSphere, trs(0, -0.115, 0, 0.098, 0.175, 0.102), dark, { aFur: 1 })]);
}

function buildLeg(dark: string): THREE.BufferGeometry {
  const parts = [
    piece(unitSphere, trs(0, -0.07, 0.03, 0.122, 0.135, 0.138), dark, { aFur: 1 }),
    piece(smallSphere, trs(0, -0.197, 0.04, 0.072, 0.018, 0.075), PAD, { aFur: 0 }),
  ];
  for (const tx of [-0.05, 0, 0.05]) {
    parts.push(piece(tinySphere, trs(tx, -0.19, 0.125 - Math.abs(tx) * 0.4, 0.024, 0.012, 0.022), PAD, { aFur: 0 }));
  }
  return merge(parts);
}

function buildBamboo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const seg = new THREE.CylinderGeometry(0.026, 0.028, 0.18, 10, 1, false);
  const node = new THREE.CylinderGeometry(0.032, 0.032, 0.018, 10, 1, false);
  for (let i = 0; i < 3; i++) {
    const y = -0.18 + i * 0.18;
    parts.push(piece(seg, trs(0, y, 0), i % 2 ? '#93c86b' : '#87bf62'));
    parts.push(piece(node, trs(0, y + 0.09, 0), '#b9dc8f'));
  }
  const leaf = new THREE.SphereGeometry(1, 10, 6);
  parts.push(piece(leaf, trs(0.07, 0.2, 0, 0.09, 0.014, 0.03, 0, 0, 0.5), '#7fbe5c'));
  parts.push(piece(leaf, trs(-0.06, 0.24, 0.01, 0.08, 0.013, 0.028, 0, 0.4, -0.6), '#9ad070'));
  return merge(parts);
}

const cache = new Map<PandaColor, PandaGeometries>();

export function getPandaGeometries(color: PandaColor): PandaGeometries {
  let g = cache.get(color);
  if (!g) {
    const dark = PANDA_COLOR_HEX[color];
    g = { body: buildBody(dark), head: buildHead(dark), arm: buildArm(dark), leg: buildLeg(dark) };
    cache.set(color, g);
  }
  return g;
}

let eyes: { geo: THREE.BufferGeometry; pivotY: number } | null = null;
export function getEyeGeometry() {
  if (!eyes) eyes = buildEyes();
  return eyes;
}

let bamboo: THREE.BufferGeometry | null = null;
export function getBambooPropGeometry(): THREE.BufferGeometry {
  if (!bamboo) bamboo = buildBamboo();
  return bamboo;
}
