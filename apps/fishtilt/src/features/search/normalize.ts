/**
 * Query/field normalisation for the search matcher — pure string functions, no React, no
 * registry knowledge, so `match.ts`'s scoring is testable independently of what content
 * exists (ruling 26).
 *
 * ## What this deliberately does and does not attempt
 *
 * `normalizeText` NFC-normalises (so a precomposed and a decomposed Hangul syllable compare
 * equal — either can come out of an IME depending on OS/browser), trims, and lowercases. The
 * lowercasing only ever affects Latin letters: Hangul has no case, so it is a no-op there and
 * exactly what makes `AKs` / `aks` / `AKS` compare equal for hand-notation queries.
 *
 * `compact` additionally strips ALL whitespace, on both sides of every comparison this module
 * powers. That is the one normalisation this feature promises for Korean input — "팟 오즈"
 * and "팟오즈" must both find the pot-odds tool, and stripping every space (not just leading/
 * trailing, and regardless of which side introduced it) is what makes that true no matter
 * which of the two ships the spacing and which the query.
 *
 * What it does NOT attempt (see the WP report's "known limitations" section for the fuller
 * discussion): partial-syllable (in-progress IME composition) matching, spelling-correction /
 * typo-tolerance, or Latin romanisation of Korean text (`potoz` will not find "팟오즈"). All
 * three are fuzzy-matching problems this module is intentionally too simple to solve.
 */

/** NFC-normalise, trim, and lowercase. */
export function normalizeText(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

/** `normalizeText`, with every whitespace run removed. */
export function compact(value: string): string {
  return normalizeText(value).replace(/\s+/gu, '');
}
