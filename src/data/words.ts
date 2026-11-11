import type { Level, WordEntry } from '../types';
import easy from './words/easy.json';
import medium from './words/medium.json';
import hard from './words/hard.json';

/** The full static word library (SPEC §14). Validated at build time by scripts/validate-words.ts. */
export const WORDS_BY_LEVEL: Record<Level, WordEntry[]> = {
  easy: easy as WordEntry[],
  medium: medium as WordEntry[],
  hard: hard as WordEntry[],
};

export const ALL_WORDS: WordEntry[] = [
  ...WORDS_BY_LEVEL.easy,
  ...WORDS_BY_LEVEL.medium,
  ...WORDS_BY_LEVEL.hard,
];

const byId = new Map(ALL_WORDS.map((w) => [w.id, w]));
export function getWord(id: string): WordEntry | undefined {
  return byId.get(id);
}
