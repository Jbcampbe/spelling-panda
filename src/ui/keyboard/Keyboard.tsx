import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { sfx } from '../../audio/sfxEngine';
import { BackspaceIcon, EnterIcon } from '../icons';

const ROW1 = 'qwertyuiop'.split('');
const ROW2 = 'asdfghjkl'.split('');
const ROW3 = 'zxcvbnm'.split('');

export interface KeyboardProps {
  onLetter: (ch: string) => void;
  onBackspace: () => void;
  /** Omit to hide the Enter key (e.g. when the screen has its own submit button). */
  onEnter?: () => void;
  disabled?: boolean;
  /** Icon shown on the Enter key (defaults to the return arrow). */
  enterIcon?: ReactNode;
}

interface KeyProps {
  label: ReactNode;
  ariaLabel: string;
  span: number;
  start?: number;
  variant?: 'letter' | 'enter' | 'back';
  onPress: () => void;
  disabled?: boolean;
  repeat?: boolean;
}

function Key({ label, ariaLabel, span, start, variant = 'letter', onPress, disabled, repeat }: KeyProps) {
  const [pressed, setPressed] = useState(false);
  const timers = useRef<{ delay?: number; interval?: number }>({});

  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.interval);
    setPressed(false);
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    setPressed(true);
    sfx.play('key');
    onPress();
    if (repeat) {
      timers.current.delay = window.setTimeout(() => {
        timers.current.interval = window.setInterval(onPress, 70);
      }, 420);
    }
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      className={`key key-${variant}${pressed ? ' is-pressed' : ''}`}
      style={{ gridColumn: `${start ?? 'auto'} / span ${span}` }}
      onPointerDown={down}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

/** Custom QWERTY keyboard (R-KEY-1..4). Never uses a focusable input (R-KEY-2). */
export default function Keyboard({ onLetter, onBackspace, onEnter, disabled, enterIcon }: KeyboardProps) {
  return (
    <div className="keyboard" role="group" aria-label="Keyboard" onContextMenu={(e) => e.preventDefault()}>
      <div className="kb-row">
        {ROW1.map((c) => (
          <Key key={c} label={c} ariaLabel={c} span={2} disabled={disabled} onPress={() => onLetter(c)} />
        ))}
      </div>
      <div className="kb-row">
        {ROW2.map((c, i) => (
          <Key
            key={c}
            label={c}
            ariaLabel={c}
            span={2}
            start={2 + i * 2}
            disabled={disabled}
            onPress={() => onLetter(c)}
          />
        ))}
      </div>
      <div className="kb-row">
        {onEnter && (
          <Key
            label={enterIcon ?? <EnterIcon size={28} />}
            ariaLabel="Enter"
            span={3}
            variant="enter"
            disabled={disabled}
            onPress={onEnter}
          />
        )}
        {ROW3.map((c, i) => (
          <Key
            key={c}
            label={c}
            ariaLabel={c}
            span={2}
            start={i === 0 ? 4 : undefined}
            disabled={disabled}
            onPress={() => onLetter(c)}
          />
        ))}
        <Key
          label={<BackspaceIcon size={28} />}
          ariaLabel="Backspace"
          span={3}
          variant="back"
          repeat
          disabled={disabled}
          onPress={onBackspace}
        />
      </div>
    </div>
  );
}
