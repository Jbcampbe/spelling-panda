import { useState, type ReactNode } from 'react';
import { randomName } from '../../data/names';
import { isValidName } from '../../game/names';
import AnswerField from '../keyboard/AnswerField';
import Keyboard from '../keyboard/Keyboard';
import { useTextEntry } from '../keyboard/useTextEntry';
import { ArrowLeftIcon, CheckIcon, DiceIcon } from '../icons';
import { sfx } from '../../audio/sfxEngine';

interface Props {
  label: string;
  hero: ReactNode;
  onSubmit: (name: string) => void;
  onBack?: () => void;
  dice?: boolean;
  busy?: boolean;
}

/** Name entry used for profile names and panda names (R-KEY-6, 1–12 letters). */
export default function NameEntry({ label, hero, onSubmit, onBack, dice, busy }: Props) {
  const [wobble, setWobble] = useState(0);
  const entry = useTextEntry(12, !busy, {
    onEnter: () => submit(),
  });

  function submit() {
    const v = entry.getValue();
    if (busy) return;
    if (!isValidName(v)) {
      if (v.length > 0) setWobble((w) => w + 1);
      return;
    }
    onSubmit(v);
  }

  return (
    <div className="screen screen-name">
      <header className="topbar">
        {onBack ? (
          <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
            <ArrowLeftIcon size={26} />
          </button>
        ) : (
          <span />
        )}
      </header>
      <div className="name-main">
        <div className="name-hero">{hero}</div>
        <div className="name-row">
          <AnswerField value={entry.value} label={label} wobbleKey={wobble} size="large" />
          {dice && (
            <button
              type="button"
              className="icon-btn icon-btn-lg dice-btn"
              aria-label="Random name"
              onClick={() => {
                sfx.play('tap');
                entry.setValue(randomName(Math.random));
              }}
            >
              <DiceIcon size={34} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          aria-label="Done"
          disabled={busy || entry.value.length === 0}
          onClick={() => {
            sfx.play('tap');
            submit();
          }}
        >
          <CheckIcon size={34} />
        </button>
      </div>
      <div className="kb-slot">
        <Keyboard
          onLetter={entry.letter}
          onBackspace={entry.backspace}
          onEnter={submit}
          enterIcon={<CheckIcon size={28} />}
          disabled={busy}
        />
      </div>
    </div>
  );
}
