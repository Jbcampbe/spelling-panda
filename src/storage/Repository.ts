import type {
  DeviceSettings,
  Level,
  LevelCycle,
  Panda,
  Profile,
  WordProgress,
} from '../types';

/**
 * SPEC R-ENG-2: persistence behind an interface so it can be swapped or mocked.
 * All methods are async. Implementations: IndexedDB (idbRepository.ts) and in-memory (memoryRepository.ts).
 */
export interface Repository {
  // Profiles
  listProfiles(): Promise<Profile[]>; // ordered by createdAt
  /** Create a profile and its starter panda atomically. */
  createProfileWithStarter(profile: Profile, starter: Panda): Promise<void>;
  /** Delete a profile and ALL its data (pandas, progress, cycles) atomically. */
  deleteProfile(profileId: string): Promise<void>;

  // Pandas
  listPandas(profileId: string): Promise<Panda[]>; // ordered by earnedAt
  /** Replace/insert several pandas in one transaction (used for island toggles and arrivals). */
  putPandas(pandas: Panda[]): Promise<void>;

  // Word progress
  listWordProgress(profileId: string, level: Level): Promise<WordProgress[]>;
  getLevelCycle(profileId: string, level: Level): Promise<LevelCycle>; // defaults to cycle 1

  /**
   * R-PRF-6: write all results of a lesson (or partial lesson on leave) in ONE transaction.
   * `cycle` is the updated LevelCycle if selection started a new cycle (else omit).
   * `pandas` are any panda rows to write (e.g. newly earned + evicted from island).
   */
  commitLesson(args: {
    progress: WordProgress[];
    cycle?: LevelCycle;
    pandas?: Panda[];
  }): Promise<void>;

  // Device settings
  getSettings(): Promise<DeviceSettings>; // returns defaults if unset
  putSettings(settings: DeviceSettings): Promise<void>;
}
