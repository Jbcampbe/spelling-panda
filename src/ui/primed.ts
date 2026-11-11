import type { AppSpeechProvider } from '../speech';
import type { WordEntry } from '../types';

/**
 * iOS only allows speech that begins inside a user gesture (R-SPK-6). The level-picker tap
 * starts the first word synchronously and hands the "speech started" signal to the lesson.
 */
interface Primed {
  wordId: string;
  at: number;
  started: Promise<void>;
  valid: boolean;
}
let primed: Primed | null = null;

export function primeSpeech(speech: AppSpeechProvider, word: WordEntry): void {
  let resolve: () => void = () => {};
  const started = new Promise<void>((r) => {
    resolve = r;
  });
  primed = { wordId: word.id, at: performance.now(), started, valid: true };
  speech.speakWord(word, { onStart: resolve }).then(resolve, resolve);
}

export function takePrimed(wordId: string): { started: Promise<void> } | null {
  if (!primed || !primed.valid || primed.wordId !== wordId) return null;
  if (performance.now() - primed.at > 8000) return null;
  return primed;
}

export function invalidatePrimed(): void {
  if (primed) primed.valid = false;
}
