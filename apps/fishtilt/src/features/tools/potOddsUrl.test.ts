import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { routeById } from '../../lib/routes.js';
import { MAX_INPUT_DECIMALS } from './amount.js';
import { parsePotOddsUrlQuery, POT_ODDS_PATH } from './potOddsUrl.js';

/*
 * WP-Q2 / P2-M10. `content/blog/pot-odds-quick.mdx` walks a 9BB pot facing a 6BB bet and its
 * CTA links `/tools/pot-odds?pot=9&bet=6`; the calculator ignored the query and opened on its
 * own 10/5 default, so the article promised one worked example and the tool showed another.
 * Same contract shape as `features/range/url.ts`, which already works.
 */
describe('parsePotOddsUrlQuery', () => {
  it('reads the exact URL the pot-odds article publishes', () => {
    expect(parsePotOddsUrlQuery('?pot=9&bet=6')).toEqual({ potBB: '9', betBB: '6' });
  });

  it('names the route it belongs to, so a CTA and a parser cannot disagree', () => {
    expect(POT_ODDS_PATH).toBe(routeById('toolPotOdds').path);
    expect(POT_ODDS_PATH).toBe(localePath(DEFAULT_LOCALE, '/tools/pot-odds'));
  });

  it('accepts a leading "?" or a bare query string', () => {
    expect(parsePotOddsUrlQuery('pot=9&bet=6')).toEqual(parsePotOddsUrlQuery('?pot=9&bet=6'));
  });

  it('returns an empty object for an empty query, leaving the defaults in place', () => {
    expect(parsePotOddsUrlQuery('')).toEqual({});
    expect(parsePotOddsUrlQuery('?something=else')).toEqual({});
  });

  it('reads each axis independently — one bad parameter never discards the other', () => {
    expect(parsePotOddsUrlQuery('?pot=abc&bet=6')).toEqual({ betBB: '6' });
    expect(parsePotOddsUrlQuery('?pot=9&bet=')).toEqual({ potBB: '9' });
  });

  it('normalises through the money boundary rather than echoing the raw text', () => {
    // `9.0` and `9` are the same milliBB, so the field is seeded with what the calculator
    // will actually use, written the way the field writes it.
    expect(parsePotOddsUrlQuery('?pot=9.0&bet=6.500')).toEqual({ potBB: '9', betBB: '6.5' });
    expect(parsePotOddsUrlQuery('?pot=.5')).toEqual({ potBB: '0.5' });
  });

  it('rejects a precision finer than one milliBB rather than rounding behind the reader', () => {
    expect(MAX_INPUT_DECIMALS).toBe(3);
    expect(parsePotOddsUrlQuery('?pot=1.2345')).toEqual({});
    expect(parsePotOddsUrlQuery('?pot=1.234')).toEqual({ potBB: '1.234' });
  });

  it('falls back to the default for an out-of-range amount, and never throws', () => {
    // `Money.parseBB`'s magnitude guard is the one rejection `parseAmountBB` delegates, so
    // the bound is read from `shared` rather than restated here.
    const overLarge = String((Money.MAX_MILLI_BB / Money.MBB_PER_BB) * 10);
    expect(Money.parseBB(overLarge).ok).toBe(false);
    expect(parsePotOddsUrlQuery(`?pot=${overLarge}`)).toEqual({});
  });

  it('does not re-decide poker rules the domain already owns', () => {
    // A negative pot and a zero bet parse fine here and are refused by `potOdds` with a typed
    // error the calculator renders in Korean — exactly as when they are typed by hand. See
    // `amount.ts`'s module doc: one rulebook, and it is the domain's.
    expect(parsePotOddsUrlQuery('?pot=-5&bet=0')).toEqual({ potBB: '-5', betBB: '0' });
  });

  it('survives a hand-mangled query string without throwing', () => {
    for (const query of ['?pot', '?pot=&bet=', '?pot=%%%', '?pot=9&pot=10', '?&&&']) {
      expect(() => parsePotOddsUrlQuery(query)).not.toThrow();
    }
  });
});
