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
import type { MilliBB } from '@gto-self/shared';
import type { HandState, SeatIndex } from '@gto-self/poker-core';
import {
  buildStrategyQuery,
  recommendPostflop,
  recommendPreflop,
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
  type StrategyStreet,
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
 * The pot-fraction rung the postflop model selected, read out of the recommendation's own
 * `SIZING_BUCKET` explanation feature (`POT_33`, `POT_100`, `ALL_IN`). Parsing the token
 * the engine emitted is a field read; re-deriving the bucket from the money would be a
 * second, drifting copy of the sizing ladder.
 */
function potFractionOf(recommendation: PostflopRecommendation): number | null {
  const found = recommendation.explanation.features.find(
    (feature) => feature.id === 'SIZING_BUCKET',
  );
  const token = found?.token ?? null;
  if (token === null || !token.startsWith('POT_')) return null;
  const percent = Number(token.slice('POT_'.length));
  return Number.isInteger(percent) ? percent : null;
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
    name: actionName(action.kind, family),
    toAmountMbb: action.sizing.toAmountMbb,
    requestedToAmountMbb: action.sizing.requestedToAmountMbb,
    clamp: action.sizing.clamp,
    potFractionPercent,
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
