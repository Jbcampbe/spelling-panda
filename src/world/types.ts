import type { Panda } from '../types';

export interface WorldProps {
  /** The profile's pandas with onIsland === true (already filtered and capped by the UI). */
  pandas: Panda[];
  /** R-PRF-P3: when true rendering stops completely (also stops while the tab is hidden). */
  paused: boolean;
  /** Visual dim of the whole world (CSS filter on the canvas wrapper). */
  dimmed?: boolean;
  /** When set (or changed), that panda drops in and the camera zooms to it, then eases back (R-NEW-4). */
  arrivalPandaId?: string;
  onArrivalDone?: () => void;
  /** Pandas just sent back to the Book — they play a brief "poof" as they leave. */
  evictedPandaIds?: string[];
  /** Called when a panda is tapped (UI plays the squeak sfx). */
  onPandaTap?: (panda: Panda) => void;
  /** Adaptive quality island cap 12 → 8 → 5 (R-PRF-P2). Called once on mount and on every change. */
  onPandaCapChange?: (cap: number) => void;
  /** R-WLD-4: disables idle camera drift and shortens transitions. Defaults to prefers-reduced-motion. */
  reducedMotion?: boolean;
  /** Dev/testing only: lock the quality tier (0 = best … 3 = lowest) and disable adaptive stepping. */
  forceQualityTier?: number;
}
