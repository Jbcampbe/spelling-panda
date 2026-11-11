import { useEffect, useRef, useState } from 'react';
import { GearIcon } from './icons';

const HOLD_MS = 3000;
const R = 27;
const C = 2 * Math.PI * R;

/** Parent gear: must be pressed and held for 3 s, with a visible progress ring (R-PAR-1). */
export default function HoldGear({ onOpen }: { onOpen: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const start = () => {
    setHolding(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onOpen();
    }, HOLD_MS);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <button
      type="button"
      className={`icon-btn hold-gear${holding ? ' is-holding' : ''}`}
      aria-label="Parent area. Press and hold for three seconds."
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
    >
      <svg className="hold-ring" viewBox="0 0 60 60" aria-hidden="true">
        <circle className="ring-track" cx="30" cy="30" r={R} />
        <circle className="ring-fill" cx="30" cy="30" r={R} strokeDasharray={C} style={{ strokeDashoffset: holding ? 0 : C }} />
      </svg>
      <GearIcon size={26} />
    </button>
  );
}
