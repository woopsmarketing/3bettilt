import { describe, expect, it } from 'vitest';
import { resolveTypedKey } from './keys.js';

/**
 * The bug this pins: a Korean (or any non-Latin) IME rewrites `event.key` to a jamo, or to
 * the literal `'Process'` while composing, so `event.key.toLowerCase()` never matches a
 * hotkey letter again. `event.code` is the physical key position and survives every IME
 * untouched, so it is the fallback source of truth.
 */
describe('resolveTypedKey', () => {
  it('uses `key` verbatim for a plain US keypress', () => {
    expect(resolveTypedKey({ key: 'f', code: 'KeyF' })).toBe('f');
  });

  it('falls back to `code` when a Korean IME delivers a Hangul jamo', () => {
    // 2-set Hangul: the physical F key produces the jamo ㄹ, not the Latin letter.
    expect(resolveTypedKey({ key: 'ㄹ', code: 'KeyF' })).toBe('f');
  });

  it('falls back to `code` while the IME is mid-composition', () => {
    expect(resolveTypedKey({ key: 'Process', code: 'KeyF' })).toBe('f');
  });

  it('returns null for a dead key with no letter/digit code', () => {
    expect(resolveTypedKey({ key: 'Dead', code: 'Quote' })).toBeNull();
  });

  it('resolves a digit through `code` when `key` is not a plain digit', () => {
    expect(resolveTypedKey({ key: 'Unidentified', code: 'Digit9' })).toBe('9');
  });

  it('uses `key` verbatim for a plain digit press', () => {
    expect(resolveTypedKey({ key: '9', code: 'Digit9' })).toBe('9');
  });

  it('does not mistake a numpad code for a letter or digit', () => {
    expect(resolveTypedKey({ key: 'Unidentified', code: 'Numpad9' })).toBeNull();
  });

  it('keeps AZERTY working: `key` already reads as `a` even though `code` is `KeyQ`', () => {
    expect(resolveTypedKey({ key: 'a', code: 'KeyQ' })).toBe('a');
  });

  it('returns null for a named key such as Escape', () => {
    expect(resolveTypedKey({ key: 'Escape', code: 'Escape' })).toBeNull();
  });

  it('returns null for a modifier key alone', () => {
    expect(resolveTypedKey({ key: 'Shift', code: 'ShiftLeft' })).toBeNull();
  });

  it('returns null for whitespace, which is not a hotkey character', () => {
    expect(resolveTypedKey({ key: ' ', code: 'Space' })).toBeNull();
  });
});
