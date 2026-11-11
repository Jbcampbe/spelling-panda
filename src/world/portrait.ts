/**
 * Head-and-shoulders PNG portraits of pandas, rendered once per colour with a single
 * shared offscreen WebGLRenderer (R-UI-3). Never throws: resolves '' without WebGL.
 */
import * as THREE from 'three';
import type { PandaColor } from '../types';
import { worldUniforms } from './materials';
import { animateRig, createPose } from './panda/animate';
import { createBrain } from './panda/behaviour';
import { createPandaRig, type PandaRig } from './panda/rig';

const SIZE = 320;

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rigs: Map<PandaColor, PandaRig>;
}

let studio: Studio | null | undefined;
const cache = new Map<PandaColor, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function getStudio(): Studio | null {
  if (studio !== undefined) return studio;
  try {
    if (typeof document === 'undefined') return (studio = null);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff3e6', '#c6d8c0', 1.25));
    scene.add(new THREE.AmbientLight('#f3ecff', 0.3));
    const key = new THREE.DirectionalLight('#fff1dc', 2.2);
    key.position.set(2, 3, 3.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#dcdcff', 0.9);
    rim.position.set(-2.5, 1.5, -2.5);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
    camera.position.set(0.34, 1.0, 2.6);
    camera.lookAt(0, 0.76, 0);
    studio = { renderer, scene, camera, rigs: new Map() };
  } catch {
    studio = null;
  }
  return studio;
}

function render(color: PandaColor): string {
  const s = getStudio();
  if (!s) return '';
  let rig = s.rigs.get(color);
  if (!rig) {
    rig = createPandaRig(color);
    s.rigs.set(color, rig);
  }
  // Settle into a calm idle pose: eyes open, looking just past the viewer.
  const brain = createBrain(0, 0, 0.32, 7);
  brain.blinkAge = 99;
  brain.blinkIn = 99;
  brain.lookYaw = -0.18;
  brain.lookPitch = 0.08;
  const pose = createPose(1.3);
  for (let i = 0; i < 40; i++) animateRig(rig, brain, pose, 0.1, 1.3);
  s.scene.add(rig.root);
  const saved = worldUniforms.uTime.value;
  worldUniforms.uTime.value = 2.2; // golden shimmer sweep mid-body
  try {
    s.renderer.render(s.scene, s.camera);
    return s.renderer.domElement.toDataURL('image/png');
  } finally {
    worldUniforms.uTime.value = saved;
    s.scene.remove(rig.root);
  }
}

/** PNG data URL portrait for a colour, cached; '' when WebGL is unavailable. */
export function getPandaPortrait(color: PandaColor): Promise<string> {
  const hit = cache.get(color);
  if (hit) return hit;
  const p = queue.then(
    () =>
      new Promise<string>((resolve) => {
        try {
          resolve(render(color));
        } catch {
          resolve('');
        }
      }),
  );
  queue = p.catch(() => '');
  cache.set(color, p);
  return p;
}
