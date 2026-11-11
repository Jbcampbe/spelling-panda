let requested = false;

/** R-PLT-7: ask the browser for persistent storage once; never throws. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (requested) return false;
  requested = true;
  try {
    if (typeof navigator === 'undefined') return false;
    const persist = navigator.storage?.persist;
    if (typeof persist !== 'function') return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
