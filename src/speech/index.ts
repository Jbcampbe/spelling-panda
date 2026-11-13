import { MockSpeechProvider } from './mockSpeechProvider';
import type { SpeakingListener, SpeechProvider } from './SpeechProvider';
import { ElevenLabsSpeechProvider } from './elevenLabsProvider';
import type { VoiceLike } from './voiceSelect';

export type { SpeechProvider, SpeakingListener } from './SpeechProvider';
export { MockSpeechProvider } from './mockSpeechProvider';
export { WebSpeechProvider } from './webSpeechProvider';
export { ElevenLabsSpeechProvider } from './elevenLabsProvider';
export { pickVoice, listUsVoices } from './voiceSelect';
export type { VoiceLike } from './voiceSelect';
export { startEasyFlash } from './easyFlash';

/** Provider plus parent-area extras; the mock implements them as harmless stubs. */
export interface AppSpeechProvider extends SpeechProvider {
  setVoiceURI(uri?: string): void;
  getUsVoices(): VoiceLike[];
  speakTest(text: string, voiceURI?: string): Promise<void>;
  onSpeakingChange(listener: SpeakingListener): () => void;
  onVoicesChanged(listener: () => void): () => void;
}

declare global {
  interface Window {
    __PANDA_MOCK_SPEECH__?: boolean;
  }
}

function shouldMock(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__PANDA_MOCK_SPEECH__ === true) return true;
  return new URLSearchParams(window.location.search).get('mockSpeech') === '1';
}

class MockAppProvider extends MockSpeechProvider implements AppSpeechProvider {
  setVoiceURI(): void {}
  getUsVoices(): VoiceLike[] {
    return [];
  }
  speakTest(): Promise<void> {
    return Promise.resolve();
  }
  onSpeakingChange(): () => void {
    return () => {};
  }
  onVoicesChanged(): () => void {
    return () => {};
  }
}

export function createSpeechProvider(): AppSpeechProvider {
  return shouldMock() ? new MockAppProvider() : new ElevenLabsSpeechProvider();
}
