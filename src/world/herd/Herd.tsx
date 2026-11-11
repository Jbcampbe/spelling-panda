import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { Panda } from '../../types';
import { islandEnvironment, spawnPoint } from '../island/environment';
import { heightAt } from '../island/layout';
import { animateRig, createPose, type PoseState } from '../panda/animate';
import {
  ARRIVAL_DROP_START,
  ARRIVAL_DROP_TIME,
  ISLAND_BEHAVIOUR,
  createBrain,
  startArrival,
  startReaction,
  stepBrain,
  type Brain,
  type Neighbour,
} from '../panda/behaviour';
import { createPandaRig, setRigShadows, type PandaRig } from '../panda/rig';
import { hashString, mulberry32 } from '../random';
import { createBlobs, createPuffs, createSparkles, createZzz } from './effects';

/** Seconds the eviction "poof" takes. */
const LEAVE_TIME = 0.55;
const LABEL_MS = 2600;

interface Actor {
  id: string;
  panda: Panda;
  rig: PandaRig;
  brain: Brain;
  pose: PoseState;
  leaving: boolean;
  poofed: boolean;
  landed: boolean;
}

/** Imperative handle the camera uses to follow a panda. */
export interface HerdApi {
  /** World-space position of a panda's feet; false if it isn't on the island. */
  getPandaPosition(id: string, out: THREE.Vector3): boolean;
}

export interface HerdProps {
  pandas: Panda[];
  arrivalPandaId?: string;
  evictedPandaIds?: string[];
  onPandaTap?: (panda: Panda) => void;
  pandaShadows: boolean;
  apiRef: RefObject<HerdApi | null>;
}

function makeActor(panda: Panda, taken: readonly { x: number; z: number }[]): Actor {
  const seed = hashString(panda.id);
  const rand = mulberry32(seed);
  const spot = spawnPoint(rand, taken);
  const rig = createPandaRig(panda.color);
  const brain = createBrain(spot.x, spot.z, 0.35 + (rand() - 0.5) * 2.2, seed ^ 0x9e3779b9);
  const pose = createPose(rand() * 20);
  rig.root.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
  rig.root.userData.pandaId = panda.id;
  return { id: panda.id, panda, rig, brain, pose, leaving: false, poofed: false, landed: true };
}

export function Herd({ pandas, arrivalPandaId, evictedPandaIds, onPandaTap, pandaShadows, apiRef }: HerdProps) {
  const actorsRef = useRef(new Map<string, Actor>());
  const [list, setList] = useState<Actor[]>([]);
  const camera = useThree((s) => s.camera);
  const fx = useMemo(
    () => ({ puffs: createPuffs(), sparkles: createSparkles(), zzz: createZzz(), blobs: createBlobs() }),
    [],
  );
  const groupRef = useRef<THREE.Group>(null);
  const evictedKey = (evictedPandaIds ?? []).join('|');

  // Reconcile actors with the pandas prop (robust to any add / remove / reorder / recolour).
  useLayoutEffect(() => {
    const map = actorsRef.current;
    const evicted = new Set(evictedKey ? evictedKey.split('|') : []);
    const wanted = new Set<string>();
    for (const p of pandas) {
      if (evicted.has(p.id)) continue;
      wanted.add(p.id);
      const existing = map.get(p.id);
      if (existing && existing.panda.color !== p.color) {
        // Colour change on an island panda: rebuild its rig in place.
        const fresh = createPandaRig(p.color);
        fresh.root.position.copy(existing.rig.root.position);
        existing.rig = fresh;
      }
      if (existing) {
        existing.panda = p;
        existing.leaving = false;
        continue;
      }
      const taken = [...map.values()].map((a) => a.brain);
      map.set(p.id, makeActor(p, taken));
    }
    for (const a of map.values()) {
      if (wanted.has(a.id)) continue;
      if (evicted.has(a.id)) {
        a.leaving = true; // poofs out, removed when the animation completes
      } else {
        map.delete(a.id);
      }
    }
    setList([...map.values()]);
  }, [pandas, evictedKey]);

  useEffect(() => {
    for (const a of list) setRigShadows(a.rig, pandaShadows);
  }, [list, pandaShadows]);

  // Start the drop-in once the arriving panda exists (it may appear after the id is set).
  const arrivalStarted = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!arrivalPandaId) {
      arrivalStarted.current = undefined;
      return;
    }
    if (arrivalStarted.current === arrivalPandaId) return;
    const a = actorsRef.current.get(arrivalPandaId);
    if (!a || a.leaving) return;
    arrivalStarted.current = arrivalPandaId;
    const b = a.brain;
    startArrival(b, Math.atan2(camera.position.x - b.x, camera.position.z - b.z));
    a.landed = false;
  }, [arrivalPandaId, list, camera]);

  useLayoutEffect(() => {
    apiRef.current = {
      getPandaPosition(id, out) {
        const a = actorsRef.current.get(id);
        if (!a) return false;
        a.rig.root.getWorldPosition(out);
        return true;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  const neighbours = useRef<Neighbour[]>([]);
  const goldScratch = useRef<{ x: number; y: number; z: number; k: number }[]>([]);
  const sleepScratch = useRef<{ x: number; y: number; z: number; heading: number; k: number; seed: number }[]>([]);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const map = actorsRef.current;
    let removed = false;
    let blobCount = 0;
    const gold = goldScratch.current;
    const sleepers = sleepScratch.current;
    gold.length = 0;
    sleepers.length = 0;
    const all = [...map.values()];

    for (const a of all) {
      const b = a.brain;
      const n = neighbours.current;
      n.length = 0;
      for (const o of all) if (o !== a && !o.leaving) n.push(o.brain);
      if (!a.leaving) stepBrain(b, dt, n, islandEnvironment, ISLAND_BEHAVIOUR);

      if (a.leaving) {
        if (!a.poofed) {
          a.poofed = true;
          const r = a.rig.root.position;
          fx.puffs.burst(r.x, r.y + 0.35, r.z, 12, 1.4, 0.9);
        }
        a.pose.leave = Math.min(1, a.pose.leave + dt / LEAVE_TIME);
        if (a.pose.leave >= 1) {
          map.delete(a.id);
          removed = true;
          continue;
        }
      }

      const ground = heightAt(b.x, b.z);
      a.rig.root.position.set(b.x, ground, b.z);
      animateRig(a.rig, b, a.pose, dt, t);

      // Landing dust for the arrival drop.
      if (b.activity === 'arrive' && !a.landed && b.elapsed >= ARRIVAL_DROP_START + ARRIVAL_DROP_TIME) {
        a.landed = true;
        fx.puffs.burst(b.x, ground + 0.02, b.z, 10, 1.6, 0.25);
      }
      if (b.activity !== 'arrive') a.landed = true;

      if (!a.rig.root.visible) continue;
      const lift = Math.max(0, a.rig.mover.position.y);
      const shrink = (1 - a.pose.leave * a.pose.leave) * Math.max(0.35, 1 - lift * 0.9);
      const lie = a.pose.lie;
      fx.blobs.set(blobCount++, b.x, ground + 0.012, b.z, 0.95 * shrink, (0.95 + lie * 0.45) * shrink, b.heading);

      if (a.panda.color === 'golden') gold.push({ x: b.x, y: ground, z: b.z, k: 1 - a.pose.leave });
      if (a.pose.sleepy > 0.02 && !a.leaving) {
        sleepers.push({ x: b.x, y: ground, z: b.z, heading: b.heading, k: a.pose.sleepy, seed: a.pose.phase % 1 });
      }
    }

    fx.blobs.finish(blobCount);
    fx.puffs.update(dt);
    fx.sparkles.update(gold, t, size.height * gl.getPixelRatio() * 0.5);
    fx.zzz.update(sleepers, t);
    if (removed) setList([...map.values()]);
  });

  const handleTap = (a: Actor) => {
    if (a.leaving || a.brain.activity === 'arrive') return false;
    startReaction(a.brain);
    onPandaTap?.(a.panda);
    return true;
  };

  return (
    <group ref={groupRef}>
      {list.map((a) => (
        <PandaActor key={a.id + ':' + a.panda.color} actor={a} onTap={handleTap} />
      ))}
      <primitive object={fx.blobs.mesh} dispose={null} />
      <primitive object={fx.puffs.mesh} dispose={null} />
      <primitive object={fx.sparkles.points} dispose={null} />
      {fx.zzz.points && <primitive object={fx.zzz.points} dispose={null} />}
    </group>
  );
}

const HIT_GEO = new THREE.SphereGeometry(0.62, 12, 8);

function PandaActor({ actor, onTap }: { actor: Actor; onTap: (a: Actor) => boolean }) {
  const [label, setLabel] = useState(0);
  useEffect(() => {
    if (!label) return;
    const id = window.setTimeout(() => setLabel(0), LABEL_MS);
    return () => window.clearTimeout(id);
  }, [label]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // A drag (camera orbit) is not a tap.
    if (e.delta > 6) return;
    if (onTap(actor)) setLabel((n) => n + 1);
  };

  return (
    <primitive object={actor.rig.root} dispose={null}>
      <mesh
        geometry={HIT_GEO}
        position={[0, 0.58, 0]}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <meshBasicMaterial visible={false} />
      </mesh>
      {label > 0 && (
        <Html position={[0, 1.42, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div key={label} className="pw-label">
            {actor.panda.name}
          </div>
        </Html>
      )}
    </primitive>
  );
}
