import type { SfxEngine, SfxName } from './Sfx';

// NOTE: lives in sfxEngine.ts (not sfx.ts) because Sfx.ts already exists and the
// default macOS filesystem is case-insensitive.

type Ctx = AudioContext;

function getCtor(): (new () => AudioContext) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

const AMBIENT_LEVEL = 0.05;
const AMBIENT_DUCKED = 0.012;

export function createSfxEngine(): SfxEngine {
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let sfxEnabled = true;
  let ambientEnabled = false;
  let ducked = false;
  let ambient: { gain: GainNode; stop: () => void } | null = null;

  const ensure = (): Ctx | null => {
    try {
      if (!ctx) {
        const C = getCtor();
        if (!C) return null;
        ctx = new C();
        master = ctx.createGain();
        master.gain.value = 0.6;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      return ctx;
    } catch {
      return null;
    }
  };

  /** One enveloped oscillator note (no clicks: short attack, exponential release). */
  const note = (
    c: Ctx,
    freq: number,
    start: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'sine',
    endFreq?: number,
  ) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(master as GainNode);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  };

  const arp = (c: Ctx, freqs: number[], gap: number, dur: number, vol: number, type: OscillatorType = 'sine') => {
    const t = c.currentTime + 0.01;
    freqs.forEach((f, i) => note(c, f, t + i * gap, dur, vol, type));
  };

  const recipes: Record<SfxName, (c: Ctx) => void> = {
    correct: (c) => arp(c, [523.25, 659.25, 783.99, 1046.5], 0.07, 0.35, 0.22),
    tryAgain: (c) => arp(c, [392, 329.63], 0.16, 0.3, 0.18, 'triangle'),
    squeak: (c) => {
      const t = c.currentTime + 0.01;
      note(c, 900, t, 0.12, 0.14, 'triangle', 1600);
    },
    tap: (c) => note(c, 700, c.currentTime + 0.005, 0.05, 0.1, 'triangle', 450),
    key: (c) => note(c, 1200, c.currentTime + 0.005, 0.025, 0.04, 'sine', 900),
    reveal: (c) => arp(c, [440, 554.37], 0.12, 0.4, 0.14),
    fanfare: (c) => {
      arp(c, [523.25, 659.25, 783.99, 1046.5, 1318.5], 0.11, 0.5, 0.2);
    },
    fanfareGolden: (c) => {
      const t = c.currentTime + 0.01;
      arp(c, [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.12, 0.7, 0.22);
      note(c, 261.63, t, 1.2, 0.12, 'triangle');
      for (let i = 0; i < 10; i++) {
        note(c, 2000 + ((i * 337) % 1800), t + 0.5 + i * 0.07, 0.35, 0.05);
      }
    },
  };

  const startAmbient = (c: Ctx) => {
    if (ambient) return;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master as GainNode);
    const stops: Array<() => void> = [];

    // Slow detuned pad chord (C major 9-ish).
    [130.81, 196, 261.63, 329.63, 392].forEach((f, i) => {
      for (const detune of [-6, 6]) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = detune;
        g.gain.value = 0.05;
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = 0.05 + i * 0.017;
        lg.gain.value = 0.03;
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(gain);
        o.start();
        lfo.start();
        stops.push(() => {
          o.stop();
          lfo.stop();
        });
      }
    });

    // Soft breeze: looped low-passed noise.
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const ng = c.createGain();
    ng.gain.value = 0.15;
    src.connect(lp).connect(ng).connect(gain);
    src.start();
    stops.push(() => src.stop());

    ambient = {
      gain,
      stop: () => {
        for (const s of stops) {
          try {
            s();
          } catch {
            /* already stopped */
          }
        }
        gain.disconnect();
      },
    };
  };

  const applyAmbient = () => {
    const c = ctx;
    if (!c) return;
    if (ambientEnabled) {
      startAmbient(c);
      const g = ambient?.gain.gain;
      if (g) g.setTargetAtTime(ducked ? AMBIENT_DUCKED : AMBIENT_LEVEL, c.currentTime, 0.25);
    } else if (ambient) {
      const a = ambient;
      ambient = null;
      a.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.2);
      setTimeout(() => a.stop(), 1000);
    }
  };

  return {
    unlock() {
      ensure();
      applyAmbient();
    },
    play(name) {
      if (!sfxEnabled) return;
      const c = ensure();
      if (!c) return;
      try {
        recipes[name](c);
      } catch {
        /* never throw from audio */
      }
    },
    setSfxEnabled(enabled) {
      sfxEnabled = enabled;
    },
    setAmbientEnabled(enabled) {
      ambientEnabled = enabled;
      // Only start once a context exists (after a user gesture) to respect autoplay rules.
      if (enabled && !ctx) ensure();
      try {
        applyAmbient();
      } catch {
        /* ignore */
      }
    },
    setDucked(d) {
      ducked = d;
      try {
        applyAmbient();
      } catch {
        /* ignore */
      }
    },
  };
}

export const sfx: SfxEngine = createSfxEngine();
