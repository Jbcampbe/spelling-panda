import type { Environment } from '../panda/behaviour';
import { EDGE_MARGIN, OBSTACLES, PANDA_RADIUS, edgeRadius } from './layout';

function edgeLimit(x: number, z: number): number {
  return edgeRadius(Math.atan2(z, x)) - EDGE_MARGIN;
}

/** The floating island as seen by panda brains. */
export const islandEnvironment: Environment = {
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
