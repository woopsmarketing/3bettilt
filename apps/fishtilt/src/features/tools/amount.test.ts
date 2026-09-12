import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { AMOUNT_ERRORS, OUTS_INPUT_ERRORS, parseAmountBB, parseOutsInput } from './amount.js';

/*
 * The parse boundary. Two properties matter here and nothing else does:
 *
 *   1. What comes out is integer milliBB, so no float ever reaches the money domain.
 *   2. What is REJECTED is only ever "this is not a number". Poker rules — a negative pot,
 *      a zero call, half an out — pass straight through to `learn-core`, which owns them.
 *      A test that expected this module to reject them would be pinning a second rulebook
 *      into existence.
 */
describe('parseAmountBB', () => {
  it('converts BB text into integer milliBB', () => {
    expect(parseAmountBB('10')).toEqual({ ok: true, value: 10_000 });
    expect(parseAmountBB('2.375')).toEqual({ ok: true, value: 2375 });
    expect(parseAmountBB('.5')).toEqual({ ok: true, value: 500 });
    expect(parseAmountBB('0')).toEqual({ ok: true, value: 0 });
  });

  it('produces a value Money accepts as money, not a float', () => {
    const parsed = parseAmountBB('0.16');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Number.isInteger(parsed.value)).toBe(true);
    // 0.16 * 1000 is 159.99999999999997 in a double; the boundary must land on 160.
    expect(parsed.value).toBe(160);
    expect(() => Money.mbb(parsed.value)).not.toThrow();
  });

  it('tolerates surrounding whitespace and digit grouping', () => {
    expect(parseAmountBB('  1,250  ')).toEqual({ ok: true, value: 1_250_000 });
  });

  it('rejects text that is not a number', () => {
    expect(parseAmountBB('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseAmountBB('   ')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseAmountBB('열')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(parseAmountBB('5 BB')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(parseAmountBB('1e3')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(parseAmountBB('--5')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
  });

  it('refuses a fourth decimal rather than silently rounding it away', () => {
    expect(parseAmountBB('2.3755')).toEqual({ ok: false, error: 'TOO_MANY_DECIMALS' });
  });

  it('refuses an amount larger than money can hold', () => {
    expect(parseAmountBB('999999999')).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });

  it('accepts a negative amount and leaves the poker rule to the domain', () => {
    expect(parseAmountBB('-3')).toEqual({ ok: true, value: -3000 });
  });

  it('lists every error exactly once', () => {
    expect(new Set(AMOUNT_ERRORS).size).toBe(AMOUNT_ERRORS.length);
  });
});

describe('parseOutsInput', () => {
  it('reads a whole number of outs', () => {
    expect(parseOutsInput('9')).toEqual({ ok: true, value: 9 });
    expect(parseOutsInput(' 15 ')).toEqual({ ok: true, value: 15 });
    expect(parseOutsInput('0')).toEqual({ ok: true, value: 0 });
  });

  it('rejects text that is not a number at all', () => {
    expect(parseOutsInput('')).toEqual({ ok: false, error: 'EMPTY' });
    expect(parseOutsInput('아홉')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(parseOutsInput('0x10')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(parseOutsInput('9장')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
  });

  it('passes a fractional or negative count through for the domain to reject', () => {
    expect(parseOutsInput('9.5')).toEqual({ ok: true, value: 9.5 });
    expect(parseOutsInput('-3')).toEqual({ ok: true, value: -3 });
  });

  it('lists every error exactly once', () => {
    expect(new Set(OUTS_INPUT_ERRORS).size).toBe(OUTS_INPUT_ERRORS.length);
  });
});
