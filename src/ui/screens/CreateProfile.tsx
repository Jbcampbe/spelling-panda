import { useState } from 'react';
import type { PandaColor } from '../../types';
import { PandaFace } from '../icons';
import Portrait from '../Portrait';
import ColorStep from './ColorStep';
import NameEntry from './NameEntry';

interface Props {
  onCancel: () => void;
  onCreate: (name: string, color: PandaColor, pandaName: string) => Promise<void>;
}

/** Profile creation: name → starter colour → starter name (R-PRF-3). */
export default function CreateProfile({ onCancel, onCreate }: Props) {
  const [step, setStep] = useState<'name' | 'color' | 'pandaName'>('name');
  const [name, setName] = useState('');
  const [color, setColor] = useState<PandaColor>('classic');
  const [busy, setBusy] = useState(false);

  if (step === 'name') {
    return (
      <NameEntry
        key="name"
        label="Your name"
        hero={
          <span className="hero-badge">
            <PandaFace size={96} />
          </span>
        }
        onBack={onCancel}
        onSubmit={(v) => {
          setName(v);
          setStep('color');
        }}
      />
    );
  }
  if (step === 'color') {
    return (
      <ColorStep
        key="color"
        onBack={() => setStep('name')}
        onPick={(c) => {
          setColor(c);
          setStep('pandaName');
        }}
      />
    );
  }
  return (
    <NameEntry
      key="pandaName"
      label="Panda name"
      dice
      busy={busy}
      hero={<Portrait color={color} size={140} />}
      onBack={() => setStep('color')}
      onSubmit={(pandaName) => {
        setBusy(true);
        onCreate(name, color, pandaName).catch(() => setBusy(false));
      }}
    />
  );
}
