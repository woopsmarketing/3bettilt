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
import { useEffect, useState, type ReactNode } from 'react';
import { Money } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { Hand, SeatIndex } from '@gto-self/poker-core';
import {
  CONFIDENCE_LABEL,
  ENVIRONMENT_FACTOR_LABEL,
  ENVIRONMENT_STATUS_LABEL,
  EQUITY_METHOD_LABEL,
  POSITION_LABEL,
  POT_TYPE_LABEL,
  PROVENANCE_LABEL,
  SIZING_CLAMP_LABEL,
  STRATEGY_ENGINE_LABEL,
  STRATEGY_ERROR_LABEL,
  STRATEGY_FAMILY_LABEL,
  STRATEGY_PRIMARY_BADGE,
  STRATEGY_UNSUPPORTED_REASON_LABEL,
  STREET_LABEL,
  ratioPercentLabel,
  sprLabel,
} from '../../lib/table/copy.js';
import {
  ALL_IN_NAME,
  computeStrategy,
  type StrategyActionRow,
  type StrategyCompute,
  type StrategyPanelModel,
  type StrategyPanelReady,
} from '../../lib/table/strategy.js';
import { useTableStore } from './TableStoreProvider.js';

/** Stable module-level identity, so the default never re-triggers the effect. */
const DEFAULT_COMPUTE: StrategyCompute = (state, heroSeat) => computeStrategy(state, heroSeat);

const bb = (amount: MilliBB): string => Money.formatBB(amount, { maxDecimals: 3 });
const bbUnit = (amount: MilliBB): string =>
  Money.formatBB(amount, { maxDecimals: 3, unit: true });

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
}

export function StrategyPanel({ compute = DEFAULT_COMPUTE }: StrategyPanelProps = {}) {
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

  const fresh = computed !== null && computed.hand === hand && computed.heroSeat === heroSeat;
  const model = computed?.model ?? null;

  if (hand === null || model === null) {
    return (
      <Shell state={hand === null ? 'NO_HAND' : 'COMPUTING'} stale={false}>
        <p data-testid="strategy-computing" className="text-xs text-ink-500">
          {hand === null ? '진행 중인 핸드가 없습니다.' : '계산 중…'}
        </p>
      </Shell>
    );
  }

  if (model.kind === 'NO_HAND') {
    return (
      <Shell state="NO_HAND" stale={!fresh}>
        <p data-testid="strategy-computing" className="text-xs text-ink-500">
          진행 중인 핸드가 없습니다.
        </p>
      </Shell>
    );
  }

  if (model.kind === 'REFUSED') {
    return (
      <Shell state="REFUSED" stale={!fresh}>
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
        <p data-testid="strategy-refusal-detail" className="text-[0.65rem] leading-snug text-ink-700">
          <span className="font-semibold">{model.code}</span> · {model.message}
        </p>
      </Shell>
    );
  }

  return (
    <Shell state="READY" stale={!fresh} model={model}>
      <Ready model={model} />
    </Shell>
  );
}

interface ShellProps {
  readonly state: 'READY' | 'REFUSED' | 'COMPUTING' | 'NO_HAND';
  readonly stale: boolean;
  readonly model?: StrategyPanelReady;
  readonly children: ReactNode;
}

/**
 * The heading and the machine-readable attributes. Every E2E assertion addresses this
 * panel through them rather than through copy (ADR-0053's testing rule).
 */
function Shell({ state, stale, model, children }: ShellProps) {
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
      className={`flex flex-col gap-1.5 ${stale ? 'opacity-50' : ''}`}
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
          {model.environment.factors.find((factor) => factor.id === 'GAME_FORMAT')?.token ??
            '—'}
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
          <span className="text-ink-500">추천 사이즈 </span>
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
              ({SIZING_CLAMP_LABEL[model.sizing.clamp]}, 규칙값{' '}
              {bbUnit(model.sizing.requestedToAmountMbb)})
            </span>
          )}
        </p>
      )}

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
      <p
        data-testid="strategy-quality"
        className="text-[0.65rem] text-ink-500"
      >
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

      {model.notes.length > 0 && (
        <ul data-testid="strategy-notes" className="flex flex-col gap-0.5 text-[0.6rem] text-ink-700">
          {model.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
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
