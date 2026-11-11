/* Dev-only harness app for the 3D world. */
import { useCallback, useEffect, useState } from 'react';
import type { Panda, PandaColor } from '../../types';
import PandaPreview from '../PandaPreview';
import World from '../World';
import { getPandaPortrait } from '../portrait';

const NAMES = ['Mochi', 'Bao', 'Pip', 'Lulu', 'Tofu', 'Suki', 'Bean', 'Momo', 'Kiki', 'Nori', 'Peach', 'Dot'];
const COLORS: PandaColor[] = ['classic', 'rose', 'sky', 'golden', 'mint', 'lavender', 'coral', 'chocolate', 'slate', 'forest', 'plum', 'classic'];

function makePanda(i: number): Panda {
  return {
    id: `panda-${i}`,
    profileId: 'dev',
    name: NAMES[i % NAMES.length],
    color: COLORS[i % COLORS.length],
    earnedAt: Date.now() - i * 1000,
    onIsland: true,
    isStarter: i === 0,
  };
}

declare global {
  interface Window {
    __pw: {
      taps: string[];
      arrivalsDone: number;
      cap: number;
      arrive: () => void;
      evict: (id: string) => void;
      setPreviewColor: (c: PandaColor) => void;
      setDimmed: (d: boolean) => void;
      setPaused: (p: boolean) => void;
    };
  }
}

let lastCap = 0;
const params = new URLSearchParams(location.search);
const tierParam = params.get('tier');
const count = Number(params.get('n') ?? 10);
const ui = params.get('ui') !== '0';
/** `?still=1` turns on reduced motion (no idle camera drift), handy for poking at pandas. */
const still = params.get('still') === '1';

export default function HarnessApp() {
  const [pandas, setPandas] = useState(() => Array.from({ length: count }, (_, i) => makePanda(i)));
  const [arrival, setArrival] = useState<string | undefined>();
  const [evicted, setEvicted] = useState<string[]>([]);
  const [previewColor, setPreviewColor] = useState<PandaColor>('rose');
  const [dimmed, setDimmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [portraits, setPortraits] = useState<Record<string, string>>({});

  useEffect(() => {
    const cs: PandaColor[] = ['classic', 'golden', 'sky', 'rose', 'mint'];
    cs.forEach((c) => getPandaPortrait(c).then((url) => setPortraits((p) => ({ ...p, [c]: url }))));
  }, []);

  const arrive = useCallback(() => {
    setPandas((ps) => {
      const p = makePanda(ps.length + 100);
      p.color = 'golden';
      p.name = 'Sunny';
      setArrival(p.id);
      return [...ps, p];
    });
  }, []);

  useEffect(() => {
    window.__pw = {
      taps: [],
      arrivalsDone: 0,
      cap: lastCap,
      arrive,
      evict: (id) => {
        setEvicted((e) => [...e, id]);
        setTimeout(() => setPandas((ps) => ps.filter((p) => p.id !== id)), 50);
      },
      setPreviewColor,
      setDimmed,
      setPaused,
    };
  }, [arrive]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <World
        pandas={pandas}
        paused={paused}
        dimmed={dimmed}
        arrivalPandaId={arrival}
        onArrivalDone={() => {
          window.__pw.arrivalsDone++;
          setArrival(undefined);
        }}
        evictedPandaIds={evicted}
        onPandaTap={(p) => window.__pw.taps.push(p.name)}
        onPandaCapChange={(c) => {
          lastCap = c;
          if (window.__pw) window.__pw.cap = c;
        }}
        forceQualityTier={tierParam === null ? undefined : Number(tierParam)}
        reducedMotion={still ? true : undefined}
      />
      {ui && (
        <>
          <div style={{ position: 'absolute', right: 12, top: 12, width: 180, height: 200, background: 'rgba(255,255,255,0.55)', borderRadius: 18 }}>
            <PandaPreview color={previewColor} name="Preview" />
          </div>
          <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 8 }}>
            {Object.entries(portraits).map(([c, url]) => (
              <div key={c} style={{ width: 72, height: 72, borderRadius: 36, background: '#fff8', overflow: 'hidden' }}>
                {url ? <img src={url} alt={c} width={72} height={72} /> : 'x'}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

