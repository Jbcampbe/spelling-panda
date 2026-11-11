/** SPEC R-SND-1/2: Web Audio synthesised sound effects. Implementation in sfx.ts. */
export type SfxName =
  | 'correct'
  | 'tryAgain'
  | 'squeak'
  | 'tap'
  | 'key'
  | 'fanfare'
  | 'fanfareGolden'
  | 'reveal';

export interface SfxEngine {
  /** Must be called from a user gesture once to unlock audio on iOS. Safe to call repeatedly. */
  unlock(): void;
  play(name: SfxName): void;
  setSfxEnabled(enabled: boolean): void;
  setAmbientEnabled(enabled: boolean): void;
  /** Duck ambient while speech is playing. */
  setDucked(ducked: boolean): void;
}
