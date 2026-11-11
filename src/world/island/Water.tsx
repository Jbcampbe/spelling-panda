import { useMemo } from 'react';
import * as THREE from 'three';
import { worldUniforms } from '../materials';
import { POND, WATER_LEVEL } from './layout';

const R = POND.r * 1.14;

const vertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uR;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uGlint;
varying vec2 vLocal;
void main() {
  vec2 p = vLocal;
  float d = length(p) / uR;
  vec3 col = mix(uDeep, uShallow, smoothstep(0.15, 0.95, d));
  // Slow, soft caustic shimmer.
  float n = sin(p.x * 6.0 + uTime * 0.7 + sin(p.y * 4.0 + uTime * 0.5))
          * sin(p.y * 5.5 - uTime * 0.6 + sin(p.x * 3.0 - uTime * 0.4));
  col += uGlint * smoothstep(0.55, 0.95, n) * 0.12;
  // Gentle concentric ripples drifting outward.
  float rip = sin(d * 22.0 - uTime * 1.2);
  col += uGlint * smoothstep(0.92, 1.0, rip) * 0.09 * (1.0 - d);
  // Bright rim where the water meets the shore.
  col = mix(col, uGlint, smoothstep(0.8, 0.9, d) * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function Water() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: worldUniforms.uTime,
          uR: { value: R },
          uDeep: { value: new THREE.Color('#6fc2d6') },
          uShallow: { value: new THREE.Color('#b8e8e6') },
          uGlint: { value: new THREE.Color('#ffffff') },
        },
      }),
    [],
  );
  const geometry = useMemo(() => new THREE.CircleGeometry(R, 64), []);
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[POND.x, WATER_LEVEL, POND.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow={false}
    />
  );
}
