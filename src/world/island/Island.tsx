import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getDecorMaterial, getWindMaterial, type WindMode } from '../materials';
import { buildStaticDecor } from './decor';
import { buildBamboo, buildFlowers, buildGrass, type InstanceSet } from './foliage';
import { buildTerrain } from './terrain';
import { Water } from './Water';

// Built lazily once per page; the World may remount but geometry is reused.
let built: {
  terrain: THREE.BufferGeometry;
  decor: THREE.BufferGeometry;
  grass: InstanceSet;
  flowers: InstanceSet;
  bamboo: ReturnType<typeof buildBamboo>;
} | null = null;

function getIslandData() {
  if (!built) {
    built = {
      terrain: buildTerrain(),
      decor: buildStaticDecor(),
      grass: buildGrass(),
      flowers: buildFlowers(),
      bamboo: buildBamboo(),
    };
  }
  return built;
}

function Instanced({
  set,
  mode,
  density,
  castShadow,
}: {
  set: InstanceSet;
  mode: WindMode;
  density: number;
  castShadow: boolean;
}) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(set.geometry, getWindMaterial(mode), set.matrices.length);
    set.matrices.forEach((mat, i) => {
      m.setMatrixAt(i, mat);
      m.setColorAt(i, set.colors[i]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.receiveShadow = true;
    return m;
  }, [set, mode]);
  useLayoutEffect(() => {
    mesh.count = Math.max(1, Math.floor(set.matrices.length * density));
    mesh.castShadow = castShadow;
  }, [mesh, set, density, castShadow]);
  return <primitive object={mesh} dispose={null} />;
}

export interface IslandProps {
  decorDensity: number;
  shadows: boolean;
}

/** The floating island diorama (terrain, decor, pond, foliage). */
export function Island({ decorDensity, shadows }: IslandProps) {
  const data = getIslandData();
  const mat = getDecorMaterial();
  return (
    <group>
      <mesh geometry={data.terrain} material={mat} receiveShadow dispose={null} />
      <mesh geometry={data.decor} material={mat} castShadow={shadows} receiveShadow dispose={null} />
      <Water />
      <Instanced set={data.grass} mode="tuft" density={decorDensity} castShadow={false} />
      <Instanced set={data.flowers} mode="flower" density={Math.min(1, decorDensity * 1.2)} castShadow={false} />
      <Instanced set={data.bamboo.segments} mode="stalk" density={1} castShadow={shadows} />
      <Instanced set={data.bamboo.leaves} mode="stalk" density={1} castShadow={shadows} />
    </group>
  );
}
