/** Imperative panda rig shared by the island, the preview and portrait rendering. */
import * as THREE from 'three';
import type { PandaColor } from '../../types';
import { getDecorMaterial, getEyeMaterial, getFurMaterial } from '../materials';
import {
  HIP,
  NECK,
  PIVOT_Y,
  SHOULDER,
  getBambooPropGeometry,
  getEyeGeometry,
  getPandaGeometries,
} from './geometry';

export interface PandaRig {
  color: PandaColor;
  /** Placed on the ground, rotated to the panda's heading. */
  root: THREE.Group;
  /** Vertical offsets (hop, sit) and squash & stretch. */
  mover: THREE.Group;
  /** Body-centre pivot: waddle, lie down, roll. */
  pivot: THREE.Group;
  body: THREE.Mesh;
  neck: THREE.Group;
  head: THREE.Mesh;
  eyes: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  bamboo: THREE.Mesh;
  meshes: THREE.Mesh[];
}

function limb(geo: THREE.BufferGeometry, mat: THREE.Material, at: THREE.Vector3): [THREE.Group, THREE.Mesh] {
  const g = new THREE.Group();
  g.position.copy(at);
  const m = new THREE.Mesh(geo, mat);
  g.add(m);
  return [g, m];
}

export function createPandaRig(color: PandaColor): PandaRig {
  const geos = getPandaGeometries(color);
  const fur = getFurMaterial(color);
  const root = new THREE.Group();
  root.name = 'panda';
  const mover = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = PIVOT_Y;
  root.add(mover);
  mover.add(pivot);

  const body = new THREE.Mesh(geos.body, fur);
  body.position.y = -PIVOT_Y;
  pivot.add(body);

  const neck = new THREE.Group();
  neck.position.set(NECK.x, NECK.y - PIVOT_Y, NECK.z);
  pivot.add(neck);
  const head = new THREE.Mesh(geos.head, fur);
  neck.add(head);
  const eyeGeo = getEyeGeometry();
  const eyes = new THREE.Mesh(eyeGeo.geo, getEyeMaterial());
  eyes.position.y = eyeGeo.pivotY;
  neck.add(eyes);

  const off = new THREE.Vector3(0, -PIVOT_Y, 0);
  const [armL, armLm] = limb(geos.arm, fur, new THREE.Vector3(-SHOULDER.x, SHOULDER.y, SHOULDER.z).add(off));
  const [armR, armRm] = limb(geos.arm, fur, SHOULDER.clone().add(off));
  const [legL, legLm] = limb(geos.leg, fur, new THREE.Vector3(-HIP.x, HIP.y, HIP.z).add(off));
  const [legR, legRm] = limb(geos.leg, fur, HIP.clone().add(off));
  pivot.add(armL, armR, legL, legR);

  const bamboo = new THREE.Mesh(getBambooPropGeometry(), getDecorMaterial());
  bamboo.visible = false;
  pivot.add(bamboo);

  const meshes = [body, head, eyes, armLm, armRm, legLm, legRm, bamboo];
  for (const m of meshes) m.receiveShadow = false;
  return { color, root, mover, pivot, body, neck, head, eyes, armL, armR, legL, legR, bamboo, meshes };
}

/** Swap colour in place (used by the live colour preview). */
export function setRigColor(rig: PandaRig, color: PandaColor): void {
  if (rig.color === color) return;
  const geos = getPandaGeometries(color);
  const fur = getFurMaterial(color);
  rig.body.geometry = geos.body;
  rig.head.geometry = geos.head;
  for (const g of [rig.armL, rig.armR]) (g.children[0] as THREE.Mesh).geometry = geos.arm;
  for (const g of [rig.legL, rig.legR]) (g.children[0] as THREE.Mesh).geometry = geos.leg;
  for (const m of rig.meshes) if (m !== rig.eyes && m !== rig.bamboo) m.material = fur;
  rig.color = color;
}

export function setRigShadows(rig: PandaRig, cast: boolean): void {
  for (const m of rig.meshes) m.castShadow = cast;
}
