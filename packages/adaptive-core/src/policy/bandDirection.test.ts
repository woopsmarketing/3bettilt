/**
 * WP-K FOLLOW-UP §1/§2 — the direction an opponent read pushes hero, band by band.
 *
 * `frequency.test.ts` and `cap.test.ts` pin the ARITHMETIC. This file pins the SIGNS, which is
 * the part the arithmetic cannot catch: a rule with the right formula and the wrong band scope
 * produces perfectly well-formed numbers pointing the wrong way. Two bugs of exactly that shape
 * shipped in WP-J/WP-K and are what this file exists to keep from coming back:
 *
 *   1. `FOLD_TO_CBET_LOW` and `CHECK_RAISE_HIGH` both read a VALUE hand, so "this opponent
 *      never folds" and "this opponent check-raises" BOTH made hero bet a strong hand LESS.
 *      A hand that wants to be called is not discouraged by an opponent who calls.
 *   2. `SIZE_WINNER_VALUE_UP` sized a value bet UP on a high `WSD`, reading "wins the
 *      showdowns they reach" as "calls too much". Those are different players.
 *
 * Every expected number here was read from a real `composeAdaptive` run against the fixture
 * beside it. The ASSERTIONS, though, are written as directional claims wherever a direction is
 * what is being tested, so a future retune of a gain or a ceiling moves the numbers without
 * silently inverting the poker.
 */
import { describe, expect, it } from 'vitest';
import { composeAdaptive, type AdaptiveComposeContext } from '../compose.js';
import type { AdaptiveRecommendation } from '../recommendation.js';
import type { AdaptiveBaseline } from '../baseline.js';
import {
  FIXTURE_WAGER,
  baselineOf,
  learned,
  ordering,
  profileOf,
} from '../testBaseline.js';
import type { AdaptiveStatObservation } from '../inputs.js';

/** The villain is live and still to act — `baselineOf`'s own default spot shape. */
const stillToAct: AdaptiveComposeContext = {
  opponents: [ordering('villain', { seatIndex: 3, actionOrderIndex: 0 })],
  wager: FIXTURE_WAGER,
};

/** REFERENCE, unchanged: `baselineOf` is CHECK 40 / BET 60 at the 75%-pot rung. */
const REFERENCE_BET_BPS = 6000;

function composeWith(
  observations: readonly AdaptiveStatObservation[],
  band: AdaptiveBaseline['aggressionBand'],
): AdaptiveRecommendation {
  return composeAdaptive(
    baselineOf({ aggressionBand: band }),
    [profileOf('villain', observations)],
    stillToAct,
  );
}

const betBps = (result: AdaptiveRecommendation): number =>
  result.actions.find((action) => action.kind === 'BET')?.frequencyBps ?? 0;

const ruleIds = (result: AdaptiveRecommendation): readonly string[] =>
  result.adjustments.map((adjustment) => adjustment.ruleId);

/* -------------------------------------------------------------------------- */
/* Fold-to-c-bet: the same read, opposite conclusions by band                  */
/* -------------------------------------------------------------------------- */

/**
 * Folds to a flop c-bet only 20% against a 45% anchor, over 100 real opportunities — the
 * station read, with no check-raise or 3-bet reading, so the §9 guard rail stays out of it.
 */
const NEVER_FOLDS: readonly AdaptiveStatObservation[] = [learned('FOLD_TO_CBET_FLOP', 2000, 100)];

describe('low Fold-to-CBet', () => {
  it('bets a STRONG hand MORE often, and one rung bigger', () => {
    const result = composeWith(NEVER_FOLDS, 'STRONG');
    expect(ruleIds(result)).toEqual(['FOLD_TO_CBET_LOW_VALUE_UP', 'SIZE_STATION_VALUE_UP_FOLD']);
    expect(betBps(result)).toBeGreaterThan(REFERENCE_BET_BPS);
    expect(betBps(result)).toBe(6400);
    expect(result.sizing?.bucketDelta).toBe(1);
  });

  it('bets a WEAK hand LESS often — the opposite sign, from the identical reading', () => {
    const result = composeWith(NEVER_FOLDS, 'WEAK');
    expect(ruleIds(result)).toEqual(['FOLD_TO_CBET_LOW']);
    expect(betBps(result)).toBeLessThan(REFERENCE_BET_BPS);
    expect(betBps(result)).toBe(5500);
  });

  it('never lets one reading move VALUE and WEAK the same way', () => {
    const value = betBps(composeWith(NEVER_FOLDS, 'STRONG')) - REFERENCE_BET_BPS;
    const bluff = betBps(composeWith(NEVER_FOLDS, 'WEAK')) - REFERENCE_BET_BPS;
    expect(Math.sign(value)).toBe(1);
    expect(Math.sign(bluff)).toBe(-1);
  });
});

/* -------------------------------------------------------------------------- */
/* Check-raise: de-escalate the hands a raise actually punishes                */
/* -------------------------------------------------------------------------- */

/** Check-raises the flop 30% against an 800 bps anchor, over 100 real opportunities. */
const CHECK_RAISES: readonly AdaptiveStatObservation[] = [learned('CHECK_RAISE_FLOP', 3000, 100)];

describe('high Check/Raise', () => {
  it('leaves a STRONG hand alone — being raised is the outcome hero wants', () => {
    const result = composeWith(CHECK_RAISES, 'STRONG');
    expect(ruleIds(result)).not.toContain('CHECK_RAISE_HIGH');
    expect(betBps(result)).toBe(REFERENCE_BET_BPS);
    // And the sizing pass has said the same thing since WP-J: `SIZE_CHECK_RAISE_DOWN` is
    // scoped to MARGINAL and WEAK. The two passes now agree rather than contradicting.
    expect(ruleIds(result)).not.toContain('SIZE_CHECK_RAISE_DOWN');
  });

  it('de-escalates a MARGINAL hand, in both frequency and size', () => {
    const result = composeWith(CHECK_RAISES, 'NEUTRAL');
    expect(ruleIds(result)).toEqual(['CHECK_RAISE_HIGH', 'SIZE_CHECK_RAISE_DOWN']);
    expect(betBps(result)).toBeLessThan(REFERENCE_BET_BPS);
    expect(betBps(result)).toBe(5300);
    expect(result.sizing?.bucketDelta).toBe(-1);
  });
});

/* -------------------------------------------------------------------------- */
/* WSD is a SECONDARY signal and never a primary one                          */
/* -------------------------------------------------------------------------- */

describe('WSD as a secondary signal only', () => {
  it('does nothing at all on its own: high WSD, low WTSD moves neither mix nor size', () => {
    const result = composeWith(
      [learned('WTSD', 1500, 200), learned('WSD', 6000, 100)],
      'STRONG',
    );
    // No rule reads WSD as a primary signal any more, and WTSD is BELOW its anchor here, so
    // there is nothing for the suppressor to suppress either.
    expect(result.adjustments).toEqual([]);
    expect(betBps(result)).toBe(REFERENCE_BET_BPS);
    expect(result.sizing?.bucketDelta).toBe(0);
  });

  it('high WTSD with an average WSD: the station size-up fires in full', () => {
    const result = composeWith(
      [learned('WTSD', 4500, 200), learned('WSD', 5000, 100)],
      'STRONG',
    );
    expect(ruleIds(result)).toEqual(['WTSD_HIGH_VALUE_UP', 'SIZE_STATION_VALUE_UP']);
    expect(result.sizing?.bucketDelta).toBe(1);
    expect(result.notes.map((note) => note.code)).not.toContain(
      'SIZING_SECONDARY_SIGNAL_WITHDRAWN',
    );
  });

  it('high WTSD AND high WSD: the size-up is withdrawn, and the reason is recorded', () => {
    const result = composeWith(
      [learned('WTSD', 4500, 200), learned('WSD', 6000, 100)],
      'STRONG',
    );
    // The FREQUENCY read is untouched — a player who gets to showdown is still bet at more
    // often for value. Only the extra RUNG, which assumed they were a station, is withheld.
    expect(ruleIds(result)).toEqual(['WTSD_HIGH_VALUE_UP']);
    expect(betBps(result)).toBeGreaterThan(REFERENCE_BET_BPS);
    expect(result.sizing?.bucketDelta).toBe(0);
    expect(result.notes).toContainEqual({
      code: 'SIZING_SECONDARY_SIGNAL_WITHDRAWN',
      detail: 'SIZE_STATION_VALUE_UP',
    });
  });

  it('never withdraws the fold-to-c-bet size-up, whose signal needs no disambiguating', () => {
    const result = composeWith(
      [learned('FOLD_TO_CBET_FLOP', 2000, 100), learned('WSD', 6000, 100)],
      'STRONG',
    );
    expect(ruleIds(result)).toContain('SIZE_STATION_VALUE_UP_FOLD');
    expect(result.sizing?.bucketDelta).toBe(1);
  });

  it('a suppressor may not fire on evidence too weak to have acted on', () => {
    // WSD 60% but over 3 observations: confidence is far below the sizing gate, so the
    // secondary signal is ignored and the station size-up stands.
    const result = composeWith(
      [learned('WTSD', 4500, 200), learned('WSD', 6000, 3)],
      'STRONG',
    );
    expect(ruleIds(result)).toContain('SIZE_STATION_VALUE_UP');
    expect(result.sizing?.bucketDelta).toBe(1);
  });
});
