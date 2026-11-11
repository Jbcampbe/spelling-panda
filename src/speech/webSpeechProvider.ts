import type { WordEntry } from '../types';
import type { SpeakingListener, SpeechProvider } from './SpeechProvider';
import { listUsVoices, pickVoice } from './voiceSelect';

export const WORD_RATE = 0.85;
export const SENTENCE_RATE = 0.9;
export const PITCH = 1;
const SAFETY_TIMEOUT_MS = 15000;

/**
 * Web Speech API provider (R-SPK-1). NOTE (R-SPK-6): iOS Safari only allows the first
 * utterance of a session from a user gesture, so the UI must call speakWord/speakTest
 * (or speak anything) from a tap handler first.
 */
export class WebSpeechProvider implements SpeechProvider {
  private voices: SpeechSynthesisVoice[] = [];
  private voiceURI: string | undefined;
  private listeners = new Set<SpeakingListener>();
  private current: { finish: () => void } | null = null;
  private voiceListeners = new Set<() => void>();

  constructor() {
    const synth = this.synth();
    if (!synth) return;
    this.refreshVoices();
    synth.addEventListener?.('voiceschanged', () => {
      this.refreshVoices();
      this.voiceListeners.forEach((l) => l());
    });
  }

  private synth(): SpeechSynthesis | undefined {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
      ? window.speechSynthesis
      : undefined;
  }

  private refreshVoices(): void {
    this.voices = this.synth()?.getVoices() ?? [];
  }

  isAvailable(): boolean {
    return this.synth() !== undefined;
  }

  setVoiceURI(uri?: string): void {
    this.voiceURI = uri;
  }

  getUsVoices(): SpeechSynthesisVoice[] {
    return listUsVoices(this.voices);
  }

  /** Called when the voice list changes (async loading). Returns unsubscribe. */
  onVoicesChanged(listener: () => void): () => void {
    this.voiceListeners.add(listener);
    return () => this.voiceListeners.delete(listener);
  }

  onSpeakingChange(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(speaking: boolean): void {
    this.listeners.forEach((l) => l(speaking));
  }

  speakWord(word: WordEntry, opts?: { onStart?: () => void }): Promise<void> {
    return this.speak(word.word, WORD_RATE, opts?.onStart);
  }

  speakSentence(word: WordEntry): Promise<void> {
    return this.speak(word.sentence, SENTENCE_RATE);
  }

  /** Parent voice test (R-SPK-8); optional explicit voice URI to audition. */
  speakTest(text: string, voiceURI?: string): Promise<void> {
    return this.speak(text, WORD_RATE, undefined, voiceURI);
  }

  cancel(): void {
    const synth = this.synth();
    if (!synth) return;
    const cur = this.current;
    synth.cancel();
    cur?.finish();
  }

  private speak(text: string, rate: number, onStart?: () => void, voiceURI?: string): Promise<void> {
    const synth = this.synth();
    if (!synth) return Promise.resolve();
    // R-SPK-5: cancel any in-progress utterance (also works around Chrome's stuck queue).
    this.cancel();
    if (this.voices.length === 0) this.refreshVoices();

    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      u.pitch = PITCH;
      const voice = pickVoice(this.voices, voiceURI ?? this.voiceURI);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      let done = false;
      const entry = { finish: () => {} };
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (this.current === entry) {
          this.current = null;
          this.emit(false);
        }
        resolve();
      };
      entry.finish = finish;
      const timer = setTimeout(finish, SAFETY_TIMEOUT_MS);
      u.onstart = () => onStart?.();
      u.onend = finish;
      u.onerror = finish;
      this.current = entry;
      this.emit(true);
      synth.speak(u);
    });
  }
}
