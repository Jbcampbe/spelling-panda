const NAME_RE = /^[a-z]{1,12}$/i;

/** 1–12 letters a–z, case-insensitive (R-PRF-3). */
export function isValidName(s: string): boolean {
  return NAME_RE.test(s);
}

/** Trim and capitalise ("bAO " → "Bao"). Does not validate. */
export function normaliseName(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
