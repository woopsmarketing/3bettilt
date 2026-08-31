/**
 * The vocabulary of the equity engine: what an equity answer contains, how the work was
 * bounded, and what the defaults are.
 *
 * ## Units
 *
 * Every probability and equity here is a plain `number` in `0..1`. That is deliberate and
 * allowed: CLAUDE.md rule 1 confines integer milliBB to MONEY, and an equity share is a
 * ratio, not money. Nothing in this directory ever touches a pot, a wager or a settlement —
 * `poker-core`'s settlement is the only thing that divides a real pot, and it is untouched.
 *
 * Range WEIGHTS remain integer basis points throughout; they are only turned into a float
 * at the very last division, when a weighted sum becomes a share.
 *
 * ## Tie semantics (heads-up and multiway, one rule)
 *
 * At showdown the players holding the maximum hand strength split the pot equally, so hero's
 * share of a showdown is
 *
 *     0                         if any villain's strength is greater than hero's
 *     1 / (1 + tiedVillains)    otherwise
 *
 * which collapses to the familiar `1` for a clean win and `0.5` for a heads-up chop.
 * `winProb` is the probability of a CLEAN win (hero strictly best), `tieProb` the
 * probability hero shares the best hand with at least one villain, and `loseProb` the rest.
 * The three sum to 1. `equity` is the expected SHARE and is therefore strictly between
 * `winProb` and `winProb + tieProb` whenever `tieProb > 0`.
 */

export const EQUITY_METHODS = ['EXACT', 'SUBSAMPLED'] as const;

/**
 * `EXACT` — every villain assignment and every runout was enumerated; the number is the
 * true equity for these inputs and is reproducible by hand.
 * `SUBSAMPLED` — the work was bounded by the deterministic Weyl scheme in `sampling.ts`.
 * Still perfectly reproducible, but an ESTIMATE. The UI must not present the two the same
 * way.
 */
export type EquityMethod = (typeof EQUITY_METHODS)[number];

export interface EquityResult {
  /** P(hero holds the single best hand). */
  readonly winProb: number;
  /** P(hero shares the best hand with one or more villains). */
  readonly tieProb: number;
  /** P(some villain holds a better hand). */
  readonly loseProb: number;
  /** Hero's expected share of the showdown, ties split. `winProb + E[share | tie]`. */
  readonly equity: number;
  /** `EXACT` only when nothing anywhere was sampled. */
  readonly method: EquityMethod;
  /** Runouts actually walked. `1` on the river (the empty runout is a runout). */
  readonly evaluatedRunouts: number;
  /** How many runouts exist for this board. `evaluatedRunouts === runoutSpaceSize` iff exhaustive. */
  readonly runoutSpaceSize: number;
  /** `(assignment, runout)` pairs that were actually scored — the real cost of the answer. */
  readonly evaluatedTrials: number;
  /** Villain combinations in the sample, after mutual card-removal filtering. */
  readonly assignmentCount: number;
  /** The size of the villain cross-product before sampling and before conflict filtering. */
  readonly assignmentSpaceSize: number;
  /** How many villain ranges were supplied. `1` is heads-up. */
  readonly villainCount: number;
  /**
   * Sum of the weights actually scored, in `bps^villainCount` units — the denominator every
   * probability above was divided by. Exposed so a caller can tell "0.5 from two combos"
   * apart from "0.5 from four hundred".
   */
  readonly scoredWeight: number;
}

/**
 * How much work an equity call is allowed to do. All three are hard ceilings on enumeration
 * size, never on wall-clock time, so a slow machine returns the SAME answer as a fast one,
 * just later. That is the whole point of not using a time budget.
 */
export interface EquityBudget {
  /**
   * Ceiling on `assignments * runouts`. The default admits the full heads-up flop
   * enumeration (1081 villain combos x 1081 runouts ~ 1.17M) so heads-up postflop equity is
   * EXACT on every street without the caller asking.
   */
  readonly maxTrials: number;
  /**
   * Ceiling on the number of villain combinations carried. Heads-up can never reach it
   * (1326 < 20000), so it only ever bites multiway, where the cross-product explodes.
   */
  readonly maxAssignments: number;
  /**
   * A floor, not a ceiling: once `maxTrials / assignments` drops below this, the engine
   * spends more than its trial budget rather than estimating a flop from four runouts.
   *
   * The default is 192 because the measured error of runout subsampling on a flop is the
   * dominant error term (~2.5% RMS at 64 runouts, ~1.5% at 128, ~0.8% at 256) while the
   * error from ASSIGNMENT subsampling is an order of magnitude smaller — so when the budget
   * has to be split, runouts are worth more than assignments. Both numbers are in the WP
   * report's accuracy table.
   */
  readonly minRunoutSamples: number;
  /**
   * Ceiling on the number of runouts walked, whatever `maxTrials` would allow.
   *
   * `maxTrials` bounds `assignments * runouts`, which is the right measure when the villain
   * range is big — but a ONE-COMBO villain range makes that product tiny while the runout
   * space is still 2.1 million preflop, and each runout costs an unranking plus two
   * evaluations no matter how small the range is. Without this second ceiling, "AA against
   * exactly KK preflop" is the slowest call in the package. Every postflop runout space
   * (1081 at most) is far below the default, so this only ever bites preflop.
   */
  readonly maxRunoutSamples: number;
}

export const DEFAULT_EQUITY_BUDGET: EquityBudget = {
  maxTrials: 2_000_000,
  maxAssignments: 20_000,
  minRunoutSamples: 192,
  maxRunoutSamples: 100_000,
};

/** The most villain ranges one call accepts. Six-max means at most five opponents. */
export const MAX_VILLAIN_RANGES = 5;
