/** Adaptive quality tiers (SPEC §10, R-PRF-P2). Index 0 is the best tier. */
export interface QualityTier {
  name: 'high' | 'medium' | 'low' | 'minimal';
  /** Upper bound for the device pixel ratio (clamped to window.devicePixelRatio). */
  dpr: number;
  /** Real-time directional shadows. Off → blob shadows + baked AO only. */
  shadows: boolean;
  shadowMapSize: number;
  /** Pandas cast real shadows (they always get a soft blob shadow). */
  pandaShadows: boolean;
  /** 0..1 multiplier on instanced decor counts (grass, flowers). */
  decorDensity: number;
  /** Island panda cap reported to the UI. */
  pandaCap: number;
}

export const QUALITY_TIERS: readonly QualityTier[] = [
  { name: 'high', dpr: 2, shadows: true, shadowMapSize: 2048, pandaShadows: true, decorDensity: 1, pandaCap: 12 },
  { name: 'medium', dpr: 1.5, shadows: true, shadowMapSize: 1024, pandaShadows: false, decorDensity: 0.7, pandaCap: 12 },
  { name: 'low', dpr: 1.25, shadows: false, shadowMapSize: 512, pandaShadows: false, decorDensity: 0.45, pandaCap: 8 },
  { name: 'minimal', dpr: 1, shadows: false, shadowMapSize: 512, pandaShadows: false, decorDensity: 0.25, pandaCap: 5 },
];

export const MAX_TIER = QUALITY_TIERS.length - 1;

/** Heuristic starting tier: phones/tablets start at "medium" (DPR 1.5), desktops at "high". */
export function initialTierIndex(): number {
  if (typeof window === 'undefined') return 1;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  return coarse || small ? 1 : 0;
}

export function clampTier(i: number): number {
  return Math.max(0, Math.min(MAX_TIER, Math.round(i)));
}

export function tierDpr(tier: QualityTier): number {
  const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(device, tier.dpr);
}
