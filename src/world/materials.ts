/**
 * Shared, cached materials and procedural textures (R-PRF-P4). Everything here is
 * created once per page and reused by every canvas (world, preview, portraits).
 */
import * as THREE from 'three';
import type { PandaColor } from '../types';

/** Global animated uniforms; `uTime` is driven by whichever canvas is rendering. */
export const worldUniforms = { uTime: { value: 0 } };

/** Seconds clock shared by shader animation (absolute so several canvases agree). */
export function tickWorldTime(): void {
  worldUniforms.uTime.value = performance.now() / 1000;
}

type Shader = THREE.WebGLProgramParametersWithUniforms;

const FUR_VERTEX_PRE = /* glsl */ `
#include <common>
attribute float aFur;
varying float vFur;
varying vec3 vWPos;
`;
const FUR_VERTEX_POST = /* glsl */ `
#include <begin_vertex>
vFur = aFur;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const FUR_FRAG_PRE = /* glsl */ `
#include <common>
uniform float uTime;
varying float vFur;
varying vec3 vWPos;
`;

function furCompile(golden: boolean) {
  return (shader: Shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', FUR_VERTEX_PRE)
      .replace('#include <begin_vertex>', FUR_VERTEX_POST);
    let frag = shader.fragmentShader.replace('#include <common>', FUR_FRAG_PRE);
    if (golden) {
      frag = frag.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.38, vFur);`,
      );
    }
    frag = frag.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       {
         vec3 V = normalize(vViewPosition);
         float fres = pow(1.0 - clamp(dot(V, normal), 0.0, 1.0), 2.6);
         // Plush, velvety rim so the fur reads soft rather than plastic.
         totalEmissiveRadiance += vColor.rgb * fres * 0.22;
         ${
           golden
             ? `float sweep = pow(max(0.0, sin(dot(vWPos, vec3(1.7, 2.6, 1.1)) * 1.6 - uTime * 1.7)), 14.0);
                float glow = 0.16 + 0.5 * fres + 0.75 * sweep;
                totalEmissiveRadiance += vec3(1.0, 0.78, 0.36) * vFur * glow * 0.55;`
             : ''
         }
       }`,
    );
    shader.fragmentShader = frag;
  };
}

let furMat: THREE.MeshStandardMaterial | null = null;
let goldMat: THREE.MeshStandardMaterial | null = null;

/** Fur material: vertex-coloured (white + dark fur baked per colour), one shared for all
 *  normal colours and one shimmering variant for golden pandas. */
export function getFurMaterial(color: PandaColor): THREE.MeshStandardMaterial {
  if (color === 'golden') {
    if (!goldMat) {
      goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
      goldMat.onBeforeCompile = furCompile(true);
      goldMat.customProgramCacheKey = () => 'pw-fur-gold';
    }
    return goldMat;
  }
  if (!furMat) {
    furMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0 });
    furMat.onBeforeCompile = furCompile(false);
    furMat.customProgramCacheKey = () => 'pw-fur';
  }
  return furMat;
}

let eyeMat: THREE.MeshStandardMaterial | null = null;
/** Glossy eyes; the white highlight vertices glow slightly so they always sparkle. */
export function getEyeMaterial(): THREE.MeshStandardMaterial {
  if (!eyeMat) {
    eyeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0 });
    eyeMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += step(0.7, vColor.r) * vColor.rgb * 0.9;`,
      );
    };
    eyeMat.customProgramCacheKey = () => 'pw-eye';
  }
  return eyeMat;
}

let decorMat: THREE.MeshStandardMaterial | null = null;
/** Matte vertex-coloured material for all static decor and the terrain. */
export function getDecorMaterial(): THREE.MeshStandardMaterial {
  if (!decorMat) decorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  return decorMat;
}

export type WindMode = 'tuft' | 'stalk' | 'flower';
const windMats = new Map<WindMode, THREE.MeshStandardMaterial>();

/**
 * Instanced foliage with a gentle wind sway in the vertex shader.
 * 'tuft'/'flower' bend by local height; 'stalk' (bamboo) bends by height above the island.
 * 'flower' applies instanceColor only where the aTint attribute is 1 (petals, not stems).
 */
export function getWindMaterial(mode: WindMode): THREE.MeshStandardMaterial {
  const cached = windMats.get(mode);
  if (cached) return cached;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  const amp = mode === 'stalk' ? 0.006 : mode === 'flower' ? 0.5 : 0.9;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    let vs = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       ${mode === 'flower' ? 'attribute float aTint;' : ''}`,
    );
    if (mode === 'flower') {
      vs = vs.replace(
        '#include <color_vertex>',
        `vColor = vec4(1.0);
         vColor.rgb = color;
         #ifdef USE_INSTANCING_COLOR
           vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor, aTint);
         #endif`,
      );
    }
    vs = vs.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4(transformed, 1.0);
       #ifdef USE_INSTANCING
         mvPosition = instanceMatrix * mvPosition;
       #endif
       {
         float h = ${mode === 'stalk' ? 'max(0.0, mvPosition.y)' : 'max(0.0, transformed.y)'};
         float w = sin(uTime * 1.05 + mvPosition.x * 0.45 + mvPosition.z * 0.6)
                 + 0.45 * sin(uTime * 2.2 + mvPosition.x * 1.3 - mvPosition.z * 0.7);
         float bend = ${amp.toFixed(4)} * h * h;
         mvPosition.x += w * bend;
         mvPosition.z += w * bend * 0.55;
       }
       mvPosition = modelViewMatrix * mvPosition;
       gl_Position = projectionMatrix * mvPosition;`,
    );
    shader.vertexShader = vs;
  };
  m.customProgramCacheKey = () => `pw-wind-${mode}`;
  windMats.set(mode, m);
  return m;
}

let blobTex: THREE.Texture | null = null;
/** Soft radial gradient used for contact-shadow blobs. */
export function getBlobTexture(): THREE.Texture {
  if (blobTex) return blobTex;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const a = Math.pow(1 - d, 1.6) * (1 - d * 0.2);
      const i = (y * size + x) * 4;
      data[i] = 40;
      data[i + 1] = 52;
      data[i + 2] = 38;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.needsUpdate = true;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  blobTex = t;
  return t;
}

let blobMat: THREE.MeshBasicMaterial | null = null;
export function getBlobMaterial(): THREE.MeshBasicMaterial {
  if (!blobMat) {
    blobMat = new THREE.MeshBasicMaterial({
      map: getBlobTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }
  return blobMat;
}

let zTex: THREE.Texture | null = null;
/** A soft "z" glyph for napping pandas (drawn on a 2D canvas, no font files). */
export function getZzzTexture(): THREE.Texture | null {
  if (zTex) return zTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.font = '800 52px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeText('z', 32, 34);
  ctx.fillStyle = '#7b86c9';
  ctx.fillText('z', 32, 34);
  zTex = new THREE.CanvasTexture(c);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}
