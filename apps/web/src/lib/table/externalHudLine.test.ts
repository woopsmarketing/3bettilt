import { describe, expect, it } from 'vitest';
import { EXTERNAL_HUD_STAT_KEYS } from '@gto-self/player-core';
import { EXTERNAL_HUD_STAT_LABEL, quickHudLineCountError, quickHudLineValueError } from './copy.js';
import { parseExternalHudLine } from './externalHudLine.js';

describe('parseExternalHudLine', () => {
  it('parses ten space-separated values in canonical order', () => {
    const result = parseExternalHudLine('24 19 8 62 31 55 47 11 27 52');
    expect(result).toEqual({
      ok: true,
      values: {
        VPIP: '24',
        PFR: '19',
        THREE_BET: '8',
        FOLD_TO_THREE_BET: '62',
        STEAL: '31',
        CBET_ANY_STREET: '55',
        FOLD_TO_CBET_ANY_STREET: '47',
        CHECK_RAISE_ANY_STREET: '11',
        WTSD: '27',
        WSD: '52',
      },
    });
  });

  it('accepts a comma-separated equivalent', () => {
    const spaced = parseExternalHudLine('24 19 8 62 31 55 47 11 27 52');
    const commaed = parseExternalHudLine('24,19,8,62,31,55,47,11,27,52');
    expect(commaed).toEqual(spaced);
  });

  it('tolerates mixed/multiple whitespace and commas', () => {
    const result = parseExternalHudLine('  24,  19 ,,8   62,31 55,,47 11,27   52 ');
    expect(result.ok).toBe(true);
  });

  it('treats "-" as unknown and omits the key entirely (never a blank string)', () => {
    const result = parseExternalHudLine('24 - 8 62 31 55 47 11 27 52');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect('PFR' in result.values).toBe(false);
    expect(result.values.VPIP).toBe('24');
  });

  it('accepts the boundary values 0 and 100', () => {
    const result = parseExternalHudLine('0 100 0 100 0 100 0 100 0 100');
    expect(result).toEqual({
      ok: true,
      values: {
        VPIP: '0',
        PFR: '100',
        THREE_BET: '0',
        FOLD_TO_THREE_BET: '100',
        STEAL: '0',
        CBET_ANY_STREET: '100',
        FOLD_TO_CBET_ANY_STREET: '0',
        CHECK_RAISE_ANY_STREET: '100',
        WTSD: '0',
        WSD: '100',
      },
    });
  });

  it('rejects a value over 100', () => {
    const result = parseExternalHudLine('24 19 8 62 31 55 47 11 27 100.5');
    expect(result).toEqual({
      ok: false,
      message: quickHudLineValueError(10, EXTERNAL_HUD_STAT_LABEL.WSD, '100.5'),
    });
  });

  it('rejects a negative value', () => {
    const result = parseExternalHudLine('-5 19 8 62 31 55 47 11 27 52');
    expect(result).toEqual({
      ok: false,
      message: quickHudLineValueError(1, EXTERNAL_HUD_STAT_LABEL.VPIP, '-5'),
    });
  });

  it('rejects a non-numeric token', () => {
    const result = parseExternalHudLine('24 abc 8 62 31 55 47 11 27 52');
    expect(result).toEqual({
      ok: false,
      message: quickHudLineValueError(2, EXTERNAL_HUD_STAT_LABEL.PFR, 'abc'),
    });
  });

  it('rejects too few tokens', () => {
    const result = parseExternalHudLine('24 19 8');
    expect(result).toEqual({
      ok: false,
      message: quickHudLineCountError(EXTERNAL_HUD_STAT_KEYS.length, 3),
    });
  });

  it('rejects too many tokens', () => {
    const result = parseExternalHudLine('24 19 8 62 31 55 47 11 27 52 3');
    expect(result).toEqual({
      ok: false,
      message: quickHudLineCountError(EXTERNAL_HUD_STAT_KEYS.length, 11),
    });
  });
});
