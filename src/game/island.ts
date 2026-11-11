import type { Panda } from '../types';

/** R-BOOK-1. */
export const ISLAND_CAP = 12;

const since = (p: Panda): number => p.islandSince ?? p.earnedAt;

/**
 * R-BOOK-3: a new panda always arrives on the island. Returns the rows to write
 * (the new panda, plus an evicted one if the island was at `cap`).
 */
export function placeNewPanda(
  pandas: readonly Panda[],
  newPanda: Panda,
  cap: number,
  now: number,
): Panda[] {
  const placed: Panda = { ...newPanda, onIsland: true, islandSince: now };
  const rows: Panda[] = [placed];
  const onIsland = pandas.filter((p) => p.onIsland && p.id !== newPanda.id);
  let excess = onIsland.length + 1 - cap;
  const oldestFirst = [...onIsland].sort((a, b) => since(a) - since(b));
  for (const p of oldestFirst) {
    if (excess <= 0) break;
    rows.push({ ...p, onIsland: false });
    excess--;
  }
  return rows;
}

export type ToggleResult = { ok: true; changed: Panda[] } | { ok: false; reason: 'full' };

/** R-BOOK-2: toggle a panda on/off the island; refuses to add when full. */
export function togglePanda(
  pandas: readonly Panda[],
  id: string,
  cap: number,
  now: number,
): ToggleResult {
  const p = pandas.find((x) => x.id === id);
  if (!p) return { ok: true, changed: [] };
  if (p.onIsland) return { ok: true, changed: [{ ...p, onIsland: false }] };
  const count = pandas.filter((x) => x.onIsland).length;
  if (count >= cap) return { ok: false, reason: 'full' };
  return { ok: true, changed: [{ ...p, onIsland: true, islandSince: now }] };
}

/**
 * Pandas to render: up to `cap` on-island pandas, most recently placed first.
 * Lowering the cap (adaptive quality) only affects rendering; stored data is untouched.
 */
export function islandPandas(pandas: readonly Panda[], cap: number): Panda[] {
  return pandas
    .filter((p) => p.onIsland)
    .sort((a, b) => since(b) - since(a))
    .slice(0, Math.max(0, cap));
}
