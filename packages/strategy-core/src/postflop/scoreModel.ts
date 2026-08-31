/**
 * THE ENTIRE POSTFLOP SCORING MODEL, AS DATA.
 *
 * Every weight, every threshold, every point value and every mapping the postflop reference
 * policy uses lives in this file and is exported. `score.ts`, `sizing.ts` and `policy.ts`
 * contain control flow and arithmetic; no MODEL number (a weight, band edge, threshold or
 * point value) may live there. A handful of structural literals remain in those files where
 * they are part of an algorithm's shape rather than the model's opinion. That separation is the
 * point: a reviewer can read this one file and know exactly what the engine believes, and a
 * disagreement about the model is a data edit rather than a code change.
 *
 * NOTHING here is GTO, and nothing here is solved output. Every number below is this
 * project's own authored rule of thumb (ADR-0056 `HEURISTIC`), except where a rationale says
 * otherwise. See `rules.ts` for the provenance of each rule and `docs/reports/STRATEGY_WP_B3.md`
 * for the same tables rendered for reading.
 *
 * ---------------------------------------------------------------------------------------
 * HOW A SCORE IS BUILT
 *
 *   1. Each COMPONENT measures one fact about the spot and maps it, through a documented
 *      band table, to `points` in roughly -100..+100.
 *   2. `score = round( sum(weight_i * points_i) / sum(weight_i) )` — a WEIGHTED MEAN, so the
 *      score stays on the same -100..+100 scale as its components and a new component does
 *      not silently rescale the bands.
 *   3. The score is looked up in a band table to get a frequency in basis points.
 *
 * NO SINGLE-FEATURE ADVICE. The heaviest aggression component carries 3 of 26 total weight
 * (11.5%), so no single measurement can move the score by more than ~23 points out of the
 * ~200-point span — never enough to cross from GIVE_UP to DOMINANT on its own. "Top pair
 * therefore bet" is unrepresentable by construction, and a test asserts the weight share.
 * ---------------------------------------------------------------------------------------
 */
import type {
  MadeHandClass,
  HeroBlocker,
  StraightDrawKind,
  FlushNutClass,
} from '../analysis/heroHand.js';
import type { BoardTendency } from '../analysis/board.js';

// ===========================================================================
// Shared band machinery
// ===========================================================================

/**
 * One row of a threshold table. Rows are ordered DESCENDING by `atLeast` and the FIRST row
 * whose `atLeast` the measured value reaches wins; the last row always has `atLeast: -Infinity`
 * so a table is total. The ROWS are always ordered by the measured value, never by points, so
 * one shape serves both a table where a bigger measurement is better (equity) and one where it
 * is worse (the size of the bet hero faces).
 */
export interface ScoreBand {
  /** Inclusive lower bound on the measured value. */
  readonly atLeast: number;
  readonly points: number;
  /** A stable token for the explanation feature, never a sentence. */
  readonly label: string;
}

/** Total. First row whose `atLeast` is reached. Throws only on a malformed (empty) table. */
export function bandFor(bands: readonly ScoreBand[], value: number): ScoreBand {
  for (const band of bands) {
    if (value >= band.atLeast) return band;
  }
  const last = bands[bands.length - 1];
  if (last === undefined) throw new Error('a score band table must not be empty');
  return last;
}

/** Every component id the aggression model can report. */
export const AGGRESSION_COMPONENT_IDS = [
  'HAND_STRENGTH',
  'HERO_EQUITY',
  'RANGE_ADVANTAGE',
  'NUT_ADVANTAGE',
  'RANGE_RANK',
  'DRAW_QUALITY',
  'BLOCKER_QUALITY',
  'POSITION',
  'INITIATIVE',
  'BOARD_TEXTURE',
  'SPR_PRESSURE',
  'MULTIWAY',
  'FACED_BET_SIZE',
  'POT_TYPE',
  'STREET_ACTION',
] as const;
export type AggressionComponentId = (typeof AGGRESSION_COMPONENT_IDS)[number];

/** Every component id the continue (fold-or-not) model can report. */
export const CONTINUE_COMPONENT_IDS = [
  'POT_ODDS_MARGIN',
  'HAND_STRENGTH',
  'DRAW_QUALITY',
  'BLOCKER_QUALITY',
  'RANGE_RANK',
  'POSITION',
  'MULTIWAY',
  'FACED_BET_SIZE',
] as const;
export type ContinueComponentId = (typeof CONTINUE_COMPONENT_IDS)[number];

export type ScoreComponentId = AggressionComponentId | ContinueComponentId;

/** A weight entry: the component, its integer weight, and why it weighs that much. */
export interface ComponentWeight<Id extends string> {
  readonly id: Id;
  readonly weight: number;
  readonly rationale: string;
}

// ===========================================================================
// 1. Aggression component weights
// ===========================================================================

/**
 * Total weight 26. Read the weights as "how much of the decision this fact is allowed to be".
 * Hand strength and raw equity are the two heaviest at 3 each because they are the only two
 * facts that are about hero's ACTUAL hand against the ACTUAL opposition; everything else is
 * context that modulates them.
 */
export const AGGRESSION_WEIGHTS: readonly ComponentWeight<AggressionComponentId>[] = [
  {
    id: 'HAND_STRENGTH',
    weight: 3,
    rationale:
      'What hero actually holds, from B1\'s made-hand class. Joint-heaviest, but 3/26 is only 11.5% of the decision — deliberately not enough for "I have top pair" to be an answer.',
  },
  {
    id: 'HERO_EQUITY',
    weight: 3,
    rationale:
      "Hero's showdown equity against the live villain range(s), from B2. Joint-heaviest because it is the one number that already accounts for draws, blockers and the opposition at once.",
  },
  {
    id: 'RANGE_ADVANTAGE',
    weight: 2,
    rationale:
      "How hero's WHOLE range does on this board against villain's. Betting frequency is a range-level decision; without this the model would bet hands rather than ranges.",
  },
  {
    id: 'NUT_ADVANTAGE',
    weight: 2,
    rationale:
      'Which range holds more of the top of the board. Range advantage and nut advantage genuinely diverge (a range can be ahead on average while holding none of the nuts), so they are separate components rather than one blended number.',
  },
  {
    id: 'RANGE_RANK',
    weight: 2,
    rationale:
      "Where hero's hand sits inside hero's OWN range. A hand can have good equity and still be a poor betting candidate if the rest of the range is stronger; this is what stops the model value-betting the middle of its range.",
  },
  {
    id: 'DRAW_QUALITY',
    weight: 2,
    rationale:
      "Semi-bluff equity: draws that can improve are the honest source of a betting range's bluffs. Weighted equally with range advantage so a strong draw can bet on a board hero's range is otherwise behind on.",
  },
  {
    id: 'BLOCKER_QUALITY',
    weight: 1,
    rationale:
      'Cards hero holds that villain therefore cannot. A real but second-order effect: it should tilt a close bluffing decision, never decide it, so it carries the minimum weight.',
  },
  {
    id: 'POSITION',
    weight: 2,
    rationale:
      'Acting last on every remaining street is worth a lot and is a fact this package knows exactly (query.heroInPosition), so it is weighted like a first-order input rather than a nudge.',
  },
  {
    id: 'INITIATIVE',
    weight: 2,
    rationale:
      'Who bet last street and who has bet this one. The previous-street aggressor has a range built to keep betting; a hand that just got raised has been told something.',
  },
  {
    id: 'BOARD_TEXTURE',
    weight: 1,
    rationale:
      "B1's STATIC/SEMI_DYNAMIC/DYNAMIC tendency, read as protection value. Low weight because texture already reaches the score indirectly through range and nut advantage; double-weighting it would double-count the board.",
  },
  {
    id: 'SPR_PRESSURE',
    weight: 1,
    rationale:
      'How committed the remaining stack is. Matters most at the extremes, which the band table reflects; a nudge in the middle.',
  },
  {
    id: 'MULTIWAY',
    weight: 2,
    rationale:
      'Every extra live opponent is another range that must fold or be beaten. Heavily weighted because it is the single most reliable way an authored model goes wrong, and it is reinforced by a multiplicative frequency scale on top (MULTIWAY_AGGRESSION_SCALE_BPS).',
  },
  {
    id: 'FACED_BET_SIZE',
    weight: 1,
    rationale:
      "The size of the last aggressive wager, as a fraction of the pot before it. Only non-zero when facing a bet, where it damps raising into a large bet. It reads villain's chosen size off villain's own action record rather than hero's call amount, which is a different number once hero has chips in on the street or someone has called in between.",
  },
  {
    id: 'POT_TYPE',
    weight: 1,
    rationale:
      'SRP / 3-bet / 4-bet pot. A bigger preflop pot means tighter, more polarized ranges and a lower SPR, so aggression is worth marginally more; the effect is small because SPR_PRESSURE already carries most of it.',
  },
  {
    id: 'STREET_ACTION',
    weight: 1,
    rationale:
      'How many opponents have checked to hero on this street. NOTE: this is an authored aggression nudge, NOT range narrowing — no range weight is changed anywhere by a postflop action (rule VILLAIN_RANGE_NOT_NARROWED). Minimum weight because it is the component least backed by anything.',
  },
];

// ===========================================================================
// 2. Continue component weights
// ===========================================================================

/**
 * Total weight 14. POT_ODDS_MARGIN carries 4 of it — by far the largest single share in either
 * model — because it is the ONLY input in this whole package traceable to a public source
 * (anchor 6 / S14). Calling is a price question first and a hand-reading question second.
 */
export const CONTINUE_WEIGHTS: readonly ComponentWeight<ContinueComponentId>[] = [
  {
    id: 'POT_ODDS_MARGIN',
    weight: 4,
    rationale:
      'Hero equity minus the equity the price demands. The heaviest weight anywhere in the model, because it rests on the one sourced relationship the anchor doc verified, and because a call that is not priced is not a call.',
  },
  {
    id: 'HAND_STRENGTH',
    weight: 2,
    rationale:
      "Made-hand class. Separate from the equity margin because equity against a range and 'can this hand beat a value bet' are different questions on the river.",
  },
  {
    id: 'DRAW_QUALITY',
    weight: 2,
    rationale:
      'A stand-in for implied odds: a draw with more to gain when it hits continues at a worse immediate price. Weighted equally with hand strength because on the flop it usually IS the reason to continue.',
  },
  {
    id: 'BLOCKER_QUALITY',
    weight: 1,
    rationale:
      "Blocking villain's value combos is the bluff-catcher's argument. As in the aggression model, it tilts a close call and never decides one.",
  },
  {
    id: 'RANGE_RANK',
    weight: 1,
    rationale:
      "Where the hand sits in hero's own range, so the model folds the bottom of a range before the middle rather than folding by absolute strength alone.",
  },
  {
    id: 'POSITION',
    weight: 1,
    rationale:
      'Continuing out of position is worth less. Lower weight than in the aggression model because the price, not the seat, dominates a calling decision.',
  },
  {
    id: 'MULTIWAY',
    weight: 2,
    rationale:
      'Continuing against several ranges needs more than continuing against one. Reinforced by MULTIWAY_CONTINUE_PENALTY_BPS on top of this component.',
  },
  {
    id: 'FACED_BET_SIZE',
    weight: 1,
    rationale:
      "A larger bet raises the price, which POT_ODDS_MARGIN already prices exactly. This component carries only the leftover: a large bet is more polarized, so villain's range is stronger than the price alone says.",
  },
];

// ===========================================================================
// 3. Component band tables
// ===========================================================================

/**
 * Made-hand class -> points. Ordered by the evaluator's own category ordering, with the
 * one-pair family split by WHICH pair, because "a pair" spans a value bet and a bluff-catch.
 *
 * `SET` outranks `STRAIGHT` and `TRIPS` here even though the evaluator ranks a straight
 * higher: a set on an unpaired board is far more disguised and has redraws, and the plain
 * strength ordering is already carried exactly by HERO_EQUITY. Deliberate, and the only place
 * this table departs from showdown order.
 */
export const HAND_STRENGTH_POINTS: Readonly<Record<MadeHandClass, number>> = {
  STRAIGHT_FLUSH: 100,
  QUADS: 100,
  FULL_HOUSE: 92,
  SET: 88,
  FLUSH: 82,
  STRAIGHT: 76,
  TRIPS: 70,
  TWO_PAIR: 60,
  OVERPAIR: 55,
  TOP_PAIR: 40,
  MIDDLE_PAIR: 5,
  UNDERPAIR: -5,
  BOTTOM_PAIR: -10,
  ACE_HIGH: -30,
  BOARD_PAIR: -35,
  NO_MADE_HAND: -45,
};

/** Adjustments applied to HAND_STRENGTH_POINTS, then the result is clamped to -100..100. */
export const HAND_STRENGTH_ADJUSTMENTS = {
  /** Hero holds the literal best hand available on this board (B1's `isNuts`). */
  NUTS_BONUS: 12,
  /**
   * A one-pair hand whose kicker class is WEAK. B1 defines that as three or more better
   * kickers still available, i.e. the pair is genuinely out-kicked most of the time it is
   * called.
   */
  WEAK_KICKER_PENALTY: -10,
  /** Hero's hand needs neither hole card (`playsTheBoard`): it cannot be ahead of anything. */
  PLAYS_THE_BOARD_PENALTY: -25,
} as const;

/**
 * Hero's showdown equity, **normalized against hero's fair share of the pot**, 0..1.
 *
 * The table is centred on 0.5 = "hero is exactly break-even against the field". Heads-up that
 * is raw equity, which is what this table originally banded. It is NOT raw equity multiway:
 * five ways, an even split is 0.20, so feeding pooled equity straight in scores every
 * multiway hand as if it were drawing dead. `normalizeHeroEquity` is the mapping that makes
 * 0.5 mean the same thing at every lineup size; `bandFor(HERO_EQUITY_BANDS, …)` must always be
 * given its output, never the raw pooled number.
 *
 * The RAW equity is still what the recommendation reports (`metrics.heroEquity`, the
 * `HERO_EQUITY` explanation feature and the score component's `rawValue`); the normalized
 * value is reported beside it as `HERO_EQUITY_NORMALIZED`. Nothing is replaced.
 */
export const HERO_EQUITY_BANDS: readonly ScoreBand[] = [
  { atLeast: 0.8, points: 80, label: 'CRUSHING' },
  { atLeast: 0.65, points: 55, label: 'STRONG' },
  { atLeast: 0.55, points: 30, label: 'AHEAD' },
  { atLeast: 0.45, points: 5, label: 'EVEN' },
  { atLeast: 0.35, points: -20, label: 'BEHIND' },
  { atLeast: 0.25, points: -45, label: 'WELL_BEHIND' },
  { atLeast: -Infinity, points: -70, label: 'CRUSHED' },
];

/**
 * Hero's break-even share of the pot against `activeOpponentCount` live opponents:
 * `1 / (1 + opponents)`. Heads-up it is 0.5; five ways it is 0.2.
 *
 * A postflop query always has at least one live opponent, so the count is floored at 1 rather
 * than allowed to produce a fair share of 1.0.
 */
export function fairShareEquity(activeOpponentCount: number): number {
  return 1 / (1 + Math.max(1, Math.floor(activeOpponentCount)));
}

/**
 * `HERO_EQUITY_BANDS`' input. Maps raw pooled equity onto the 0.5-centred scale the band table
 * is authored on, by PIECEWISE-LINEAR rescaling around the fair share `s = 1/(1+opponents)`:
 *
 *   equity <= s :  0.5 * equity / s              (0 -> 0.0, s -> 0.5)
 *   equity  > s :  0.5 + 0.5 * (equity - s)/(1 - s)   (s -> 0.5, 1 -> 1.0)
 *
 * Three properties, and they are the reason this shape was chosen over a bare `equity / s`
 * ratio:
 *
 *  1. **Heads-up is bit-identical to the old behaviour.** `s = 0.5` makes both branches the
 *     identity (every operation is a multiply or divide by a power of two, so it is exact in
 *     IEEE-754, not merely close). No heads-up recommendation moves.
 *  2. **It stays inside the table's domain.** The output is always in `[0, 1]`, so the band
 *     edges keep meaning what they say. A bare ratio would put a 5-way nut hand at 4.4 and
 *     saturate the top band for anything above fair share.
 *  3. **Both directions are graded.** Multiway, "slightly behind fair share" and "drawing
 *     nearly dead" have to land in different bands, which is precisely what the raw-equity
 *     version could not do.
 *
 * Deterministic and total: pure arithmetic on two numbers, no clock, no state.
 *
 * NOT applied to `RANGE_ADVANTAGE_BANDS` or `NUT_ADVANTAGE_BANDS`, and that is deliberate:
 * both are measured against the PRIMARY villain alone (`context.rangeAdvantage` is
 * `rangeVsRangeEquity(hero, primary) - 0.5`), so they are already pairwise and already centred.
 * `POT_ODDS_MARGIN_BANDS` and `ALL_IN_CALL_BANDS` are fed `heroEquity - requiredEquity`, where
 * the RAW pooled equity is the correct input by definition — hero must beat the whole field to
 * win the pot, and the price hero is being laid does not care how many opponents set it.
 */
export function normalizeHeroEquity(equity: number, activeOpponentCount: number): number {
  const fair = fairShareEquity(activeOpponentCount);
  if (equity <= fair) return (equity / fair) * 0.5;
  return 0.5 + ((equity - fair) / (1 - fair)) * 0.5;
}

/** `rangeVsRangeEquity(hero, primary villain).equity - 0.5`. */
export const RANGE_ADVANTAGE_BANDS: readonly ScoreBand[] = [
  { atLeast: 0.1, points: 45, label: 'LARGE_EDGE' },
  { atLeast: 0.06, points: 30, label: 'CLEAR_EDGE' },
  { atLeast: 0.02, points: 15, label: 'SLIGHT_EDGE' },
  { atLeast: -0.02, points: 0, label: 'LEVEL' },
  { atLeast: -0.06, points: -15, label: 'SLIGHT_DEFICIT' },
  { atLeast: -0.1, points: -30, label: 'CLEAR_DEFICIT' },
  { atLeast: -Infinity, points: -45, label: 'LARGE_DEFICIT' },
];

/** `nutShare(hero) - nutShare(primary villain)`; see NUT_SHARE_PERCENTILE. */
export const NUT_ADVANTAGE_BANDS: readonly ScoreBand[] = [
  { atLeast: 0.08, points: 45, label: 'LARGE_EDGE' },
  { atLeast: 0.04, points: 30, label: 'CLEAR_EDGE' },
  { atLeast: 0.01, points: 15, label: 'SLIGHT_EDGE' },
  { atLeast: -0.01, points: 0, label: 'LEVEL' },
  { atLeast: -0.04, points: -15, label: 'SLIGHT_DEFICIT' },
  { atLeast: -0.08, points: -30, label: 'CLEAR_DEFICIT' },
  { atLeast: -Infinity, points: -45, label: 'LARGE_DEFICIT' },
];

/**
 * `1 - equityQuantile(heroDistribution, hero's own equity)` — the weighted share of hero's
 * own range that hero's hand is at least as good as. 1.0 is the very top of the range.
 */
export const RANGE_RANK_BANDS: readonly ScoreBand[] = [
  { atLeast: 0.95, points: 50, label: 'TOP_5' },
  { atLeast: 0.85, points: 35, label: 'TOP_15' },
  { atLeast: 0.7, points: 18, label: 'TOP_30' },
  { atLeast: 0.5, points: 0, label: 'UPPER_HALF' },
  { atLeast: 0.3, points: -18, label: 'LOWER_HALF' },
  { atLeast: 0.15, points: -32, label: 'BOTTOM_30' },
  { atLeast: -Infinity, points: -45, label: 'BOTTOM_15' },
];

/**
 * Draw quality is ADDITIVE across the four sources below and then capped, because a hand can
 * genuinely hold two draws at once and a max-of would throw the second one away. Every value
 * is non-negative: a draw is never a reason to be less aggressive.
 */
export const DRAW_QUALITY = {
  FLUSH_DRAW_BY_NUT_CLASS: {
    NUT: 45,
    SECOND_NUT: 36,
    THIRD_NUT: 30,
    WEAK: 24,
  } as Readonly<Record<FlushNutClass, number>>,
  STRAIGHT_DRAW_BY_KIND: {
    OESD: 32,
    DOUBLE_GUTSHOT: 26,
    GUTSHOT: 12,
  } as Readonly<Record<StraightDrawKind, number>>,
  BACKDOOR_FLUSH_DRAW: 8,
  BACKDOOR_STRAIGHT_DRAW: 5,
  /** Only counted when hero has no made hand better than ace-high — otherwise it double-counts. */
  OVERCARD_EACH: 3,
  /** Ceiling on the sum. A hand holding every draw at once is not four times as aggressive. */
  CAP: 70,
} as const;

/**
 * Blocker points, summed over the blockers B1 reports, then capped. Flush and straight
 * blockers outrank pair blockers because they remove villain's strongest continues.
 */
export const BLOCKER_POINTS: Readonly<Record<HeroBlocker, number>> = {
  NUT_FLUSH_BLOCKER: 18,
  SECOND_NUT_FLUSH_BLOCKER: 10,
  NUT_FLUSH_DRAW_BLOCKER: 8,
  FLUSH_DRAW_BLOCKER: 4,
  NUT_STRAIGHT_BLOCKER: 12,
  STRAIGHT_BLOCKER: 5,
  TOP_PAIR_BLOCKER: 8,
  BOARD_PAIR_BLOCKER: 6,
};

/** Ceiling on the blocker sum. */
export const BLOCKER_CAP = 30;

/** Acting last on every remaining street. */
export const POSITION_POINTS = {
  AGGRESSION_IN_POSITION: 20,
  AGGRESSION_OUT_OF_POSITION: -12,
  CONTINUE_IN_POSITION: 15,
  CONTINUE_OUT_OF_POSITION: -5,
} as const;

/**
 * Initiative is the SUM of a previous-street term and a current-street term, clamped to
 * -100..100. Two terms rather than one because "I bet the flop" and "my flop bet just got
 * raised" are different facts that can both be true.
 */
export const INITIATIVE_POINTS = {
  /** Hero made the last aggressive action on the previous street. */
  HERO_HAD_INITIATIVE: 25,
  /** An opponent did. */
  OPPONENT_HAD_INITIATIVE: -12,
  /** Nobody bet the previous street, or this is the flop of a limped pot. */
  NOBODY_HAD_INITIATIVE: 0,
  /** Hero already bet or raised this street and is now facing a raise. */
  HERO_AGGRESSION_RAISED: -10,
  /** An opponent has bet or raised this street. */
  OPPONENT_AGGRESSED_THIS_STREET: -8,
} as const;

/**
 * Board texture, read as PROTECTION value rather than as raw texture. The tendency alone says
 * nothing about whether hero wants to bet: a dynamic board is a reason to bet a made hand and
 * a reason NOT to bet air, so each tendency has two entries.
 */
export const BOARD_TEXTURE_POINTS = {
  STATIC_WITH_RANGE_EDGE: 10,
  STATIC_WITHOUT_RANGE_EDGE: -5,
  SEMI_DYNAMIC: 0,
  /** Hero holds a made hand worth protecting, or a draw good enough to semi-bluff. */
  DYNAMIC_WITH_EQUITY: 15,
  DYNAMIC_WITHOUT_EQUITY: -12,
  /** `RANGE_ADVANTAGE` at or above this counts as an edge for the STATIC branch. */
  STATIC_RANGE_EDGE_THRESHOLD: 0.02,
  /** `DRAW_QUALITY` points at or above this counts as semi-bluff equity on a DYNAMIC board. */
  DYNAMIC_DRAW_THRESHOLD: 26,
} as const;

/** `effectiveStackRemaining / potTotal`, from the query. Lower means more committed. */
export const SPR_PRESSURE_BANDS: readonly ScoreBand[] = [
  { atLeast: 12, points: -15, label: 'VERY_DEEP' },
  { atLeast: 7, points: -8, label: 'DEEP' },
  { atLeast: 4, points: 0, label: 'MEDIUM' },
  { atLeast: 2, points: 5, label: 'SHALLOW' },
  { atLeast: 1, points: 15, label: 'NEAR_COMMITTED' },
  { atLeast: -Infinity, points: 25, label: 'COMMITTED' },
];

/**
 * The SPR both models score when the query reports none (`StrategyQuery.spr` is null only on a
 * zero pot, which cannot happen postflop — so this is a total-function default, not a live
 * path). It is NOT an authored magnitude: it is READ OFF the table above as the `MEDIUM` band's
 * own lower edge, so "no SPR" scores in the neutral band by construction and moving that edge
 * moves the default with it. `score.ts` used to spell the number `4` inline, twice and
 * undocumented (R1B MINOR-8).
 */
export const UNKNOWN_SPR: number = (() => {
  const medium = SPR_PRESSURE_BANDS.find((band) => band.label === 'MEDIUM');
  if (medium === undefined) throw new Error('SPR_PRESSURE_BANDS lost its MEDIUM band');
  return medium.atLeast;
})();

/**
 * How many opponents must have CHECKED to hero for `STREET_ACTION_POINTS` to read the board as
 * given up on. The POINTS were always in this file; these thresholds that select them were
 * spelled inline in `score.ts` (R1B MINOR-8).
 */
export const STREET_CHECK_THRESHOLDS = {
  /** At or above this many checks: `TWO_OR_MORE_CHECKS`. */
  TWO_OR_MORE: 2,
  /** Exactly this many: `ONE_CHECK`. Below it: `NO_CHECKS`. */
  ONE: 1,
} as const;

/** Live opponents other than hero. Indexed by count; index 0 is unreachable (hand is over). */
export const MULTIWAY_AGGRESSION_POINTS: readonly number[] = [0, 0, -25, -45, -55, -65];
export const MULTIWAY_CONTINUE_POINTS: readonly number[] = [0, 0, -20, -35, -45, -50];

/**
 * `lastAggression.amountMbb / lastAggression.potBeforeMbb` — the LAST AGGRESSIVE WAGER as a
 * fraction of the pot immediately before it went in (`PostflopSpot.facedBetFractionOfPot`).
 * It is the size villain chose, not hero's price: a raise over hero's own bet, or a bet that
 * has since been called, both make hero's call amount a different quantity from the wager.
 */
export const FACED_BET_SIZE_BANDS: readonly ScoreBand[] = [
  { atLeast: 1.1, points: -40, label: 'OVERBET' },
  { atLeast: 0.85, points: -25, label: 'LARGE' },
  { atLeast: 0.6, points: -12, label: 'MEDIUM' },
  { atLeast: 0.35, points: 0, label: 'SMALL' },
  { atLeast: -Infinity, points: 10, label: 'TINY' },
];

export type PostflopPotType = 'LIMPED' | 'SINGLE_RAISED' | 'THREE_BET' | 'FOUR_BET_PLUS';

export const POT_TYPE_POINTS: Readonly<Record<PostflopPotType, number>> = {
  LIMPED: -8,
  SINGLE_RAISED: 0,
  THREE_BET: 12,
  FOUR_BET_PLUS: 20,
};

/** Opponents who have CHECKED to hero on this street, when hero is not facing a bet. */
export const STREET_ACTION_POINTS = {
  NO_CHECKS: 0,
  ONE_CHECK: 12,
  TWO_OR_MORE_CHECKS: 20,
} as const;

/** `heroEquity - requiredEquity`, where required equity is `call / (pot + call)`. */
export const POT_ODDS_MARGIN_BANDS: readonly ScoreBand[] = [
  { atLeast: 0.2, points: 90, label: 'HUGE_OVERLAY' },
  { atLeast: 0.1, points: 65, label: 'CLEAR_OVERLAY' },
  { atLeast: 0.04, points: 38, label: 'OVERLAY' },
  { atLeast: 0.0, points: 12, label: 'BREAK_EVEN' },
  { atLeast: -0.04, points: -25, label: 'SHORT' },
  { atLeast: -0.1, points: -60, label: 'CLEARLY_SHORT' },
  { atLeast: -Infinity, points: -100, label: 'HOPELESS' },
];

// ===========================================================================
// 4. Score -> frequency
// ===========================================================================

export const AGGRESSION_BAND_IDS = [
  'DOMINANT',
  'STRONG',
  'MODERATE',
  'NEUTRAL',
  'WEAK',
  'POOR',
  'GIVE_UP',
] as const;
export type AggressionBandId = (typeof AGGRESSION_BAND_IDS)[number];

export interface AggressionBand {
  readonly id: AggressionBandId;
  readonly atLeast: number;
  /** How often hero bets or raises, in basis points. Always a multiple of 500. */
  readonly aggressionBps: number;
  readonly rationale: string;
}

/**
 * The aggression score -> bet/raise frequency table. First row whose `atLeast` is reached wins.
 *
 * The top is 9500, never 10000: a policy with no solver behind it does not get to claim a
 * pure strategy, and even the nuts benefits from an occasional check. The bottom is 0: the
 * model gives up rather than manufacturing a bluff it cannot justify, which is what stops
 * river air from being shown a pure jam.
 */
export const AGGRESSION_BANDS: readonly AggressionBand[] = [
  {
    id: 'DOMINANT',
    atLeast: 28,
    aggressionBps: 9500,
    rationale:
      'Hero is ahead on essentially every axis at once — hand, equity, range and nuts. Near-pure aggression; the residual 500 is the honest admission that a reference model is not a solve.',
  },
  {
    id: 'STRONG',
    atLeast: 16,
    aggressionBps: 8000,
    rationale:
      'A clear edge on most axes. Bets four times in five, which is roughly where a strong value hand with an unmixed alternative belongs.',
  },
  {
    id: 'MODERATE',
    atLeast: 5,
    aggressionBps: 6500,
    rationale:
      'A real but not decisive edge: thin value, or a good semi-bluff. Bets about two thirds.',
  },
  {
    id: 'NEUTRAL',
    atLeast: -6,
    aggressionBps: 5000,
    rationale:
      'The axes disagree or cancel. An even mix is the honest answer to a genuinely balanced spot, and the primary-action tie-break then shows the LESS committing action.',
  },
  {
    id: 'WEAK',
    atLeast: -20,
    aggressionBps: 3000,
    rationale:
      'Behind on most axes but with something (a draw, a blocker, position). Bets as a minority bluffing frequency.',
  },
  {
    id: 'POOR',
    atLeast: -38,
    aggressionBps: 1500,
    rationale:
      'Behind nearly everywhere. A small residual frequency keeps the betting range from being purely strong, which is a real property and not a solved one.',
  },
  {
    id: 'GIVE_UP',
    atLeast: -Infinity,
    aggressionBps: 0,
    rationale:
      'Nothing supports aggression. The model declines to invent a bluff — a zero here is a statement that this hand has no documented reason to bet, not a claim that betting is provably wrong.',
  },
];

export interface ContinueBand {
  readonly id: string;
  readonly atLeast: number;
  readonly continueBps: number;
  readonly rationale: string;
}

/**
 * The continue score -> call-or-raise frequency table, used only when hero faces a bet.
 * 10000 IS reachable here (unlike aggression): a hand that beats the price by a wide margin
 * should never be shown a fold frequency at all.
 */
export const CONTINUE_BANDS: readonly ContinueBand[] = [
  {
    id: 'ALWAYS',
    atLeast: 30,
    continueBps: 10000,
    rationale: 'Priced in with room to spare and strong on the other axes too. Never folds.',
  },
  {
    id: 'STRONG',
    atLeast: 16,
    continueBps: 9000,
    rationale:
      "Clearly priced in. The 1000 fold is the model's own error bar, not a strategic fold.",
  },
  {
    id: 'GOOD',
    atLeast: 4,
    continueBps: 7500,
    rationale: 'Priced in on balance. Continues three times in four.',
  },
  {
    id: 'MARGINAL',
    atLeast: -10,
    continueBps: 5500,
    rationale:
      'Genuinely close. A mix is the honest answer; it also keeps the continuing range from being readable.',
  },
  {
    id: 'THIN',
    atLeast: -25,
    continueBps: 3500,
    rationale: 'Short of the price on most axes but not hopeless — a minority defend.',
  },
  {
    id: 'POOR',
    atLeast: -45,
    continueBps: 1500,
    rationale:
      'Clearly short of the price. A small defending frequency, mostly the blocker-heavy part of the class.',
  },
  {
    id: 'GIVE_UP',
    atLeast: -Infinity,
    continueBps: 0,
    rationale: 'Not priced in on any axis. Folds.',
  },
];

export interface RaiseShareBand {
  readonly id: string;
  readonly atLeast: number;
  /** Share OF THE CONTINUE MASS that raises, in basis points. */
  readonly raiseShareBps: number;
  readonly rationale: string;
}

/**
 * Once the continue mass is fixed, the AGGRESSION score decides how much of it raises rather
 * than calls. Splitting the decision in two is deliberate: a hand can be clearly priced in
 * (high continue score) and still be a poor raising candidate (low aggression score), and a
 * one-step model would force it to choose between folding and raising.
 */
export const RAISE_SHARE_BANDS: readonly RaiseShareBand[] = [
  {
    id: 'MOSTLY_RAISE',
    atLeast: 45,
    raiseShareBps: 8000,
    rationale:
      'A dominant hand facing a bet raises most of the time; the flatting share protects the calling range.',
  },
  {
    id: 'MIXED',
    atLeast: 25,
    raiseShareBps: 5000,
    rationale: 'Strong enough to raise half the time.',
  },
  {
    id: 'SOME_RAISE',
    atLeast: 10,
    raiseShareBps: 2500,
    rationale: 'A quarter of the continues raise — thin value and the better semi-bluffs.',
  },
  {
    id: 'RARE_RAISE',
    atLeast: -5,
    raiseShareBps: 1000,
    rationale: 'A small raising frequency keeps a calling range from being capped.',
  },
  {
    id: 'MINIMAL_RAISE',
    atLeast: -20,
    raiseShareBps: 500,
    rationale: 'The minimum representable non-zero frequency on the 5-point grid.',
  },
  {
    id: 'NEVER_RAISE',
    atLeast: -Infinity,
    raiseShareBps: 0,
    rationale: 'Nothing here justifies putting more money in. Call or fold.',
  },
];

// ===========================================================================
// 5. Multiway adjustments (on top of the components)
// ===========================================================================

/**
 * A multiplicative SCALE on the aggression frequency, indexed by live opponent count and
 * applied after the band lookup:
 *
 *     final = floorToGrid( bandFrequency * scale / 10000 )
 *
 * It exists in addition to the MULTIWAY score component, and it is a SCALE rather than a
 * ceiling for a specific reason: a ceiling only bites when a spot happens to be above it, so
 * "we bet less multiway" would be an accident of where a score landed inside its band. A scale
 * makes the reduction unconditional — every non-zero aggression frequency is strictly lower
 * three-handed than heads-up, and a test asserts exactly that on the same spot.
 *
 * The grid rounding is DOWNWARD (`floor`), because reducing aggression is the entire purpose
 * of the adjustment and rounding back up would sometimes undo it. The one fixed point is a
 * 500 bps frequency at the smallest scale, which floors to 0 — the minimum representable
 * frequency has nowhere to go but off.
 */
export const MULTIWAY_AGGRESSION_SCALE_BPS: readonly number[] = [
  10000, 10000, 7500, 5500, 4500, 3500,
];

/**
 * A flat penalty subtracted from the continue frequency, indexed by live opponent count, then
 * floored at zero. The continuing threshold tightens structurally with each extra range that
 * has to be beaten.
 *
 * It is a REDUCTION, never a cap, and where the band already continues at least as often as the
 * PRICE says it is bounded below by that price-implied frequency (see
 * `priceImpliedContinueBps`; the arithmetic is `score.ts` `penalizedContinueBps`). Without that
 * bound the subtraction reached `CONTINUE_BANDS.ALWAYS`, whose own contract is "never folds",
 * and produced a fold frequency for hands that cannot lose — three-handed quads were shown
 * FOLD 1000. No number of extra opponents makes a hand that wins every runout a fold, so the
 * penalty stops where the price takes over. Below the price line — the hand is short of the
 * price, or the model's non-price axes say fold — it applies in full, so multiway stays
 * strictly tighter than heads-up wherever the price has not already settled the decision.
 */
export const MULTIWAY_CONTINUE_PENALTY_BPS: readonly number[] = [0, 0, 1000, 2000, 2500, 3000];

// ===========================================================================
// 6. Facing an all-in
// ===========================================================================

/**
 * Facing an all-in there is nothing to raise into, so the decision is call or fold on price.
 * `equityMargin = heroEquity - requiredEquity`.
 *
 * The bands are GRADED rather than a single threshold on purpose. A binary "call iff equity >
 * price" would claim the range model is accurate to the basis point; B2 §4 measures multiway
 * flop equity at roughly plus or minus two points, and the ranges themselves are authored.
 * The middle band is the width of that uncertainty.
 */
/**
 * Half-width of the break-even band below: the tolerance that absorbs range-model and
 * subsampling error, documented so `rules.ts` and the UI can state it.
 *
 * Declared BEFORE the table because every edge in that table is a whole multiple of it, and
 * this is now the ONLY place the number is written. It used to be declared here, named by
 * `FACING_ALL_IN_POT_ODDS` as an input, read by nothing, and written out a second time inside
 * the band table — two copies of one number, free to drift (R1B MINOR-11). The multipliers
 * (+4, +1, -1, -3) are the authored part and stay visible as multipliers.
 */
export const ALL_IN_CALL_MARGIN = 0.02;

export const ALL_IN_CALL_BANDS: readonly ScoreBand[] = [
  { atLeast: 4 * ALL_IN_CALL_MARGIN, points: 10000, label: 'CLEAR_CALL' },
  { atLeast: ALL_IN_CALL_MARGIN, points: 8500, label: 'CALL' },
  { atLeast: -ALL_IN_CALL_MARGIN, points: 5000, label: 'BREAK_EVEN' },
  { atLeast: -3 * ALL_IN_CALL_MARGIN, points: 1500, label: 'THIN' },
  { atLeast: -Infinity, points: 0, label: 'FOLD' },
];

/**
 * Total. The continuing frequency the PRICE alone justifies at an equity margin, in bps.
 *
 * This is `ALL_IN_CALL_BANDS` read for a second purpose, deliberately and with no second table:
 * that table already states, for a given `heroEquity - requiredEquity`, how often a decision
 * that is purely about price continues. Facing an all-in it IS the answer; facing an ordinary
 * bet it is the FLOOR under the multiway continue penalty for a band that already continues at
 * least that often, so a reduction that is about extra ranges can never argue a hand out of a
 * call the price has already settled. Reusing the table keeps the floor a thing the model can
 * see (an equity margin), not a fresh authored constant.
 *
 * `null` (no price — hero is not facing a bet) means no floor.
 */
export function priceImpliedContinueBps(potOddsMargin: number | null): number {
  if (potOddsMargin === null) return 0;
  return bandFor(ALL_IN_CALL_BANDS, potOddsMargin).points;
}

// ===========================================================================
// 7. Sizing
// ===========================================================================

export interface PotFractionBucket {
  /** e.g. 67 for two thirds of the pot. Presentation only. */
  readonly percent: number;
  /** The exact rational used for the milliBB arithmetic. No float ever enters a money path. */
  readonly numerator: number;
  readonly denominator: number;
}

/**
 * The ONLY sizes this policy can recommend, smallest first, plus ALL_IN as a separate top
 * rung handled by `ALL_IN_GATE`. A recommendation is always one of these, so a pseudo-precise
 * 47.83%-pot size is unrepresentable — the sizing analogue of the 5-point frequency grid.
 */
export const POT_FRACTION_BUCKETS: readonly PotFractionBucket[] = [
  { percent: 25, numerator: 1, denominator: 4 },
  { percent: 33, numerator: 1, denominator: 3 },
  { percent: 50, numerator: 1, denominator: 2 },
  { percent: 67, numerator: 2, denominator: 3 },
  { percent: 75, numerator: 3, denominator: 4 },
  { percent: 100, numerator: 1, denominator: 1 },
  { percent: 125, numerator: 5, denominator: 4 },
  { percent: 150, numerator: 3, denominator: 2 },
];

/** The starting rung, by aggression band. Index into `POT_FRACTION_BUCKETS`. */
/**
 * The starting rung, by aggression band. **Deliberately NOT monotone in the band**, and that
 * is the whole point.
 *
 * A betting range is polarized: the hands that bet are the strong ones and the ones with
 * nothing, and they must bet the SAME size or the size itself tells villain which is which. So
 * the two bluffing bands (WEAK, POOR) borrow the STRONG band's rung rather than sizing down,
 * while the middling bands (MODERATE, NEUTRAL) — thin value that wants a cheap call — size
 * DOWN. A monotone table would make every size a readable strength announcement.
 */
export const SIZING_BASE_INDEX_BY_BAND: Readonly<Record<AggressionBandId, number>> = {
  DOMINANT: 5, // 100% pot
  STRONG: 4, // 75%
  MODERATE: 3, // 67% — thin value wants to be called
  NEUTRAL: 3, // 67%
  WEAK: 4, // 75% — a bluff is sized like the value hands it represents
  POOR: 4, // 75%
  GIVE_UP: 4, // 75% (unreachable in practice: this band bets at 0 frequency)
};

/**
 * Every sizing modifier, as rung offsets. They are SUMMED and the result is clamped into the
 * bucket array, so no combination can leave the ladder.
 */
export const SIZING_MODIFIERS = {
  BY_TENDENCY: { STATIC: -1, SEMI_DYNAMIC: 0, DYNAMIC: 1 } as Readonly<
    Record<BoardTendency, number>
  >,
  /** Nut advantage at or beyond this margin moves a rung, in the direction of the advantage. */
  NUT_ADVANTAGE_MARGIN: 0.05,
  NUT_ADVANTAGE_STEP: 1,
  /**
   * Range advantage at or beyond this margin moves a rung DOWN, but only on a STATIC board.
   * The "small and frequent" shape is texture-conditional: the same edge on a dynamic board
   * does not want the small size, which is why this is a separate entry from BY_TENDENCY.
   */
  RANGE_ADVANTAGE_MARGIN: 0.06,
  RANGE_ADVANTAGE_STATIC_STEP: -1,
  /** SPR below LOW_SPR moves up a rung; above HIGH_SPR, down one. */
  LOW_SPR: 2,
  HIGH_SPR: 6,
  SPR_STEP: 1,
  /** Three or more live opponents: one rung down. Two: unchanged (frequency carries it). */
  MULTIWAY_OPPONENT_THRESHOLD: 3,
  MULTIWAY_STEP: -1,
  /** The river has no card to come and the most polarized ranges. */
  RIVER_STEP: 1,
  /** A raise is measured against a pot that already contains villain's bet. */
  RAISE_STEP: 1,
} as const;

/**
 * ALL_IN is selectable as a size only when BOTH hold. Above the SPR gate a shove is a size no
 * pot fraction would ever produce, so offering it would be inventing a line rather than
 * choosing one. (A clamp of an ordinary bucket to the engine maximum can still land on the
 * whole stack; that path is recorded as a CLAMP, never as a chosen shove.)
 */
export const ALL_IN_GATE = {
  /** `effectiveStackRemaining / potTotal` at or below this. */
  MAX_SPR: 1.5,
  /** The aggression band must be this one or better (earlier in AGGRESSION_BAND_IDS). */
  MIN_BAND: 'STRONG' as AggressionBandId,
} as const;

// ===========================================================================
// 8. Nut-share measurement
// ===========================================================================

/**
 * How `nutShare(range)` is defined, exactly.
 *
 *   1. Build the made-hand strength distribution of the UNIFORM 1326-combo range on this
 *      board (B2's `buildStrengthDistribution`, ~1.3 ms). This is the board's own reference
 *      distribution and depends on nothing but the board.
 *   2. Read off the strength at its `NUT_SHARE_PERCENTILE` from the top. That single packed
 *      strength value is the board's NUT CUTOFF — an ABSOLUTE threshold, not a per-range one.
 *   3. `nutShare(R)` = the weight of R at or above the cutoff, divided by R's total weight.
 *
 * Step 2 is what makes the two shares comparable: if each range used its OWN top 5%, every
 * range would have a nut share of 5% by construction and the difference would always be zero.
 * Made-hand strength is used rather than equity because it costs ~1.3 ms per range against
 * ~65 ms for an equity distribution, and on a river (where nut advantage matters most) the
 * two are the same thing.
 */
export const NUT_SHARE_PERCENTILE = 0.05;

/** The same construction at a looser cutoff, reported for the explanation but not scored. */
export const STRONG_SHARE_PERCENTILE = 0.2;

// ===========================================================================
// 9. Confidence
// ===========================================================================

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/**
 * Confidence is a COUNT of documented degradations, not a second opinion: provenance is
 * always HEURISTIC postflop — every registry rule is authored (see `rules.ts`), so it cannot carry gradation, and
 * this field does instead. 0 -> HIGH, 1 -> MEDIUM, 2 or more -> LOW.
 *
 * Exactly four things count, and each is one degradation:
 *
 *  - `MULTIWAY` — two or more live opponents. B2 note 8: the equity engine models no
 *    correlation between villain ranges.
 *  - `HERO_EQUITY_SUBSAMPLED` — HERO's own equity number was estimated rather than
 *    enumerated. The RANGE equity being subsampled deliberately does NOT count: it is a
 *    range-level aggregate feeding two components with combined weight 4 of 26, and on a flop
 *    it is subsampled essentially always, so counting it would pin every flop answer to LOW
 *    and make the field carry no information. It is still reported in `metrics`, in the
 *    `EQUITY_METHOD` explanation feature, and as the `EQUITY_SUBSAMPLED` rule id.
 *  - `OFF_POLICY_RANGE` — some seat took a preflop line the reference policy never takes, so
 *    its range is uninformative rather than narrow (A3's rule).
 *  - `UNNARROWED_AGGRESSION` — a postflop BET or RAISE happened before hero's decision and
 *    was not conditioned on. Only AGGRESSION counts, not a check: a check is the least
 *    informative action in poker and every range this model builds already contains the hands
 *    that would check, whereas a bet genuinely narrows a range this policy is choosing not to
 *    narrow. That the narrowing was skipped at all is reported unconditionally through the
 *    `VILLAIN_RANGE_NARROWING` feature.
 */
export const CONFIDENCE_THRESHOLDS = { MEDIUM_AT: 1, LOW_AT: 2 } as const;

// ===========================================================================
// 10. Model self-checks, run at module load
// ===========================================================================

/**
 * The structural guarantee behind "no single-feature advice": no component may carry more
 * than this share of the total weight of its model.
 */
export const MAX_SINGLE_COMPONENT_WEIGHT_SHARE = 0.3;

function totalWeight<Id extends string>(weights: readonly ComponentWeight<Id>[]): number {
  return weights.reduce((sum, entry) => sum + entry.weight, 0);
}

export const AGGRESSION_TOTAL_WEIGHT = totalWeight(AGGRESSION_WEIGHTS);
export const CONTINUE_TOTAL_WEIGHT = totalWeight(CONTINUE_WEIGHTS);

function assertModel(): void {
  const checks: readonly (readonly [string, readonly ComponentWeight<string>[], number])[] = [
    ['aggression', AGGRESSION_WEIGHTS, AGGRESSION_TOTAL_WEIGHT],
    ['continue', CONTINUE_WEIGHTS, CONTINUE_TOTAL_WEIGHT],
  ];
  for (const [name, weights, total] of checks) {
    if (total <= 0) throw new Error(`${name} model has no weight`);
    const seen = new Set<string>();
    for (const entry of weights) {
      if (seen.has(entry.id)) throw new Error(`${name} model lists ${entry.id} twice`);
      seen.add(entry.id);
      if (!Number.isInteger(entry.weight) || entry.weight <= 0) {
        throw new Error(`${name} weight for ${entry.id} must be a positive integer`);
      }
      if (entry.weight / total > MAX_SINGLE_COMPONENT_WEIGHT_SHARE) {
        throw new Error(
          `${name} component ${entry.id} carries ${entry.weight}/${total} of the model, above the ${MAX_SINGLE_COMPONENT_WEIGHT_SHARE} ceiling`,
        );
      }
      if (entry.rationale.length === 0) throw new Error(`${name} ${entry.id} has no rationale`);
    }
  }
  const descending = (values: readonly { readonly atLeast: number }[], name: string): void => {
    for (let i = 1; i < values.length; i += 1) {
      const previous = values[i - 1];
      const current = values[i];
      if (previous === undefined || current === undefined) continue;
      if (!(current.atLeast < previous.atLeast)) {
        throw new Error(`${name} bands are not strictly descending at index ${i}`);
      }
    }
    const last = values[values.length - 1];
    if (last === undefined || last.atLeast !== -Infinity) {
      throw new Error(`${name} bands must end at -Infinity so the table is total`);
    }
  };
  descending(HERO_EQUITY_BANDS, 'HERO_EQUITY');
  descending(RANGE_ADVANTAGE_BANDS, 'RANGE_ADVANTAGE');
  descending(NUT_ADVANTAGE_BANDS, 'NUT_ADVANTAGE');
  descending(RANGE_RANK_BANDS, 'RANGE_RANK');
  descending(SPR_PRESSURE_BANDS, 'SPR_PRESSURE');
  descending(FACED_BET_SIZE_BANDS, 'FACED_BET_SIZE');
  descending(POT_ODDS_MARGIN_BANDS, 'POT_ODDS_MARGIN');
  descending(ALL_IN_CALL_BANDS, 'ALL_IN_CALL');
  descending(AGGRESSION_BANDS, 'AGGRESSION');
  descending(CONTINUE_BANDS, 'CONTINUE');
  descending(RAISE_SHARE_BANDS, 'RAISE_SHARE');

  const grid = (value: number, what: string): void => {
    if (!Number.isInteger(value) || value < 0 || value > 10000 || value % 500 !== 0) {
      throw new Error(`${what} (${value}) is not a multiple of 500 in 0..10000`);
    }
  };
  for (const band of AGGRESSION_BANDS) grid(band.aggressionBps, `AGGRESSION_BANDS.${band.id}`);
  for (const band of CONTINUE_BANDS) grid(band.continueBps, `CONTINUE_BANDS.${band.id}`);
  for (const band of RAISE_SHARE_BANDS) grid(band.raiseShareBps, `RAISE_SHARE_BANDS.${band.id}`);
  for (const band of ALL_IN_CALL_BANDS) grid(band.points, `ALL_IN_CALL_BANDS.${band.label}`);
  for (const value of MULTIWAY_AGGRESSION_SCALE_BPS) grid(value, 'MULTIWAY_AGGRESSION_SCALE_BPS');
  for (const value of MULTIWAY_CONTINUE_PENALTY_BPS) grid(value, 'MULTIWAY_CONTINUE_PENALTY_BPS');

  const first = AGGRESSION_BANDS[0];
  if (first === undefined || first.aggressionBps >= 10000) {
    throw new Error(
      'the top aggression band must be below 10000: a REFERENCE policy is never pure',
    );
  }
  const last = AGGRESSION_BANDS[AGGRESSION_BANDS.length - 1];
  if (last === undefined || last.aggressionBps !== 0) {
    throw new Error(
      'the bottom aggression band must be 0: the model gives up rather than inventing a bluff',
    );
  }
  for (const index of Object.values(SIZING_BASE_INDEX_BY_BAND)) {
    if (!Number.isInteger(index) || index < 0 || index >= POT_FRACTION_BUCKETS.length) {
      throw new Error(`SIZING_BASE_INDEX_BY_BAND holds ${index}, outside the bucket ladder`);
    }
  }
}

assertModel();
