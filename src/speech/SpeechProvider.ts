import type { WordEntry } from '../types';

/** SPEC R-SPK-2: all speech goes through this interface. */
export interface SpeechProvider {
  isAvailable(): boolean;
  speakWord(word: WordEntry, opts?: { onStart?: () => void }): Promise<void>;
  speakSentence(word: WordEntry): Promise<void>;
  cancel(): void;
}

/** Optional observer so ambient audio can duck while speaking (R-SND-2). */
export type SpeakingListener = (speaking: boolean) => void;
