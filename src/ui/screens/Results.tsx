import { useEffect, useMemo } from 'react';
import { sfx } from '../../audio/sfxEngine';
import type { LessonScore } from '../../game/scoring';
import type { Reward } from '../../types';
import { ArrowRightIcon, SparkleIcon, StarIcon } from '../icons';
import { PandaFace } from '../icons';

interface Props {
  score: LessonScore;
  reward: Reward;
  onContinue: () => void;
}

function message(correct: number, total: number): string {
  if (correct >= total) return 'Perfect! Amazing!';
  if (correct >= 8) return 'Great job!';
  if (correct >= 5) return 'Nice work!';
  return 'Good try! Keep going!';
}

const CONFETTI_COLORS = ['#f5b942', '#ef8fa8', '#6fa8dc', '#6cc4a4', '#a58fd6', '#f08a6c'];

export default function Results({ score, reward, onContinue }: Props) {
  const golden = reward.kind === 'golden';
  const earned = reward.kind !== 'none';

  useEffect(() => {
    if (golden) sfx.play('fanfareGolden');
    else if (earned) sfx.play('fanfare');
    else sfx.play('correct');
  }, [golden, earned]);

  const pieces = useMemo(() => {
    const n = golden ? 44 : earned ? 24 : 0;
    return Array.from({ length: n }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      dur: 2.4 + Math.random() * 1.8,
      color: golden && i % 2 === 0 ? '#f5c542' : CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot: Math.random() * 360,
      round: i % 3 === 0,
    }));
  }, [golden, earned]);

  return (
    <div className={`overlay overlay-center results${golden ? ' is-golden' : ''}`}>
      <div className="confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <i
            key={i}
            className={p.round ? 'round' : undefined}
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              background: p.color,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        ))}
      </div>
      <div className="card results-card">
        <div className="score" aria-label={`${score.correct} out of ${score.total}`}>
          <span className="score-num">{score.correct}</span>
          <span className="score-of">/{score.total}</span>
        </div>
        <div className="stars" aria-label={`${score.stars} first-try stars`}>
          {Array.from({ length: score.total }, (_, i) => (
            <span key={i} className={`star${i < score.stars ? ' on' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>
              <StarIcon size={26} filled={i < score.stars} />
            </span>
          ))}
        </div>
        <p className="encourage">{message(score.correct, score.total)}</p>
        {earned && (
          <div className="reward-badge">
            {golden ? <SparkleIcon size={30} /> : null}
            <span className={`reward-panda${golden ? ' golden' : ''}`}>
              <PandaFace color={golden ? 'golden' : 'classic'} size={72} />
            </span>
            {golden ? <SparkleIcon size={30} /> : null}
          </div>
        )}
        <button type="button" className="btn btn-primary btn-lg" aria-label="Continue" onClick={onContinue}>
          <ArrowRightIcon size={40} />
        </button>
      </div>
    </div>
  );
}
