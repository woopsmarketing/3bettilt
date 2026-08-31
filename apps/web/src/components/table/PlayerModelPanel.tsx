'use client';

/**
 * The learned Player Model, as prompt §28 asks for it.
 *
 * This is NOT the existing `PlayerProfilePanel`, and deliberately so. That panel shows
 * TESTIMONY — a HUD reading the user typed in and free-text notes — and this one shows what
 * the app COMPUTED from raw history. They are permanently separate record types that must
 * never be merged or averaged (ADR-0062a), so they are separate panels. This one lives in the
 * analysis overlay, beside the run it came from.
 *
 * Three rules hold in every row below:
 *
 * 1. **The denominator is always on screen** (prompt §28). Every percentage is rendered next
 *    to `기회 N` and to the raw `actions / opportunities` pair it was derived from. A
 *    percentage on its own is not an acceptable rendering of a sample of four.
 * 2. **`UNKNOWN` is not a small number.** A bucket with too little evidence shows its counts
 *    and a dash, never a frequency (WP C1-A, prompt §22).
 * 3. **The `position: null` bucket and the positional rows are never added together**
 *    (ADR-0035). They are two separate sections and `analysis-view.ts` keeps them apart.
 *
 * The server action arrives as a PROP, never an import: a `'use server'` module reaches
 * `@gto-self/db` and its native binding, which must not be reachable from a client bundle
 * (ADR-0044). Only the TYPES come from `src/server/analysis-contract.ts`, and they are erased.
 */
import { useEffect, useState } from 'react';
import type { GetPlayerModelAction, PlayerModelView } from '../../server/analysis-contract.js';
import {
  SNAPSHOT_CONFIDENCE_LABEL,
  formatAnalysisInstant,
  observedRateLabel,
  overallStats,
  positionalStats,
  topSpots,
} from '../../lib/table/analysis-view.js';

type LoadState =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'ERROR'; readonly code: string; readonly message: string }
  | { readonly kind: 'LOADED'; readonly view: PlayerModelView };

export interface PlayerModelPanelProps {
  readonly playerId: string;
  /** Shown while the model loads, so the header does not flicker. */
  readonly nickname: string | null;
  readonly getPlayerModel: GetPlayerModelAction;
  /** How many situation buckets to list. The model keeps all of them; this is display only. */
  readonly spotLimit?: number;
}

const CONFIDENCE_CLASS: Readonly<Record<string, string>> = {
  UNKNOWN: 'text-ink-700',
  LEARNING: 'text-dirty-500',
  KNOWN: 'text-good-500',
};

function Confidence({ state }: { readonly state: keyof typeof SNAPSHOT_CONFIDENCE_LABEL }) {
  return (
    <span
      // The English state the snapshot actually stores stays reachable; the label is Korean.
      title={state}
      data-confidence={state}
      className={`text-[0.6rem] ${CONFIDENCE_CLASS[state] ?? 'text-ink-500'}`}
    >
      {`신뢰도 ${SNAPSHOT_CONFIDENCE_LABEL[state]}`}
    </span>
  );
}

export function PlayerModelPanel({
  playerId,
  nickname,
  getPlayerModel,
  spotLimit = 8,
}: PlayerModelPanelProps) {
  const [state, setState] = useState<LoadState>({ kind: 'LOADING' });

  useEffect(() => {
    let live = true;
    setState({ kind: 'LOADING' });
    getPlayerModel({ playerId }).then(
      (result) => {
        if (!live) return;
        setState(
          result.ok
            ? { kind: 'LOADED', view: result.value }
            : // The refusing layer's own code and message, verbatim (`CLAUDE.md` rule 3).
              { kind: 'ERROR', code: result.code, message: result.message },
        );
      },
      (error: unknown) => {
        if (!live) return;
        setState({
          kind: 'ERROR',
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
    return () => {
      live = false;
    };
  }, [playerId, getPlayerModel]);

  const view = state.kind === 'LOADED' ? state.view : null;
  const snapshot = view?.snapshot ?? null;
  const versions = view?.versions ?? [];

  return (
    <section data-testid="player-model" aria-label="플레이어 모델" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">
        {view?.nickname ?? nickname ?? '플레이어'}
        <span className="ml-2 tabular text-[0.6rem] font-normal text-ink-700">{playerId}</span>
      </h3>

      {state.kind === 'LOADING' && (
        <p data-testid="model-loading" className="text-xs text-ink-500">
          불러오는 중…
        </p>
      )}

      {state.kind === 'ERROR' && (
        <p data-testid="model-error" role="alert" className="text-xs text-danger-500">
          <span className="font-semibold">{state.code}</span> {state.message}
        </p>
      )}

      {/* A player who has never been analysed is a STATE, not an error (WP C1-B §6). */}
      {view !== null && snapshot === null && (
        <p data-testid="model-empty" className="text-xs text-ink-500">
          아직 분석된 모델이 없습니다. 세션 분석을 실행하면 만들어집니다.
        </p>
      )}

      {snapshot !== null && (
        <>
          <dl
            data-testid="model-headline"
            className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-ink-300"
          >
            <dt className="text-ink-500">총 관찰 핸드</dt>
            <dd className="tabular" data-testid="model-hand-count">
              {snapshot.sourceHandCount}
            </dd>
            <dt className="text-ink-500">모델 버전</dt>
            <dd className="tabular" data-testid="model-version">{`v${snapshot.modelVersion}`}</dd>
            <dt className="text-ink-500">마지막 분석</dt>
            <dd className="tabular" data-testid="model-analyzed-at">
              {formatAnalysisInstant(snapshot.createdAt)}
            </dd>
            <dt className="text-ink-500">관찰 기회 합계</dt>
            <dd className="tabular" data-testid="model-observation-count">
              {snapshot.sourceObservationCount}
            </dd>
            <dt className="text-ink-500">SHOW 증거</dt>
            <dd className="tabular" data-testid="model-show-count">
              {snapshot.sourceShowCount}
            </dd>
          </dl>

          {/* The headline stats. `position: null` ONLY — see the header note. */}
          <div>
            <h4 className="text-[0.65rem] uppercase tracking-widest text-ink-500">
              기본 지표 (전체 포지션)
            </h4>
            <ul data-testid="model-overall-stats" className="mt-1 flex flex-col gap-0.5">
              {overallStats(snapshot.globalStats).map((stat) => (
                <li
                  key={stat.key}
                  data-testid={`model-stat-${stat.key}`}
                  data-opportunities={stat.opportunities}
                  className="flex items-baseline gap-2 text-xs text-ink-300"
                >
                  <span className="w-36 shrink-0 text-ink-500">{stat.key}</span>
                  <span className="tabular w-16 shrink-0">{`기회 ${stat.opportunities}`}</span>
                  <span className="tabular w-14 shrink-0 text-ink-700">
                    {`${stat.actions}/${stat.opportunities}`}
                  </span>
                  <span className="tabular w-12 shrink-0" data-testid={`model-rate-${stat.key}`}>
                    {observedRateLabel(stat.actions, stat.opportunities, stat.confidence.state)}
                  </span>
                  <Confidence state={stat.confidence.state} />
                </li>
              ))}
            </ul>
          </div>

          {/* Separate section, separate list, never summed with the block above. */}
          <details data-testid="model-positional">
            <summary className="cursor-pointer text-[0.65rem] uppercase tracking-widest text-ink-500">
              {`포지션별 지표 ${positionalStats(snapshot.globalStats).length}건 (전체 포지션 값과 합산하지 않습니다)`}
            </summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {positionalStats(snapshot.globalStats).map((stat) => (
                <li
                  key={`${stat.key}:${stat.position}`}
                  data-testid={`model-stat-${stat.key}-${stat.position}`}
                  className="flex items-baseline gap-2 text-xs text-ink-300"
                >
                  <span className="w-36 shrink-0 text-ink-500">{`${stat.key} · ${stat.position}`}</span>
                  <span className="tabular w-16 shrink-0">{`기회 ${stat.opportunities}`}</span>
                  <span className="tabular w-14 shrink-0 text-ink-700">
                    {`${stat.actions}/${stat.opportunities}`}
                  </span>
                  <span className="tabular w-12 shrink-0">
                    {observedRateLabel(stat.actions, stat.opportunities, stat.confidence.state)}
                  </span>
                  <Confidence state={stat.confidence.state} />
                </li>
              ))}
            </ul>
          </details>

          {/* Situational observations. The spot key is the model's own key, verbatim. */}
          <div>
            <h4 className="text-[0.65rem] uppercase tracking-widest text-ink-500">
              {`주요 상황 ${snapshot.spotStats.length}개 중 상위 ${Math.min(spotLimit, snapshot.spotStats.length)}개`}
            </h4>
            <ul data-testid="model-spots" className="mt-1 flex flex-col gap-1">
              {topSpots(snapshot.spotStats, spotLimit).map((spot) => (
                <li
                  key={spot.spotKey}
                  data-testid={`model-spot-${spot.spotKey}`}
                  data-opportunities={spot.opportunities}
                  className="rounded bg-surface-700 px-2 py-1 text-xs text-ink-300"
                >
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{spot.spotKey}</span>
                    <Confidence state={spot.confidence.state} />
                  </p>
                  <p className="tabular text-[0.65rem] text-ink-500">{`기회 ${spot.opportunities}`}</p>
                  <ul className="mt-0.5 flex flex-wrap gap-x-3 text-[0.65rem]">
                    {(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'] as const)
                      .filter((effect) => spot.effects[effect] > 0)
                      .map((effect) => (
                        <li key={effect} className="tabular">
                          <span className="text-ink-500">{effect}</span>{' '}
                          <span>{`${spot.effects[effect]}/${spot.opportunities}`}</span>{' '}
                          <span>
                            {observedRateLabel(
                              spot.effects[effect],
                              spot.opportunities,
                              spot.confidence.state,
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[0.65rem] uppercase tracking-widest text-ink-500">버전 기록</h4>
            <ul data-testid="model-versions" className="mt-1 flex flex-wrap gap-x-3 text-[0.65rem]">
              {versions.map((version) => (
                <li
                  key={version.snapshotId}
                  data-testid={`model-version-${version.modelVersion}`}
                  className="tabular text-ink-500"
                >
                  {`v${version.modelVersion} · ${version.sourceHandCount}핸드`}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
