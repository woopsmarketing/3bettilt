/**
 * Resolves a keyboard event to the physical letter or digit the user actually pressed,
 * independent of the active input method.
 *
 * The bug this exists to fix: with a Korean (or any non-Latin) IME engaged, a browser
 * `keydown` does not deliver `event.key === 'f'`. It delivers the Hangul jamo (`'ㄹ'`), or
 * the literal string `'Process'` while the IME is composing. `event.key.toLowerCase()`
 * then matches nothing, and every hotkey in the app goes dead for exactly the primary
 * user. `event.code` is the physical key position and is untouched by any IME — a Korean
 * 2-set keyboard is physically QWERTY with the Latin legend printed on the keycap, so
 * `code` is exactly what the user's hand pressed.
 *
 * `key` is still preferred when it already IS a single ASCII letter or digit: that is
 * what keeps non-QWERTY *Latin* layouts (AZERTY, Dvorak, ...) working exactly as they do
 * today, where the physical position is deliberately NOT what the user means.
 *
 * Pure and React/DOM-free by design (`CLAUDE.md` rule 4's layering intent extends to this
 * module even though it lives under `apps/web`): the argument is a structural shape, not
 * a `KeyboardEvent` class, so this is trivially unit-testable and matches how
 * `isTypingTarget` in `ActionDock.tsx` is duck-typed rather than `instanceof`-checked.
 *
 * Named keys — `Escape`, `Backspace`, `Enter` — are NOT this function's concern. They are
 * multi-character `key` values with a `code` that never matches `KeyA`..`KeyZ` or
 * `Digit0`..`Digit9`, so this resolver returns `null` for them by construction. Callers
 * that need those keys must keep reading `event.key` directly, exactly as before.
 */
export interface PhysicalKeyEvent {
  readonly key: string;
  readonly code: string;
}

const SINGLE_ASCII_ALNUM = /^[a-zA-Z0-9]$/;
const LETTER_CODE = /^Key([A-Z])$/;
const DIGIT_CODE = /^Digit([0-9])$/;

/**
 * Total. Returns the single ASCII letter or digit the user physically typed, or `null`
 * when the event carries neither (a named key, a dead key, a numpad code — numpad digits
 * are deliberately NOT mapped here; nothing in this app's hotkeys uses the numpad, and
 * treating `NumpadX` as a letter/digit source would be scope this bug does not need).
 */
export function resolveTypedKey(event: PhysicalKeyEvent): string | null {
  // 1. `key` wins when it is already exactly one ASCII letter or digit. This is what a
  //    US layout, and every other Latin layout, delivers for a normal keypress — AZERTY's
  //    `code: 'KeyQ'` for the letter the user reads as `a` must NOT be remapped back to
  //    `q` by the fallback below.
  if (SINGLE_ASCII_ALNUM.test(event.key)) return event.key;

  // 2. Otherwise fall back to the physical key position, which no IME rewrites.
  const letter = LETTER_CODE.exec(event.code);
  if (letter !== null) return letter[1]!.toLowerCase();

  const digit = DIGIT_CODE.exec(event.code);
  if (digit !== null) return digit[1]!;

  return null;
}
