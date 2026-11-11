import {
  DEFAULT_SETTINGS,
  type DeviceSettings,
  type Level,
  type LevelCycle,
  type Panda,
  type Profile,
  type WordProgress,
} from '../types';
import type { Repository } from './Repository';

/** In-memory Repository for tests and the e2e mock. Stores deep copies. */
export function createMemoryRepository(): Repository {
  const profiles = new Map<string, Profile>();
  const pandas = new Map<string, Panda>();
  const progress = new Map<string, WordProgress>();
  const cycles = new Map<string, LevelCycle>();
  let settings: DeviceSettings | undefined;

  const copy = <T>(v: T): T => structuredClone(v);
  const pKey = (p: { profileId: string; wordId: string }) => `${p.profileId}|${p.wordId}`;
  const cKey = (profileId: string, level: Level) => `${profileId}|${level}`;

  return {
    async listProfiles() {
      return [...profiles.values()].sort((a, b) => a.createdAt - b.createdAt).map(copy);
    },
    async createProfileWithStarter(profile, starter) {
      profiles.set(profile.id, copy(profile));
      pandas.set(starter.id, copy(starter));
    },
    async deleteProfile(profileId) {
      profiles.delete(profileId);
      for (const [k, v] of pandas) if (v.profileId === profileId) pandas.delete(k);
      for (const [k, v] of progress) if (v.profileId === profileId) progress.delete(k);
      for (const [k, v] of cycles) if (v.profileId === profileId) cycles.delete(k);
    },
    async listPandas(profileId) {
      return [...pandas.values()]
        .filter((p) => p.profileId === profileId)
        .sort((a, b) => a.earnedAt - b.earnedAt)
        .map(copy);
    },
    async putPandas(rows) {
      for (const p of rows) pandas.set(p.id, copy(p));
    },
    async listWordProgress(profileId, level) {
      return [...progress.values()]
        .filter((p) => p.profileId === profileId && p.level === level)
        .map(copy);
    },
    async getLevelCycle(profileId, level) {
      return copy(cycles.get(cKey(profileId, level)) ?? { profileId, level, cycle: 1 });
    },
    async commitLesson({ progress: rows, cycle, pandas: pandaRows }) {
      for (const p of rows) progress.set(pKey(p), copy(p));
      if (cycle) cycles.set(cKey(cycle.profileId, cycle.level), copy(cycle));
      for (const p of pandaRows ?? []) pandas.set(p.id, copy(p));
    },
    async getSettings() {
      return copy(settings ?? DEFAULT_SETTINGS);
    },
    async putSettings(s) {
      settings = copy(s);
    },
  };
}
