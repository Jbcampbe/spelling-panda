import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { Panda } from '../../types';
import { sfx } from '../../audio/sfxEngine';
import { clampToPond, inPond, islandEnvironment, nearestWalkable, spawnPoint } from '../island/environment';
import { ISLAND_RADIUS, WATER_LEVEL, heightAt } from '../island/layout';
import { MAX_SWIMMERS, setPondSwimmer } from '../island/ripples';
import { animateRig, createPose, type PoseState } from '../panda/animate';
import {
  ARRIVAL_DROP_START,
  ARRIVAL_DROP_TIME,
  ISLAND_BEHAVIOUR,
  canFeed,
  createBrain,
  startArrival,
  startDrop,
  startHold,
  startMunch,
  startReaction,
  startSwim,
  stepBrain,
  type Brain,
  type Neighbour,
} from '../panda/behaviour';
import { createPandaRig, setRigShadows, type PandaRig } from '../panda/rig';
import { angleDelta, clamp, damp, hashString, mulberry32 } from '../random';
import { createBlobs, createHearts, createPuffs, createSparkles, createZzz } from './effects';

/** Seconds the eviction "poof" takes. */
const LEAVE_TIME = 0.55;
const LABEL_MS = 2600;
/** Finger travel (px) or hold time (ms) that turns a press on a panda into a pick-up. */
const GRAB_MOVE_PX = 8;
const GRAB_HOLD_MS = 230;
/** Height (island space) of the plane the finger drags on: a carried panda hangs just above
 *  the finger (so a small hand does not cover it) and lands right under it. */
const CARRY_Y = 0.3;
/** How far below the water line a swimming panda's feet hang. */
const SWIM_DEPTH = 0.5;
/** Screen distance (px) within which dropped food still reaches a panda. */
const FEED_REACH_PX = 110;

interface Drag {
  actor: Actor;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  t0: number;
  active: boolean;
}

interface OrbitLike {
  enabled: boolean;
}

const tmpRay = new THREE.Ray();
const tmpInv = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpNdc = new THREE.Vector2();
const tmpSpot = { x: 0, z: 0 };
const CARRY_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CARRY_Y);
const rayCaster = new THREE.Raycaster();

interface Actor {
  id: string;
  panda: Panda;
  rig: PandaRig;
  brain: Brain;
  pose: PoseState;
  leaving: boolean;
  poofed: boolean;
  landed: boolean;
  /** Set when a press became a pick-up, so the click that follows isn't also a tap. */
  grabbed: boolean;
  /** In a 'drop' glide; a puff and a thump play when it ends. */
  dropping: boolean;
}

/** Imperative handle the camera uses to follow a panda. */
export interface HerdApi {
  /** World-space position of a panda's feet; false if it isn't on the island. */
  getPandaPosition(id: string, out: THREE.Vector3): boolean;
  /** Feed the panda nearest a screen point (client px). False if none is close enough. */
  feedAt(clientX: number, clientY: number): boolean;
  /** Feed any panda that is free to eat. */
  feedAny(): boolean;
}

export interface HerdProps {
  pandas: Panda[];
  arrivalPandaId?: string;
  evictedPandaIds?: string[];
  onPandaTap?: (panda: Panda) => void;
  pandaShadows: boolean;
  apiRef: RefObject<HerdApi | null>;
  /** The child is playing with a panda (keeps the idle camera drift away). */
  onInteract?: () => void;
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
  return { id: panda.id, panda, rig, brain, pose, leaving: false, poofed: false, landed: true, grabbed: false, dropping: false };
}

export function Herd({ pandas, arrivalPandaId, evictedPandaIds, onPandaTap, pandaShadows, apiRef, onInteract }: HerdProps) {
  const actorsRef = useRef(new Map<string, Actor>());
  const [list, setList] = useState<Actor[]>([]);
  const camera = useThree((s) => s.camera);
  const fx = useMemo(
    () => ({
      puffs: createPuffs(),
      sparkles: createSparkles(),
      zzz: createZzz(),
      hearts: createHearts(),
      blobs: createBlobs(),
    }),
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

  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const controlsRef = useRef(controls);
  const interactRef = useRef(onInteract);
  useEffect(() => {
    controlsRef.current = controls;
    interactRef.current = onInteract;
  }, [controls, onInteract]);

  // ---- Feeding ----
  const feed = (a: Actor): boolean => {
    if (a.leaving || !startMunch(a.brain)) return false;
    const r = a.rig.root.position;
    fx.puffs.burst(r.x, r.y + 0.55, r.z, 5, 0.7, 0.5);
    sfx.play('munch');
    interactRef.current?.();
    return true;
  };

  useLayoutEffect(() => {
    apiRef.current = {
      getPandaPosition(id, out) {
        const a = actorsRef.current.get(id);
        if (!a) return false;
        a.rig.root.getWorldPosition(out);
        return true;
      },
      feedAt(clientX, clientY) {
        const group = groupRef.current;
        if (!group) return false;
        const rect = gl.domElement.getBoundingClientRect();
        let best: Actor | null = null;
        let bestD = FEED_REACH_PX;
        for (const a of actorsRef.current.values()) {
          if (a.leaving || !canFeed(a.brain)) continue;
          tmpV.copy(a.rig.root.position);
          tmpV.y += 0.65;
          group.localToWorld(tmpV).project(camera);
          const px = rect.left + (tmpV.x * 0.5 + 0.5) * rect.width;
          const py = rect.top + (-tmpV.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(px - clientX, py - clientY);
          if (d < bestD) {
            bestD = d;
            best = a;
          }
        }
        return best ? feed(best) : false;
      },
      feedAny() {
        const free = [...actorsRef.current.values()].filter((a) => !a.leaving && canFeed(a.brain));
        if (free.length === 0) return false;
        // Prefer a panda that is awake and not already snacking.
        const keen = free.filter((a) => a.brain.activity !== 'nap' && a.brain.activity !== 'eat');
        const pool = keen.length ? keen : free;
        return feed(pool[Math.floor(Math.random() * pool.length)]);
      },
    };
    return () => {
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `feed` only touches refs and stable pools
  }, [apiRef, camera, gl]);

  // ---- Pick up & carry ----
  const drag = useRef<Drag | null>(null);
  const dragHandlers = useMemo(() => {
    /** Island-space point under the finger on the carry plane, kept over the island. */
    const spot = (d: Drag, out: THREE.Vector3): boolean => {
      const group = groupRef.current;
      if (!group) return false;
      const rect = gl.domElement.getBoundingClientRect();
      tmpNdc.set(((d.x - rect.left) / rect.width) * 2 - 1, -((d.y - rect.top) / rect.height) * 2 + 1);
      rayCaster.setFromCamera(tmpNdc, camera);
      tmpRay.copy(rayCaster.ray).applyMatrix4(tmpInv.copy(group.matrixWorld).invert());
      if (!tmpRay.intersectPlane(CARRY_PLANE, out)) return false;
      // Stay over the island so the panda can't be lost in the sky.
      const r = Math.hypot(out.x, out.z);
      const k = r > ISLAND_RADIUS - 0.6 ? (ISLAND_RADIUS - 0.6) / r : 1;
      out.x *= k;
      out.z *= k;
      return true;
    };
    const pickUp = (d: Drag) => {
      d.active = true;
      d.actor.grabbed = true;
      startHold(d.actor.brain);
      const c = controlsRef.current;
      if (c) c.enabled = false;
      document.body.style.cursor = 'grabbing';
      sfx.play('pickup');
      interactRef.current?.();
    };
    const stop = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('pointerdown', extraFinger, true);
    };
    const letGo = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      stop();
      if (!d.active) return;
      const c = controlsRef.current;
      if (c) c.enabled = true;
      document.body.style.cursor = '';
      interactRef.current?.();
      const a = d.actor;
      const b = a.brain;
      if (b.activity !== 'held') return;
      // Land where the finger let go (a quick flick can leave the panda trailing behind it):
      // in the pond, or at the nearest spot a panda can stand.
      let x = b.x;
      let z = b.z;
      if (spot(d, tmpV)) {
        x = tmpV.x;
        z = tmpV.z;
      }
      if (inPond(x, z)) clampToPond(x, z, tmpSpot);
      else nearestWalkable(x, z, tmpSpot);
      startDrop(b, tmpSpot.x, tmpSpot.z);
      a.dropping = true;
    };
    function move(ev: PointerEvent) {
      const d = drag.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      d.x = ev.clientX;
      d.y = ev.clientY;
      if (!d.active && Math.hypot(d.x - d.startX, d.y - d.startY) > GRAB_MOVE_PX) pickUp(d);
    }
    function up(ev: PointerEvent) {
      const d = drag.current;
      if (d && ev.pointerId === d.pointerId) letGo();
    }
    /** A second finger before the pick-up means a pinch: leave it to the camera. */
    function extraFinger(ev: PointerEvent) {
      const d = drag.current;
      if (d && !d.active && ev.pointerId !== d.pointerId) letGo();
    }
    const press = (actor: Actor, ev: PointerEvent) => {
      if (drag.current || ev.button !== 0) return;
      const act = actor.brain.activity;
      if (actor.leaving || act === 'arrive' || act === 'drop') return;
      actor.grabbed = false;
      drag.current = {
        actor,
        pointerId: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        x: ev.clientX,
        y: ev.clientY,
        t0: performance.now(),
        active: false,
      };
      // Capture phase: we must see each move before the orbit controls do.
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
      window.addEventListener('pointerdown', extraFinger, true);
    };
    return { press, pickUp, letGo, spot };
  }, [camera, gl]);
  useEffect(() => () => dragHandlers.letGo(), [dragHandlers]);

  const neighbours = useRef<Neighbour[]>([]);
  const goldScratch = useRef<{ x: number; y: number; z: number; k: number }[]>([]);
  const sleepScratch = useRef<{ x: number; y: number; z: number; heading: number; k: number; seed: number }[]>([]);
  const loveScratch = useRef<{ x: number; y: number; z: number; k: number; seed: number }[]>([]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const map = actorsRef.current;
    let removed = false;
    let blobCount = 0;
    const gold = goldScratch.current;
    const sleepers = sleepScratch.current;
    const lovers = loveScratch.current;
    gold.length = 0;
    sleepers.length = 0;
    lovers.length = 0;
    let swimmers = 0;
    const all = [...map.values()];

    // Carry the picked-up panda under the finger.
    const d = drag.current;
    if (d) {
      const a = d.actor;
      const b = a.brain;
      if (a.leaving || !map.has(a.id) || (d.active && b.activity !== 'held')) dragHandlers.letGo();
      else if (!d.active) {
        if (performance.now() - d.t0 > GRAB_HOLD_MS) dragHandlers.pickUp(d);
      } else if (groupRef.current) {
        const ox = b.x;
        const oz = b.z;
        if (dragHandlers.spot(d, tmpV)) {
          b.x = damp(b.x, tmpV.x, 18, dt);
          b.z = damp(b.z, tmpV.z, 18, dt);
        }
        // Dangle: the body trails behind the motion, and the panda turns to face the child.
        const inv = dt > 1e-4 ? 1 / dt : 0;
        const vx = (b.x - ox) * inv;
        const vz = (b.z - oz) * inv;
        const sh = Math.sin(b.heading);
        const ch = Math.cos(b.heading);
        a.pose.swayX = damp(a.pose.swayX, clamp((vx * sh + vz * ch) * 0.22, -0.6, 0.6), 9, dt);
        a.pose.swayZ = damp(a.pose.swayZ, clamp(-(vx * ch - vz * sh) * 0.22, -0.6, 0.6), 9, dt);
        tmpV.copy(camera.position);
        groupRef.current.worldToLocal(tmpV);
        const face = Math.atan2(tmpV.x - b.x, tmpV.z - b.z);
        b.heading += angleDelta(b.heading, face) * (1 - Math.exp(-5 * dt));
      }
    }

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

      // Swimmers hang in the water instead of standing on the pond bed.
      const land = heightAt(b.x, b.z);
      const swim = a.pose.swim;
      const ground = land + (WATER_LEVEL - SWIM_DEPTH - land) * swim;
      a.rig.root.position.set(b.x, ground, b.z);
      animateRig(a.rig, b, a.pose, dt, t);
      if (b.activity !== 'held') {
        a.pose.swayX = damp(a.pose.swayX, 0, 6, dt);
        a.pose.swayZ = damp(a.pose.swayZ, 0, 6, dt);
      }

      // Touch-down after being carried.
      if (a.dropping && b.activity !== 'drop') {
        a.dropping = false;
        if (b.activity === 'idle' && inPond(b.x, b.z)) {
          startSwim(b);
          fx.puffs.burst(b.x, WATER_LEVEL + 0.04, b.z, 10, 1.2, 1.5);
          sfx.play('splash');
        } else if (b.activity === 'idle') {
          fx.puffs.burst(b.x, land + 0.02, b.z, 7, 1.1, 0.2);
          sfx.play('drop');
        }
      }
      if (swim > 0.02 && swimmers < MAX_SWIMMERS) setPondSwimmer(swimmers++, b.x, b.z, swim);

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
      const shade = shrink * (1 - swim);
      if (shade > 0.03) {
        const sy = Math.max(land, WATER_LEVEL) + 0.012;
        fx.blobs.set(blobCount++, b.x, sy, b.z, 0.95 * shade, (0.95 + lie * 0.45) * shade, b.heading);
      }

      if (a.panda.color === 'golden') gold.push({ x: b.x, y: ground, z: b.z, k: 1 - a.pose.leave });
      if (a.pose.sleepy > 0.02 && !a.leaving) {
        sleepers.push({ x: b.x, y: ground, z: b.z, heading: b.heading, k: a.pose.sleepy, seed: a.pose.phase % 1 });
      }
      if (b.activity === 'munch' && a.pose.eat > 0.02 && !a.leaving) {
        lovers.push({ x: b.x, y: ground, z: b.z, k: a.pose.eat, seed: a.pose.phase % 1 });
      }
    }
    for (let i = swimmers; i < MAX_SWIMMERS; i++) setPondSwimmer(i, 0, 0, 0);

    fx.blobs.finish(blobCount);
    fx.puffs.update(dt);
    fx.sparkles.update(gold, t, size.height * gl.getPixelRatio() * 0.5);
    fx.zzz.update(sleepers, t);
    fx.hearts.update(lovers, t);
    if (removed) setList([...map.values()]);
  });

  const handleTap = (a: Actor) => {
    const act = a.brain.activity;
    if (a.leaving || act === 'arrive' || act === 'held' || act === 'drop') return false;
    if (act === 'swim' || act === 'climb') {
      // Keep paddling; just a happy little splash.
      if (act === 'swim') fx.puffs.burst(a.brain.x, WATER_LEVEL + 0.04, a.brain.z, 6, 0.9, 1.2);
    } else if (act !== 'munch') {
      startReaction(a.brain);
    }
    onPandaTap?.(a.panda);
    return true;
  };

  return (
    <group ref={groupRef}>
      {list.map((a) => (
        <PandaActor key={a.id + ':' + a.panda.color} actor={a} onTap={handleTap} onPress={dragHandlers.press} />
      ))}
      <primitive object={fx.blobs.mesh} dispose={null} />
      <primitive object={fx.puffs.mesh} dispose={null} />
      <primitive object={fx.sparkles.points} dispose={null} />
      {fx.zzz.points && <primitive object={fx.zzz.points} dispose={null} />}
      {fx.hearts.points && <primitive object={fx.hearts.points} dispose={null} />}
    </group>
  );
}

const HIT_GEO = new THREE.SphereGeometry(0.62, 12, 8);

function PandaActor({
  actor,
  onTap,
  onPress,
}: {
  actor: Actor;
  onTap: (a: Actor) => boolean;
  onPress: (a: Actor, ev: PointerEvent) => void;
}) {
  const [label, setLabel] = useState(0);
  useEffect(() => {
    if (!label) return;
    const id = window.setTimeout(() => setLabel(0), LABEL_MS);
    return () => window.clearTimeout(id);
  }, [label]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // A drag (camera orbit) or a pick-up is not a tap.
    if (actor.grabbed) {
      actor.grabbed = false;
      return;
    }
    if (e.delta > 6) return;
    if (onTap(actor)) setLabel((n) => n + 1);
  };

  return (
    <primitive object={actor.rig.root} dispose={null}>
      <mesh
        geometry={HIT_GEO}
        position={[0, 0.58, 0]}
        onClick={click}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPress(actor, e.nativeEvent);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (document.body.style.cursor !== 'grabbing') document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          if (document.body.style.cursor !== 'grabbing') document.body.style.cursor = '';
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
