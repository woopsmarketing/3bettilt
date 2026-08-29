/**
 * The wire shape between the table's client components and the player-profile server
 * action.
 *
 * It exists for the same reason `lib/session-setup/contract.ts` does: a `'use server'`
 * module reaches `@gto-self/db` and a native SQLite binding, so the client component
 * takes the action as a PROP typed by this module and never imports it. Everything here
 * is plain JSON — no branded id, no `Timestamp`, no domain object — so it crosses the
 * server/client boundary without a serialization surprise.
 *
 * This is NOT a hot path. The profile panel opens on a click and is allowed to await;
 * nothing about a hand transition goes through here (`prompt` D3).
 */

/** One HUD reading, kept as the user entered it (`CLAUDE.md` rule 3). */
export interface ProfileHudStat {
  readonly key: string;
  /** Verbatim user input, e.g. `"23.5"`. Never a re-formatted number. */
  readonly enteredText: string;
}

export interface ProfileHudSnapshot {
  /** Epoch milliseconds, UTC. Formatted at the very last moment, in the component. */
  readonly recordedAt: number;
  /** `null` is genuinely unknown, not zero. Rendered as such. */
  readonly handSample: number | null;
  readonly stats: readonly ProfileHudStat[];
}

export interface ProfileNote {
  readonly id: string;
  readonly body: string;
  readonly createdAt: number;
}

export interface PlayerProfileView {
  readonly playerId: string;
  readonly nickname: string;
  readonly displayAlias: string | null;
  readonly archived: boolean;
  /** `null` when this player has no HUD reading yet. Renders as "no HUD data". */
  readonly hud: ProfileHudSnapshot | null;
  readonly notes: readonly ProfileNote[];
  /** Partial-read failures. Shown, never hidden. */
  readonly warnings: readonly string[];
}

export type PlayerProfileResult =
  | { readonly ok: true; readonly profile: PlayerProfileView }
  | { readonly ok: false; readonly message: string };

/** The server action, as the client component sees it. */
export type LoadPlayerProfileAction = (playerId: string) => Promise<PlayerProfileResult>;
