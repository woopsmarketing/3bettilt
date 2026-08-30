'use client';

/**
 * The right panel's player profile.
 *
 * This is the ONE place in the table that awaits anything. Opening a profile is a click,
 * not a hand transition, so a server action is the right tool — and it is reached as a
 * PROP, never an import, because a `'use server'` module pulls a native SQLite binding
 * that must never enter a client bundle (`prompt` D3).
 *
 * A player with no HUD reading and no notes is a normal, fully-rendered profile. Nothing
 * is invented to fill the space.
 */
import { useEffect, useState } from 'react';
import type { LoadPlayerProfileAction, PlayerProfileView } from '../../lib/table/contract.js';

type LoadState =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'ERROR'; readonly message: string }
  | { readonly kind: 'LOADED'; readonly profile: PlayerProfileView };

export interface PlayerProfilePanelProps {
  readonly playerId: string;
  /** Shown immediately, so the header does not flicker while the profile loads. */
  readonly nickname: string | null;
  readonly loadProfile: LoadPlayerProfileAction;
  readonly onClose: () => void;
}

function formatInstant(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

export function PlayerProfilePanel({
  playerId,
  nickname,
  loadProfile,
  onClose,
}: PlayerProfilePanelProps) {
  const [state, setState] = useState<LoadState>({ kind: 'LOADING' });

  useEffect(() => {
    let live = true;
    setState({ kind: 'LOADING' });
    loadProfile(playerId).then(
      (result) => {
        if (!live) return;
        setState(
          result.ok
            ? { kind: 'LOADED', profile: result.profile }
            : { kind: 'ERROR', message: result.message },
        );
      },
      (error: unknown) => {
        if (!live) return;
        setState({
          kind: 'ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
    return () => {
      live = false;
    };
  }, [playerId, loadProfile]);

  const profile = state.kind === 'LOADED' ? state.profile : null;

  return (
    <section
      data-testid="player-profile"
      aria-label="플레이어 정보"
      className="flex flex-col gap-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">
          {profile?.displayAlias ?? profile?.nickname ?? nickname ?? '플레이어'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-surface-600 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-ink-500 hover:text-ink-100"
        >
          Esc
        </button>
      </header>

      {state.kind === 'LOADING' && (
        <p className="text-xs text-ink-500" data-testid="profile-loading">
          불러오는 중…
        </p>
      )}

      {state.kind === 'ERROR' && (
        <p className="text-xs text-danger-500" data-testid="profile-error">
          {state.message}
        </p>
      )}

      {profile !== null && (
        <>
          {profile.archived && (
            <p className="text-[0.65rem] uppercase tracking-widest text-dirty-500">보관됨</p>
          )}

          <div>
            <h3 className="text-[0.65rem] uppercase tracking-widest text-ink-500">최근 HUD</h3>
            {profile.hud === null ? (
              <p className="mt-1 text-xs text-ink-700" data-testid="profile-no-hud">
                이 플레이어의 HUD 기록이 없습니다.
              </p>
            ) : (
              <div className="mt-1" data-testid="profile-hud">
                <p className="tabular text-[0.65rem] text-ink-700">
                  {formatInstant(profile.hud.recordedAt)} ·{' '}
                  {profile.hud.handSample === null ? '표본 불명' : `${profile.hud.handSample}핸드`}
                </p>
                <ul className="mt-1">
                  {profile.hud.stats.map((stat) => (
                    <li
                      key={stat.key}
                      className="flex items-baseline justify-between gap-2 text-xs text-ink-300"
                    >
                      <span className="text-ink-500">{stat.key}</span>
                      {/* Exactly what the user entered (`CLAUDE.md` rule 3). */}
                      <span className="tabular">{stat.enteredText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-[0.65rem] uppercase tracking-widest text-ink-500">메모</h3>
            {profile.notes.length === 0 ? (
              <p className="mt-1 text-xs text-ink-700" data-testid="profile-no-notes">
                아직 메모가 없습니다.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-2">
                {profile.notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded bg-surface-700 px-2 py-1 text-xs text-ink-300"
                  >
                    <p className="tabular text-[0.6rem] text-ink-700">
                      {formatInstant(note.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{note.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {profile.warnings.length > 0 && (
            <ul className="text-[0.65rem] text-dirty-500">
              {profile.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
