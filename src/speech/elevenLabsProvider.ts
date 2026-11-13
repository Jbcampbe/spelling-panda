import type { WordEntry } from '../types';
import type { SpeakingListener, SpeechProvider } from './SpeechProvider';
import type { VoiceLike } from './voiceSelect';
import { WebSpeechProvider } from './webSpeechProvider';

/** Bump to invalidate cached audio after changing the server's voice or model. */
const AUDIO_VERSION = '1';
const SAFETY_TIMEOUT_MS = 20000;
/** After this many failures in a row, stop trying ElevenLabs for the session. */
const MAX_FAILURES = 2;

/**
 * Natural AI voice via the server's /api/tts endpoint (ElevenLabs), used when the parent leaves the
 * voice on "Automatic". Picking a specific device voice, or any playback failure (offline, no key,
 * quota), uses the Web Speech provider instead.
 *
 * R-SPK-6: one shared <audio> element is started synchronously inside the caller's tap handler, so
 * iOS treats it as user-initiated.
 */
export class ElevenLabsSpeechProvider implements SpeechProvider {
  private readonly fallback = new WebSpeechProvider();
  private readonly audio: HTMLAudioElement | undefined =
    typeof Audio !== 'undefined' ? new Audio() : undefined;
  private voiceURI: string | undefined;
  private failures = 0;
  private listeners = new Set<SpeakingListener>();
  private current: { finish: () => void } | null = null;

  constructor() {
    if (this.audio) this.audio.preload = 'auto';
    this.fallback.onSpeakingChange((s) => this.emit(s));
  }

  private useAi(voiceURI = this.voiceURI): boolean {
    return !!this.audio && !voiceURI && this.failures < MAX_FAILURES;
  }

  isAvailable(): boolean {
    return !!this.audio || this.fallback.isAvailable();
  }

  setVoiceURI(uri?: string): void {
    this.voiceURI = uri;
    this.fallback.setVoiceURI(uri);
  }

  getUsVoices(): VoiceLike[] {
    return this.fallback.getUsVoices();
  }

  onVoicesChanged(listener: () => void): () => void {
    return this.fallback.onVoicesChanged(listener);
  }

  onSpeakingChange(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(speaking: boolean): void {
    this.listeners.forEach((l) => l(speaking));
  }

  speakWord(word: WordEntry, opts?: { onStart?: () => void }): Promise<void> {
    if (!this.useAi()) return this.fallback.speakWord(word, opts);
    return this.play(`id=${encodeURIComponent(word.id)}&kind=word`, opts?.onStart, () =>
      this.fallback.speakWord(word, opts),
    );
  }

  speakSentence(word: WordEntry): Promise<void> {
    if (!this.useAi()) return this.fallback.speakSentence(word);
    return this.play(`id=${encodeURIComponent(word.id)}&kind=sentence`, undefined, () =>
      this.fallback.speakSentence(word),
    );
  }

  /** Parent voice test (R-SPK-8). The server only speaks its fixed test phrase. */
  speakTest(text: string, voiceURI?: string): Promise<void> {
    if (!this.useAi(voiceURI)) return this.fallback.speakTest(text, voiceURI);
    return this.play('kind=test', undefined, () => this.fallback.speakTest(text, voiceURI));
  }

  cancel(): void {
    const cur = this.current;
    if (this.audio && !this.audio.paused) this.audio.pause();
    cur?.finish();
    this.fallback.cancel();
  }

  private play(
    query: string,
    onStart: (() => void) | undefined,
    fallback: () => Promise<void>,
  ): Promise<void> {
    const audio = this.audio!;
    this.cancel();
    return new Promise<void>((resolve) => {
      let done = false;
      let started = false;
      const entry = { finish: () => {} };
      const cleanup = () => {
        clearTimeout(timer);
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (this.current === entry) {
          this.current = null;
          this.emit(false);
        }
      };
      const finish = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      };
      const fail = () => {
        if (done) return;
        done = true;
        cleanup();
        this.failures += 1;
        // Nothing was heard yet, so say it with the device voice instead.
        if (!started) void fallback().then(resolve, resolve);
        else resolve();
      };
      const handlePlaying = () => {
        if (started) return;
        started = true;
        this.failures = 0;
        onStart?.();
      };
      const handleEnded = () => finish();
      const handleError = () => fail();
      entry.finish = finish;
      const timer = setTimeout(fail, SAFETY_TIMEOUT_MS);

      audio.addEventListener('playing', handlePlaying);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      this.current = entry;
      this.emit(true);
      audio.src = `/api/tts?${query}&v=${AUDIO_VERSION}`;
      audio.play().catch((err: unknown) => {
        // AbortError means a newer play()/pause() replaced this one; that path already finished us.
        if ((err as { name?: string })?.name !== 'AbortError') fail();
      });
    });
  }
}
