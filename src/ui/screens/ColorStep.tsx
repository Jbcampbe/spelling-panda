import { Suspense, useState } from 'react';
import { sfx } from '../../audio/sfxEngine';
import { PANDA_COLOR_HEX } from '../../world/colors';
import { SELECTABLE_COLORS, type PandaColor } from '../../types';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '../icons';
import { PandaPreview } from '../lazy';
import Portrait from '../Portrait';

const COLOR_NAMES: Record<string, string> = {
  classic: 'Classic black',
  chocolate: 'Chocolate brown',
  rose: 'Rose pink',
  sky: 'Sky blue',
  mint: 'Mint',
  lavender: 'Lavender',
  coral: 'Coral',
  slate: 'Slate grey',
  forest: 'Forest green',
  plum: 'Plum',
};

interface Props {
  onPick: (c: PandaColor) => void;
  onBack?: () => void;
}

/** R-NEW-1: large swatches plus a live 3D preview. */
export default function ColorStep({ onPick, onBack }: Props) {
  const [color, setColor] = useState<PandaColor>('classic');
  return (
    <div className="screen screen-color">
      <header className="topbar">
        {onBack ? (
          <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
            <ArrowLeftIcon size={26} />
          </button>
        ) : (
          <span />
        )}
      </header>
      <div className="color-main">
        <div className="preview-card">
          <Suspense fallback={<Portrait color={color} size={180} />}>
            <PandaPreview color={color} />
          </Suspense>
        </div>
        <div className="swatches" role="radiogroup" aria-label="Fur colour">
          {SELECTABLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={COLOR_NAMES[c]}
              className={`swatch${color === c ? ' is-selected' : ''}`}
              style={{ background: PANDA_COLOR_HEX[c] }}
              onClick={() => {
                sfx.play('tap');
                setColor(c);
              }}
            >
              {color === c && <CheckIcon size={28} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          aria-label="Choose this colour"
          onClick={() => {
            sfx.play('tap');
            onPick(color);
          }}
        >
          <ArrowRightIcon size={34} />
        </button>
      </div>
    </div>
  );
}
