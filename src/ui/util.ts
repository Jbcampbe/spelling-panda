import type { Level } from '../types';

export function isMockSpeech(): boolean {
  if (typeof window === 'undefined') return false;
  return window.__PANDA_MOCK_SPEECH__ === true || new URLSearchParams(window.location.search).get('mockSpeech') === '1';
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export const LEVEL_LABEL: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

declare global {
  interface Window {
    __PANDA_DEBUG__?: { currentWord?: string; level?: string };
  }
}

/** Captured `beforeinstallprompt` event (Android / desktop install, R-PAR-2). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installEvent: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    installListeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installListeners.forEach((l) => l());
  });
}
export function getInstallEvent(): InstallPromptEvent | null {
  return installEvent;
}
export function onInstallEventChange(l: () => void): () => void {
  installListeners.add(l);
  return () => installListeners.delete(l);
}
