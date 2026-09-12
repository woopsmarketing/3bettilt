/**
 * Outs — "I am drawing; how often do I actually get there?"
 *
 * The answer is a hypergeometric probability, and it is small enough to state in closed
 * form, so this module states it in closed form. Nothing here is estimated, simulated or
 * sampled. `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §5.2.
 *
 * ## No money, so no `Money`
 *
 * Every number this module returns is a probability in `0..1`. CLAUDE.md rule 1 confines
 * integer milliBB to MONEY (ADR-0001); a probability is a ratio and rounding one to a
 * milliBB would be meaningless. `potOdds.ts` makes the same distinction for the same
 * reason: its pot is money, its required equity is not.
 *
 * ## Why 47 and 46
 *
 * After the flop a player has seen 2 hole cards and 3 board cards, so 47 cards are unseen;
 * after the turn, 46. The opponents' hole cards are counted as UNSEEN rather than removed,
 * because from the drawing player's seat they are unknown — this is the standard,
 * universally taught convention, not a modelling choice this project is making. It is also
 * why the number is 47 and not "47 minus two per opponent": cards you cannot see are cards
 * that can still come, as far as your own information goes.
 *
 * ## The decomposition, and why both halves are returned
 *
 * On the flop two cards are still to come, and the honest way to say "I hit by the river"
 * is the sum of two disjoint events a beginner can check by hand:
 *
 *     nextCardProb     = outs / unseen                          (hit the turn)
 *     missThenHitProb  = (unseen - outs)/unseen * outs/(unseen-1)  (miss the turn, hit the river)
 *     byRiverProb      = nextCardProb + missThenHitProb
 *
 * which is algebraically identical to the textbook complement
 * `1 - C(unseen - outs, cardsToCome) / C(unseen, cardsToCome)`. `byRiverProb` is computed
 * from the complement — one division, so the exact form is the primary answer — and the two
 * components are returned beside it because the whole point of the page is that the number
 * is derivable, not handed down. The test suite asserts the two forms agree.
 *
 * On the turn the river IS the next card: `missThenHitProb` is exactly 0 and `byRiverProb`
 * is `nextCardProb` itself, the identical float. `1 - (unseen - outs)/unseen` would be the
 * same quantity but not always the same double, and one event must not render as two
 * slightly different percentages.
 *
 * ## The rule of 2 and 4 is a shortcut, never the answer
 *
 * Beginners are taught "outs x 2 for one card, outs x 4 for two cards". It is a good mental
 * tool and it is wrong by a widening margin as the out count grows (at 15 outs the x4
 * shortcut says 60% when the truth is 54.1%). Showing only the shortcut teaches a
 * falsehood; hiding it leaves the learner unable to follow other poker literature. So both
 * are returned, in separate fields, with the signed error already computed — the product's
 * job is to show the gap, not to pick a side.
 */

import { err, ok, type Result } from '@gto-self/shared';

/** The two streets on which a draw still has a card to come. */
export const DRAW_STREETS = ['FLOP', 'TURN'] as const;

/**
 * Which board the draw is looking at. `'FLOP'` means three board cards are out and two are
 * still to come; `'TURN'` means four are out and only the river remains. There is no
 * `'RIVER'` member: with no card to come there is no draw to price.
 */
export type DrawStreet = (typeof DRAW_STREETS)[number];

/** Every way an out count can fail to describe a real draw. */
export const OUTS_ERRORS = ['NON_INTEGER_OUTS', 'NEGATIVE_OUTS', 'OUTS_EXCEED_UNSEEN'] as const;

export type OutsError = (typeof OUTS_ERRORS)[number];

/** 52 - 2 hole cards - 3 board cards. */
export const UNSEEN_AFTER_FLOP = 47;

/** 52 - 2 hole cards - 4 board cards. */
export const UNSEEN_AFTER_TURN = 46;

export interface OutsInput {
  /** Cards that complete the draw. A non-negative integer, at most the unseen count. */
  readonly outs: number;
  readonly street: DrawStreet;
}

/** The "outs x 2 / outs x 4" mental shortcut, reported so the learner can see the gap. */
export interface OutsShortcut {
  /** `outs * 0.02`. */
  readonly nextCardProb: number;
  /** `outs * 0.04` on the flop, `outs * 0.02` on the turn. */
  readonly byRiverProb: number;
  /** Always 2 — the shortcut for one card to come. */
  readonly nextCardMultiplier: number;
  /** 4 on the flop, 2 on the turn. */
  readonly byRiverMultiplier: number;
  /** `shortcut - exact`, signed. Positive means the shortcut overstates the draw. */
  readonly nextCardError: number;
  /** `shortcut - exact`, signed. Positive means the shortcut overstates the draw. */
  readonly byRiverError: number;
}

export interface OutsOdds {
  readonly outs: number;
  readonly street: DrawStreet;
  /** 47 after the flop, 46 after the turn. */
  readonly unseenCards: number;
  /** 2 after the flop, 1 after the turn. */
  readonly cardsToCome: number;
  /** P(the very next card is an out). */
  readonly nextCardProb: number;
  /** P(the next card misses AND the last one hits). Exactly 0 on the turn. */
  readonly missThenHitProb: number;
  /** P(at least one of the remaining cards is an out). Equals `nextCardProb` on the turn. */
  readonly byRiverProb: number;
  /** The mental shortcut, kept strictly separate from the exact answer above. */
  readonly ruleOfTwoAndFour: OutsShortcut;
}

/**
 * Exact draw probabilities for an out count, or a typed reason the count is not a real one.
 *
 * Zero outs is accepted and answers 0: "this draw is dead" is a true and useful statement,
 * unlike `potOdds`' zero call, which describes no decision at all. An out count equal to
 * the unseen count is likewise accepted and answers 1.
 */
export function outsOdds(input: OutsInput): Result<OutsOdds, OutsError> {
  const { outs, street } = input;

  if (!Number.isInteger(outs)) return err('NON_INTEGER_OUTS');
  if (outs < 0) return err('NEGATIVE_OUTS');

  const unseenCards = street === 'FLOP' ? UNSEEN_AFTER_FLOP : UNSEEN_AFTER_TURN;
  const cardsToCome = street === 'FLOP' ? 2 : 1;
  if (outs > unseenCards) return err('OUTS_EXCEED_UNSEEN');

  const nextCardProb = outs / unseenCards;

  // P(every card to come misses) = C(unseen - outs, cardsToCome) / C(unseen, cardsToCome),
  // written out rather than called through a binomial helper so the two-card case reads as
  // the falling factorials a person would actually cancel by hand. `missCount - 1` can only
  // reach -1 when `missCount === 0`, and 0 * -1 is 0, so the product stays correct there.
  const missCount = unseenCards - outs;
  // On the turn "by the river" and "the next card" are the SAME event, so the same float is
  // returned for both rather than a second, independently rounded one — `1 - 37/46` and
  // `9/46` differ in the last bit, and a UI showing one number twice must show it twice.
  const byRiverProb =
    cardsToCome === 2
      ? 1 - (missCount * (missCount - 1)) / (unseenCards * (unseenCards - 1))
      : nextCardProb;

  const missThenHitProb =
    cardsToCome === 2 ? (missCount / unseenCards) * (outs / (unseenCards - 1)) : 0;

  const byRiverMultiplier = cardsToCome === 2 ? 4 : 2;
  const shortcutNext = outs * 0.02;
  const shortcutByRiver = outs * byRiverMultiplier * 0.01;

  return ok({
    outs,
    street,
    unseenCards,
    cardsToCome,
    nextCardProb,
    missThenHitProb,
    byRiverProb,
    ruleOfTwoAndFour: {
      nextCardProb: shortcutNext,
      byRiverProb: shortcutByRiver,
      nextCardMultiplier: 2,
      byRiverMultiplier,
      nextCardError: shortcutNext - nextCardProb,
      byRiverError: shortcutByRiver - byRiverProb,
    },
  });
}
