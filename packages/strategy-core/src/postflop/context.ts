/**
 * The MEASUREMENT layer: everything the scoring model reads, computed once from a
 * `StrategyQuery`.
 *
 * Nothing here scores, weights, or advises — that is `score.ts`. Nothing here holds a
 * constant that affects a recommendation either; the two numbers this file DOES own
 * (`NUT_SHARE_PERCENTILE` and the budgets) live in `scoreModel.ts` and `PostflopBudget`
 * respectively.
 *
 * The expensive calls, and why there are exactly three of them:
 *
 *  1. `equityVsRanges(hero's two cards, board, every live villain range)` — hero's actual
 *     equity, multiway-aware, EXACT heads-up on every postflop street (B2 §3).
 *  2. `equityDistribution(hero range, PRIMARY villain range, board)` — one pass that yields
 *     BOTH the range-advantage number and hero's rank inside hero's own range. Running it
 *     against every villain would multiply the dominant cost by up to five, which is why
 *     `primaryVillainOf` exists.
 *  3. `buildStrengthDistribution` x3 (the board's reference distribution, hero's range,
 *     the primary villain's) at ~1.3 ms each — the nut-share measurement. B2 §6 guidance 1 is
 *     explicit that bulk per-combo questions belong here and not in the equity engine.
 *
 * `nutStrengthOnBoard` is computed ONCE and threaded into every call that wants it (B1 risk 3).
 *
 * There is a FOURTH call, and it is conditional: when hero's actual combo carries no weight in
 * hero's own propagated range, call 2 never scored it, so one `equityVsRange` against the
 * PRIMARY villain supplies the number call 2 would have produced. It is not an extra estimate
 * of something already known — it is the only way to obtain the quantity `rangeRank` ranks
 * without silently swapping in a different one (R1 MINOR-2). It never runs heads-up (call 1
 * already IS that number there) and never runs on the common path.
 */
import { invariant, ok, type Card, type MilliBB } from '@gto-self/shared';
import { analyzeBoard, type BoardFeatures } from '../analysis/board.js';
import {
  analyzeHeroHand,
  nutStrengthOnBoard,
  type HeroHandFeatures,
} from '../analysis/heroHand.js';
import { strategyErr, type StrategyResult } from '../errors.js';
import type { EquityBudget, EquityMethod, EquityResult } from '../equity/model.js';
import { equityVsRange, equityVsRanges } from '../equity/equity.js';
import {
  equityDistribution,
  equityQuantile,
  type EquityDistribution,
} from '../equity/rangeEquity.js';
import {
  buildStrengthDistribution,
  weightAtOrAboveBps,
  type StrengthDistribution,
} from '../equity/strength.js';
import type { EquityCache } from '../equity/cache.js';
import { comboIndexOf, type ComboIndex } from '../range/combo.js';
import { handClassOfCombo, type HandClass } from '../range/handClass.js';
import { uniformRange, type RangeWeights } from '../range/weights.js';
import type { StrategyQuery } from '../types.js';
import { buildPostflopRanges, type PostflopRangeModel } from './ranges.js';
import {
  classifyPostflopSpot,
  type PostflopSpot,
  type PostflopSpotClassification,
} from './spot.js';
import { NUT_SHARE_PERCENTILE, STRONG_SHARE_PERCENTILE } from './scoreModel.js';

/**
 * Work ceilings. Every field bounds an ENUMERATION SIZE, never wall-clock time, so a slow
 * machine returns the same answer as a fast one — B2's rule, inherited unchanged, and the
 * reason determinism survives the budget.
 */
export interface PostflopBudget {
  /** Passed straight to `equityVsRanges`. Omit for B2's defaults (exact heads-up postflop). */
  readonly equity?: Partial<EquityBudget>;
  /** Passed straight to `equityDistribution`. */
  readonly rangeEquityMaxOps?: number;
  readonly rangeEquityMaxRunouts?: number;
  /** An explicit, caller-owned cache. There is no global one (B2 §2.8). */
  readonly cache?: EquityCache;
}

/**
 * How hero's ranked equity was obtained. Both members denote the SAME quantity — hero's actual
 * combo against the PRIMARY villain's range on this board — and differ only in the estimator:
 *
 *  - `RANGE_DISTRIBUTION` — read straight off hero's own entry in the range-vs-range pass. Free,
 *    and it shares that pass's runout sample with every combo it is compared against.
 *  - `EXACT_PAIRWISE_PROBE` — hero's combo carries no weight in hero's own propagated range, so
 *    the pass never scored it. One `equityVsRange` call against the primary villain supplies the
 *    same quantity, EXACT on every postflop street. Heads-up it costs nothing at all, because
 *    `equityVsRanges` against a one-villain lineup already computed exactly this number.
 *
 * What this deliberately does NOT do is substitute hero's WHOLE-FIELD equity, which is what the
 * pre-fix fallback did: multiway that is a different quantity, systematically lower than the
 * pairwise one the distribution is made of, so ranking it there understated hero's rank by a
 * measured 0.04-0.07 (R1 MINOR-2). See `STRATEGY_FIX_RANGERANK.md`.
 */
export type RangeRankBasis = 'RANGE_DISTRIBUTION' | 'EXACT_PAIRWISE_PROBE';

export interface NutShares {
  /** The packed strength at the board's `NUT_SHARE_PERCENTILE` cutoff. Absolute, board-level. */
  readonly nutCutoffStrength: number;
  readonly strongCutoffStrength: number;
  readonly heroNutShare: number;
  readonly villainNutShare: number;
  readonly heroStrongShare: number;
  readonly villainStrongShare: number;
  /** `heroNutShare - villainNutShare`. The scored number. */
  readonly nutAdvantage: number;
}

export interface PostflopContext {
  readonly query: StrategyQuery;
  readonly spot: PostflopSpot;
  readonly ranges: PostflopRangeModel;
  readonly board: BoardFeatures;
  readonly heroHand: HeroHandFeatures;
  readonly heroCombo: ComboIndex;
  readonly handClass: HandClass;

  /** Hero's equity against EVERY live villain range. */
  readonly heroEquity: number;
  readonly heroEquityResult: EquityResult;
  /** Hero's whole range against the PRIMARY villain's. */
  readonly rangeEquity: number;
  readonly rangeAdvantage: number;
  readonly rangeEquityDistribution: EquityDistribution;
  /**
   * The weighted share of hero's own range that hero's hand is at least as good as, 0..1.
   * 1.0 is the very top of the range.
   *
   * The RANKED QUANTITY and the DISTRIBUTION it is ranked in are the same kind of equity —
   * hero's combo against the PRIMARY villain's range on this board — in every case. See
   * `rangeRankBasis` for how the ranked quantity was obtained, and the module note for why
   * this is the only defensible pairing (R1 MINOR-2).
   */
  readonly rangeRank: number;
  /** The equity value that was ranked. Always pairwise vs the primary villain. */
  readonly rangeRankEquity: number;
  /** How `rangeRankEquity` was obtained. See `RangeRankBasis`. */
  readonly rangeRankBasis: RangeRankBasis;
  /** True when hero's actual combo was found in hero's own range (it usually is). */
  readonly heroComboInRange: boolean;

  readonly nut: NutShares;

  /** `call / (pot + call)`, from the query. Null when hero is not facing a bet. */
  readonly requiredEquity: number | null;
  /** `heroEquity - requiredEquity`. Null when hero is not facing a bet. */
  readonly potOddsMargin: number | null;
  readonly spr: number | null;
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;

  /** True when ANY equity number behind this context was subsampled rather than enumerated. */
  readonly anyEquitySubsampled: boolean;
  readonly heroEquityMethod: EquityMethod;
  readonly rangeEquityMethod: EquityMethod;
}

/**
 * The absolute strength cutoff for a share measurement: walk the board's own all-1326-combo
 * strength distribution from the top and take the strength of the first entry at which the
 * cumulative weight has reached `percentile` of the total.
 *
 * Everything of EQUAL strength is then counted by `weightAtOrAboveBps`, so a board whose top
 * 5% falls inside a large tie group yields a share above 5% for the reference range itself.
 * That is correct and deliberate: the cutoff is a STRENGTH, and two ranges must be measured
 * against the same strength to be comparable at all.
 */
export function shareCutoffStrength(reference: StrengthDistribution, percentile: number): number {
  const total = reference.totalWeightBps;
  if (total === 0) return reference.nutStrength;
  const target = total * percentile;
  for (let i = 0; i < reference.entries.length; i += 1) {
    const cumulative = reference.cumulativeBps[i + 1] ?? 0;
    if (cumulative >= target) {
      const entry = reference.entries[i];
      if (entry !== undefined) return entry.strength;
    }
  }
  // Unreachable for a positive percentile; the weakest strength is the safe total answer.
  const last = reference.entries[reference.entries.length - 1];
  return last?.strength ?? reference.nutStrength;
}

function shareAtOrAbove(dist: StrengthDistribution, strength: number): number {
  if (dist.totalWeightBps === 0) return 0;
  return weightAtOrAboveBps(dist, strength) / dist.totalWeightBps;
}

/**
 * Result. Every measurement the scoring model needs.
 *
 * Refuses only for reasons about the QUESTION, never about the spot:
 *  - a preflop query (`NOT_A_DECISION_POINT`);
 *  - hero's holding not entered as exactly two distinct cards (`INVALID_HERO_CARDS`);
 *  - a spot `classifyPostflopSpot` reports UNSUPPORTED (`NOT_A_DECISION_POINT`), which only
 *    happens when the hand is over, the board is malformed, or the engine offers no action;
 *  - a range or equity computation that has nothing to enumerate (B2's typed errors).
 */
export function buildPostflopContext(
  query: StrategyQuery,
  budget: PostflopBudget = {},
): StrategyResult<PostflopContext> {
  const classification: PostflopSpotClassification = classifyPostflopSpot(query);
  if (classification.kind === 'UNSUPPORTED') {
    return strategyErr(
      'NOT_A_DECISION_POINT',
      `The postflop reference policy cannot answer here: ${classification.detail}`,
      { street: query.street, value: classification.reason },
    );
  }
  const spot = classification;

  if (query.heroCards.length !== 2) {
    return strategyErr(
      'INVALID_HERO_CARDS',
      `A postflop recommendation needs hero's two cards; got ${query.heroCards.length}`,
      { field: 'heroCards', actual: query.heroCards.length, expected: '2' },
    );
  }
  const [first, second] = query.heroCards;
  invariant(first !== undefined && second !== undefined, "hero's two cards were just checked");
  if (first === second) {
    return strategyErr('INVALID_HERO_CARDS', "Hero's two cards are identical", {
      field: 'heroCards',
    });
  }
  for (const card of query.board) {
    if (card === first || card === second) {
      return strategyErr('INVALID_HERO_CARDS', 'Hero holds a card that is on the board', {
        field: 'heroCards',
      });
    }
  }

  const ranges = buildPostflopRanges(query);
  if (!ranges.ok) return ranges;

  const board: readonly Card[] = query.board;
  const nutStrength = nutStrengthOnBoard(board);
  const boardFeatures = analyzeBoard(board);
  const heroHand = analyzeHeroHand([first, second], board, { nutStrength });
  const heroCombo = comboIndexOf(first, second);
  const handClass = handClassOfCombo(heroCombo);

  // ---- 1. hero's equity against every live villain -------------------------------------
  const villainRanges: readonly RangeWeights[] = ranges.value.villains.map((seat) => seat.range);
  const heroEquityResult = equityVsRanges(query.heroCards, board, villainRanges, {
    ...(budget.equity ?? {}),
    ...(budget.cache === undefined ? {} : { cache: budget.cache }),
  });
  if (!heroEquityResult.ok) return heroEquityResult;

  // ---- 2. hero's range against the primary villain's ------------------------------------
  const distribution = equityDistribution(
    ranges.value.hero.range,
    ranges.value.primaryVillain.range,
    board,
    {
      ...(budget.rangeEquityMaxOps === undefined ? {} : { maxOps: budget.rangeEquityMaxOps }),
      ...(budget.rangeEquityMaxRunouts === undefined
        ? {}
        : { maxRunouts: budget.rangeEquityMaxRunouts }),
      ...(budget.cache === undefined ? {} : { cache: budget.cache }),
    },
  );
  if (!distribution.ok) return distribution;

  // ---- 2b. hero's rank INSIDE that same distribution ------------------------------------
  // The ranked quantity must be the same KIND of equity as the distribution's entries —
  // hero's combo vs the PRIMARY villain — or the quantile is meaningless (R1 MINOR-2).
  const heroEntry = distribution.value.aggregate.perCombo.find(
    (entry) => entry.combo === heroCombo,
  );
  let rangeRankEquity: number;
  let rangeRankBasis: RangeRankBasis;
  if (heroEntry !== undefined) {
    rangeRankEquity = heroEntry.equity;
    rangeRankBasis = 'RANGE_DISTRIBUTION';
  } else if (
    ranges.value.villains.length === 1 &&
    ranges.value.villains[0] === ranges.value.primaryVillain
  ) {
    // Heads-up the whole field IS the primary villain, so the exact number is already in hand.
    // This is why the pre-fix substitution was harmless heads-up and wrong multiway.
    rangeRankEquity = heroEquityResult.value.equity;
    rangeRankBasis = 'EXACT_PAIRWISE_PROBE';
  } else {
    // Hero holds a combo his own propagated range gives no weight (CLAUDE.md rule 3 keeps that
    // path reachable), so the pass above never scored it. Ask for exactly that one number
    // rather than substituting a different one. Measured cost below the 200 ms budget; see the
    // fix report's latency table.
    const probe = equityVsRange(query.heroCards, board, ranges.value.primaryVillain.range, {
      ...(budget.equity ?? {}),
      ...(budget.cache === undefined ? {} : { cache: budget.cache }),
    });
    if (!probe.ok) return probe;
    rangeRankEquity = probe.value.equity;
    rangeRankBasis = 'EXACT_PAIRWISE_PROBE';
  }
  const rangeRank = 1 - equityQuantile(distribution.value, rangeRankEquity);

  // ---- 3. nut shares --------------------------------------------------------------------
  const reference = buildStrengthDistribution(uniformRange(), board, { nutStrength });
  if (!reference.ok) return reference;
  const heroStrength = buildStrengthDistribution(ranges.value.hero.range, board, { nutStrength });
  if (!heroStrength.ok) return heroStrength;
  const villainStrength = buildStrengthDistribution(ranges.value.primaryVillain.range, board, {
    nutStrength,
  });
  if (!villainStrength.ok) return villainStrength;

  const nutCutoffStrength = shareCutoffStrength(reference.value, NUT_SHARE_PERCENTILE);
  const strongCutoffStrength = shareCutoffStrength(reference.value, STRONG_SHARE_PERCENTILE);
  const heroNutShare = shareAtOrAbove(heroStrength.value, nutCutoffStrength);
  const villainNutShare = shareAtOrAbove(villainStrength.value, nutCutoffStrength);

  const requiredEquity = query.potOdds;
  const heroEquity = heroEquityResult.value.equity;

  const heroEquityMethod = heroEquityResult.value.method;
  const rangeEquityMethod = distribution.value.aggregate.method;

  return ok({
    query,
    spot,
    ranges: ranges.value,
    board: boardFeatures,
    heroHand,
    heroCombo,
    handClass,

    heroEquity,
    heroEquityResult: heroEquityResult.value,
    rangeEquity: distribution.value.aggregate.equity,
    rangeAdvantage: distribution.value.aggregate.equity - 0.5,
    rangeEquityDistribution: distribution.value,
    rangeRank,
    rangeRankEquity,
    rangeRankBasis,
    heroComboInRange: heroEntry !== undefined,

    nut: {
      nutCutoffStrength,
      strongCutoffStrength,
      heroNutShare,
      villainNutShare,
      heroStrongShare: shareAtOrAbove(heroStrength.value, strongCutoffStrength),
      villainStrongShare: shareAtOrAbove(villainStrength.value, strongCutoffStrength),
      nutAdvantage: heroNutShare - villainNutShare,
    },

    requiredEquity,
    potOddsMargin: requiredEquity === null ? null : heroEquity - requiredEquity,
    spr: query.spr,
    potBeforeDecisionMbb: query.potBeforeDecisionMbb,
    callAmountMbb: query.callAmountMbb,

    anyEquitySubsampled: heroEquityMethod === 'SUBSAMPLED' || rangeEquityMethod === 'SUBSAMPLED',
    heroEquityMethod,
    rangeEquityMethod,
  });
}
