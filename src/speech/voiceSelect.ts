export type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService' | 'default' | 'voiceURI'>;

const QUALITY_RE = /enhanced|premium|natural|neural/i;

/** Accepts 'en-US' and 'en_US' (case-insensitive). */
export function isUsEnglish(v: Pick<VoiceLike, 'lang'>): boolean {
  return v.lang.replace('_', '-').toLowerCase() === 'en-us';
}

function score(v: VoiceLike): number {
  return (QUALITY_RE.test(v.name) ? 4 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
}

/** en-US voices, best first (stable for ties). */
export function listUsVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  return voices
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => isUsEnglish(v))
    .sort((a, b) => score(b.v) - score(a.v) || a.i - b.i)
    .map(({ v }) => v);
}

/** R-SPK-3. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], preferredURI?: string): T | undefined {
  const us = listUsVoices(voices);
  if (preferredURI) {
    const pref = us.find((v) => v.voiceURI === preferredURI);
    if (pref) return pref;
  }
  return us[0];
}
