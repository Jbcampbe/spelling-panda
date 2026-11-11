import type { Reward, WordResult } from '../types';

export interface LessonScore {
  correct: number;
  stars: number;
  total: number;
}

export function scoreLesson(results: readonly WordResult[]): LessonScore {
  let correct = 0;
  let stars = 0;
  for (const r of results) {
    if (r.outcome === 'correct') {
      correct++;
      if (r.firstTry) stars++;
    }
  }
  return { correct, stars, total: results.length };
}

/** R-RWD-1..3: 8–9 of 10 → panda, 10 of 10 → golden, else none. */
export function rewardFor(correct: number, total = 10): Reward {
  if (total >= 10 && correct >= total) return { kind: 'golden' };
  if (total >= 10 && correct >= 8) return { kind: 'panda' };
  return { kind: 'none' };
}
