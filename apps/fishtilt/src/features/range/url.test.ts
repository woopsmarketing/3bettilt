import { describe, expect, it } from 'vitest';
import { STRATEGY_POSITIONS } from '@gto-self/strategy-core';
import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { routeById } from '../../lib/routes.js';
import { RANGE_SPOTS, RANGE_STACK_DEPTHS } from './types.js';
import { buildRangeUrl, parseRangeUrlQuery, RANGE_EXPLORER_PATH } from './url.js';

describe('parseRangeUrlQuery', () => {
  it('reads the exact example URL from the build spec', () => {
    expect(parseRangeUrlQuery('?hero=BTN&spot=RFI&stack=100')).toEqual({
      heroPosition: 'BTN',
      spot: 'RFI',
      stackDepth: 100,
    });
  });

  it('accepts a leading "?" or a bare query string', () => {
    expect(parseRangeUrlQuery('hero=SB&spot=RFI&stack=100')).toEqual(
      parseRangeUrlQuery('?hero=SB&spot=RFI&stack=100'),
    );
  });

  it('returns an empty object for an empty query string', () => {
    expect(parseRangeUrlQuery('')).toEqual({});
  });

  it('drops an unrecognised position rather than throwing', () => {
    expect(parseRangeUrlQuery('?hero=XX&spot=RFI&stack=100')).toEqual({
      spot: 'RFI',
      stackDepth: 100,
    });
  });

  it('drops an unrecognised spot rather than throwing', () => {
    expect(parseRangeUrlQuery('?hero=BTN&spot=FACING_4BET&stack=100')).toEqual({
      heroPosition: 'BTN',
      stackDepth: 100,
    });
  });

  it('drops a stack depth that is not one of the four shipped buckets', () => {
    expect(parseRangeUrlQuery('?hero=BTN&spot=RFI&stack=200')).toEqual({
      heroPosition: 'BTN',
      spot: 'RFI',
    });
  });

  it('drops a non-numeric stack value rather than producing NaN', () => {
    expect(parseRangeUrlQuery('?stack=abc')).toEqual({});
  });

  it('resolves every real StrategyPosition', () => {
    for (const position of STRATEGY_POSITIONS) {
      expect(parseRangeUrlQuery(`?hero=${position}`)).toEqual({ heroPosition: position });
    }
  });

  it('resolves every RangeSpot', () => {
    for (const spot of RANGE_SPOTS) {
      expect(parseRangeUrlQuery(`?spot=${spot}`)).toEqual({ spot });
    }
  });

  it('resolves every shipped RangeStackDepth', () => {
    for (const depth of RANGE_STACK_DEPTHS) {
      expect(parseRangeUrlQuery(`?stack=${depth}`)).toEqual({ stackDepth: depth });
    }
  });

  it('ignores unrelated query parameters', () => {
    expect(parseRangeUrlQuery('?utm_source=x&hero=CO')).toEqual({ heroPosition: 'CO' });
  });
});

describe('buildRangeUrl', () => {
  it('produces the exact example URL from the build spec', () => {
    // The build spec's example, under the locale the site serves it at (D-S3-02).
    expect(buildRangeUrl({ heroPosition: 'BTN', spot: 'RFI', stackDepth: 100 })).toBe(
      localePath(DEFAULT_LOCALE, '/tools/range?hero=BTN&spot=RFI&stack=100'),
    );
    expect(RANGE_EXPLORER_PATH).toBe(routeById('range').path);
  });

  it('always points at the canonical path', () => {
    const url = buildRangeUrl({ heroPosition: 'SB', spot: 'RFI', stackDepth: 100 });
    expect(url.startsWith(`${RANGE_EXPLORER_PATH}?`)).toBe(true);
  });

  it('round-trips through parseRangeUrlQuery for every real position', () => {
    for (const heroPosition of STRATEGY_POSITIONS) {
      const url = buildRangeUrl({ heroPosition, spot: 'RFI', stackDepth: 100 });
      const [, search] = url.split('?');
      expect(parseRangeUrlQuery(`?${search}`)).toEqual({
        heroPosition,
        spot: 'RFI',
        stackDepth: 100,
      });
    }
  });
});
