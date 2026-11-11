// Shared data model (SPEC §3.1, §14.2). This file is the contract between modules —
// change it only deliberately.

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'] as const;

export type Grade = 'K' | '1' | '2' | '3' | '4' | '5';

export type PandaColor =
  | 'classic'
  | 'chocolate'
  | 'rose'
  | 'sky'
  | 'mint'
  | 'lavender'
  | 'coral'
  | 'slate'
  | 'forest'
  | 'plum'
  | 'golden'; // golden is never user-selectable

/** The ten user-selectable colours, in display order. */
export const SELECTABLE_COLORS: readonly Exclude<PandaColor, 'golden'>[] = [
  'classic',
  'chocolate',
  'rose',
  'sky',
  'mint',
  'lavender',
  'coral',
  'slate',
  'forest',
  'plum',
] as const;

export interface Profile {
  id: string; // uuid
  name: string; // 1–12 letters as typed
  avatarPandaId: string;
  createdAt: number;
}

export interface Panda {
  id: string;
  profileId: string;
  name: string; // 1–12 letters
  color: PandaColor;
  earnedAt: number;
  onIsland: boolean;
  isStarter: boolean;
  /** When the panda was last placed on the island (used for "longest on island" eviction, R-BOOK-3). */
  islandSince?: number;
}

export interface WordProgress {
  profileId: string;
  wordId: string;
  level: Level;
  state: 'mastered' | 'missed';
  lastSeenAt: number;
  missedAt?: number;
  cycle: number;
}

export interface LevelCycle {
  profileId: string;
  level: Level;
  cycle: number; // starts at 1
}

export interface DeviceSettings {
  voiceURI?: string;
  sfxEnabled: boolean; // default true
  ambientEnabled: boolean; // default false
}

export const DEFAULT_SETTINGS: DeviceSettings = { sfxEnabled: true, ambientEnabled: false };

export interface WordEntry {
  id: string; // e.g. "easy-cat"
  word: string; // /^[a-z]+$/
  level: Level;
  grade: Grade;
  sentence: string;
  homophoneGroup?: string;
}

/** Outcome of a single word within a lesson. */
export type WordOutcome = 'correct' | 'missed';

export interface WordResult {
  wordId: string;
  outcome: WordOutcome;
  firstTry: boolean; // spelled right on try 1 (earns a star)
}

export type Reward = { kind: 'none' } | { kind: 'panda' } | { kind: 'golden' };
