import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfxEngine';
import type { Panda } from '../../types';
import { ArrowLeftIcon, IslandIcon, SparkleIcon } from '../icons';
import Portrait from '../Portrait';
import type { ToggleOutcome } from '../useApp';

interface Props {
  pandas: Panda[];
  cap: number;
  onBack: () => void;
  onToggle: (id: string) => Promise<ToggleOutcome>;
}

export default function PandaBook({ pandas, cap, onBack, onToggle }: Props) {
  const [full, setFull] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const onIsland = pandas.filter((p) => p.onIsland).length;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tap = async (p: Panda) => {
    const res = await onToggle(p.id);
    if (res === 'full') {
      sfx.play('tryAgain');
      setFull((n) => n + 1);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFull(0), 1800);
    } else {
      sfx.play(res === 'on' ? 'squeak' : 'tap');
      setFull(0);
    }
  };

  return (
    <div className="screen screen-book">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon size={26} />
        </button>
        <div
          key={full}
          className={`island-count${full > 0 ? ' is-full' : ''}`}
          aria-label={`${onIsland} of ${cap} pandas on the island`}
        >
          <IslandIcon size={28} />
          <span>
            {onIsland}/{cap}
          </span>
        </div>
      </header>
      <div className="book-grid">
        {pandas.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`panda-card${p.onIsland ? ' is-on' : ''}${p.color === 'golden' ? ' is-golden' : ''}${full > 0 && !p.onIsland ? ' is-blocked' : ''}`}
            aria-pressed={p.onIsland}
            aria-label={`${p.name}${p.onIsland ? ', on the island' : ', in the book'}`}
            onClick={() => void tap(p)}
          >
            <span className="card-portrait">
              <Portrait color={p.color} size={96} />
              {p.color === 'golden' && (
                <span className="golden-badge">
                  <SparkleIcon size={20} />
                </span>
              )}
            </span>
            <span className="card-name">{p.name}</span>
            <span className="card-state" aria-hidden="true">
              <IslandIcon size={20} />
            </span>
          </button>
        ))}
      </div>
      {full > 0 && (
        <div className="book-hint" role="status">
          <IslandIcon size={28} />
          <span>
            {onIsland}/{cap}
          </span>
        </div>
      )}
    </div>
  );
}
