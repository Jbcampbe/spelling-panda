import { useEffect, useState, type ReactNode } from 'react';
import { sfx } from '../../audio/sfxEngine';
import { WORDS_BY_LEVEL } from '../../data/words';
import { buildLesson } from '../../game/selection';
import type { AppSpeechProvider } from '../../speech';
import type { Repository } from '../../storage/Repository';
import { LEVELS, type Level, type LevelCycle, type Profile, type WordProgress } from '../../types';
import { ArrowLeftIcon, BambooIcon, SproutIcon, TreeIcon, WarnIcon } from '../icons';
import { primeSpeech } from '../primed';
import type { LessonSetup } from '../useApp';
import { LEVEL_LABEL } from '../util';

interface Props {
  repo: Repository;
  speech: AppSpeechProvider;
  profile: Profile;
  onBack: () => void;
  onStart: (setup: LessonSetup) => void;
}

type Loaded = Record<Level, { progress: WordProgress[]; cycle: LevelCycle }>;

const ICONS: Record<Level, ReactNode> = {
  easy: <SproutIcon size={64} />,
  medium: <BambooIcon size={72} />,
  hard: <TreeIcon size={84} />,
};

export default function LevelPicker({ repo, speech, profile, onBack, onStart }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const speechOk = speech.isAvailable();

  useEffect(() => {
    let alive = true;
    void Promise.all(
      LEVELS.map(async (level) => {
        const [progress, cycle] = await Promise.all([
          repo.listWordProgress(profile.id, level),
          repo.getLevelCycle(profile.id, level),
        ]);
        return [level, { progress, cycle }] as const;
      }),
    )
      .then((entries) => {
        if (alive) setLoaded(Object.fromEntries(entries) as Loaded);
      })
      .catch(() => {
        const empty = Object.fromEntries(
          LEVELS.map((l) => [l, { progress: [], cycle: { profileId: profile.id, level: l, cycle: 1 } }]),
        ) as unknown as Loaded;
        if (alive) setLoaded(empty);
      });
    return () => {
      alive = false;
    };
  }, [repo, profile.id]);

  // Runs inside the tap gesture: unlock audio and start the first word's speech (R-SPK-6).
  const pick = (level: Level) => {
    if (!loaded) return;
    sfx.unlock();
    sfx.play('tap');
    const data = loaded[level];
    const sel = buildLesson({
      pool: WORDS_BY_LEVEL[level],
      progress: data.progress,
      cycle: data.cycle.cycle,
      rng: Math.random,
    });
    if (sel.words.length === 0) return;
    primeSpeech(speech, sel.words[0]);
    onStart({ level, words: sel.words, cycle: sel.cycle, prevCycle: data.cycle.cycle });
  };

  return (
    <div className="overlay overlay-center">
      <div className="card level-card">
        <header className="card-top">
          <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
            <ArrowLeftIcon size={26} />
          </button>
        </header>
        {!speechOk && (
          <p className="notice" role="alert">
            <WarnIcon size={22} />
            <span>This browser cannot speak words aloud. Ask a grown-up for help (Medium and Hard need sound).</span>
          </p>
        )}
        <div className="level-row">
          {LEVELS.map((level, i) => {
            const disabled = !loaded || (!speechOk && level !== 'easy');
            return (
              <button
                key={level}
                type="button"
                className={`level-btn level-${level}`}
                aria-label={LEVEL_LABEL[level]}
                disabled={disabled}
                onClick={() => pick(level)}
              >
                <span className="level-icon">{ICONS[level]}</span>
                <span className="level-pips" aria-hidden="true">
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <i key={k} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
