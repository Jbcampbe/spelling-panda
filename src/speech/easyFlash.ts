export interface EasyFlashOptions {
  /** Starts speaking; must call `onStart` when the utterance begins. */
  speak: (onStart: () => void) => Promise<void>;
  onShow: () => void;
  onHide: () => void;
  showMs?: number;
  fallbackMs?: number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
}

/**
 * R-SPK-7: show the word for `showMs` starting at utterance onstart; if onstart
 * hasn't fired within `fallbackMs`, start the timer anyway. Returns a cancel fn
 * (hides the word if it was shown).
 */
export function startEasyFlash(opts: EasyFlashOptions): () => void {
  const { speak, onShow, onHide, showMs = 3000, fallbackMs = 1000 } = opts;
  const st = opts.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const ct = opts.clearTimeout ?? ((id) => globalThis.clearTimeout(id as number));
  let started = false;
  let cancelled = false;
  let shown = false;
  let hideId: unknown;

  const begin = () => {
    if (started || cancelled) return;
    started = true;
    ct(fallbackId);
    shown = true;
    onShow();
    hideId = st(() => {
      shown = false;
      onHide();
    }, showMs);
  };

  const fallbackId = st(begin, fallbackMs);
  speak(begin).catch(() => begin());

  return () => {
    if (cancelled) return;
    cancelled = true;
    ct(fallbackId);
    ct(hideId);
    if (shown) {
      shown = false;
      onHide();
    }
  };
}
