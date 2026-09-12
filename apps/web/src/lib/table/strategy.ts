/**
 * The web app's read model for `@gto-self/strategy-core` — 기본전략 · REFERENCE.
 *
 * Four rules govern this file, and they are the reason it exists at all rather than the
 * panel calling the engine inline:
 *
 * 1. **Pure and synchronous.** `computeStrategy` is a plain function call: no `await`, no
 *    `fetch`, no server action, no database. It is exactly as local as `poker-core` is
 *    (ADR-0043), which is what lets the panel be scheduled instead of awaited.
 * 2. **No poker fact and no strategy number is derived here.** Every value below is a
 *    FIELD READ off `StrategyQuery` (built by the one documented adapter seam) or off the
 *    recommendation the reference policy returned. Percentages are `bps / 100`; nothing
 *    else is computed. Rule 2 of `CLAUDE.md` is structural here: this module cannot invent
 *    a frequency because it never authors one.
 * 3. **A refusal is data.** Every typed `StrategyError` and every `UNSUPPORTED` spot comes
 *    back as a renderable model with the engine's own code and message carried verbatim
 *    (`CLAUDE.md` rule 3). Nothing throws, nothing returns a plausible-looking default.
 * 4. **ACTUAL is never replaced by NORMALIZED.** `actual` carries the effective stack, the
 *    real pot and the real last raise-TO; `metrics.stackBucket` carries the lookup key the
 *    policy actually used. Both are kept and both are shown (`CLAUDE.md` rule 3).
 *
 * The engine is NEVER labelled with the three letters this project reserves for solved
 * output. `label` on both recommendation shapes is the constant `'REFERENCE'` and the
 * user-facing name is 기본전략 · REFERENCE (ADR-0056).
 */
import { Money, type MilliBB } from '@gto-self/shared';
import type { HandState, SeatIndex } from '@gto-self/poker-core';
import {
  buildStrategyQuery,
  recommendPostflop,
  recommendPreflop,
  POT_FRACTION_BUCKETS,
  type AggressionBandId,
  type ConfidenceLevel,
  type EnvironmentCompatibility,
  type EquityMethod,
  type PostflopBudget,
  type PostflopPotType,
  type PostflopRecommendation,
  type PostflopSpotFamily,
  type PreflopSpotFamily,
  type PreflopSpotUnsupportedReason,
  type Provenance,
  type SizingClampKind,
  type StackBucketClassification,
  type StrategyActionKind,
  type StrategyErrorCode,
  type StrategyPosition,
  type StrategyQuery,
  type StrategyRecommendation,
  type StrategySeatProfile,
  type StrategyStreet,
  type StrategyWagerOption,
} from '@gto-self/strategy-core';

/** Every spot family either policy can report, plus preflop's typed `UNSUPPORTED`. */
export type StrategySpotFamily = PreflopSpotFamily | PostflopSpotFamily | 'UNSUPPORTED';

/**
 * One action row. `name` is the LATIN display name — `FOLD` / `CALL` / `3BET` — because
 * standard poker notation stays international (ADR-0053); `kind` is the engine's own
 * action kind and is what any test should assert on.
 */
export interface StrategyActionRow {
  readonly kind: StrategyActionKind;
  readonly name: string;
  /** A multiple of 500. The set sums to exactly 10000 (ADR-0056). */
  readonly frequencyBps: number;
  /** `frequencyBps / 100`. An integer by construction — never a fabricated decimal. */
  readonly percent: number;
  readonly isPrimary: boolean;
  /** Raise-TO semantics: hero's street contribution AFTER acting. */
  readonly toAmountMbb: MilliBB | null;
  /**
   * The engine's own flag: this action puts hero's whole remaining stack in. Carried, not
   * re-derived — comparing `toAmountMbb` against a stack here would be this file authoring a
   * poker fact. It is set on an explicit `ALL_IN`, on a CALL that covers hero's last chip, and
   * on a `BET`/`RAISE` whose sizing landed exactly on the engine's maximum. That last case is
   * the one that matters: without the flag a recommended shove renders as an ordinary
   * `BET TO 25 BB`.
   */
  readonly isAllIn: boolean;
}

export interface StrategySizingView {
  /**
   * The engine's own action kind for the row this sizing belongs to. `name` is the display
   * string; this is the field a test — or the ADAPTIVE seam, which has to label a size as a
   * BET or a RAISE — should read. It follows `StrategyActionRow`'s `kind` / `name` pairing so
   * the same fact is never spelled two ways.
   */
  readonly kind: StrategyActionKind;
  /** The same Latin name the aggressive row carries. */
  readonly name: string;
  readonly toAmountMbb: MilliBB;
  /** What the sizing rule asked for before legality clamped it. Never dropped (rule 3). */
  readonly requestedToAmountMbb: MilliBB;
  readonly clamp: SizingClampKind;
  /**
   * The pot-fraction rung the postflop model chose (25 / 33 / 50 / 67 / 75 / 100 / 125 /
   * 150), read off the recommendation's own `SIZING_BUCKET` explanation feature. `null`
   * preflop, where sizing is a raise-TO rule rather than a pot fraction.
   */
  readonly potFractionPercent: number | null;
  /**
   * The engine's legal raise-TO window, carried verbatim off `RecommendedSizing`. Both bounds
   * are already on the recommendation; they are surfaced here so a consumer that moves a size
   * — the ADAPTIVE layer moves it one rung — can prove the result is legal without rebuilding
   * a `PostflopContext` or re-deriving a minimum raise.
   */
  readonly minToAmountMbb: MilliBB;
  readonly maxToAmountMbb: MilliBB;
  readonly allIn: boolean;
}

export interface StrategyMetricsView {
  readonly spr: number | null;
  readonly potOdds: number | null;
  readonly requiredEquity: number | null;
  /** Hero's actual two cards against every live villain range. Postflop only. */
  readonly equity: number | null;
  readonly equityMethod: EquityMethod | null;
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  /** The NORMALIZED lookup key. `actual.effectiveStackMbb` is what hero really has. */
  readonly stackBucket: StackBucketClassification;
}

/** What is actually on the table, as opposed to the reference environment. */
export interface StrategyActualView {
  readonly effectiveStackMbb: MilliBB;
  readonly potTotalMbb: MilliBB;
  readonly dealtInCount: number;
  readonly heroInPosition: boolean;
  /** The last seat to raise the price on this street, and to how much. */
  readonly lastAggressorPosition: StrategyPosition | null;
  readonly lastAggressorToAmountMbb: MilliBB | null;
}

/**
 * ONE non-hero dealt-in seat's ordering facts, as `StrategyQuery` states them.
 *
 * These are the "caller-supplied ordering facts" `adaptive-core/src/multiway.ts` refuses to
 * compute: that package cannot import `poker-core` and holds no notion of button, blinds or
 * action order, so who is live and who acts after hero has to arrive as data. Everything here
 * is a field read off `StrategySeatProfile` and `StrategyQuery.aggressionHistory`.
 *
 * THERE IS NO PLAYER ID. `StrategyQuery` is deliberately anonymous — the reference engine is
 * never told who is in a seat — so the seat index is all this model can carry. The seat ->
 * player mapping is applied one layer up, in `adaptive.ts`, by the caller that owns the lineup.
 */
export interface StrategyOpponentOrdering {
  /** poker-core's physical seat index 0..5. */
  readonly seatIndex: number;
  /** Still in the hand AND still able to act: `status === 'IN_HAND'`. All-in is not live. */
  readonly isLive: boolean;
  /**
   * This seat's action-order index on the CURRENT street is greater than hero's.
   *
   * The index is the engine's own published first-orbit order (`preflopOrder` preflop,
   * `postflopOrder` otherwise). After a re-raise the betting reopens and the true order wraps,
   * which this comparison does not model — a seat that already acted and is live still counts
   * as "after hero" only if it sits later in the orbit. That is the conservative direction for
   * everything downstream: the §9 guard rail can only ever REFUSE an adjustment, and the
   * PRIMARY villain choice falls back to "nobody", which reports `INSUFFICIENT_DATA`.
   */
  readonly actsAfterHero: boolean;
  /** This seat made the last aggressive action on the current street. At most one seat does. */
  readonly isLastAggressorThisStreet: boolean;
  /** `preflopOrder` preflop, `postflopOrder` on every other street. 0 = first to act. */
  readonly actionOrderIndex: number;
}

/**
 * The facts the ADAPTIVE composition layer needs and the REFERENCE read model above does not
 * already carry.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THIS LIVES HERE AND NOT IN `adaptive-core`
 *
 * `@gto-self/adaptive-core` composes an already-computed baseline. It may not import
 * `poker-core`, so it cannot see a `HandState`, and it holds no board analysis, no ranges and
 * no scoring model, so it cannot compute an aggression band. Every field below is therefore
 * SUPPLIED to it, and every one of them is a field read off `StrategyQuery` or off the
 * recommendation the reference policy returned — the same rule 2 that governs the rest of this
 * file. Nothing here is a second opinion about a poker fact.
 *
 * WHAT IS DELIBERATELY ABSENT. `street`, `heroPosition`, `actions`, `primaryKind`, `sizing`,
 * `potBeforeDecisionMbb` and `callAmountMbb` are all already on `StrategyPanelReady` /
 * `StrategyMetricsView`, so they are read from there rather than duplicated into a second
 * money field that could disagree with the first.
 * ---------------------------------------------------------------------------------------
 */
export interface StrategyAdaptiveFacts {
  /** Hero has a live bet to call: `callAmountMbb` is positive. Never `!canCheck`. */
  readonly heroFacingBet: boolean;
  /** Contenders other than hero who have not folded, from the query's own count. */
  readonly activeOpponentCount: number;
  /**
   * POSTFLOP ONLY: the REFERENCE engine's OWN `scoring.aggressionBand.id`, copied verbatim.
   * `null` preflop, where the engine authors no band. It is READ, never re-derived — a second
   * notion of "how strong is hero here" is exactly the duplicate system the working agreement
   * forbids, and `adaptive-core/src/baseline.ts` says the same thing from the other side.
   */
  readonly aggressionBand: AggressionBandId | null;
  /**
   * Hero's decision is a preflop RAISE FIRST IN, taken from the engine's own
   * `PreflopSpotFamily`. See `PREFLOP_OPENER_FAMILIES` for the list and why it is that list.
   * Always `false` postflop.
   */
  readonly heroIsPreflopOpener: boolean;
  /** Hero's contribution to the CURRENT street so far, off hero's own `StrategySeatProfile`. */
  readonly heroStreetContributionMbb: MilliBB;
  /**
   * The rung of `POT_FRACTION_BUCKETS` the postflop model chose; `-1` when it chose ALL_IN;
   * `null` when there is no pot-fraction rung to name at all — no sizing, or preflop, where
   * sizing is a raise-TO rule rather than a pot fraction (mirroring `potFractionPercent`).
   */
  readonly bucketIndex: number | null;
  /** The engine's legal bet/raise window, verbatim from `query.legalActions.wager`. */
  readonly wager: StrategyWagerOption | null;
  /** One entry per non-hero dealt-in seat, in the query's own seat order (`preflopOrder`). */
  readonly opponentOrderings: readonly StrategyOpponentOrdering[];
}

export interface StrategyPanelReady {
  readonly kind: 'READY';
  readonly street: StrategyStreet;
  readonly family: StrategySpotFamily;
  /** Set only when the preflop policy reports a line it does not model. */
  readonly unsupportedReason: PreflopSpotUnsupportedReason | null;
  readonly potType: PostflopPotType | null;
  readonly heroPosition: StrategyPosition;
  /** `'AKs'`, `'77'`, `'T9o'`. */
  readonly handClassKey: string;
  readonly actions: readonly StrategyActionRow[];
  readonly primary: StrategyActionRow;
  readonly sizing: StrategySizingView | null;
  readonly metrics: StrategyMetricsView;
  readonly quality: Provenance;
  /** Postflop only: the model's own confidence. Preflop provenance carries no gradation. */
  readonly confidence: ConfidenceLevel | null;
  readonly notes: readonly string[];
  readonly ruleIds: readonly string[];
  readonly environment: EnvironmentCompatibility;
  readonly actual: StrategyActualView;
  /**
   * The extra facts 상대 적응 · ADAPTIVE composes over. Present on every READY model, whether or
   * not anything ever asks for an adaptive answer: they are byte-for-byte a function of the
   * `HandState` alone, so carrying them cannot make this model depend on player data.
   */
  readonly adaptiveFacts: StrategyAdaptiveFacts;
}

export type StrategyPanelModel =
  | { readonly kind: 'NO_HAND' }
  | { readonly kind: 'REFUSED'; readonly code: StrategyErrorCode; readonly message: string }
  | StrategyPanelReady;

/**
 * The LATIN name for the aggressive action in a spot, derived from the family the engine
 * classified — never from the money. Exhaustive over both families' unions, so a new
 * family is a compile error here rather than a raise silently labelled `RAISE`.
 *
 * Two families deliberately keep the neutral `RAISE`: `OPEN_PLUS_CALLER` (hero is already
 * in the pot facing a cold-caller, which has no settled short name) and `BLIND_VS_BLIND`
 * (the same family covers an open and a raise over a limp). Naming either would be this
 * file asserting a poker fact it did not read.
 */
export function aggressiveActionName(family: StrategySpotFamily): string {
  switch (family) {
    case 'RFI':
      return 'OPEN';
    case 'VS_LIMP':
      return 'ISO';
    case 'VS_OPEN':
      return '3BET';
    case 'SQUEEZE':
      return 'SQUEEZE';
    case 'OPENER_VS_3BET':
    case 'COLD_4BET':
      return '4BET';
    case 'VS_4BET':
      return '5BET';
    case 'OPEN_PLUS_CALLER':
    case 'BLIND_VS_BLIND':
    case 'VS_ALLIN':
    case 'UNSUPPORTED':
      return 'RAISE';
    case 'CBET':
    case 'DELAYED_CBET':
    case 'PROBE':
      return 'BET';
    case 'FACING_BET':
    case 'FACING_RAISE':
    case 'FACING_ALL_IN':
      return 'RAISE';
  }
}

/**
 * The Latin marker for an action that commits hero's whole remaining stack (ADR-0053: standard
 * poker vocabulary stays international). It is both the row NAME of an explicit `ALL_IN` and
 * the amount marker on any other row the engine flagged `isAllIn`, so the panel never spells
 * the same fact two ways.
 */
export const ALL_IN_NAME = 'ALL IN';

/** `FOLD` / `CHECK` / `CALL` keep their own name; aggression takes the family's. */
function actionName(kind: StrategyActionKind, family: StrategySpotFamily): string {
  switch (kind) {
    case 'FOLD':
      return 'FOLD';
    case 'CHECK':
      return 'CHECK';
    case 'CALL':
      return 'CALL';
    case 'ALL_IN':
      return ALL_IN_NAME;
    case 'BET':
    case 'RAISE':
      return aggressiveActionName(family);
  }
}

/**
 * The `SIZING_BUCKET` token the postflop model emitted (`POT_33`, `POT_100`, `ALL_IN`), or
 * `null` when the recommendation carried no such feature. Both sizing readers below go through
 * this one function, so the percent shown and the rung index handed to ADAPTIVE can never come
 * from two different places and disagree.
 */
function sizingBucketTokenOf(recommendation: PostflopRecommendation): string | null {
  const found = recommendation.explanation.features.find(
    (feature) => feature.id === 'SIZING_BUCKET',
  );
  return found?.token ?? null;
}

/**
 * The pot-fraction rung the postflop model selected, read out of the recommendation's own
 * `SIZING_BUCKET` explanation feature (`POT_33`, `POT_100`, `ALL_IN`). Parsing the token
 * the engine emitted is a field read; re-deriving the bucket from the money would be a
 * second, drifting copy of the sizing ladder.
 */
function potFractionOf(recommendation: PostflopRecommendation): number | null {
  const token = sizingBucketTokenOf(recommendation);
  if (token === null || !token.startsWith('POT_')) return null;
  const percent = Number(token.slice('POT_'.length));
  return Number.isInteger(percent) ? percent : null;
}

/**
 * The same choice as an INDEX into `POT_FRACTION_BUCKETS` — the form the ADAPTIVE sizing pass
 * moves along — with `-1` for the engine's ALL_IN rung and `null` when there is no rung at all.
 *
 * The percent is matched against the ladder rather than recomputed from the money: the engine
 * already told us which rung it chose, and `POT_FRACTION_BUCKETS` is the engine's own array, so
 * the round trip `POT_FRACTION_BUCKETS[bucketIndex].percent === potFractionPercent` holds by
 * construction. A percent that is somehow not on the ladder comes back as `null` rather than as
 * `Array.findIndex`'s own `-1`, which here means something else entirely.
 */
function bucketIndexOf(recommendation: PostflopRecommendation): number | null {
  const token = sizingBucketTokenOf(recommendation);
  if (token === null) return null;
  if (token === 'ALL_IN') return -1;
  const percent = potFractionOf(recommendation);
  if (percent === null) return null;
  const index = POT_FRACTION_BUCKETS.findIndex((bucket) => bucket.percent === percent);
  return index === -1 ? null : index;
}

/**
 * The preflop families in which hero's aggressive option is a RAISE FIRST IN.
 *
 * The list is exactly `RFI`, and the omissions carry the meaning:
 *
 *  - `VS_LIMP` also has `raiseCount === 0`, but somebody has already voluntarily entered the
 *    pot, so hero would be ISOLATING, not opening. It is also the family a BIG BLIND gets when
 *    it can simply check behind limpers — precisely the spot the naive
 *    `street === 'PREFLOP' && !heroFacingBet` derivation misreads as an open, which is why
 *    `adaptive-core/src/baseline.ts` requires this fact to be supplied rather than inferred.
 *  - `BLIND_VS_BLIND`, `VS_OPEN`, `SQUEEZE`, `OPEN_PLUS_CALLER`, `OPENER_VS_3BET`, `COLD_4BET`,
 *    `VS_4BET` and `VS_ALLIN` are all reached only at `raiseCount >= 1` (`preflop/spot.ts`
 *    rules 1, 2, 4, 5, 6): a raise is already standing, so hero cannot be the one opening.
 *    Note in particular that a folded-to SB is `RFI` and NOT `BLIND_VS_BLIND` — rule 3 fires
 *    first — so the small blind's open is inside the list, not outside it.
 *  - `UNSUPPORTED`, and every postflop family, are not preflop opens at all.
 *
 * The narrowness is also what keeps the steal rule honest: `analysis-core` scopes the `STEAL`
 * stat to "RFI from CO/BTN/SB", so `PREFLOP_HERO_STEALING` fires over exactly the line that
 * stat was observed on.
 */
const PREFLOP_OPENER_FAMILIES: readonly StrategySpotFamily[] = ['RFI'];

/**
 * Hero's own seat profile. `buildStrategyQuery` refuses to produce a query without a dealt-in
 * hero, so this cannot miss; `null` is returned rather than asserted so that a future adapter
 * change degrades to "no facts" instead of throwing inside a React render.
 */
function heroSeatOf(query: StrategyQuery): StrategySeatProfile | null {
  return query.seats.find((seat) => seat.isHero) ?? null;
}

/** The action-order index the CURRENT street is played in. 0 = first to act. */
function actionOrderIndexOf(seat: StrategySeatProfile, street: StrategyStreet): number {
  return street === 'PREFLOP' ? seat.preflopOrder : seat.postflopOrder;
}

/**
 * One ordering row per non-hero dealt-in seat, in `query.seats` order (which the adapter
 * documents as `preflopOrder` order). Every field is read; nothing about action order is
 * recomputed, and the seat that made the last aggression this street is found by matching the
 * engine's own `aggressionHistory` position rather than by comparing money.
 */
function opponentOrderingsOf(query: StrategyQuery): readonly StrategyOpponentOrdering[] {
  const streetAggression = query.aggressionHistory.filter((entry) => entry.street === query.street);
  const lastAggressor = streetAggression[streetAggression.length - 1] ?? null;
  const hero = heroSeatOf(query);
  const heroOrder = hero === null ? null : actionOrderIndexOf(hero, query.street);

  return query.seats
    .filter((seat) => !seat.isHero)
    .map((seat) => {
      const actionOrderIndex = actionOrderIndexOf(seat, query.street);
      return {
        seatIndex: seat.seatIndex,
        isLive: seat.status === 'IN_HAND',
        actsAfterHero: heroOrder !== null && actionOrderIndex > heroOrder,
        isLastAggressorThisStreet:
          lastAggressor !== null && lastAggressor.position === seat.position,
        actionOrderIndex,
      };
    });
}

/** What the ADAPTIVE layer needs and the REFERENCE read model does not already carry. */
function adaptiveFactsOf(
  query: StrategyQuery,
  supplied: {
    readonly aggressionBand: AggressionBandId | null;
    readonly bucketIndex: number | null;
    readonly heroIsPreflopOpener: boolean;
  },
): StrategyAdaptiveFacts {
  const hero = heroSeatOf(query);
  return {
    // The engine's own test for "hero owes chips to continue" — `preflop/spot.ts` uses the
    // same predicate for `facingAllIn`. `!canCheck` would be a different question.
    heroFacingBet: Money.isPositive(query.callAmountMbb),
    activeOpponentCount: query.activeOpponentCount,
    aggressionBand: supplied.aggressionBand,
    heroIsPreflopOpener: supplied.heroIsPreflopOpener,
    heroStreetContributionMbb: hero === null ? Money.mbb(0) : hero.streetContributionMbb,
    bucketIndex: supplied.bucketIndex,
    wager: query.legalActions.wager,
    opponentOrderings: opponentOrderingsOf(query),
  };
}

function actualOf(query: StrategyQuery): StrategyActualView {
  const aggression = query.aggressionHistory.filter(
    (entry) => entry.street === query.street,
  );
  const last = aggression[aggression.length - 1] ?? null;
  return {
    effectiveStackMbb: query.effectiveStackMbb,
    potTotalMbb: query.potTotalMbb,
    dealtInCount: query.dealtInCount,
    heroInPosition: query.heroInPosition,
    lastAggressorPosition: last === null ? null : last.position,
    lastAggressorToAmountMbb: last === null ? null : last.toAmountMbb,
  };
}

/**
 * The action rows and the PRIMARY one. `primaryAction` is picked by the package's own
 * documented tie-break (highest frequency, ties to the least committing action) and is
 * simply matched here by kind — the emitted set has one row per kind by construction. This
 * file never re-picks a primary, and the badge it drives says 추천, never "correct"
 * (`docs/UX.md`).
 */
function rowsOf(
  recommendation: StrategyRecommendation | PostflopRecommendation,
  family: StrategySpotFamily,
): { readonly rows: readonly StrategyActionRow[]; readonly primary: StrategyActionRow } {
  const rows = recommendation.actions.map((action) => ({
    kind: action.kind,
    name: actionName(action.kind, family),
    frequencyBps: action.frequencyBps,
    percent: action.frequencyBps / 100,
    isPrimary: action.kind === recommendation.primaryAction.kind,
    toAmountMbb: action.toAmountMbb,
    isAllIn: action.isAllIn,
  }));
  const primary = rows.find((row) => row.isPrimary);
  if (primary === undefined) {
    // Unreachable: `primaryAction` is one of `actions`. Kept total rather than throwing a
    // TypeError three frames away inside React.
    throw new Error('the recommendation names a primary action that is not in its own set');
  }
  return { rows, primary };
}

function sizingOf(
  recommendation: StrategyRecommendation | PostflopRecommendation,
  family: StrategySpotFamily,
  potFractionPercent: number | null,
): StrategySizingView | null {
  const action = recommendation.actions.find((entry) => entry.sizing !== null);
  if (action === undefined || action.sizing === null) return null;
  return {
    kind: action.kind,
    name: actionName(action.kind, family),
    toAmountMbb: action.sizing.toAmountMbb,
    requestedToAmountMbb: action.sizing.requestedToAmountMbb,
    clamp: action.sizing.clamp,
    potFractionPercent,
    minToAmountMbb: action.sizing.minToAmountMbb,
    maxToAmountMbb: action.sizing.maxToAmountMbb,
    allIn: action.isAllIn,
  };
}

function fromPreflop(
  query: StrategyQuery,
  recommendation: StrategyRecommendation,
): StrategyPanelReady {
  const family: StrategySpotFamily = recommendation.family;
  const { rows, primary } = rowsOf(recommendation, family);
  return {
    kind: 'READY',
    street: 'PREFLOP',
    family,
    unsupportedReason: recommendation.unsupportedReason,
    potType: null,
    heroPosition: recommendation.heroPosition,
    handClassKey: recommendation.handClass.key,
    actions: rows,
    primary,
    sizing: sizingOf(recommendation, family, null),
    metrics: {
      spr: recommendation.metrics.spr,
      potOdds: recommendation.metrics.potOdds,
      requiredEquity: recommendation.metrics.requiredEquity,
      equity: null,
      equityMethod: null,
      potBeforeDecisionMbb: recommendation.metrics.potBeforeDecisionMbb,
      callAmountMbb: recommendation.metrics.callAmountMbb,
      stackBucket: recommendation.metrics.stackBucket,
    },
    quality: recommendation.provenance.quality,
    confidence: null,
    notes: recommendation.provenance.notes,
    ruleIds: recommendation.provenance.ruleIds,
    environment: recommendation.provenance.environmentCompatibility,
    actual: actualOf(query),
    adaptiveFacts: adaptiveFactsOf(query, {
      // Preflop carries no aggression band: the seven-band scale is the postflop scoring
      // model's, and preflop provenance has no gradation at all (`confidence` is null here
      // for the same reason).
      aggressionBand: null,
      // Preflop sizing is a raise-TO rule, not a rung of the pot-fraction ladder, so there is
      // no index to name — the same `null` `sizingOf` gets for `potFractionPercent`.
      bucketIndex: null,
      heroIsPreflopOpener: PREFLOP_OPENER_FAMILIES.includes(family),
    }),
  };
}

function fromPostflop(
  query: StrategyQuery,
  recommendation: PostflopRecommendation,
): StrategyPanelReady {
  const family: StrategySpotFamily = recommendation.family;
  const potFraction = potFractionOf(recommendation);
  const { rows, primary } = rowsOf(recommendation, family);
  return {
    kind: 'READY',
    street: recommendation.street,
    family,
    unsupportedReason: null,
    potType: recommendation.potType,
    heroPosition: recommendation.heroPosition,
    handClassKey: recommendation.handClass.key,
    actions: rows,
    primary,
    sizing: sizingOf(recommendation, family, potFraction),
    metrics: {
      spr: recommendation.metrics.spr,
      potOdds: recommendation.metrics.potOdds,
      requiredEquity: recommendation.metrics.requiredEquity,
      equity: recommendation.metrics.heroEquity,
      equityMethod: recommendation.metrics.heroEquityMethod,
      potBeforeDecisionMbb: recommendation.metrics.potBeforeDecisionMbb,
      callAmountMbb: recommendation.metrics.callAmountMbb,
      stackBucket: recommendation.metrics.stackBucket,
    },
    quality: recommendation.provenance.quality,
    confidence: recommendation.confidence,
    notes: recommendation.provenance.notes,
    ruleIds: recommendation.provenance.ruleIds,
    environment: recommendation.provenance.environmentCompatibility,
    actual: actualOf(query),
    adaptiveFacts: adaptiveFactsOf(query, {
      // READ, never re-derived. This is the engine's own band for this exact spot.
      aggressionBand: recommendation.scoring.aggressionBand.id,
      bucketIndex: bucketIndexOf(recommendation),
      // "Hero opens" is a preflop-only fact; every rule scoped to it also demands
      // `street === 'PREFLOP'`, so postflop it is simply absent rather than unknown.
      heroIsPreflopOpener: false,
    }),
  };
}

export interface ComputeStrategyOptions {
  /**
   * B3's documented work ceiling for the postflop engine. Every field bounds an
   * ENUMERATION SIZE rather than wall-clock time, so a slow machine returns the same
   * answer as a fast one.
   *
   * Deliberately EMPTY by default, and the reason has been corrected twice. B3 reported
   * ~87 ms for a heads-up flop and called it the worst shape, from a two-point sample that
   * never covered 4+ players. `postflop/benchmark.test.ts` now covers 2 through 6 and
   * measures the worst shape as a six-way limped flop at ~106 ms (~112 ms on a monotone
   * board) against ~90 ms heads-up on an M-series Mac; review R1B measured the same shape
   * at 130–153 ms through the real adapter. That is inside the 200 ms interaction budget
   * with roughly 1.8x headroom here and materially less on a mid-range laptop, so the lever
   * stays UNTUNED: tightening it would trade real accuracy (`EXACT` vs `SUBSAMPLED`, which
   * the panel reports) for headroom the measurement does not say is needed. Do not restate
   * ~87 ms, or "~2.3x headroom", as the worst case anywhere.
   */
  readonly budget?: PostflopBudget;
}

/**
 * Total. `HandState` in, a renderable panel model out — including for every refusal.
 *
 * Synchronous by contract. Nothing on this path awaits; see `StrategyPanel.tsx` for how the
 * CALL is scheduled so that the user's own action commits before any analysis starts. Note
 * what that scheduling does not buy: this function has no yield point, so once it has begun
 * it runs to completion on the main thread.
 *
 * **The parameter list is load-bearing for `prompt` §39.** `(HandState, heroSeat, options)`
 * is the whole input: no player model, no analysis snapshot, no database handle, not even an
 * optional one. That is what makes "an analysis run cannot change what the panel says" true
 * by construction rather than by discipline. Adding a player-derived argument — including as
 * an optional field on `ComputeStrategyOptions` — needs an ADR first, and would have to
 * defeat `packages/strategy-core/tests/layering.test.ts` on the way.
 */
export function computeStrategy(
  state: HandState,
  heroSeat: SeatIndex | null,
  options: ComputeStrategyOptions = {},
): StrategyPanelModel {
  const built = buildStrategyQuery(state, heroSeat === null ? {} : { heroSeat });
  if (!built.ok) {
    return { kind: 'REFUSED', code: built.error.code, message: built.error.message };
  }
  const query = built.value;

  if (query.street === 'PREFLOP') {
    const recommendation = recommendPreflop(query);
    if (!recommendation.ok) {
      return {
        kind: 'REFUSED',
        code: recommendation.error.code,
        message: recommendation.error.message,
      };
    }
    return fromPreflop(query, recommendation.value);
  }

  const recommendation = recommendPostflop(query, options.budget ?? {});
  if (!recommendation.ok) {
    return {
      kind: 'REFUSED',
      code: recommendation.error.code,
      message: recommendation.error.message,
    };
  }
  return fromPostflop(query, recommendation.value);
}

/** The function shape `StrategyPanel` schedules. Injected in tests so calls can be counted. */
export type StrategyCompute = (
  state: HandState,
  heroSeat: SeatIndex | null,
) => StrategyPanelModel;
