import type { Level, WordProgress, WordResult } from '../types';

export interface ApplyResultsArgs {
  existing: readonly WordProgress[];
  results: readonly WordResult[];
  profileId: string;
  level: Level;
  cycle: number;
  now: number;
}

/**
 * Rows to write after a lesson (completed or abandoned; abandoned = only answered words).
 * Correct → mastered in the current cycle (leaves the queue). Missed → missed with
 * missedAt = now (moves to the back of the queue). Pure; does not mutate inputs.
 */
export function applyResults(args: ApplyResultsArgs): WordProgress[] {
  const { existing, results, profileId, level, cycle, now } = args;
  const byWord = new Map(existing.map((p) => [p.wordId, p]));
  const out = new Map<string, WordProgress>();
  for (const r of results) {
    const prev = byWord.get(r.wordId);
    const base = { profileId, wordId: r.wordId, level: prev?.level ?? level, lastSeenAt: now, cycle };
    out.set(
      r.wordId,
      r.outcome === 'correct'
        ? { ...base, state: 'mastered' }
        : { ...base, state: 'missed', missedAt: now },
    );
  }
  return [...out.values()];
}
