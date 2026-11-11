import type { Environment } from '../panda/behaviour';
import { EDGE_MARGIN, OBSTACLES, PANDA_RADIUS, POND, edgeRadius, pondDistance } from './layout';

function edgeLimit(x: number, z: number): number {
  return edgeRadius(Math.atan2(z, x)) - EDGE_MARGIN;
}

/** The floating island as seen by panda brains. */
export const islandEnvironment: Environment = {
  water: POND,
  isWalkable(x, z, margin) {
    if (Math.hypot(x, z) > edgeLimit(x, z) - margin) return false;
    for (const o of OBSTACLES) {
      if (Math.hypot(x - o.x, z - o.z) < o.r + PANDA_RADIUS + margin) return false;
    }
    return true;
  },
  obstaclePush(x, z) {
    let px = 0;
    let pz = 0;
    const influence = 0.55;
    for (const o of OBSTACLES) {
      const dx = x - o.x;
      const dz = z - o.z;
      const d = Math.hypot(dx, dz);
      const reach = o.r + PANDA_RADIUS + influence;
      if (d < reach && d > 1e-4) {
        const k = (1 - d / reach) ** 1.5 * 1.4;
        px += (dx / d) * k;
        pz += (dz / d) * k;
      }
    }
    const r = Math.hypot(x, z);
    const lim = edgeLimit(x, z);
    if (r > lim - influence && r > 1e-4) {
      const k = Math.min(1.5, (r - (lim - influence)) / influence) * 1.2;
      px -= (x / r) * k;
      pz -= (z / r) * k;
    }
    return { x: px, z: pz };
  },
  segmentClear(ax, az, bx, bz, margin) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(ax + (bx - ax) * t, az + (bz - az) * t, margin)) return false;
    }
    return true;
  },
  randomPoint(rand) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 5;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  },
};

/** Deterministic-ish spawn spot seeded by panda id, kept apart from `taken` spots. */
export function spawnPoint(
  rand: () => number,
  taken: readonly { x: number; z: number }[],
): { x: number; z: number } {
  let best = { x: 0, z: 0.5 };
  let bestScore = -Infinity;
  for (let i = 0; i < 40; i++) {
    const p = islandEnvironment.randomPoint(rand);
    if (!islandEnvironment.isWalkable(p.x, p.z, 0.2)) continue;
    let nearest = 99;
    for (const t of taken) nearest = Math.min(nearest, Math.hypot(p.x - t.x, p.z - t.z));
    // Prefer spots with room, slightly toward the centre/front so they read well.
    const score = Math.min(nearest, 2.2) - Math.hypot(p.x, p.z) * 0.08;
    if (score > bestScore) {
      bestScore = score;
      best = p;
      if (nearest > 1.8 && i > 6) break;
    }
  }
  return best;
}

/** True when a panda dropped at (x,z) lands in the pond. */
export function inPond(x: number, z: number): boolean {
  return pondDistance(x, z) < POND.r * 0.92;
}

/** Pull a point into the part of the pond that is deep enough to swim in. */
export function clampToPond(x: number, z: number, out: { x: number; z: number }): void {
  const d = pondDistance(x, z);
  const lim = POND.r * 0.62;
  const k = d > lim ? lim / d : 1;
  out.x = POND.x + (x - POND.x) * k;
  out.z = POND.z + (z - POND.z) * k;
}

/**
 * Nearest spot to (x,z) where a panda can stand (the point itself when it is already fine).
 * Searches outward in rings, so a drop on a tree or off the edge lands just beside it.
 */
export function nearestWalkable(x: number, z: number, out: { x: number; z: number }): void {
  out.x = x;
  out.z = z;
  if (islandEnvironment.isWalkable(x, z, 0)) return;
  for (let r = 0.12; r < 7; r += 0.12) {
    const n = Math.max(8, Math.ceil(r * 14));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (islandEnvironment.isWalkable(px, pz, 0.04)) {
        out.x = px;
        out.z = pz;
        return;
      }
    }
  }
  out.x = 0;
  out.z = 0.5;
}
