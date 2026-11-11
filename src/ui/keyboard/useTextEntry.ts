import { useCallback, useEffect, useRef, useState } from 'react';

export interface TextEntryHandlers {
  onEnter?: () => void;
  /** Called when a letter is added or removed (e.g. to clear a wobble). */
  onChange?: (value: string) => void;
}

/**
 * Text state fed by the on-screen keyboard AND the physical keyboard (R-KEY-3, R-KEY-5).
 * `enabled=false` ignores physical keys (e.g. while a dialog is open).
 */
export function useTextEntry(maxLength: number, enabled: boolean, handlers: TextEntryHandlers = {}) {
  const [value, setValue] = useState('');
  const valueRef = useRef('');
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const set = useCallback((v: string) => {
    valueRef.current = v;
    setValue(v);
    handlersRef.current.onChange?.(v);
  }, []);

  const letter = useCallback(
    (ch: string) => {
      if (valueRef.current.length >= maxLength) return;
      set(valueRef.current + ch.toLowerCase());
    },
    [maxLength, set],
  );
  const backspace = useCallback(() => {
    if (valueRef.current.length === 0) return;
    set(valueRef.current.slice(0, -1));
  }, [set]);
  const enter = useCallback(() => handlersRef.current.onEnter?.(), []);
  const clear = useCallback(() => set(''), [set]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        letter(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) enter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, letter, backspace, enter]);

  const getValue = useCallback(() => valueRef.current, []);

  return { value, setValue: set, getValue, letter, backspace, enter, clear };
}
