import { describe, expect, it } from 'vitest';
import { STARTING_HAND_VIEWS } from './types.js';
import { MAX_TOP_PERCENT, MIN_TOP_PERCENT } from './viewModel.js';
import { buildStartingHandUrl, parseStartingHandUrlQuery, STARTING_HAND_PATH } from './url.js';

describe('parseStartingHandUrlQuery', () => {
  it('reads a full example URL', () => {
    expect(parseStartingHandUrlQuery('?view=TOP_SHARE&pct=15')).toEqual({
      view: 'TOP_SHARE',
      percent: 15,
    });
  });

  it('accepts a leading "?" or a bare query string identically', () => {
    expect(parseStartingHandUrlQuery('view=RANK&pct=1')).toEqual(
      parseStartingHandUrlQuery('?view=RANK&pct=1'),
    );
  });

  it('returns an empty object for an empty query string', () => {
    expect(parseStartingHandUrlQuery('')).toEqual({});
  });

  it('resolves every StartingHandView', () => {
    for (const view of STARTING_HAND_VIEWS) {
      expect(parseStartingHandUrlQuery(`?view=${view}`)).toEqual({ view });
    }
  });

  it('drops an unrecognised view rather than throwing', () => {
    expect(parseStartingHandUrlQuery('?view=NOPE&pct=15')).toEqual({ percent: 15 });
  });

  it('accepts the boundary percent values', () => {
    expect(parseStartingHandUrlQuery(`?pct=${MIN_TOP_PERCENT}`)).toEqual({
      percent: MIN_TOP_PERCENT,
    });
    expect(parseStartingHandUrlQuery(`?pct=${MAX_TOP_PERCENT}`)).toEqual({
      percent: MAX_TOP_PERCENT,
    });
  });

  it('drops a percent below the legal minimum', () => {
    expect(parseStartingHandUrlQuery('?pct=0')).toEqual({});
  });

  it('drops a percent above the legal maximum', () => {
    expect(parseStartingHandUrlQuery('?pct=101')).toEqual({});
  });

  it('drops a fractional percent rather than rounding it silently', () => {
    expect(parseStartingHandUrlQuery('?pct=15.5')).toEqual({});
  });

  it('drops a non-numeric percent rather than producing NaN', () => {
    expect(parseStartingHandUrlQuery('?pct=abc')).toEqual({});
  });

  it('ignores unrelated query parameters', () => {
    expect(parseStartingHandUrlQuery('?utm_source=x&view=RANK')).toEqual({ view: 'RANK' });
  });
});

describe('buildStartingHandUrl', () => {
  it('produces the canonical path with both axes', () => {
    expect(buildStartingHandUrl({ view: 'TOP_SHARE', percent: 15 })).toBe(
      `${STARTING_HAND_PATH}?view=TOP_SHARE&pct=15`,
    );
  });

  it('always points at the canonical path', () => {
    expect(buildStartingHandUrl({ view: 'RANK', percent: 1 }).startsWith(STARTING_HAND_PATH)).toBe(
      true,
    );
  });

  it('round-trips through parse for every view and both percent boundaries', () => {
    for (const view of STARTING_HAND_VIEWS) {
      for (const percent of [MIN_TOP_PERCENT, MAX_TOP_PERCENT]) {
        const url = buildStartingHandUrl({ view, percent });
        const [, search] = url.split('?');
        expect(parseStartingHandUrlQuery(`?${search ?? ''}`)).toEqual({ view, percent });
      }
    }
  });
});
