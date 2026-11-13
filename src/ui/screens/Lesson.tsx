import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfxEngine';
import { lastAttempt, newAttempt, outcomeOf, reveal, submitTry, type AttemptState } from '../../game/attempt';
import type { AppSpeechProvider } from '../../speech';
import { startEasyFlash } from '../../speech';
import type { WordResult } from '../../types';
import AnswerField from '../keyboard/AnswerField';
import Keyboard from '../keyboard/Keyboard';
import { useTextEntry } from '../keyboard/useTextEntry';
import {
  ArrowRightIcon,
  BambooIcon,
  BubbleIcon,
  CheckIcon,
  CloseIcon,
  DotCorrect,
  DotMissed,
  DotPending,
  EarIcon,
  EyeIcon,
  LeaveIcon,
  PlayIcon,
  SpeakerIcon,
  SproutIcon,
  TreeIcon,
} from '../icons';
import { invalidatePrimed, takePrimed } from '../primed';
import type { LessonSetup } from '../useApp';
import { isMockSpeech } from '../util';

interface Props {
  setup: LessonSetup;
  speech: AppSpeechProvider;
  onFinish: (results: WordResult[]) => void;
  onLeave: (results: WordResult[]) => void;
}

const AUTO_ADVANCE_MS = 1200;

export default function Lesson({ setup, speech, onFinish, onLeave }: Props) {
  const { words, level } = setup;
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState<AttemptState>(() => newAttempt(words[0]));
  const [results, setResults] = useState<WordResult[]>([]);
  const resultsRef = useRef<WordResult[]>([]);
  const [flash, setFlash] = useState<'pending' | 'showing' | 'hidden'>(level === 'easy' ? 'pending' : 'hidden');
  const [wobble, setWobble] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const advanceTimer = useRef<number | undefined>(undefined);
  const word = words[idx];

  // Speak (and, on Easy, flash) each word when it appears (R-LSN-3, R-LVL-1).
  useEffect(() => {
    const w = words[idx];
    const primed = idx === 0 ? takePrimed(w.id) : null;
    if (level === 'easy') {
      return startEasyFlash({
        speak: (onStart) => (primed ? primed.started.then(onStart) : speech.speakWord(w, { onStart })),
        onShow: () => setFlash('showing'),
        onHide: () => setFlash('hidden'),
      });
    }
    if (!primed) speech.speakWord(w).catch(() => {});
    return undefined;
  }, [idx, words, level, speech]);

  useEffect(
    () => () => {
      speech.cancel();
      invalidatePrimed();
      window.clearTimeout(advanceTimer.current);
    },
    [speech],
  );

  // E2E hook: only when speech is mocked.
  useEffect(() => {
    if (!isMockSpeech()) return;
    window.__PANDA_DEBUG__ = { currentWord: word.word, level };
    return () => {
      window.__PANDA_DEBUG__ = undefined;
    };
  }, [word, level]);

  const entry = useTextEntry(20, !confirming, { onEnter: () => onEnter() });

  const speakWord = () => {
    speech.speakWord(word).catch(() => {});
  };

  const recordOutcome = (next: AttemptState) => {
    const r = outcomeOf(next);
    if (!r) return;
    resultsRef.current = [...resultsRef.current, r];
    setResults(resultsRef.current);
  };

  const advance = () => {
    window.clearTimeout(advanceTimer.current);
    if (idx + 1 >= words.length) {
      onFinish(resultsRef.current);
      return;
    }
    const next = words[idx + 1];
    setIdx(idx + 1);
    setAttempt(newAttempt(next));
    setFlash(level === 'easy' ? 'pending' : 'hidden');
    entry.clear();
  };

  function onEnter() {
    if (confirming) return;
    if (attempt.status === 'revealed') {
      sfx.play('tap');
      advance();
    } else if (attempt.status === 'typing') {
      submit();
    }
  }

  function submit() {
    if (attempt.status !== 'typing') return;
    const next = submitTry(attempt, entry.getValue());
    if (next === attempt) return; // empty input does nothing (R-LSN-5)
    setAttempt(next);
    if (next.status === 'correct') {
      sfx.play('correct');
      speakWord();
      recordOutcome(next);
      advanceTimer.current = window.setTimeout(advance, AUTO_ADVANCE_MS);
      return;
    }
    entry.clear();
    if (next.status === 'revealed') {
      sfx.play('reveal');
      speakWord();
      recordOutcome(next);
    } else {
      sfx.play('tryAgain');
      setWobble((w) => w + 1);
      speakWord();
    }
  }

  const doReveal = () => {
    const next = reveal(attempt);
    if (next === attempt) return;
    setAttempt(next);
    entry.clear();
    sfx.play('reveal');
    speakWord();
    recordOutcome(next);
  };

  const openConfirm = () => {
    window.clearTimeout(advanceTimer.current);
    sfx.play('tap');
    setConfirming(true);
  };
  const closeConfirm = () => {
    setConfirming(false);
    if (attempt.status === 'correct') advanceTimer.current = window.setTimeout(advance, 600);
  };

  const typing = attempt.status === 'typing';
  const prev = typing ? lastAttempt(attempt) : undefined;
  const LevelIcon = level === 'easy' ? SproutIcon : level === 'medium' ? BambooIcon : TreeIcon;

  return (
    <div className={`lesson level-${level}`}>
      <header className="lesson-top">
        <button type="button" className="icon-btn glass" aria-label="Leave lesson" onClick={openConfirm}>
          <CloseIcon size={26} />
        </button>
        <ol className="dots" aria-label={`Word ${idx + 1} of ${words.length}`}>
          {words.map((w, i) => {
            const r = results[i];
            const cls = r ? (r.outcome === 'correct' ? 'dot-correct' : 'dot-missed') : i === idx ? 'dot-current' : 'dot-pending';
            return (
              <li key={w.id} className={`dot ${cls}`}>
                {r ? r.outcome === 'correct' ? <DotCorrect /> : <DotMissed /> : <DotPending />}
              </li>
            );
          })}
        </ol>
        <span className="level-badge" aria-hidden="true">
          <LevelIcon size={28} />
        </span>
      </header>

      <main className="lesson-main">
        <div className="word-stage" aria-live="polite">
          {attempt.status === 'correct' ? (
            <span className="stage-check" key="check">
              <CheckIcon size={64} />
            </span>
          ) : attempt.status === 'revealed' ? null : flash === 'showing' ? (
            <div className="flash-word" key="flash">
              <span className="flash-text">{word.word}</span>
              <span className="flash-bar" aria-hidden="true" />
            </div>
          ) : (
            <span className="stage-ear" aria-hidden="true">
              <EarIcon size={64} />
            </span>
          )}
        </div>

        {attempt.status === 'revealed' ? (
          <div className="reveal-box" key="reveal">
            {lastAttempt(attempt) && (
              <div className="reveal-try" aria-label="Your try">
                <span>{lastAttempt(attempt)}</span>
              </div>
            )}
            <div className="reveal-word" aria-label="Correct spelling">
              {word.word}
            </div>
          </div>
        ) : (
          <AnswerField
            value={attempt.status === 'correct' ? attempt.word : entry.value}
            label="Your spelling"
            wobbleKey={wobble}
            previous={prev}
            state={attempt.status === 'correct' ? 'correct' : 'idle'}
            action={
              <button
                type="button"
                className="btn btn-primary answer-submit"
                aria-label="Check my spelling"
                disabled={!typing || confirming || entry.value.length === 0}
                onClick={() => {
                  sfx.play('tap');
                  onEnter();
                }}
              >
                <CheckIcon size={40} />
              </button>
            }
          />
        )}

        <div className="lesson-controls">
          <button type="button" className="icon-btn icon-btn-lg" aria-label="Hear the word again" onClick={speakWord}>
            <SpeakerIcon size={34} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-lg"
            aria-label="Hear the sentence"
            onClick={() => speech.speakSentence(word).catch(() => {})}
          >
            <BubbleIcon size={34} />
          </button>
          {attempt.revealAvailable && typing && (
            <button type="button" className="icon-btn icon-btn-lg reveal-btn" aria-label="Show the answer" onClick={doReveal}>
              <EyeIcon size={34} />
            </button>
          )}
        </div>
      </main>

      <div className="kb-slot">
        <Keyboard
          onLetter={entry.letter}
          onBackspace={entry.backspace}
          disabled={!typing || confirming}
        />
        {attempt.status === 'revealed' && !confirming && (
          <div className="next-wrap">
            <button type="button" className="btn btn-primary btn-lg" aria-label="Next word" onClick={onEnter}>
              <ArrowRightIcon size={40} />
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Leave lesson?">
          <div className="card confirm-card">
            <LeaveIcon size={56} />
            <h2>Leave lesson?</h2>
            <div className="confirm-row">
              <button type="button" className="btn btn-primary btn-lg" aria-label="Keep playing" onClick={closeConfirm}>
                <PlayIcon size={36} />
              </button>
              <button type="button" className="btn btn-soft btn-lg" aria-label="Leave" onClick={() => onLeave(resultsRef.current)}>
                <LeaveIcon size={36} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
