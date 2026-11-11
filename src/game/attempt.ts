import type { WordEntry, WordResult } from '../types';

export const MAX_TRIES = 3;

export type AttemptStatus = 'typing' | 'correct' | 'revealed';

export interface AttemptState {
  wordId: string;
  word: string;
  /** Number of submitted tries so far. */
  tries: number;
  /** Wrong attempts so far, oldest first (shown faded above the input, R-LSN-8). */
  attempts: string[];
  status: AttemptStatus;
  /** True after the first wrong try and for the rest of the word (R-LSN-9). */
  revealAvailable: boolean;
  /** Spelled right on try 1. */
  firstTry: boolean;
}

/** R-LSN-6: case-insensitive, trimmed, exact. */
export function checkAnswer(input: string, word: Pick<WordEntry, 'word'>): boolean {
  return input.trim().toLowerCase() === word.word.trim().toLowerCase();
}

export function newAttempt(word: Pick<WordEntry, 'id' | 'word'>): AttemptState {
  return {
    wordId: word.id,
    word: word.word,
    tries: 0,
    attempts: [],
    status: 'typing',
    revealAvailable: false,
    firstTry: false,
  };
}

/** Submit a try (R-LSN-5..8, 11). Empty input or a finished word is a no-op (same state returned). */
export function submitTry(state: AttemptState, input: string): AttemptState {
  if (state.status !== 'typing') return state;
  const trimmed = input.trim();
  if (trimmed === '') return state;
  const tries = state.tries + 1;
  if (checkAnswer(trimmed, { word: state.word })) {
    return { ...state, tries, status: 'correct', firstTry: tries === 1 };
  }
  return {
    ...state,
    tries,
    attempts: [...state.attempts, trimmed],
    revealAvailable: true,
    status: tries >= MAX_TRIES ? 'revealed' : 'typing',
  };
}

/** Reveal button (R-LSN-9/11). Only valid once available. */
export function reveal(state: AttemptState): AttemptState {
  if (state.status !== 'typing' || !state.revealAvailable) return state;
  return { ...state, status: 'revealed' };
}

/** Last wrong attempt, shown next to the answer on reveal. */
export function lastAttempt(state: AttemptState): string | undefined {
  return state.attempts[state.attempts.length - 1];
}

/** Final result once the word is finished, else null (R-LSN-12). */
export function outcomeOf(state: AttemptState): WordResult | null {
  if (state.status === 'correct') {
    return { wordId: state.wordId, outcome: 'correct', firstTry: state.firstTry };
  }
  if (state.status === 'revealed') {
    return { wordId: state.wordId, outcome: 'missed', firstTry: false };
  }
  return null;
}
