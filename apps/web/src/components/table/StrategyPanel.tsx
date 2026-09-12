'use client';

/**
 * 기본전략 · REFERENCE — the right column's strategy slot, shown while HERO is the seat on
 * the clock (`lib/table/rightPanel.ts`).
 *
 * ## What it promises
 *
 * Every number here came out of `@gto-self/strategy-core` and nothing here authors one
 * (`CLAUDE.md` rule 2). Frequencies are integer percents because the engine emits integer
 * basis points quantized to 5-point steps (ADR-0056) — a 63.72% is unrepresentable by
 * construction, not by convention. The top action carries 추천 / PRIMARY and is NEVER
 * called correct: mixed strategies are shown in full, in the engine's own least-to-most
 * committing order (`docs/UX.md`). The panel is not solved output and never says it is.
 *
 * ACTUAL and MODEL sit side by side, always (`docs/UX.md`, `CLAUDE.md` rule 3): the real
 * effective stack and the real last raise-TO against the stack bucket the policy looked up
 * and the reference environment those tables were authored for.
 *
 * ## Why the answer is SCHEDULED rather than computed in render
 *
 * A postflop recommendation is a real computation. B3 measured a heads-up flop at ~87 ms and
 * called it the worst shape; it is not, and the benchmark now says so in the repo rather than
 * in a review. `postflop/benchmark.test.ts` covers 2, 3, 4, 5 and 6 players and measures the
 * worst shape as a SIX-WAY LIMPED FLOP: ~106 ms there (~112 ms on a monotone board) against
 * ~90 ms for the heads-up flop, on an M-series Mac. An independent measurement through the
 * real adapter (review R1B, MAJOR-2) put the same shape at 130–153 ms. Take the worst case as
 * **~110–150 ms on this machine class, and 2–4x that on a mid-range laptop** — never ~87 ms.
 * ADR-0043 says the path from a keystroke to a visible change never waits on anything, and
 * that has to keep being true now that this panel exists.
 *
 * Two things make it true:
 *
 * 1. **Nothing is computed during render.** The commit that shows the fold, the new pot
 *    and the new actor contains no strategy work at all; the panel renders 계산 중… (or
 *    the previous answer, greyed and marked stale) and the transition is already on
 *    screen.
 * 2. **The compute is a macrotask, not the effect body.** The `useEffect` below only
 *    schedules a `setTimeout`; the analysis runs in a later task. This is the part that
 *    actually matters. React flushes pending passive effects SYNCHRONOUSLY at the start of
 *    the next discrete input it processes — so with the analysis inside the effect body,
 *    pressing `f` and then `c` 30 ms later would make the second keystroke wait for the
 *    first keystroke's analysis, *and* the user's own action would carry it. With the
 *    analysis in a timer, the effect body costs nothing to flush and the user's action
 *    commits before any analysis starts.
 *
 * ## What the timer does and does NOT cancel — stated precisely, because it matters
 *
 * `clearTimeout` supersedes a computation that has been SCHEDULED and has not STARTED. A
 * burst of six transitions inside one task therefore analyses the sixth state and never
 * begins the first five. That is the whole of the guarantee.
 *
 * It does not — and on a single main thread cannot — interrupt a computation that has
 * already begun. `computeStrategy` is one synchronous call with no yield point, so once
 * the timer fires the main thread is busy for the length of that call and an input arriving
 * in that window waits for the remainder of it. There is no worker and no time-slicing;
 * calling this design "cancellable" without that sentence overclaims, and an earlier
 * version of this comment did.
 *
 * Measured, on this machine class, for the worst shape (6-way limped flop, hero first to
 * act): `recommendPostflop` 119–130 ms total, of which the score/assembly phase is 0.0–0.3
 * ms (0.22%) and the equity phase is 119–122 ms. So yielding between the equity phase and
 * the policy phase would shorten the worst-case block by well under a millisecond, and it
 * was NOT adopted. Inside the equity phase the two dominant calls are `equityVsRanges`
 * (55–62 ms) and `equityDistribution` (63–64 ms); a yield BETWEEN those two would roughly
 * halve the block, but it needs a resumable two-phase context in `strategy-core` rather than
 * a change here, and is recorded as a follow-up in `docs/reports/STRATEGY_FIX_POSTFLOP.md`.
 *
 * `useEffect`'s dependency is the `Hand` OBJECT. `tableStore` commits a new immutable
 * `Hand` on every transition and never mutates one, so object identity IS state identity:
 * a re-render caused by anything else — a seat selection, a top-up chip, a keystroke in
 * the raise editor — cannot re-run the analysis. `StrategyPanel.test.tsx` counts the
 * calls to prove it, and counts STARTS against COMPLETIONS to pin the paragraph above.
 *
 * There is no `await`, no `fetch`, no server action and no worker anywhere on this path.
 */
/*
 * ## WP-7: BOTH answers, at once, and never a choice between them
 *
 * This panel used to carry a mode selector — 기본전략 · REFERENCE or 상대 적응 · ADAPTIVE, one
 * at a time. It is gone. At a hero decision the two sections render TOGETHER, REFERENCE above
 * and ADAPTIVE below, because the only useful reading of an exploit is against the baseline it
 * departed from: "BET 64%" means nothing until "BET 60%" is beside it, and a delta the user
 * has to reconstruct by clicking back and forth is a delta they will get wrong.
 *
 * Nothing about the COMPUTATION changed with that. REFERENCE is still analysed in a scheduled
 * macrotask and ADAPTIVE is still composed in a render-time memo over the analysed model, with
 * disjoint dependency lists — the whole point of that split (see the note on the memo below) is
 * that opponent data cannot reach the REFERENCE effect, and showing both sections at once does
 * not put it there. `StrategyPanel.test.tsx` still counts `compute` to prove it.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { Hand, SeatIndex } from '@gto-self/poker-core';
import { ADAPTIVE_NOTE_SCOPE, maxTotalShiftBpsFor } from '@gto-self/adaptive-core';
import type {
  AdaptiveAction,
  AdaptiveAdjustment,
  AdaptiveRecommendation,
} from '@gto-self/adaptive-core';
import {
  ADAPTIVE_CAP_APPLIED_LABEL,
  ADAPTIVE_CAP_LABEL,
  ADAPTIVE_DELTA_LABEL,
  ADAPTIVE_ENGINE_LABEL,
  ADAPTIVE_NO_CHANGE_LABEL,
  ADAPTIVE_NO_OPPONENT_DATA_LABEL,
  ADAPTIVE_NOT_APPLICABLE_NOTICE,
  ADAPTIVE_REASON_LABEL,
  ADAPTIVE_REASONS_HEADING,
  ADAPTIVE_RULE_LABEL,
  ADAPTIVE_SAME_AS_REFERENCE_LABEL,
  ADAPTIVE_STAT_LABEL,
  ADAPTIVE_STATUS_LABEL,
  ADAPTIVE_UNCHANGED_LABEL,
  ADAPTIVE_UNCHANGED_PLAIN_REASON,
  ADAPTIVE_UNKNOWN_OPPONENT_LABEL,
  adaptiveBaselinePrimaryLabel,
  adaptiveNoteLabel,
  adaptiveOpponentLabel,
  adaptiveProvenanceLabel,
  adaptiveSampleLabel,
  adaptiveShiftLabel,
  adaptiveStatusReasonLabel,
  bpsAmountLabel,
  bpsPercentLabel,
  seatLabel,
  signedBpsPointsLabel,
  sizingClampNote,
  sizingStepLabel,
  SIZING_RECOMMENDATION_LABEL,
  CONFIDENCE_LABEL,
  ENVIRONMENT_FACTOR_LABEL,
  ENVIRONMENT_STATUS_LABEL,
  EQUITY_METHOD_LABEL,
  POSITION_LABEL,
  POT_TYPE_LABEL,
  PROVENANCE_LABEL,
  STRATEGY_ENGINE_LABEL,
  STRATEGY_ERROR_LABEL,
  STRATEGY_FAMILY_LABEL,
  STRATEGY_PRIMARY_BADGE,
  STRATEGY_UNSUPPORTED_REASON_LABEL,
  STREET_LABEL,
  ratioPercentLabel,
  sprLabel,
  RECOMMENDATION_HEADLINE_LABEL,
  COMPARISON_ADAPTIVE_ROW_LABEL,
  COMPARISON_BASELINE_ROW_LABEL,
  COMPARISON_DELTA_ROW_LABEL,
  REASON_DISCLOSURE_LABEL,
  TECHNICAL_DETAIL_DISCLOSURE_LABEL,
} from '../../lib/table/copy.js';
import {
  ALL_IN_NAME,
  computeStrategy,
  type StrategyActionRow,
  type StrategyCompute,
  type StrategyPanelModel,
  type StrategyPanelReady,
  type StrategySizingView,
} from '../../lib/table/strategy.js';
import { computeAdaptive } from '../../lib/table/adaptive.js';
import { adaptiveOpponentList, type AdaptiveInputMap } from '../../lib/table/adaptiveStore.js';
import { useTableStore } from './TableStoreProvider.js';

/** Stable module-level identity, so the default never re-triggers the effect. */
const DEFAULT_COMPUTE: StrategyCompute = (state, heroSeat) => computeStrategy(state, heroSeat);

/** Stable module-level identity, so the default never re-triggers the ADAPTIVE memo. */
const NO_OPPONENT_INPUTS: AdaptiveInputMap = {};

const bb = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3 });
const bbUnit = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3, unit: true });

/**
 * The recommended-size line, as plain text (FAST TABLE UX V3's headline banner).
 *
 * Same ternary as `Ready`'s own `strategy-sizing` paragraph below — duplicated rather than
 * extracted, because the two render into different shapes (this one has no clamp
 * annotation, no `data-*` attributes, and lives in a different component tree) and forcing
 * one helper to serve both would couple two call sites that are free to diverge.
 */
function sizingLabelOf(sizing: StrategySizingView): string {
  if (sizing.allIn) {
    return sizing.potFractionPercent === null
      ? `${ALL_IN_NAME} · ${bbUnit(sizing.toAmountMbb)}`
      : `${ALL_IN_NAME} · ${bbUnit(sizing.toAmountMbb)} (${sizing.potFractionPercent}% POT)`;
  }
  return sizing.potFractionPercent === null
    ? `${sizing.name} TO ${bbUnit(sizing.toAmountMbb)}`
    : `${sizing.potFractionPercent}% POT · ${bbUnit(sizing.toAmountMbb)}`;
}

interface Computed {
  readonly hand: Hand;
  readonly heroSeat: SeatIndex | null;
  readonly model: StrategyPanelModel;
}

export interface StrategyPanelProps {
  /**
   * Injected in tests so the calls can be COUNTED — the memoization claim above is only
   * worth making if something checks it. The app never passes this.
   */
  readonly compute?: StrategyCompute;
  /**
   * The 상대 적응 store's opponent inputs, keyed by player id (`lib/table/adaptiveStore.ts`).
   * Threaded as a prop rather than read from a context so this component stays free of any
   * dependency on how — or whether — the inputs were loaded.
   */
  readonly opponentInputs?: AdaptiveInputMap;
  /**
   * The store's monotonic change counter. It is the memo's explicit dependency (WP-J design
   * contract §6): when a HUD reading is saved mid-hand this number changes, ADAPTIVE
   * recomputes, and the REFERENCE effect below — whose dependency is the `Hand` identity —
   * cannot see the difference.
   */
  readonly adaptiveVersion?: number;
}

export function StrategyPanel({
  compute = DEFAULT_COMPUTE,
  opponentInputs = NO_OPPONENT_INPUTS,
  adaptiveVersion = 0,
}: StrategyPanelProps = {}) {
  const hand = useTableStore((state) => state.hand);
  const heroSeat = useTableStore((state) => state.table.heroSeat);

  const [computed, setComputed] = useState<Computed | null>(null);

  useEffect(() => {
    if (hand === null) {
      setComputed(null);
      return;
    }
    // The effect body is deliberately trivial. See the header: a flush of THIS effect must
    // never be able to sit in front of the user's next keystroke.
    const timer = window.setTimeout(() => {
      setComputed({ hand, heroSeat, model: compute(hand.state, heroSeat) });
    }, 0);
    // Supersedes a computation that has not STARTED. It cannot stop one that has — see the
    // header; `computeStrategy` is one synchronous call with no yield point.
    return () => window.clearTimeout(timer);
  }, [hand, heroSeat, compute]);

  /**
   * 상대 적응 · ADAPTIVE, IN RENDER — deliberately not a second effect (WP-J §6).
   *
   * The whole composition is integer arithmetic over a handful of small arrays: no equity, no
   * ranges, no board analysis, no clock, no `await` (`lib/table/adaptive.ts` states that from
   * the other side). It is nowhere near the 110-150 ms the header is written around, so
   * scheduling it would buy nothing and would put the panel a task behind the store.
   *
   * WHAT THIS BUYS, AND IT IS THE POINT OF THE WHOLE WORK PACKAGE: the dependency list here
   * has no `Hand` in it beyond the one already analysed, and the REFERENCE effect's dependency
   * list has no opponent data in it at all. A HUD reading saved mid-hand therefore recomputes
   * ADAPTIVE and CANNOT recompute REFERENCE. `StrategyPanel.test.tsx` counts `compute` across
   * both to prove it.
   *
   * `computed` (not `hand`) is the dependency, because the baseline ADAPTIVE composes over is
   * the analysed model, not whatever state has settled since. The seat -> player mapping is
   * read off the SAME hand for the same reason: a mapping taken from the live table could
   * name a lineup the baseline never saw.
   */
  const adaptive = useMemo<AdaptiveRecommendation | null>(() => {
    if (computed === null) return null;
    const seatPlayerIds = new Map<number, string>();
    for (const seat of SEAT_INDEXES) {
      const playerId = computed.hand.state.seats[seat].playerId;
      if (playerId !== null) seatPlayerIds.set(seat, playerId);
    }
    return computeAdaptive(computed.model, adaptiveOpponentList(opponentInputs), seatPlayerIds);
    // `adaptiveVersion` is the store's own change signal and is listed on purpose: the map
    // identity already changes on every mutation, and the counter is what keeps that true if
    // the store is ever given an in-place edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, opponentInputs, adaptiveVersion]);

  const fresh = computed !== null && computed.hand === hand && computed.heroSeat === heroSeat;
  const model = computed?.model ?? null;
  const ready = model !== null && model.kind === 'READY' ? model : null;
  // Rendered BELOW the REFERENCE section, in every state (WP-7). There is no state in which
  // one section exists and the other does not: ADAPTIVE answers 이 상황에는 적용하지 않습니다
  // where there is nothing to compose on, which is an answer, not an absence.
  const shell = {
    adaptiveSlot: <AdaptiveSection adaptive={adaptive} ready={ready} />,
    // FAST TABLE UX V3: the at-a-glance headline, rendered ABOVE both sections. `null`
    // outside READY — there is nothing to headline while there is no hand or a refusal, and
    // the sections below already say so.
    banner:
      ready !== null ? (
        <>
          <RecommendationBanner model={ready} adaptive={adaptive} />
          <ComparisonBlock model={ready} adaptive={adaptive} />
        </>
      ) : null,
  };

  if (hand === null || model === null) {
    return (
      <Shell {...shell} state={hand === null ? 'NO_HAND' : 'COMPUTING'} stale={false}>
        <p data-testid="strategy-computing" className="text-xs text-ink-500">
          {hand === null ? '진행 중인 핸드가 없습니다.' : '계산 중…'}
        </p>
      </Shell>
    );
  }

  if (model.kind === 'NO_HAND') {
    return (
      <Shell {...shell} state="NO_HAND" stale={!fresh}>
        <p data-testid="strategy-computing" className="text-xs text-ink-500">
          진행 중인 핸드가 없습니다.
        </p>
      </Shell>
    );
  }

  if (model.kind === 'REFUSED') {
    return (
      <Shell {...shell} state="REFUSED" stale={!fresh}>
        {/* The engine's own code and message are kept VERBATIM inside the Korean frame
            (`CLAUDE.md` rule 3): the user sees the engine's verdict, not a paraphrase.
            Nothing is guessed to fill the gap. */}
        <p
          data-testid="strategy-refusal"
          data-code={model.code}
          className="text-xs font-medium text-ink-300"
        >
          {STRATEGY_ERROR_LABEL[model.code]}
        </p>
        <p
          data-testid="strategy-refusal-detail"
          className="text-[0.65rem] leading-snug text-ink-700"
        >
          <span className="font-semibold">{model.code}</span> · {model.message}
        </p>
      </Shell>
    );
  }

  return (
    <Shell {...shell} state="READY" stale={!fresh} model={model}>
      <Ready model={model} />
    </Shell>
  );
}

interface ShellProps {
  readonly state: 'READY' | 'REFUSED' | 'COMPUTING' | 'NO_HAND';
  readonly stale: boolean;
  readonly model?: StrategyPanelReady;
  /** The 상대 적응 block. Always present (WP-7); rendered BELOW `children`. */
  readonly adaptiveSlot: ReactNode;
  /** FAST TABLE UX V3's headline banner + comparison block. `null` outside READY. */
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The two sections and the machine-readable attributes. Every E2E assertion addresses this
 * panel through them rather than through copy (ADR-0053's testing rule).
 *
 * `strategy-reference-section` and `strategy-adaptive-section` are BOTH rendered in every
 * state, including `REFUSED` and `NO_HAND` — the mode selector that used to choose between
 * them is gone (WP-7). A section that vanished whenever its engine had nothing to say would
 * leave the user unable to tell whether it exists at all in that spot; each one is there, and
 * each answers honestly, including "there is nothing here to adapt".
 *
 * `stale` dims and marks the REFERENCE section only. ADAPTIVE is composed over the analysed
 * model, so it is exactly as old as REFERENCE is and one 이전 상황 기준 flag covers both.
 */
function Shell({ state, stale, model, adaptiveSlot, banner, children }: ShellProps) {
  return (
    <section
      data-testid="strategy-panel"
      data-state={state}
      data-stale={stale ? 'true' : 'false'}
      data-street={model?.street ?? ''}
      data-family={model?.family ?? ''}
      data-quality={model?.quality ?? ''}
      data-confidence={model?.confidence ?? ''}
      data-primary={model?.primary.kind ?? ''}
      aria-label="전략"
      className={`flex flex-col gap-2 ${stale ? 'opacity-50' : ''}`}
    >
      {banner}
      <section
        data-testid="strategy-reference-section"
        aria-label={STRATEGY_ENGINE_LABEL}
        className="flex flex-col gap-1.5"
      >
        <h2 className="flex items-baseline gap-2 text-[0.65rem] uppercase tracking-widest text-ink-500">
          <span data-testid="strategy-engine-label" className="normal-case tracking-normal">
            {STRATEGY_ENGINE_LABEL}
          </span>
          {stale && (
            <span data-testid="strategy-stale" className="text-dirty-500">
              이전 상황 기준
            </span>
          )}
        </h2>
        {children}
      </section>
      <section
        data-testid="strategy-adaptive-section"
        aria-label={ADAPTIVE_ENGINE_LABEL}
        className="flex flex-col gap-1.5"
      >
        {adaptiveSlot}
      </section>
    </section>
  );
}

/**
 * FAST TABLE UX V3 §1 — "지금 무엇을 해야 하나", read in under a second.
 *
 * Renders whichever primary is AUTHORITATIVE right now: the adapted primary when 상대 맞춤
 * 전략 actually changed something (`status === 'ADAPTED' && changedFromBaseline`), else
 * 기본전략's own primary. Nothing here is computed — every field is read straight off
 * `model`/`adaptive`, which `StrategyPanel` already finished computing before this renders.
 */
function RecommendationBanner({
  model,
  adaptive,
}: {
  readonly model: StrategyPanelReady;
  readonly adaptive: AdaptiveRecommendation | null;
}) {
  const names = new Map(model.actions.map((action) => [action.kind, action.name]));

  let actionName = model.primary.name;
  let sizeLabel: string | null = model.sizing !== null ? sizingLabelOf(model.sizing) : null;
  let source: 'ADAPTIVE' | 'REFERENCE' = 'REFERENCE';

  if (
    adaptive !== null &&
    adaptive.status === 'ADAPTED' &&
    adaptive.changedFromBaseline &&
    adaptive.primaryAction !== null
  ) {
    const primary = adaptive.primaryAction;
    actionName = names.get(primary.kind) ?? primary.kind;
    source = 'ADAPTIVE';
    if (adaptive.sizing !== null) {
      sizeLabel = sizeText(adaptive.sizing.toPotFractionPercent, adaptive.sizing.toToAmountMbb);
    }
  }

  return (
    <section
      data-testid="strategy-recommendation-banner"
      data-source={source}
      aria-label={RECOMMENDATION_HEADLINE_LABEL}
      className="flex flex-col items-center gap-1 rounded-md border border-good-500 bg-surface-900 px-3 py-3 text-center"
    >
      <span className="text-[0.6rem] uppercase tracking-widest text-ink-500">
        {RECOMMENDATION_HEADLINE_LABEL}
      </span>
      <span
        data-testid="strategy-recommendation-action"
        className="text-2xl font-bold tracking-wide text-ink-100"
      >
        {actionName}
      </span>
      {sizeLabel !== null && (
        <span
          data-testid="strategy-recommendation-sizing"
          className="tabular text-lg font-semibold text-good-500"
        >
          {sizeLabel}
        </span>
      )}
    </section>
  );
}

/**
 * FAST TABLE UX V3 §1 — 기본전략 and 상대 맞춤 전략 frequencies, and their delta, always
 * together (same reasoning as WP-7's `AdaptiveSection`, pulled up so it reads immediately
 * under the banner rather than buried below the full REFERENCE readout).
 *
 * When there is nothing to adapt (`adaptive === null`) or nothing cleared its gate
 * (`INSUFFICIENT_DATA`), only 기본전략 is shown — inventing an adaptive frequency here would
 * be exactly the fabrication `CLAUDE.md` rules 2 and 5 forbid, and `AdaptiveSection` below
 * already says so in full.
 */
function ComparisonBlock({
  model,
  adaptive,
}: {
  readonly model: StrategyPanelReady;
  readonly adaptive: AdaptiveRecommendation | null;
}) {
  const names = new Map(model.actions.map((action) => [action.kind, action.name]));
  const baselineLine = model.actions.map((action) => `${action.name} ${action.percent}%`).join('   ');

  if (adaptive === null || adaptive.status !== 'ADAPTED') {
    return (
      <div data-testid="strategy-comparison" className="flex flex-col gap-0.5 text-[0.7rem]">
        <p data-testid="strategy-comparison-baseline" className="tabular text-ink-100">
          <span className="text-ink-500">{COMPARISON_BASELINE_ROW_LABEL} </span>
          {baselineLine}
        </p>
      </div>
    );
  }

  const adaptiveLine = adaptive.actions
    .map((action) => `${names.get(action.kind) ?? action.kind} ${action.frequencyBps / 100}%`)
    .join('   ');
  const deltaLine = adaptive.actions
    .map((action) => `${names.get(action.kind) ?? action.kind} ${signedBpsPointsLabel(action.deltaBps)}`)
    .join('   ');

  return (
    <div data-testid="strategy-comparison" className="flex flex-col gap-0.5 text-[0.7rem]">
      <p data-testid="strategy-comparison-adaptive" className="tabular text-ink-100">
        <span className="text-ink-500">{COMPARISON_ADAPTIVE_ROW_LABEL} </span>
        {adaptiveLine}
      </p>
      <p data-testid="strategy-comparison-baseline" className="tabular text-ink-300">
        <span className="text-ink-500">{COMPARISON_BASELINE_ROW_LABEL} </span>
        {baselineLine}
      </p>
      {adaptive.changedFromBaseline && (
        <p data-testid="strategy-comparison-delta" className="tabular text-ink-500">
          <span className="text-ink-700">{COMPARISON_DELTA_ROW_LABEL} </span>
          {deltaLine}
        </p>
      )}
    </div>
  );
}

function Ready({ model }: { readonly model: StrategyPanelReady }) {
  const bucket = model.metrics.stackBucket;
  const divergent = model.environment.factors.filter((factor) => factor.status === 'DIVERGENT');

  return (
    <>
      {/* Spot, in the engine's own words. */}
      <p data-testid="strategy-spot" className="text-[0.7rem] text-ink-300">
        <span className="tabular">{STREET_LABEL[model.street]}</span>
        {' · '}
        <span data-testid="strategy-position">{POSITION_LABEL[model.heroPosition]}</span>
        {' · '}
        <span data-testid="strategy-family">{STRATEGY_FAMILY_LABEL[model.family]}</span>
        {model.potType !== null && ` · ${POT_TYPE_LABEL[model.potType]}`}
        {' · '}
        <span data-testid="strategy-hand-class" className="tabular">
          {model.handClassKey}
        </span>
      </p>

      {/* A line the preflop policy could not classify. Said plainly, still with its
          frequencies, because the policy's fallback is a real answer and hiding it would
          be worse than labelling it. */}
      {model.unsupportedReason !== null && (
        <p
          data-testid="strategy-unsupported"
          data-reason={model.unsupportedReason}
          className="text-[0.65rem] text-dirty-500"
        >
          지원하지 않는 상황: {STRATEGY_UNSUPPORTED_REASON_LABEL[model.unsupportedReason]}
        </p>
      )}

      {/* ACTUAL | MODEL, side by side and never collapsed into one (`docs/UX.md`). */}
      <div className="grid grid-cols-2 gap-x-3 rounded border border-surface-700 bg-surface-900 px-2 py-1 text-[0.65rem]">
        <span className="uppercase tracking-widest text-ink-700">실제</span>
        <span className="uppercase tracking-widest text-ink-700">기준 모델</span>

        <span data-testid="strategy-actual-stack" className="tabular text-ink-300">
          유효 스택 {bbUnit(model.actual.effectiveStackMbb)}
        </span>
        <span data-testid="strategy-model-bucket" className="tabular text-ink-300">
          {bucket.kind === 'BUCKET' ? bucket.bucket.label : `${bb(bucket.minimumMbb)} BB 미만`}
        </span>

        <span data-testid="strategy-actual-aggression" className="tabular text-ink-300">
          {model.actual.lastAggressorPosition === null ||
          model.actual.lastAggressorToAmountMbb === null
            ? '이번 스트리트 벳 없음'
            : `${POSITION_LABEL[model.actual.lastAggressorPosition]} ${bbUnit(
                model.actual.lastAggressorToAmountMbb,
              )}`}
        </span>
        {/* No "model open size" is printed here on purpose: the reference tables state a
            hero sizing rule, not an opponent's. Printing 2.5 BB beside a real 2.37 BB open
            would be a number no source supports (`CLAUDE.md` rule 2). The reference
            ENVIRONMENT is what the model actually assumes, so that is what is shown. */}
        <span data-testid="strategy-model-environment" className="text-ink-300">
          {model.environment.factors.find((factor) => factor.id === 'GAME_FORMAT')?.token ?? '—'}
        </span>
      </div>

      {/* Every available action, in the engine's own least-to-most-committing order. */}
      <ul data-testid="strategy-actions" className="flex flex-col gap-0.5">
        {model.actions.map((action) => (
          <ActionRow key={action.kind} action={action} />
        ))}
      </ul>

      {model.sizing !== null && (
        <p
          data-testid="strategy-sizing"
          data-all-in={model.sizing.allIn ? 'true' : 'false'}
          className="tabular text-[0.7rem] text-ink-300"
        >
          <span className="text-ink-500">{SIZING_RECOMMENDATION_LABEL} </span>
          {/* A recommended size that IS the stack is said so, in place of the pot-fraction or
              raise-TO wording. `sizing.allIn` is the engine's flag on the aggressive action;
              it was computed here and never rendered, which is how `BET TO 25 BB` shipped for
              a shove. The pot rung is still shown beside it, because the model did choose one
              and dropping it would hide how the size was reached (`CLAUDE.md` rule 3). */}
          {model.sizing.allIn
            ? `${ALL_IN_NAME} · ${bbUnit(model.sizing.toAmountMbb)}${
                model.sizing.potFractionPercent === null
                  ? ''
                  : ` (${model.sizing.potFractionPercent}% POT)`
              }`
            : model.sizing.potFractionPercent === null
              ? `${model.sizing.name} TO ${bbUnit(model.sizing.toAmountMbb)}`
              : `${model.sizing.potFractionPercent}% POT · ${bbUnit(model.sizing.toAmountMbb)}`}
          {model.sizing.clamp !== 'NONE' && (
            <span data-testid="strategy-sizing-clamp" className="text-dirty-500">
              {' '}
              ({sizingClampNote(model.sizing.clamp, bbUnit(model.sizing.requestedToAmountMbb))})
            </span>
          )}
        </p>
      )}

      {/* 추천 이유 (FAST TABLE UX V3 §3) — closed by default. `<details>` keeps its content
          IN THE DOM (just visually collapsed), so every test below still finds these nodes
          regardless of open/closed state; only the disclosure's own open/closed state is new. */}
      {model.notes.length > 0 && (
        <details data-testid="strategy-reason-detail">
          <summary className="cursor-pointer text-[0.65rem] text-ink-500">
            {REASON_DISCLOSURE_LABEL} ▾
          </summary>
          <ul
            data-testid="strategy-notes"
            className="mt-1 flex flex-col gap-0.5 text-[0.6rem] text-ink-700"
          >
            {model.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}

      {/* 상세 데이터 보기 (FAST TABLE UX V3 §3/§8) — closed by default. Equity/pot-odds/SPR,
          the raw `Provenance`/`confidence` enum values and the environment caveat are all
          "필요할 때만 보여야 하는 것" (prompt §8), not part of the fast read above. */}
      <details data-testid="strategy-technical-detail">
        <summary className="cursor-pointer text-[0.65rem] text-ink-500">
          {TECHNICAL_DETAIL_DISCLOSURE_LABEL} ▾
        </summary>
        <div className="mt-1 flex flex-col gap-1.5">
          {/* Metrics. Each one is a field read; `—` where the engine reports none. */}
          <p className="tabular flex flex-wrap gap-x-3 text-[0.65rem] text-ink-500">
            <span data-testid="strategy-equity">
              Equity{' '}
              {model.metrics.equity === null ? '—' : ratioPercentLabel(model.metrics.equity)}
              {model.metrics.equityMethod !== null &&
                ` (${EQUITY_METHOD_LABEL[model.metrics.equityMethod]})`}
            </span>
            <span data-testid="strategy-pot-odds">
              팟오즈{' '}
              {model.metrics.potOdds === null ? '—' : ratioPercentLabel(model.metrics.potOdds)}
            </span>
            <span data-testid="strategy-spr">
              SPR {model.metrics.spr === null ? '—' : sprLabel(model.metrics.spr)}
            </span>
            <span data-testid="strategy-pot">팟 {bbUnit(model.metrics.potBeforeDecisionMbb)}</span>
          </p>

          {/* 품질: how the number was produced, not whether it is real (ADR-0056). */}
          <p data-testid="strategy-quality" className="text-[0.65rem] text-ink-500">
            품질 {PROVENANCE_LABEL[model.quality]} ({model.quality})
            {model.confidence !== null && ` · 신뢰도 ${CONFIDENCE_LABEL[model.confidence]}`}
          </p>

          {/* The environment caveat, INLINE and non-blocking — `docs/UX.md`'s interruption
              policy is explicit that a caveat shown in place costs nothing and a modal breaks
              the session. */}
          <p
            data-testid="strategy-environment"
            data-status={model.environment.status}
            className={`text-[0.65rem] leading-snug ${
              model.environment.status === 'DIVERGENT' ? 'text-dirty-500' : 'text-ink-700'
            }`}
          >
            환경 {ENVIRONMENT_STATUS_LABEL[model.environment.status]}
            {divergent.length > 0 &&
              `: ${divergent.map((factor) => ENVIRONMENT_FACTOR_LABEL[factor.id]).join(', ')}`}
          </p>
        </div>
      </details>
    </>
  );
}

function ActionRow({ action }: { readonly action: StrategyActionRow }) {
  return (
    <li
      data-testid={`strategy-action-${action.kind}`}
      data-kind={action.kind}
      data-name={action.name}
      data-percent={action.percent}
      data-primary={action.isPrimary ? 'true' : 'false'}
      className={`flex items-baseline gap-2 rounded px-1.5 py-0.5 text-xs ${
        action.isPrimary ? 'bg-surface-700 text-ink-100' : 'text-ink-300'
      }`}
    >
      <span className="w-[4.5rem] shrink-0 font-semibold tracking-wide">{action.name}</span>
      <span data-testid={`strategy-frequency-${action.kind}`} className="tabular w-10 text-right">
        {action.percent}%
      </span>
      {action.toAmountMbb !== null && (
        /* An all-in is not a bet-TO like any other: it is the last chip, and rendering a
           recommended shove as `TO 25 BB` hides the only fact about it that matters. The
           engine's own `isAllIn` decides — this file does not compare the amount to a stack. */
        <span
          data-testid={`strategy-amount-${action.kind}`}
          data-all-in={action.isAllIn ? 'true' : 'false'}
          className={`tabular text-[0.65rem] ${
            action.isAllIn ? 'font-semibold text-dirty-500' : 'text-ink-500'
          }`}
        >
          {action.isAllIn
            ? `${ALL_IN_NAME} · ${bbUnit(action.toAmountMbb)}`
            : `TO ${bbUnit(action.toAmountMbb)}`}
        </span>
      )}
      {action.isPrimary && (
        <span
          data-testid="strategy-primary-badge"
          className="ml-auto rounded border border-good-500 px-1 text-[0.6rem] text-good-500"
        >
          {STRATEGY_PRIMARY_BADGE}
        </span>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 상대 적응 · ADAPTIVE                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Internal. Who a number is about.
 *
 * Every rule in the policy table is keyed to ONE villain, so an explanation that does not name
 * them is unreadable at a six-handed table. `nickname` is the name the user gave the player;
 * a seat with no nickname falls back to the seat, which is still a thing the user can look at.
 */
function opponentLabel(adaptive: AdaptiveRecommendation, playerId: string): string {
  const summary = adaptive.opponents.find((opponent) => opponent.playerId === playerId);
  if (summary === undefined) return ADAPTIVE_UNKNOWN_OPPONENT_LABEL;
  return summary.nickname ?? seatLabel(summary.seatIndex);
}

/** Internal. A pot-fraction rung and its amount, or a bare raise-TO when there is no rung. */
function sizeText(potFractionPercent: number | null, amount: MilliBB): string {
  return potFractionPercent === null
    ? `TO ${bbUnit(amount)}`
    : `${potFractionPercent}% POT · ${bbUnit(amount)}`;
}

/**
 * One line of 이유: what was read, over how many observations, and how sure we are.
 *
 * All four numbers are the adjustment's own fields. Nothing is recomputed here and nothing is
 * rounded that the engine did not already quantize — `estimateBps` and `confidenceBps` are
 * integer basis points, shown as whole percents.
 */
function ReasonRow({
  adjustment,
  adaptive,
}: {
  readonly adjustment: AdaptiveAdjustment;
  readonly adaptive: AdaptiveRecommendation;
}) {
  return (
    <li
      data-testid={`adaptive-reason-${adjustment.ruleId}`}
      data-rule={adjustment.ruleId}
      data-stat={adjustment.stat}
      data-sample={adjustment.sampleN}
      data-capped-by={adjustment.cappedBy ?? ''}
      className="leading-snug"
      title={ADAPTIVE_RULE_LABEL[adjustment.ruleId]}
    >
      <span className="text-ink-500">{opponentLabel(adaptive, adjustment.opponentPlayerId)}</span>{' '}
      <span className="text-ink-300">{ADAPTIVE_STAT_LABEL[adjustment.stat]}</span>{' '}
      <span className="tabular">{bpsPercentLabel(adjustment.estimateBps)}</span>{' '}
      <span className="tabular text-ink-700">
        {adaptiveSampleLabel(adjustment.sampleN, adjustment.confidenceBps)}
      </span>{' '}
      <span className="text-ink-500">· {ADAPTIVE_REASON_LABEL[adjustment.reasonKey]}</span>
      {adjustment.cappedBy !== null && (
        <span className="text-dirty-500"> · {ADAPTIVE_CAP_LABEL[adjustment.cappedBy]}</span>
      )}
      {/*
        `prompt` §8: "숫자를 나열하는 것으로 끝내지 말고, 이 숫자가 왜 현재 Hero 전략을 올리거나
        내렸는지를 한글로 설명한다." `ADAPTIVE_RULE_LABEL` already reads as exactly that
        sentence ("관찰 → 그래서 이렇게 반영") — it was previously only a hover `title`, which
        fails the same section's "tooltip에만 의존하지 말라" instruction. Shown here as a
        second, visible line instead of duplicating its wording inline.
      */}
      <p data-testid={`adaptive-reason-narrative-${adjustment.ruleId}`} className="text-ink-700">
        → {ADAPTIVE_RULE_LABEL[adjustment.ruleId]}
      </p>
      {/*
        CLAUDE.md rule 3: BOTH the entered value and the normalized one are shown. `n=` above
        is the EFFECTIVE sample this stat was given — for a manual HUD reading that is a small
        fraction of the hand count the user typed, because a snapshot-wide hand count is not
        this stat's opportunity count. Showing only the effective number would silently
        contradict the figure the user can see in their own HUD panel, so each source's own
        caveat is rendered verbatim beside it.
      */}
      {adjustment.sources.map(
        (source) =>
          source.note !== null && (
            <span
              key={source.source}
              data-testid={`adaptive-source-note-${source.source}`}
              className="block text-[0.6rem] text-ink-700"
            >
              {source.note}
            </span>
          ),
      )}
    </li>
  );
}

/** One row of the adapted mix, with the signed distance from what REFERENCE said. */
function AdaptiveActionRow({
  action,
  name,
}: {
  readonly action: AdaptiveAction;
  readonly name: string;
}) {
  return (
    <li
      data-testid={`adaptive-action-${action.kind}`}
      data-kind={action.kind}
      data-percent={action.frequencyBps / 100}
      data-delta={action.deltaBps}
      className="flex items-baseline gap-2 px-1.5 text-[0.7rem] text-ink-300"
    >
      <span className="w-[4.5rem] shrink-0 font-semibold tracking-wide">{name}</span>
      <span className="tabular w-10 text-right">{action.frequencyBps / 100}%</span>
      {/*
        A moved row is EMPHASISED, never coloured by its sign. `-10%p` in the same green as
        `+10%p` reads as "we approve of this direction", and a frequency delta has no such
        valence: adapting toward folding more is exactly as correct an answer as adapting
        toward betting more. Brightness says "this moved"; nothing says "this is good".

        The number is `deltaBps` STRAIGHT OFF the engine — nothing here subtracts one
        frequency from another (WP-7). Its unit is percentage POINTS, which is why it is
        `signedBpsPointsLabel` and not the plain percent formatter: `+4%` beside `64%` reads
        as 4% of 64.
      */}
      <span
        data-testid={`adaptive-delta-${action.kind}`}
        className={`tabular w-16 text-right ${
          action.deltaBps === 0 ? 'text-ink-700' : 'text-ink-100'
        }`}
      >
        {signedBpsPointsLabel(action.deltaBps)}
      </span>
    </li>
  );
}

/**
 * The 상대 적응 block (WP-J design contract §8).
 *
 * FOUR RENDERED STATES, and the distinction between the middle two is the one that matters:
 *
 * 1. `adaptive === null` — no hand, a refusal, or a preflop line the REFERENCE engine itself
 *    disclaims. Composing an exploit on top of an answer the engine says it does not model
 *    would present a player-specific recommendation derived from a non-answer, so the panel
 *    says REFERENCE only. It is NOT an error state and is not styled as one.
 * 2. `INSUFFICIENT_DATA` — no rule cleared its gate. The gate that was missed is named, and
 *    NO adaptive number is shown, because there is none: the REFERENCE rows below are the
 *    whole answer (`CLAUDE.md` rules 2 and 5).
 * 3. `ADAPTED` with `changedFromBaseline === false` — a rule fired, and the §9 guard rail, the
 *    global cap or the 500-bps grid then held the output exactly at the baseline. The
 *    reasoning is shown, and it is deliberately NOT badged as a change and renders no `+0%`
 *    delta row: `changedFromBaseline`, never `status`, is the badge flag.
 * 4. `ADAPTED` with a real change — the adapted primary, the baseline beneath it, the signed
 *    delta, the reasons, and the total-shift line against its cap.
 *
 * `provenance` is ALWAYS shown, as itself. It is fixed at `'HEURISTIC'` at the type level and
 * nothing in this block may ever present it as anything else (`CLAUDE.md` rule 2).
 */
function AdaptiveSection({
  adaptive,
  ready,
}: {
  readonly adaptive: AdaptiveRecommendation | null;
  readonly ready: StrategyPanelReady | null;
}) {
  if (adaptive === null || ready === null) {
    return (
      <section
        data-testid="adaptive-panel"
        data-status="NONE"
        data-changed="false"
        className="flex flex-col gap-1 rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-[0.7rem]"
      >
        <p data-testid="adaptive-heading" className="text-[0.65rem] text-ink-500">
          {ADAPTIVE_ENGINE_LABEL}
        </p>
        <p data-testid="adaptive-none" className="leading-snug text-ink-300">
          {ADAPTIVE_NOT_APPLICABLE_NOTICE}
        </p>
      </section>
    );
  }

  const changed = adaptive.changedFromBaseline;
  const primary = adaptive.primaryAction;
  const baseline = adaptive.baseline;
  // The baseline row is the SAME action the adapted primary names, at the frequency REFERENCE
  // gave it — that is what "BET 75% / 기본전략 BET 55%" means and what makes the delta row
  // readable. When the adaptation also moved which action is PRIMARY, REFERENCE's own top
  // action is named beside it rather than quietly replaced.
  const baselineOfPrimary =
    primary === null
      ? null
      : (baseline.actions.find((action) => action.kind === primary.kind) ?? null);
  const primaryKindChanged = primary !== null && primary.kind !== baseline.primaryKind;
  const sizing = adaptive.sizing;
  const cap = maxTotalShiftBpsFor(baseline.activeOpponentCount);
  const primaryOpponent = adaptive.opponents.find((opponent) => opponent.role === 'PRIMARY');
  // The structural remark that explains a MIX held at the baseline: the §9 guard rail, the
  // global cap, or nothing at all. First one wins — `composeAdaptive` emits them in the order
  // the limiters are applied.
  //
  // FREQUENCY-scoped only. A sizing remark ("preflop sizing is out of scope") is true but is
  // an answer to a different question, and promoting it into the "조정 없음 —" slot tells the
  // user the mix held for a reason that has nothing to do with the mix. When no frequency
  // remark exists the honest sentence is the plain one: the adapted mix came out equal to
  // REFERENCE's, which is what a small read is supposed to produce.
  const firstNote =
    adaptive.notes.find((note) => ADAPTIVE_NOTE_SCOPE[note.code] === 'FREQUENCY') ?? null;
  // The action NAMES are the REFERENCE model's own (`OPEN` / `3BET` / `BET`), read off the row
  // with the same kind. ADAPTIVE never introduces a kind the baseline lacks, so every adapted
  // row has one; the kind itself is the fallback rather than a name invented here.
  const names = new Map(ready.actions.map((action) => [action.kind, action.name]));

  return (
    <section
      data-testid="adaptive-panel"
      data-status={adaptive.status}
      data-changed={changed ? 'true' : 'false'}
      data-cap-applied={adaptive.capApplied ? 'true' : 'false'}
      className="flex flex-col gap-1 rounded border border-surface-700 bg-surface-900 px-2 py-1.5 text-[0.7rem]"
    >
      <p
        data-testid="adaptive-heading"
        className="flex items-baseline gap-2 text-[0.65rem] text-ink-500"
      >
        <span>{ADAPTIVE_ENGINE_LABEL}</span>
        {primaryOpponent !== undefined && (
          <span data-testid="adaptive-opponent" className="text-ink-300">
            (
            {adaptiveOpponentLabel(
              primaryOpponent.nickname ?? seatLabel(primaryOpponent.seatIndex),
            )}
            )
          </span>
        )}
        {changed && (
          <span
            data-testid="adaptive-changed-badge"
            className="ml-auto rounded border border-good-500 px-1 text-[0.6rem] text-good-500"
          >
            {ADAPTIVE_STATUS_LABEL.ADAPTED}
          </span>
        )}
      </p>

      {/* WP-7's no-data state, in two lines and no numbers. There is no adaptive frequency in
          this state and none is shown: `AdaptiveRecommendation` echoes the baseline verbatim,
          so 기본전략 above IS the answer, and inventing an opponent statistic to fill the
          space is exactly what `CLAUDE.md` rules 2 and 5 forbid. */}
      {adaptive.status === 'INSUFFICIENT_DATA' && (
        <>
          <p data-testid="adaptive-status" className="text-ink-300">
            {ADAPTIVE_NO_OPPONENT_DATA_LABEL}
          </p>
          <p data-testid="adaptive-same-as-reference" className="text-ink-500">
            {ADAPTIVE_SAME_AS_REFERENCE_LABEL}
          </p>
          {adaptive.notes.length > 0 && (
            <p data-testid="adaptive-status-reason" className="leading-snug text-ink-700">
              {adaptiveStatusReasonLabel(adaptive.notes.map(adaptiveNoteLabel).join(', '))}
            </p>
          )}
        </>
      )}

      {adaptive.status === 'ADAPTED' && !changed && (
        <p data-testid="adaptive-status" className="leading-snug text-ink-300">
          {ADAPTIVE_UNCHANGED_LABEL} —{' '}
          {firstNote === null ? ADAPTIVE_UNCHANGED_PLAIN_REASON : adaptiveNoteLabel(firstNote)}
        </p>
      )}

      {adaptive.status === 'ADAPTED' && changed && primary !== null && (
        <>
          <p
            data-testid="adaptive-primary"
            data-kind={primary.kind}
            className="tabular text-ink-100"
          >
            <span className="font-semibold tracking-wide">
              {names.get(primary.kind) ?? primary.kind}
            </span>{' '}
            {primary.frequencyBps / 100}%
          </p>

          <p data-testid="adaptive-baseline" className="tabular text-ink-500">
            <span className="text-ink-700">{STRATEGY_ENGINE_LABEL} </span>
            {baselineOfPrimary === null
              ? '—'
              : `${names.get(baselineOfPrimary.kind) ?? baselineOfPrimary.kind} ${
                  baselineOfPrimary.frequencyBps / 100
                }%`}
            {primaryKindChanged && (
              <span data-testid="adaptive-primary-changed" className="text-dirty-500">
                {' '}
                {adaptiveBaselinePrimaryLabel(
                  names.get(baseline.primaryKind) ?? baseline.primaryKind,
                )}
              </span>
            )}
          </p>

          <p data-testid="adaptive-delta" className="tabular text-ink-300">
            <span className="text-ink-700">{ADAPTIVE_DELTA_LABEL} </span>
            {names.get(primary.kind) ?? primary.kind} {signedBpsPointsLabel(primary.deltaBps)}
          </p>

          {/*
            The recommended size, from -> to, in the unit the ENGINE actually produced.

            `sizeText` renders a pot-fraction rung and its amount where the engine chose one and
            a bare raise-TO where it did not — postflop has a `POT_FRACTION_BUCKETS` rung and
            preflop is an amount, and WP-7 is explicit that a percentage the engine never
            computed is not invented to make the two look alike. Both ends are the sizing
            record's own fields (`fromPotFractionPercent`/`fromToAmountMbb` and their `to`
            counterparts); nothing here derives a size.

            When `bucketDelta` is 0 the size did not move, and it says so instead of drawing an
            arrow between two identical values.
          */}
          {sizing !== null && (
            <p
              data-testid="adaptive-sizing"
              data-from-bucket={sizing.fromBucketIndex}
              data-to-bucket={sizing.toBucketIndex}
              data-bucket-delta={sizing.bucketDelta}
              className="tabular text-ink-300"
            >
              <span className="text-ink-700">{SIZING_RECOMMENDATION_LABEL} </span>
              {sizing.bucketDelta === 0 ? (
                <>
                  {sizeText(sizing.toPotFractionPercent, sizing.toToAmountMbb)}
                  <span className="text-ink-700"> ({ADAPTIVE_NO_CHANGE_LABEL})</span>
                </>
              ) : (
                <>
                  <span className="text-ink-500">
                    {sizeText(sizing.fromPotFractionPercent, sizing.fromToAmountMbb)}
                  </span>
                  {' → '}
                  <span className="text-ink-100">
                    {sizeText(sizing.toPotFractionPercent, sizing.toToAmountMbb)}
                  </span>
                  <span className="text-ink-700"> ({sizingStepLabel(sizing.bucketDelta)})</span>
                </>
              )}
            </p>
          )}

          {/* The sizing clamp is never dropped: the rung the rule asked for and the amount the
              engine's legal window allowed are both facts (`CLAUDE.md` rule 3). */}
          {sizing !== null && sizing.clamp !== 'NONE' && (
            <p data-testid="adaptive-sizing-clamp" className="tabular text-dirty-500">
              {sizingClampNote(sizing.clamp, bbUnit(sizing.requestedToAmountMbb))}
            </p>
          )}

          <ul data-testid="adaptive-actions" className="flex flex-col gap-0.5">
            {adaptive.actions.map((action) => (
              <AdaptiveActionRow
                key={action.kind}
                action={action}
                name={names.get(action.kind) ?? action.kind}
              />
            ))}
          </ul>
        </>
      )}

      {/* 추천 이유 (FAST TABLE UX V3 §3) — closed by default, same disclosure as `Ready`'s. */}
      {adaptive.adjustments.length > 0 && (
        <details data-testid="adaptive-reason-detail">
          <summary className="cursor-pointer text-[0.65rem] text-ink-500">
            {REASON_DISCLOSURE_LABEL} ▾
          </summary>
          <div className="mt-1 flex flex-col gap-1">
            <p data-testid="adaptive-reasons-heading" className="text-[0.65rem] text-ink-500">
              {ADAPTIVE_REASONS_HEADING}
            </p>
            <ul
              data-testid="adaptive-reasons"
              className="flex flex-col gap-0.5 text-[0.65rem] text-ink-300"
            >
              {adaptive.adjustments.map((adjustment) => (
                <ReasonRow
                  key={`${adjustment.ruleId}:${adjustment.stat}:${adjustment.opponentPlayerId}`}
                  adjustment={adjustment}
                  adaptive={adaptive}
                />
              ))}
            </ul>
            <p data-testid="adaptive-shift" className="tabular text-[0.65rem] text-ink-500">
              {adaptiveShiftLabel(bpsAmountLabel(adaptive.totalShiftBps), bpsAmountLabel(cap))}
              {adaptive.capApplied && (
                <span className="text-dirty-500"> · {ADAPTIVE_CAP_APPLIED_LABEL}</span>
              )}
            </p>
          </div>
        </details>
      )}

      {/* 상세 데이터 보기 (FAST TABLE UX V3 §3/§8). Provenance, always, as itself. This layer
          is an authored heuristic composed from a small sample; it is never solved output and
          never says it is (`CLAUDE.md` rule 2) — demoted here, never deleted. */}
      <details data-testid="adaptive-technical-detail">
        <summary className="cursor-pointer text-[0.6rem] text-ink-700">
          {TECHNICAL_DETAIL_DISCLOSURE_LABEL} ▾
        </summary>
        <p data-testid="adaptive-provenance" className="mt-1 text-[0.6rem] text-ink-700">
          {adaptiveProvenanceLabel(adaptive.provenance, adaptive.policyVersion)}
        </p>
      </details>
    </section>
  );
}
