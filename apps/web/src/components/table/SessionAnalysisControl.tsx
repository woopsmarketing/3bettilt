'use client';

/**
 * 세션 분석 및 반영 — the button, its safe boundary, and the summary it opens (prompt §26-§28).
 *
 * ## Why a button in the header and an overlay under it
 *
 * Prompt §26 asks for "the smallest clear safe-boundary UI" and explicitly warns against
 * building a session-management feature. There is no session-end workflow to integrate with,
 * so the control sits where the session-level facts already are — beside 저장된 핸드 N — and its
 * result opens over the table rather than inside the right column. The right column belongs to
 * the hand being played; a post-session report that squeezed the action log out of it would be
 * a worse table for the sake of a screen the user visits once.
 *
 * ## The boundary
 *
 * The decision is `sessionAnalysisGate` in `lib/table/analysis-view.ts`, and it is the only
 * one. The button is `disabled` while a hand is live, while a completed hand is still on its
 * way to the database, and while a run this browser started has not come back — the last of
 * these being the double-click guard the server deliberately does not have (WP C1-B §9.3). A
 * second completed run is harmless anyway: it is a `NO_CHANGES` run by construction (ADR-0062c).
 * The guard exists so the user is not shown two summaries racing for the same panel.
 *
 * ## Props, not imports
 *
 * Both server actions arrive as props (ADR-0044). The types come from
 * `src/server/analysis-contract.ts`, whose only domain imports are `import type` and are
 * erased, so no runtime edge to `@gto-self/db` is created by this file.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewPhase } from '@gto-self/poker-core';
import type {
  AnalysisPlayerSummary,
  GetPlayerModelAction,
  RunSessionAnalysisAction,
  RunSessionAnalysisResult,
} from '../../server/analysis-contract.js';
import {
  ANALYSIS_GATE_REASON_LABEL,
  ANALYSIS_OUTCOME_CLASS,
  ANALYSIS_OUTCOME_LABEL,
  ANALYSIS_STATUS_LABEL,
  RUN_ANALYSIS_LABEL,
  analysisDisclaimer,
  countOrDash,
  sessionAnalysisGate,
} from '../../lib/table/analysis-view.js';
import { PlayerModelPanel } from './PlayerModelPanel.js';

export interface SessionAnalysisControlProps {
  readonly sessionId: string;
  /** The live hand's phase, or `null` when there is no hand. */
  readonly handPhase: ViewPhase['kind'] | null;
  /** Completed hands whose persist has not come back yet. */
  readonly savesInFlight: number;
  /** Completed hands this browser could not store. A warning, never a block — see below. */
  readonly unsavedHandCount?: number;
  readonly runSessionAnalysis: RunSessionAnalysisAction;
  readonly getPlayerModel: GetPlayerModelAction;
  /** Told whenever the overlay opens or closes, so the table can stand its hotkeys down. */
  readonly onOpenChange?: (open: boolean) => void;
}

interface ProfileTarget {
  readonly playerId: string;
  readonly nickname: string | null;
}

function PlayerRow({
  player,
  onOpenProfile,
}: {
  readonly player: AnalysisPlayerSummary;
  readonly onOpenProfile: (target: ProfileTarget) => void;
}) {
  return (
    <li
      data-testid={`analysis-player-${player.playerId}`}
      data-outcome={player.outcome}
      className="rounded border border-surface-700 bg-surface-800 px-2 py-1"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">
          {/* A nickname that could not be read is not invented; the id still identifies. */}
          {player.nickname ?? player.playerId}
        </span>
        <span
          data-testid={`analysis-outcome-${player.playerId}`}
          className={`text-xs ${ANALYSIS_OUTCOME_CLASS[player.outcome]}`}
        >
          {ANALYSIS_OUTCOME_LABEL[player.outcome]}
        </span>
      </div>
      <dl className="mt-0.5 grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-0.5 text-xs text-ink-300">
        <dt className="text-ink-500">총 관찰</dt>
        <dd className="tabular" data-testid={`analysis-total-${player.playerId}`}>
          {`${countOrDash(player.totalHands)} hands`}
        </dd>
        <dt className="text-ink-500">이번 추가</dt>
        <dd className="tabular" data-testid={`analysis-added-${player.playerId}`}>
          {/* `null` is "there was no previous snapshot to add to", NOT `totalHands`. */}
          {player.addedSinceLastSnapshot === null ? '—' : `${player.addedSinceLastSnapshot} hands`}
        </dd>
        <dt className="text-ink-500">주요 상황</dt>
        <dd className="tabular" data-testid={`analysis-spots-${player.playerId}`}>
          {/* `null` on a 변경 없음 row: this run did not recompute it, so it is not claimed. */}
          {player.spotGroupCount === null ? '—' : `${player.spotGroupCount} groups`}
        </dd>
        <dt className="text-ink-500">SHOW</dt>
        <dd className="tabular" data-testid={`analysis-show-${player.playerId}`}>
          {countOrDash(player.showCount)}
        </dd>
        <dt className="text-ink-500">Model</dt>
        <dd className="tabular" data-testid={`analysis-model-${player.playerId}`}>
          {player.modelVersion === null ? '—' : `v${player.modelVersion}`}
        </dd>
        <dt />
        <dd className="text-right">
          <button
            type="button"
            data-testid={`analysis-open-profile-${player.playerId}`}
            onClick={() => onOpenProfile({ playerId: player.playerId, nickname: player.nickname })}
            className="rounded border border-surface-600 px-2 py-0.5 text-[0.65rem] text-ink-300 hover:border-actor-500"
          >
            프로필 보기
          </button>
        </dd>
      </dl>
      {player.outcome === 'FAILED' && (
        <p
          data-testid={`analysis-error-${player.playerId}`}
          role="alert"
          className="mt-0.5 text-[0.65rem] text-danger-500"
        >
          {/* Verbatim, from whichever layer refused (`CLAUDE.md` rule 3, prompt §33). */}
          <span className="font-semibold">{player.errorCode ?? 'UNKNOWN'}</span>{' '}
          {player.errorMessage ?? ''}
        </p>
      )}
    </li>
  );
}

export function SessionAnalysisControl({
  sessionId,
  handPhase,
  savesInFlight,
  unsavedHandCount = 0,
  runSessionAnalysis,
  getPlayerModel,
  onOpenChange,
}: SessionAnalysisControlProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunSessionAnalysisResult | null>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  // The click-path half of the double-click guard. `disabled` alone is a render behind a
  // second click that lands in the same tick; this ref is not.
  const inFlight = useRef(false);

  const gate = sessionAnalysisGate({ phase: handPhase, savesInFlight, running });

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const close = useCallback((): void => {
    setOpen(false);
    setProfile(null);
  }, []);

  // The overlay owns `Esc` while it is up; the table stands its own listener down for the
  // whole time (`TableRoot`), so this is the only handler in play and no key can reach a seat
  // behind the dialog. Bound only while open, so nothing listens when nothing is showing.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const run = useCallback((): void => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setOpen(true);
    setProfile(null);
    setResult(null);
    void runSessionAnalysis({ sessionId })
      .then((value) => setResult(value))
      .catch((error: unknown) => {
        setResult({
          ok: false,
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        inFlight.current = false;
        setRunning(false);
      });
  }, [runSessionAnalysis, sessionId]);

  const summary = result !== null && result.ok ? result.summary : null;

  return (
    <>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="run-analysis"
          disabled={!gate.enabled}
          title={gate.reason === null ? undefined : ANALYSIS_GATE_REASON_LABEL[gate.reason]}
          onClick={run}
          className="self-center rounded border border-actor-500 px-2.5 py-0.5 text-xs font-semibold text-actor-500 disabled:border-surface-600 disabled:text-ink-700"
        >
          {RUN_ANALYSIS_LABEL}
        </button>
        {gate.reason !== null && (
          // The reason in words, not only in a tooltip: a disabled control with no stated
          // reason is the thing that makes a user think the app is broken.
          <span data-testid="analysis-gate-reason" className="text-[0.6rem] text-ink-700">
            {ANALYSIS_GATE_REASON_LABEL[gate.reason]}
          </span>
        )}
        {result !== null && !open && (
          <button
            type="button"
            data-testid="reopen-analysis"
            onClick={() => setOpen(true)}
            className="text-[0.6rem] uppercase tracking-widest text-ink-500 hover:text-ink-100"
          >
            결과 보기
          </button>
        )}
      </span>

      {open && (
        <div
          data-testid="analysis-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="세션 분석 결과"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-6"
        >
          <div className="flex max-h-full w-full max-w-3xl flex-col gap-2 overflow-y-auto rounded-md border border-surface-700 bg-surface-900 p-3 text-ink-100">
            <header className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">이번 분석</h2>
              <button
                type="button"
                data-testid="analysis-close"
                onClick={close}
                className="rounded border border-surface-600 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-ink-500 hover:text-ink-100"
              >
                Esc
              </button>
            </header>

            {running && (
              <p data-testid="analysis-running" className="text-xs text-ink-500">
                분석 중입니다…
              </p>
            )}

            {result !== null && !result.ok && (
              <p data-testid="analysis-failure" role="alert" className="text-xs text-danger-500">
                {/* The service's own code and message. Nothing was written (WP C1-B §5). */}
                <span className="font-semibold">{result.code}</span> {result.message}
              </p>
            )}

            {summary !== null && (
              <>
                <dl
                  data-testid="analysis-totals"
                  data-status={summary.status}
                  className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-300 sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]"
                >
                  <dt className="text-ink-500">Hands</dt>
                  <dd className="tabular" data-testid="analysis-total-hands">
                    {summary.sessionHandCount}
                  </dd>
                  <dt className="text-ink-500">Players</dt>
                  <dd className="tabular" data-testid="analysis-total-players">
                    {summary.playerCount}
                  </dd>
                  <dt className="text-ink-500">SHOW evidence</dt>
                  <dd className="tabular" data-testid="analysis-total-show">
                    {summary.showCount}
                  </dd>
                  <dt className="text-ink-500">상태</dt>
                  <dd data-testid="analysis-status">{ANALYSIS_STATUS_LABEL[summary.status]}</dd>
                  <dt className="text-ink-500">소요</dt>
                  <dd className="tabular">{`${summary.durationMs} ms`}</dd>
                  <dt className="text-ink-500">알고리즘</dt>
                  <dd className="tabular">{`v${summary.algorithmVersion}`}</dd>
                </dl>

                {/* Prompt §27. Said in words, on this screen, every time. */}
                <p
                  data-testid="analysis-disclaimer"
                  className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-ink-300"
                >
                  {analysisDisclaimer(summary)}
                </p>

                {unsavedHandCount > 0 && (
                  <p
                    data-testid="analysis-unsaved-warning"
                    role="alert"
                    className="text-[0.65rem] text-danger-500"
                  >
                    {`저장되지 않은 핸드가 ${unsavedHandCount}개 있습니다. 이번 분석에는 포함되지 않았습니다.`}
                  </p>
                )}

                {summary.status === 'NO_ELIGIBLE_HANDS' ? (
                  // Nothing went wrong: there was simply nothing to analyse (WP C1-B §3).
                  <p data-testid="analysis-no-hands" className="text-xs text-ink-500">
                    이 세션에는 아직 완료된 핸드가 없습니다. 핸드를 끝내고 다시 실행하세요.
                  </p>
                ) : (
                  <ul data-testid="analysis-players" className="flex flex-col gap-1">
                    {summary.players.map((player) => (
                      <PlayerRow key={player.playerId} player={player} onOpenProfile={setProfile} />
                    ))}
                  </ul>
                )}
              </>
            )}

            {profile !== null && (
              <div className="rounded-md border border-surface-700 bg-surface-800 p-2">
                <PlayerModelPanel
                  playerId={profile.playerId}
                  nickname={profile.nickname}
                  getPlayerModel={getPlayerModel}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
