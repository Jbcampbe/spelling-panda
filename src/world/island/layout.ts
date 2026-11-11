/**
 * Island layout: terrain height field, outline, obstacle circles and decor placements.
 * Pure data + math so the behaviour module and the renderers agree on the world.
 */
import { smoothstep } from '../random';

export const ISLAND_RADIUS = 6.2;
/** Thickness of the rounded grassy rim. */
export const RIM = 0.38;

/** Organic outline: radius multiplier as a function of angle. */
export function edgeFactor(theta: number): number {
  return (
    1 +
    0.055 * Math.sin(3 * theta + 1.1) +
    0.035 * Math.sin(5 * theta + 2.3) +
    0.02 * Math.sin(8 * theta + 0.4)
  );
}

export function edgeRadius(theta: number): number {
  return ISLAND_RADIUS * edgeFactor(theta);
}

export const POND = { x: 1.95, z: 1.45, r: 1.25 } as const;
export const WATER_LEVEL = -0.13;

/** Gentle rolling meadow without the pond. */
export function baseHeight(x: number, z: number): number {
  const r2 = x * x + z * z;
  return (
    0.07 * Math.sin(0.62 * x + 0.4) * Math.cos(0.55 * z - 0.3) +
    0.045 * Math.sin(1.1 * x + 0.9 * z + 1.7) +
    0.12 -
    0.004 * r2
  );
}

export function pondDistance(x: number, z: number): number {
  return Math.hypot(x - POND.x, z - POND.z);
}

/** Terrain height of the grassy top (island-local space). */
export function heightAt(x: number, z: number): number {
  const d = pondDistance(x, z);
  const bowl = 1 - smoothstep(POND.r * 0.45, POND.r * 1.12, d);
  return baseHeight(x, z) - bowl * 0.55;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export type TreeKind = 'green' | 'blossom' | 'mint';
export interface TreeSpot extends Circle {
  s: number;
  kind: TreeKind;
}
export const TREES: readonly TreeSpot[] = [
  { x: -3.55, z: -1.55, r: 0.55, s: 1.12, kind: 'green' },
  { x: -0.95, z: -4.05, r: 0.5, s: 0.95, kind: 'blossom' },
  { x: 3.65, z: -2.35, r: 0.5, s: 1.02, kind: 'mint' },
  { x: -3.85, z: 2.55, r: 0.45, s: 0.86, kind: 'blossom' },
];

export interface BambooSpot extends Circle {
  stalks: number;
  seed: number;
}
export const BAMBOO: readonly BambooSpot[] = [
  { x: -2.05, z: -3.25, r: 0.55, stalks: 7, seed: 11 },
  { x: 4.35, z: 0.15, r: 0.5, stalks: 6, seed: 23 },
  { x: 1.45, z: -4.25, r: 0.5, stalks: 6, seed: 37 },
  { x: -4.7, z: 0.45, r: 0.5, stalks: 5, seed: 41 },
];

export interface RockSpot extends Circle {
  h: number;
  seed: number;
}
export const ROCKS: readonly RockSpot[] = [
  { x: 3.35, z: 2.95, r: 0.42, h: 0.32, seed: 1 },
  { x: 3.85, z: 2.55, r: 0.22, h: 0.18, seed: 2 },
  { x: 0.55, z: 2.75, r: 0.24, h: 0.16, seed: 3 },
  { x: -1.9, z: 3.75, r: 0.46, h: 0.34, seed: 4 },
  { x: 2.85, z: -0.55, r: 0.26, h: 0.2, seed: 5 },
  { x: -0.55, z: -2.35, r: 0.2, h: 0.14, seed: 6 },
  { x: -4.6, z: -2.75, r: 0.3, h: 0.24, seed: 7 },
];

export interface BushSpot extends Circle {
  seed: number;
  tint: 'green' | 'sage' | 'berry';
}
export const BUSHES: readonly BushSpot[] = [
  { x: -0.25, z: 4.7, r: 0.5, seed: 1, tint: 'green' },
  { x: 4.75, z: 2.0, r: 0.42, seed: 2, tint: 'sage' },
  { x: -4.85, z: -1.0, r: 0.4, seed: 3, tint: 'berry' },
  { x: 2.45, z: -3.6, r: 0.38, seed: 4, tint: 'green' },
  { x: -2.85, z: 4.25, r: 0.36, seed: 5, tint: 'sage' },
  { x: 0.4, z: -4.95, r: 0.34, seed: 6, tint: 'sage' },
];

export const MUSHROOMS: readonly { x: number; z: number; s: number }[] = [
  { x: -3.0, z: -1.05, s: 1 },
  { x: -3.15, z: -0.8, s: 0.7 },
  { x: 3.1, z: -2.0, s: 0.85 },
  { x: -3.35, z: 2.95, s: 0.8 },
];

/** Everything pandas must walk around (pond is treated as a big obstacle). */
export const OBSTACLES: readonly Circle[] = [
  { x: POND.x, z: POND.z, r: POND.r * 1.02 },
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: t.r })),
  ...BAMBOO.map((b) => ({ x: b.x, z: b.z, r: b.r })),
  ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: r.r + 0.05 })),
  ...BUSHES.map((b) => ({ x: b.x, z: b.z, r: b.r })),
];

/** How far pandas keep from the rim (island units). */
export const EDGE_MARGIN = 1.05;
export const PANDA_RADIUS = 0.36;
