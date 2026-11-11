import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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

interface PandaDB extends DBSchema {
  profiles: { key: string; value: Profile };
  pandas: { key: string; value: Panda; indexes: { profileId: string } };
  progress: {
    key: [string, string];
    value: WordProgress;
    indexes: { 'profileId-level': [string, string] };
  };
  cycles: { key: [string, string]; value: LevelCycle };
  settings: { key: string; value: DeviceSettings };
}

const SETTINGS_KEY = 'device';

/** IndexedDB-backed Repository (R-PRF-5/6). Multi-store writes are single transactions. */
export function createIdbRepository(dbName = 'panda-world'): Repository {
  let dbPromise: Promise<IDBPDatabase<PandaDB>> | undefined;
  const db = () =>
    (dbPromise ??= openDB<PandaDB>(dbName, 1, {
      upgrade(d) {
        d.createObjectStore('profiles', { keyPath: 'id' });
        const pandas = d.createObjectStore('pandas', { keyPath: 'id' });
        pandas.createIndex('profileId', 'profileId');
        const progress = d.createObjectStore('progress', { keyPath: ['profileId', 'wordId'] });
        progress.createIndex('profileId-level', ['profileId', 'level']);
        d.createObjectStore('cycles', { keyPath: ['profileId', 'level'] });
        d.createObjectStore('settings');
      },
    }));

  return {
    async listProfiles() {
      const all = await (await db()).getAll('profiles');
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },
    async createProfileWithStarter(profile, starter) {
      const tx = (await db()).transaction(['profiles', 'pandas'], 'readwrite');
      await Promise.all([tx.objectStore('profiles').put(profile), tx.objectStore('pandas').put(starter), tx.done]);
    },
    async deleteProfile(profileId) {
      const tx = (await db()).transaction(['profiles', 'pandas', 'progress', 'cycles'], 'readwrite');
      const ops: Promise<unknown>[] = [tx.objectStore('profiles').delete(profileId)];
      const pandaKeys = await tx.objectStore('pandas').index('profileId').getAllKeys(profileId);
      for (const k of pandaKeys) ops.push(tx.objectStore('pandas').delete(k));
      const range = IDBKeyRange.bound([profileId, ''], [profileId, '￿']);
      ops.push(tx.objectStore('progress').delete(range));
      ops.push(tx.objectStore('cycles').delete(range));
      ops.push(tx.done);
      await Promise.all(ops);
    },
    async listPandas(profileId) {
      const all = await (await db()).getAllFromIndex('pandas', 'profileId', profileId);
      return all.sort((a, b) => a.earnedAt - b.earnedAt);
    },
    async putPandas(pandas: Panda[]) {
      const tx = (await db()).transaction('pandas', 'readwrite');
      await Promise.all([...pandas.map((p) => tx.store.put(p)), tx.done]);
    },
    async listWordProgress(profileId: string, level: Level) {
      return (await db()).getAllFromIndex('progress', 'profileId-level', [profileId, level]);
    },
    async getLevelCycle(profileId: string, level: Level) {
      return (await (await db()).get('cycles', [profileId, level])) ?? { profileId, level, cycle: 1 };
    },
    async commitLesson({ progress, cycle, pandas }) {
      const tx = (await db()).transaction(['progress', 'cycles', 'pandas'], 'readwrite');
      const ops: Promise<unknown>[] = progress.map((p) => tx.objectStore('progress').put(p));
      if (cycle) ops.push(tx.objectStore('cycles').put(cycle));
      for (const p of pandas ?? []) ops.push(tx.objectStore('pandas').put(p));
      ops.push(tx.done);
      await Promise.all(ops);
    },
    async getSettings() {
      const s = await (await db()).get('settings', SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...s };
    },
    async putSettings(settings) {
      await (await db()).put('settings', settings, SETTINGS_KEY);
    },
  };
}
