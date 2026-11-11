import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfxEngine';
import { applyResults } from '../game/progress';
import { ISLAND_CAP, placeNewPanda, togglePanda } from '../game/island';
import { normaliseName } from '../game/names';
import { rewardFor, scoreLesson, type LessonScore } from '../game/scoring';
import { createSpeechProvider, type AppSpeechProvider } from '../speech';
import { createIdbRepository } from '../storage/idbRepository';
import { createMemoryRepository } from '../storage/memoryRepository';
import { requestPersistentStorage } from '../storage/persist';
import type { Repository } from '../storage/Repository';
import {
  DEFAULT_SETTINGS,
  type DeviceSettings,
  type Level,
  type Panda,
  type PandaColor,
  type Profile,
  type Reward,
  type WordEntry,
  type WordResult,
} from '../types';
import { newId } from './util';

export interface LessonSetup {
  level: Level;
  words: WordEntry[];
  /** Cycle the lesson was built in (may be greater than prevCycle, R-SEL-6). */
  cycle: number;
  prevCycle: number;
}

export type Screen =
  | { name: 'loading' }
  | { name: 'profilePicker' }
  | { name: 'createProfile' }
  | { name: 'home' }
  | { name: 'levelPicker' }
  | { name: 'lesson'; setup: LessonSetup }
  | { name: 'results'; level: Level; score: LessonScore; reward: Reward }
  | { name: 'newPandaColor' }
  | { name: 'newPandaName'; color: PandaColor }
  | { name: 'pandaBook' }
  | { name: 'parent' };

export interface Arrival {
  pandaId: string;
  evicted: string[];
}

function applySettings(s: DeviceSettings, speech: AppSpeechProvider) {
  sfx.setSfxEnabled(s.sfxEnabled);
  sfx.setAmbientEnabled(s.ambientEnabled);
  speech.setVoiceURI(s.voiceURI);
}

export type ToggleOutcome = 'on' | 'off' | 'full';

export function useApp() {
  const [repo, setRepo] = useState<Repository>(() => createIdbRepository());
  const [speech] = useState<AppSpeechProvider>(() => createSpeechProvider());
  const [settings, setSettings] = useState<DeviceSettings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pandas, setPandas] = useState<Panda[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [worldCap, setWorldCap] = useState(ISLAND_CAP);
  const ambientBeforeMute = useRef(false);

  const cap = Math.min(ISLAND_CAP, worldCap);

  // Boot: persistent storage (R-PLT-7), settings, profiles.
  useEffect(() => {
    let alive = true;
    void requestPersistentStorage();
    void (async () => {
      let r = repo;
      let s: DeviceSettings = DEFAULT_SETTINGS;
      let list: Profile[] = [];
      try {
        [s, list] = await Promise.all([r.getSettings(), r.listProfiles()]);
      } catch (err) {
        console.warn('Storage unavailable, using memory only', err);
        r = createMemoryRepository();
        if (alive) setRepo(r);
      }
      if (!alive) return;
      applySettings(s, speech);
      setSettings(s);
      setProfiles(list);
      setScreen({ name: 'profilePicker' });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  // Duck ambient audio while speaking (R-SND-2).
  useEffect(() => speech.onSpeakingChange((s) => sfx.setDucked(s)), [speech]);

  // First gesture unlocks audio (iOS / autoplay rules).
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const go = useCallback((s: Screen) => setScreen(s), []);

  const selectProfile = async (p: Profile) => {
    const list = await repo.listPandas(p.id);
    setProfile(p);
    setPandas(list);
    setArrival(null);
    setScreen({ name: 'home' });
  };

  const switchProfile = () => {
    speech.cancel();
    setProfile(null);
    setPandas([]);
    setArrival(null);
    setScreen({ name: 'profilePicker' });
  };

  const createProfile = async (name: string, color: PandaColor, pandaName: string) => {
    const now = Date.now();
    const pandaId = newId();
    const p: Profile = { id: newId(), name: normaliseName(name), avatarPandaId: pandaId, createdAt: now };
    const starter: Panda = {
      id: pandaId,
      profileId: p.id,
      name: normaliseName(pandaName),
      color,
      earnedAt: now,
      onIsland: true,
      isStarter: true,
      islandSince: now,
    };
    await repo.createProfileWithStarter(p, starter);
    setProfiles((l) => [...l, p]);
    setProfile(p);
    setPandas([starter]);
    setArrival(null);
    setScreen({ name: 'home' });
  };

  const deleteProfile = async (id: string) => {
    await repo.deleteProfile(id);
    setProfiles((l) => l.filter((p) => p.id !== id));
    setProfile(null);
    setPandas([]);
    setScreen({ name: 'profilePicker' });
  };

  const mergePandas = (rows: Panda[]) =>
    setPandas((cur) => {
      const m = new Map(cur.map((p) => [p.id, p]));
      for (const r of rows) m.set(r.id, r);
      return [...m.values()].sort((a, b) => a.earnedAt - b.earnedAt);
    });

  const commitResults = async (setup: LessonSetup, results: WordResult[]) => {
    if (!profile || results.length === 0) return;
    try {
      const existing = await repo.listWordProgress(profile.id, setup.level);
      const progress = applyResults({
        existing,
        results,
        profileId: profile.id,
        level: setup.level,
        cycle: setup.cycle,
        now: Date.now(),
      });
      await repo.commitLesson({
        progress,
        cycle:
          setup.cycle !== setup.prevCycle
            ? { profileId: profile.id, level: setup.level, cycle: setup.cycle }
            : undefined,
      });
    } catch (err) {
      console.error('Could not save lesson', err);
    }
  };

  const finishLesson = async (setup: LessonSetup, results: WordResult[]) => {
    const score = scoreLesson(results);
    await commitResults(setup, results);
    setScreen({ name: 'results', level: setup.level, score, reward: rewardFor(score.correct, score.total) });
  };

  /** R-LSN-13: leave early — answered words are recorded, no reward. */
  const leaveLesson = async (setup: LessonSetup, results: WordResult[]) => {
    speech.cancel();
    await commitResults(setup, results);
    setScreen({ name: 'home' });
  };

  const afterResults = (reward: Reward) => {
    if (reward.kind === 'golden') setScreen({ name: 'newPandaName', color: 'golden' });
    else if (reward.kind === 'panda') setScreen({ name: 'newPandaColor' });
    else setScreen({ name: 'home' });
  };

  const createEarnedPanda = async (color: PandaColor, name: string) => {
    if (!profile) return;
    const now = Date.now();
    const panda: Panda = {
      id: newId(),
      profileId: profile.id,
      name: normaliseName(name),
      color,
      earnedAt: now,
      onIsland: true,
      isStarter: false,
      islandSince: now,
    };
    const rows = placeNewPanda(pandas, panda, cap, now);
    await repo.putPandas(rows);
    mergePandas(rows);
    setArrival({ pandaId: panda.id, evicted: rows.slice(1).map((r) => r.id) });
    setScreen({ name: 'home' });
  };

  const toggleIsland = async (id: string): Promise<ToggleOutcome> => {
    const res = togglePanda(pandas, id, cap, Date.now());
    if (!res.ok) return 'full';
    if (res.changed.length === 0) return 'off';
    await repo.putPandas(res.changed);
    mergePandas(res.changed);
    return res.changed[0].onIsland ? 'on' : 'off';
  };

  const updateSettings = (patch: Partial<DeviceSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applySettings(next, speech);
    void repo.putSettings(next).catch((err) => console.error('Could not save settings', err));
  };

  const toggleMute = () => {
    const muted = !settings.sfxEnabled && !settings.ambientEnabled;
    if (muted) updateSettings({ sfxEnabled: true, ambientEnabled: ambientBeforeMute.current });
    else {
      ambientBeforeMute.current = settings.ambientEnabled;
      updateSettings({ sfxEnabled: false, ambientEnabled: false });
    }
  };

  return {
    repo,
    speech,
    settings,
    profiles,
    profile,
    pandas,
    screen,
    arrival,
    cap,
    go,
    setWorldCap,
    clearArrival: () => setArrival(null),
    selectProfile,
    switchProfile,
    createProfile,
    deleteProfile,
    finishLesson,
    leaveLesson,
    afterResults,
    createEarnedPanda,
    toggleIsland,
    updateSettings,
    toggleMute,
  };
}

export type AppApi = ReturnType<typeof useApp>;
