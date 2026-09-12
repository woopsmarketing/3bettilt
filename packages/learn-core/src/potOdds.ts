/**
 * Pot odds — "how often do I have to win for this call to break even?"
 *
 * The whole point of this tool for a beginner is that the formula is NOT magic, so every
 * intermediate value a person would work out by hand is returned as a named field rather
 * than folded into one percentage. `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §5.2.
 *
 * ## Money
 *
 * Every amount is integer milliBB and every combination of two amounts goes through
 * `Money.*` (CLAUDE.md rule 1, ADR-0001). The three OUTPUT ratios — required equity, the
 * "one in N" figure and the classic odds-against figure — are deliberately plain numbers:
 * they are proportions, not money, and rounding one of them to a milliBB would be wrong.
 *
 * ## The uncalled remainder
 *
 * The naive formula `call / (pot + bet + call)` silently assumes the caller can cover the
 * bet. When a short stack calls all-in for LESS than the bet, the part of the bet nobody
 * matched is returned to the bettor and never becomes part of the pot being contested.
 * That is a settled rule of the game, not an assumption this project is making, so it is
 * modelled rather than approximated: the pot is built from `min(bet, call)`, and the
 * remainder is reported in `uncalledReturnMbb` so the UI can say out loud that it goes
 * back. When `call === bet` — the ordinary case, and the one the published formula
 * describes — `uncalledReturnMbb` is zero and the two agree exactly.
 */

import { Money, err, ok, type MilliBB, type Result } from '@gto-self/shared';

/** Every way the three inputs can fail to describe a real call. */
export const POT_ODDS_ERRORS = [
  'NEGATIVE_POT',
  'NEGATIVE_BET',
  'NON_POSITIVE_CALL',
  'CALL_EXCEEDS_BET',
] as const;

export type PotOddsError = (typeof POT_ODDS_ERRORS)[number];

export interface PotOddsInput {
  /** What is already in the middle, NOT counting the bet being faced. */
  readonly potBeforeCallMbb: MilliBB;
  /** What the opponent just put in. */
  readonly villainBetMbb: MilliBB;
  /** What hero must put in to call. Less than the bet only when hero is all-in for less. */
  readonly callAmountMbb: MilliBB;
}

export interface PotOdds {
  readonly potBeforeCallMbb: MilliBB;
  readonly villainBetMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  /** The part of the bet that hero actually matches: `min(bet, call)`. */
  readonly calledBetMbb: MilliBB;
  /** The part of the bet nobody matched, returned to the bettor. Usually zero. */
  readonly uncalledReturnMbb: MilliBB;
  /** What hero is playing for once the call is made: `pot + calledBet + call`. */
  readonly finalPotMbb: MilliBB;
  /** Break-even win rate as a proportion in `0..1`. Multiply by 100 to display. */
  readonly requiredEquity: number;
  /** The same number said the beginner way: "win 1 time in N". `finalPot / call`. */
  readonly oneInN: number;
  /** The classic quoted form: pot odds of `oddsAgainst : 1`. `(finalPot - call) / call`. */
  readonly oddsAgainst: number;
}

/**
 * Pot odds for one call, or a typed reason the inputs do not describe one.
 *
 * A zero call is rejected rather than answered with "0% needed": facing no bet there is
 * no call to price, and a checked-down street is a different question from a cheap one.
 */
export function potOdds(input: PotOddsInput): Result<PotOdds, PotOddsError> {
  const { potBeforeCallMbb, villainBetMbb, callAmountMbb } = input;

  if (potBeforeCallMbb < 0) return err('NEGATIVE_POT');
  if (villainBetMbb < 0) return err('NEGATIVE_BET');
  if (callAmountMbb <= 0) return err('NON_POSITIVE_CALL');
  if (Money.gt(callAmountMbb, villainBetMbb)) return err('CALL_EXCEEDS_BET');

  const calledBetMbb = Money.min(villainBetMbb, callAmountMbb);
  const uncalledReturnMbb = Money.sub(villainBetMbb, calledBetMbb);
  const finalPotMbb = Money.add(Money.add(potBeforeCallMbb, calledBetMbb), callAmountMbb);

  // `finalPotMbb >= callAmountMbb > 0`, so neither ratio can divide by zero; the `?? 0`
  // is unreachable and exists only because `Money.ratio` is total.
  const requiredEquity = Money.ratio(callAmountMbb, finalPotMbb) ?? 0;
  const oneInN = Money.ratio(finalPotMbb, callAmountMbb) ?? 0;
  const oddsAgainst = Money.ratio(Money.sub(finalPotMbb, callAmountMbb), callAmountMbb) ?? 0;

  return ok({
    potBeforeCallMbb,
    villainBetMbb,
    callAmountMbb,
    calledBetMbb,
    uncalledReturnMbb,
    finalPotMbb,
    requiredEquity,
    oneInN,
    oddsAgainst,
  });
}
