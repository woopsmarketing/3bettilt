/**
 * The vocabulary of the starting-hand strength ranking: what one measurement is, how much of
 * the space it covered, and what the dataset is allowed to claim about itself.
 *
 * ## What is being measured, exactly
 *
 * For a starting-hand class `H`: hero holds one combo of `H`, both players are all-in
 * before the flop, the opponent holds a hand drawn UNIFORMLY from every legal two-card
 * holding that does not use one of hero's cards, and the board runs out. `equity` is
 * hero's expected share of that pot, ties split.
 *
 * `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` §4 chose this basis over adopting a
 * published ranking (someone else's judgement, not reproducible) and over a composite
 * heuristic (category C, which FishTilt does not display). It is a property of the CARDS:
 * two people who agree on the rules of hold'em and start from an empty page get the same
 * number.
 *
 * ## What it is NOT
 *
 * All-in preflop equity is not playability. It answers one narrow question — "if the money
 * goes in right now and nobody folds, what share do I get?" — and a hand's real value also
 * comes from how often it flops something worth betting, how easily it gets away from a
 * bad flop, and how the money goes in at all. This is why suited connectors sit lower here
 * than their real-world reputation: `76s` beats a random hand less often than `A2o` does,
 * and the two are not remotely the same hand to play. The methodology page says this out
 * loud, and any UI that shows the ranking must link to it
 * (`docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md`).
 *
 * ## Why it is EXACT
 *
 * Every one of the `C(50, 5) = 2,118,760` boards is walked against every one of the
 * `C(50, 2) = 1225` opponent hands, for all 169 classes. Nothing is sampled anywhere, so
 * there is no estimate, no confidence interval and no tie band: two classes are equal only
 * if their equities are bit-identical, and otherwise the order between them is a fact.
 *
 * This reverses the audit's original judgement, and it does so on the condition CLAUDE.md
 * rule 9 sets for reopening a settled decision — the premise turned out to be false. §4 of
 * the audit rejected an exact dataset because "fully exact evaluation is out of reach"; a
 * measurement afterwards put one class at about 75 seconds, so all 169 is roughly three and
 * a half CPU-hours and about twenty minutes of wall clock through a worker pool. The
 * orchestrator reopened it; this package implements the reversal and does not re-argue it.
 *
 * `method` is the literal type `'EXACT'` — not `EquityMethod` — so no later edit can widen
 * it, and a dataset regenerated at a sampled budget cannot be published through this type
 * by accident (`POKER_EDUCATIONAL_DATA_AUDIT.md` §3, CLAUDE.md rule 5).
 */

/**
 * The one basis this dataset ranks by. A string rather than a bare boolean so a stored or
 * transmitted dataset says what it is, and so a second basis added later cannot be mistaken
 * for this one.
 */
export const HAND_STRENGTH_RANK_BASIS = 'HEADS_UP_ALLIN_EQUITY_VS_RANDOM_HAND' as const;

export type HandStrengthRankBasis = typeof HAND_STRENGTH_RANK_BASIS;

/** Every way a request against the ranking can fail. */
export const HAND_STRENGTH_ERRORS = ['UNKNOWN_HAND_CLASS', 'SHARE_OUT_OF_RANGE'] as const;

export type HandStrengthError = (typeof HAND_STRENGTH_ERRORS)[number];

/** One class's measurement, plus the positions that follow from it. */
export interface HandStrengthEntry {
  /** `'AA'`, `'AKs'`, `'72o'` — `strategy-core`'s Latin class key (ADR-0053). */
  readonly key: string;
  /** The 13x13 matrix index (`row * 13 + col`), read from `strategy-core`, never re-derived. */
  readonly classIndex: number;
  /**
   * Hero's all-in preflop share against a uniformly random legal hand, `0..1`. Exact: the
   * mean over every board and every opponent hand, not an estimate of that mean.
   */
  readonly equity: number;
  /**
   * 1 = strongest, 169 = weakest. A total order, and — unlike the sampled dataset this
   * replaced — every step in it is a real difference rather than one inside an error bar.
   * Two classes rank adjacently with equal claim only if `equity` is bit-identical, which
   * `HandStrengthDatasetMeta.exactTies` records explicitly.
   */
  readonly rank: number;
  /** 6 for a pair, 4 suited, 12 offsuit — read from `strategy-core`. */
  readonly comboCount: number;
  /** Combos in this class and every stronger-ranked class. The last entry is 1326. */
  readonly cumulativeCombos: number;
  /**
   * `cumulativeCombos / 1326` — the share of hands ACTUALLY DEALT that rank here or higher.
   * This, not `rank / 169`, is what "상위 X%" means: `AA` is one of 169 labels but only
   * 0.45% of deals.
   */
  readonly cumulativeShare: number;
}

/** How much of the space each class's measurement covered. All of it. */
export interface HandStrengthEnumeration {
  /** Boards walked per class. Equal to `boardSpaceSize`, which is what makes this exact. */
  readonly boardsPerClass: number;
  /** `C(50, 5) = 2,118,760` — the boards that exist once hero's two cards are removed. */
  readonly boardSpaceSize: number;
  /** `C(50, 2) = 1225` opponent hands, every one of them, at equal weight. */
  readonly opponentHands: number;
  /**
   * `(board, opponent hand)` pairs scored per class, after pairs sharing a card were
   * dropped: `2,118,760 x 990 = 2,097,572,400`. The same for every class, because it does
   * not depend on which two cards hero holds.
   */
  readonly scoredTrialsPerClass: number;
  /** `scoredTrialsPerClass * 169` — what the whole dataset cost, in showdowns. */
  readonly scoredTrialsTotal: number;
}

/**
 * One class measured twice from two different combos of itself.
 *
 * The suit-symmetry argument in `measure.ts` is what licenses measuring 169 classes instead
 * of 1326 combos, and with exact enumeration it becomes directly testable: the two runs
 * cover the same set of showdowns, so they must produce the same number.
 */
export interface HandStrengthSymmetryCheck {
  readonly key: string;
  /** The shipped value — measured from the class's lowest-index combo. */
  readonly lowestComboEquity: number;
  /** The same class measured from its highest-index combo. Different physical cards. */
  readonly highestComboEquity: number;
  /** `|lowest - highest|`. Zero, or floating-point summation-order noise. */
  readonly absoluteDifference: number;
}

/** The suit-symmetry evidence, and whether it holds. */
export interface HandStrengthSymmetry {
  readonly checks: readonly HandStrengthSymmetryCheck[];
  readonly maxAbsoluteDifference: number;
  /** How many of the checks agreed BIT FOR BIT, `absoluteDifference === 0`. */
  readonly identicalCount: number;
  /** `maxAbsoluteDifference <= HAND_STRENGTH_SYMMETRY_TOLERANCE`. */
  readonly passed: boolean;
}

/**
 * How far two exact enumerations of the same class are allowed to differ: `1e-9`.
 *
 * The derivation, which is why this is a bound and not a taste:
 *
 * The two runs enumerate the SAME multiset of showdowns — that is the content of the
 * symmetry argument — but they visit them in a different order, because the deck array is
 * built from whichever cards hero is not holding and a suit relabelling moves cards between
 * positions. The question is therefore how much reordering an identical set of additions can
 * change the total.
 *
 * On this path the answer is NONE, and that is worth stating precisely rather than bounding
 * loosely. `strategy-core` stores range weights as `Uint16Array` basis points, and a uniform
 * villain range has exactly one distinct value, `BPS_FULL` (10000). Heads-up, every
 * increment is therefore an integer — a win adds 10000, a tie adds 10000/2 = 5000 — and the
 * largest accumulator any class reaches is `scoredWeight`, 2,097,572,400 showdowns x 10000 =
 * 2.0975724e13. That is 429x below 2^53, so every partial sum is an integer that Float64
 * represents EXACTLY. Exactly-representable integer addition is exact, and exact addition is
 * order-independent, so the two orders cannot disagree at all. The equity is then one
 * correctly-rounded division of two identical integers, which preserves the identity.
 *
 * Bit-identity is forced, not lucky, and the run confirms it: `maxAbsoluteDifference` is 0
 * across all 17 checks, not merely small.
 *
 * `1e-9` is therefore NOT a rounding budget — nothing here rounds. It is a tripwire that
 * must never fire, placed far enough below the data to be meaningful: 6,064x under the
 * smallest real gap between two adjacent classes (6.0639e-6, `72s` vs `54o`). Anything
 * above zero means an assumption above is false — the range is not uniform, the weights are
 * not integral, or the symmetry argument itself is wrong — and that is a stop-and-report
 * condition, not a tolerance to widen.
 *
 * (An earlier version of this comment derived 1e-9 from a `sqrt(n) * eps` rounding budget.
 * That reasoning does not apply on this path: it describes accumulations that round, and
 * these do not. The conclusion was safe, the argument was not.)
 */
export const HAND_STRENGTH_SYMMETRY_TOLERANCE = 1e-9;

/** One class measured on the CHEAP sampled path, so a fast test can reproduce it. */
export interface HandStrengthSpotCheck {
  readonly key: string;
  /** What the cheap sampled budget produced. Deterministic, so a test reproduces it exactly. */
  readonly equity: number;
}

/** Everything the dataset says about itself, independent of how the 169 rows are carried. */
export interface HandStrengthDatasetMeta {
  readonly rankBasis: HandStrengthRankBasis;
  /** One sentence naming the measurement, carried with the data so it travels with it. */
  readonly methodology: string;
  /** Where the long-form reasoning and the playability caveat live. */
  readonly methodologyReport: string;
  /**
   * ALWAYS `'EXACT'`, and only because nothing anywhere was sampled. Widening this literal,
   * or setting it on a dataset built at a sampled budget, is the exact mistake the type
   * exists to prevent; see the header of this file.
   */
  readonly method: 'EXACT';
  /** Showdowns behind the whole dataset. The headline "how was this computed" number. */
  readonly trialCount: number;
  readonly enumeration: HandStrengthEnumeration;
  readonly symmetry: HandStrengthSymmetry;
  /**
   * Adjacent classes whose exact equities are BIT-IDENTICAL, written as `'AKs = AKo'`.
   * A genuine tie in the metric, not a measurement artefact — and the only kind of tie an
   * exact dataset can have. Empty means the 169 values are all distinct and every step in
   * the ranking is a real difference.
   */
  readonly exactTies: readonly string[];
  /** Boards the cheap sampled path walks, for the fast test's recomputation. */
  readonly spotCheckRunoutSamples: number;
  /** The cheap-path values a fast test recomputes to prove the pipeline still runs. */
  readonly spotChecks: readonly HandStrengthSpotCheck[];
  /**
   * Largest `|cheap sampled value - exact value|` over all 169 classes. Now a real accuracy
   * figure for the sampled path rather than a self-comparison, because the exact column is
   * the truth.
   */
  readonly spotCheckMaxDeviation: number;
  readonly generatorVersion: string;
  /** ISO-8601 UTC instant the shipped numbers were produced. */
  readonly generatedAt: string;
}

/**
 * One row of the generated file: `[key, equity]`, in rank order.
 *
 * A tuple rather than an object because the generated file holds ONLY what was measured.
 * `rank` is the row's position, `comboCount` and the matrix index belong to
 * `strategy-core`, and the cumulative combo counts are arithmetic — writing any of them
 * down here would create a second source of truth for a number the chart, the range model
 * and this ranking all already agree on (the same rule `handClass/facts.ts` states).
 * `ranking.ts` expands a row into a full `HandStrengthEntry` at load and CHECKS the derived
 * parts against `strategy-core` while it does.
 */
export type HandStrengthRow = readonly [key: string, equity: number];

/** Exactly what `dataset.generated.ts` holds: the metadata and the 169 measured rows. */
export interface HandStrengthDatasetSource extends HandStrengthDatasetMeta {
  /** RANK ORDER, strongest first. */
  readonly rows: readonly HandStrengthRow[];
}

/** The dataset as callers read it: the same metadata over expanded, checked entries. */
export interface HandStrengthDataset extends HandStrengthDatasetMeta {
  /** The 169 entries, RANK ORDER, strongest first. `entries[i].rank === i + 1`. */
  readonly entries: readonly HandStrengthEntry[];
}
