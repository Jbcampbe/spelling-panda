/**
 * Pooled, single-draw-call effects shared by the whole herd:
 * soft "poof" puffs, golden sparkles, nap Zzz's and contact-shadow blobs.
 */
import * as THREE from 'three';
import { getBlobMaterial, getHeartTexture, getZzzTexture, worldUniforms } from '../materials';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const ID_Q = new THREE.Quaternion();

// ---------------------------------------------------------------- puffs
export interface Puffs {
  mesh: THREE.InstancedMesh;
  /** Burst of cloud puffs around a point (island space). */
  burst(x: number, y: number, z: number, count: number, spread: number, upward: number): void;
  update(dt: number): void;
}

export function createPuffs(max = 72): Puffs {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#fff6fb',
    emissiveIntensity: 0.45,
    roughness: 1,
    flatShading: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  for (let i = 0; i < max; i++) mesh.setMatrixAt(i, HIDDEN);
  const pos = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const age = new Float32Array(max).fill(1);
  const life = new Float32Array(max).fill(1);
  const size = new Float32Array(max);
  let next = 0;
  let alive = 0;

  return {
    mesh,
    burst(x, y, z, count, spread, upward) {
      for (let k = 0; k < count; k++) {
        const i = next;
        next = (next + 1) % max;
        const a = (k / count) * Math.PI * 2 + Math.random() * 0.6;
        const s = spread * (0.7 + Math.random() * 0.6);
        pos[i * 3] = x + Math.cos(a) * 0.12;
        pos[i * 3 + 1] = y + Math.random() * 0.15;
        pos[i * 3 + 2] = z + Math.sin(a) * 0.12;
        vel[i * 3] = Math.cos(a) * s;
        vel[i * 3 + 1] = upward * (0.5 + Math.random());
        vel[i * 3 + 2] = Math.sin(a) * s;
        age[i] = 0;
        life[i] = 0.75 + Math.random() * 0.45;
        size[i] = 0.1 + Math.random() * 0.09;
      }
      alive = max;
    },
    update(dt) {
      if (alive === 0) return;
      let any = 0;
      for (let i = 0; i < max; i++) {
        if (age[i] >= life[i]) continue;
        age[i] += dt;
        const u = Math.min(1, age[i] / life[i]);
        if (u >= 1) {
          mesh.setMatrixAt(i, HIDDEN);
          continue;
        }
        any++;
        const drag = Math.exp(-3.2 * dt);
        vel[i * 3] *= drag;
        vel[i * 3 + 1] = vel[i * 3 + 1] * drag + 0.25 * dt;
        vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        // Grow quickly, then shrink away (reads as a fade without transparency).
        const s = size[i] * (Math.min(1, u * 5) * 1.25) * (1 - u * u);
        tmpP.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        tmpS.setScalar(Math.max(0.0001, s));
        mesh.setMatrixAt(i, tmpM.compose(tmpP, ID_Q, tmpS));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (any === 0) alive = 0;
    },
  };
}

// ---------------------------------------------------------------- sparkles
const SPARK_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uScale;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.5 + 0.5 * sin(uTime * 2.6 + aPhase * 6.2831);
  vA = tw * tw;
  gl_PointSize = uScale * (0.45 + 0.75 * tw) / max(0.1, -mv.z);
}
`;
const SPARK_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.32, 0.0, d);
  float rays = (smoothstep(0.07, 0.0, abs(c.x)) + smoothstep(0.07, 0.0, abs(c.y))) * smoothstep(0.5, 0.05, d);
  float a = clamp(core * core + rays * 0.8, 0.0, 1.0) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.6) * a, a);
}
`;

export const SPARKS_PER_PANDA = 12;

export interface Sparkles {
  points: THREE.Points;
  /** Write sparkles for the golden pandas; `centres` are island-space feet positions. */
  update(centres: readonly { x: number; y: number; z: number; k: number }[], t: number, pxScale: number): void;
}

export function createSparkles(maxPandas = 12): Sparkles {
  const n = maxPandas * SPARKS_PER_PANDA;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = (i * 0.618034) % 1;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setDrawRange(0, 0);
  const uScale = { value: 300 };
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: { uTime: worldUniforms.uTime, uScale, uColor: { value: new THREE.Color('#ffd25e') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(centres, t, pxScale) {
      uScale.value = pxScale * 0.26;
      const count = Math.min(maxPandas, centres.length);
      for (let p = 0; p < count; p++) {
        const c = centres[p];
        for (let j = 0; j < SPARKS_PER_PANDA; j++) {
          const i = p * SPARKS_PER_PANDA + j;
          const seed = phase[i] * 17.0 + p;
          const dir = j % 2 === 0 ? 1 : -1;
          const a = t * (0.35 + (j % 3) * 0.12) * dir + seed * 2.4;
          const r = (0.5 + 0.22 * Math.sin(seed * 3.1 + t * 0.7)) * c.k;
          const h = 0.25 + ((j * 0.137 + t * 0.12 + phase[i]) % 1) * 1.1;
          pos[i * 3] = c.x + Math.cos(a) * r;
          pos[i * 3 + 1] = c.y + h * c.k;
          pos[i * 3 + 2] = c.z + Math.sin(a) * r;
        }
      }
      geo.setDrawRange(0, count * SPARKS_PER_PANDA);
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- zzz
export const Z_PER_PANDA = 3;

export interface Zzz {
  points: THREE.Points | null;
  update(sleepers: readonly { x: number; y: number; z: number; heading: number; k: number; seed: number }[], t: number): void;
}

export function createZzz(maxPandas = 12): Zzz {
  const tex = getZzzTexture();
  if (!tex) return { points: null, update() {} };
  const n = maxPandas * Z_PER_PANDA;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 4).fill(1);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    map: tex,
    size: 0.3,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(sleepers, t) {
      const count = Math.min(maxPandas, sleepers.length);
      for (let p = 0; p < count; p++) {
        const s = sleepers[p];
        // Rise from just above the head of a lying panda (head is "forward").
        const hx = s.x + Math.sin(s.heading) * 0.35;
        const hz = s.z + Math.cos(s.heading) * 0.35;
        for (let j = 0; j < Z_PER_PANDA; j++) {
          const i = p * Z_PER_PANDA + j;
          const u = (t * 0.32 + j / Z_PER_PANDA + s.seed) % 1;
          pos[i * 3] = hx + Math.sin(u * 5 + s.seed * 6) * 0.12 + u * 0.18;
          pos[i * 3 + 1] = s.y + 0.55 + u * 0.75;
          pos[i * 3 + 2] = hz;
          const a = Math.sin(Math.PI * u) * s.k;
          col[i * 4 + 3] = a;
        }
      }
      geo.setDrawRange(0, count * Z_PER_PANDA);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- hearts
export const HEARTS_PER_PANDA = 3;

export interface Hearts {
  points: THREE.Points | null;
  /** Hearts drifting up from happy pandas; `k` fades them in and out. */
  update(lovers: readonly { x: number; y: number; z: number; k: number; seed: number }[], t: number): void;
}

export function createHearts(maxPandas = 12): Hearts {
  const tex = getHeartTexture();
  if (!tex) return { points: null, update() {} };
  const n = maxPandas * HEARTS_PER_PANDA;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 4).fill(1);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    map: tex,
    size: 0.34,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return {
    points,
    update(lovers, t) {
      const count = Math.min(maxPandas, lovers.length);
      for (let p = 0; p < count; p++) {
        const s = lovers[p];
        for (let j = 0; j < HEARTS_PER_PANDA; j++) {
          const i = p * HEARTS_PER_PANDA + j;
          const u = (t * 0.55 + j / HEARTS_PER_PANDA + s.seed) % 1;
          const a = j * 2.1 + s.seed * 6;
          pos[i * 3] = s.x + Math.cos(a) * 0.22 + Math.sin(u * 6 + a) * 0.07;
          pos[i * 3 + 1] = s.y + 1.05 + u * 0.75;
          pos[i * 3 + 2] = s.z + Math.sin(a) * 0.22;
          col[i * 4 + 3] = Math.sin(Math.PI * u) * s.k;
        }
      }
      geo.setDrawRange(0, count * HEARTS_PER_PANDA);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- blobs
export interface Blobs {
  mesh: THREE.InstancedMesh;
  set(i: number, x: number, y: number, z: number, sx: number, sz: number, heading: number): void;
  finish(count: number): void;
}

export function createBlobs(max = 20): Blobs {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, getBlobMaterial(), max);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.count = 0;
  const yAxis = new THREE.Vector3(0, 1, 0);
  return {
    mesh,
    set(i, x, y, z, sx, sz, heading) {
      if (i >= max) return;
      tmpP.set(x, y, z);
      tmpQ.setFromAxisAngle(yAxis, heading);
      tmpS.set(sx, 1, sz);
      mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
    },
    finish(count) {
      mesh.count = Math.min(max, count);
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
