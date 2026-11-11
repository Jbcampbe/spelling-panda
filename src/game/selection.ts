import type { WordEntry, WordProgress } from '../types';
import { shuffle, type Rng } from './rng';

export interface BuildLessonArgs {
  /** All words of the chosen level. */
  pool: readonly WordEntry[];
  /** Progress rows for this profile + level. */
  progress: readonly WordProgress[];
  /** Current LevelCycle.cycle (starts at 1). */
  cycle: number;
  rng: Rng;
  size?: number;
  maxQueued?: number;
}

export interface LessonSelection {
  words: WordEntry[];
  /** Equals the input cycle unless a new cycle was started (R-SEL-6). */
  cycle: number;
}

/** Missed words for the pool, oldest `missedAt` first (R-SEL-1). */
export function missedQueue(
  pool: readonly WordEntry[],
  progress: readonly WordProgress[],
): WordEntry[] {
  const byId = new Map(pool.map((w) => [w.id, w]));
  return progress
    .filter((p) => p.state === 'missed' && byId.has(p.wordId))
    .sort((a, b) => (a.missedAt ?? 0) - (b.missedAt ?? 0))
    .map((p) => byId.get(p.wordId) as WordEntry);
}

/** R-SEL-4..9. Pure; all randomness comes from `rng`. */
export function buildLesson(args: BuildLessonArgs): LessonSelection {
  const { pool, progress, rng, size = 10, maxQueued = 3 } = args;
  let cycle = args.cycle;

  const chosen: WordEntry[] = [];
  const chosenIds = new Set<string>();
  const groups = new Set<string>();
  const tryAdd = (w: WordEntry): boolean => {
    if (chosen.length >= size || chosenIds.has(w.id)) return false;
    if (w.homophoneGroup && groups.has(w.homophoneGroup)) return false;
    chosen.push(w);
    chosenIds.add(w.id);
    if (w.homophoneGroup) groups.add(w.homophoneGroup);
    return true;
  };

  const queue = missedQueue(pool, progress);
  const queuedIds = new Set(queue.map((w) => w.id));
  let queuedTaken = 0;
  for (const w of queue) {
    if (queuedTaken >= maxQueued) break;
    if (tryAdd(w)) queuedTaken++;
  }

  const masteredNow = new Set(
    progress.filter((p) => p.state === 'mastered' && p.cycle === cycle).map((p) => p.wordId),
  );
  for (const w of shuffle(pool, rng)) {
    if (chosen.length >= size) break;
    if (queuedIds.has(w.id) || masteredNow.has(w.id)) continue;
    tryAdd(w);
  }

  // Not enough unseen words: roll over to a new cycle (R-SEL-6).
  if (chosen.length < size) {
    let added = 0;
    for (const w of shuffle(pool, rng)) {
      if (chosen.length >= size) break;
      if (queuedIds.has(w.id)) continue;
      if (tryAdd(w)) added++;
    }
    if (added > 0) cycle += 1;
  }

  // Tiny pools: top up with remaining queued words as a last resort.
  if (chosen.length < size) {
    for (const w of queue) {
      if (chosen.length >= size) break;
      tryAdd(w);
    }
  }

  return { words: shuffle(chosen, rng), cycle };
}
