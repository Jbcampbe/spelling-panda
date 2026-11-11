import type { WordEntry } from '../types';
import type { SpeechProvider } from './SpeechProvider';

export interface MockSpeechCall {
  kind: 'word' | 'sentence' | 'cancel';
  wordId?: string;
}

/** Test/e2e provider: fires onStart on the next tick and resolves quickly. */
export class MockSpeechProvider implements SpeechProvider {
  readonly calls: MockSpeechCall[] = [];
  isAvailable(): boolean {
    return true;
  }
  speakWord(word: WordEntry, opts?: { onStart?: () => void }): Promise<void> {
    this.calls.push({ kind: 'word', wordId: word.id });
    return new Promise((resolve) => {
      setTimeout(() => {
        opts?.onStart?.();
        setTimeout(resolve, 5);
      }, 0);
    });
  }
  speakSentence(word: WordEntry): Promise<void> {
    this.calls.push({ kind: 'sentence', wordId: word.id });
    return new Promise((resolve) => setTimeout(resolve, 5));
  }
  cancel(): void {
    this.calls.push({ kind: 'cancel' });
  }
}
