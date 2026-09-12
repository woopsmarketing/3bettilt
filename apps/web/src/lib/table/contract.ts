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

/**
 * Two string-literal unions, imported TYPE-ONLY from the composition package.
 *
 * `import type` is erased, so a client component that imports this module for its wire
 * shapes never gains a runtime edge to anything — the same reasoning `analysis-contract.ts`
 * records for its `PlayerModelSnapshot` import. `@gto-self/adaptive-core` is a pure domain
 * package in any case: no React, no persistence, no native binding.
 *
 * They are imported rather than widened to `string` because these values cross the wire and
 * then go straight back into `buildAdjustmentProfile`. Typing them as `string` here would
 * force a cast at the one place that matters, and a cast is exactly where an
 * eighteenth stat key would slip through unnoticed. The unions are plain JSON: a string
 * literal is not a domain object, a branded id or a class instance.
 */
import type { AdaptiveStatKey, AdaptiveStatSource } from '@gto-self/adaptive-core';

/**
 * The runtime imports below are all client-safe and already precedented in a wire contract:
 * `zod` and `SEAT_INDEXES`/`MAX_NICKNAME_LENGTH` are exactly what `session-setup/contract.ts`
 * imports for the same purpose, and `Money` is a pure integer-arithmetic module. None of them
 * pulls in React, `@gto-self/db` or a native binding. `ExternalHudStatKey` is TYPE-ONLY, so the
 * key vocabulary is shared with `player-core` without a runtime edge to it.
 */
import { z } from 'zod';
import { Money } from '@gto-self/shared';
import { MAX_NICKNAME_LENGTH } from '@gto-self/player-core';
import type { ExternalHudStatKey } from '@gto-self/player-core';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { SeatIndex } from '@gto-self/poker-core';

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

/**
 * One `EXTERNAL_HUD` lifetime snapshot (WP-K). `sampleN` is `null` unconditionally — this
 * source never reports a hand count, and the panel must never round that up to a number.
 */
export interface ProfileExternalHudSnapshot {
  readonly recordedAt: number;
  readonly sampleN: null;
  readonly stats: readonly ProfileHudStat[];
}

export interface PlayerProfileView {
  readonly playerId: string;
  readonly nickname: string;
  readonly displayAlias: string | null;
  readonly archived: boolean;
  /** `null` when this player has no HUD reading yet. Renders as "no HUD data". */
  readonly hud: ProfileHudSnapshot | null;
  /** `null` when this player has never been bulk-imported from an external HUD. */
  readonly externalHud: ProfileExternalHudSnapshot | null;
  readonly notes: readonly ProfileNote[];
  /** Partial-read failures. Shown, never hidden. */
  readonly warnings: readonly string[];
}

export type PlayerProfileResult =
  | { readonly ok: true; readonly profile: PlayerProfileView }
  | { readonly ok: false; readonly message: string };

/** The server action, as the client component sees it. */
export type LoadPlayerProfileAction = (playerId: string) => Promise<PlayerProfileResult>;

/**
 * Write side of the manual profile panel. Both actions return the refreshed
 * `PlayerProfileView` on success so the panel can re-render without a second round trip.
 */

export interface SaveHudSnapshotInput {
  readonly playerId: string;
  /** `key` is one of `HudStatKey` (`@gto-self/player-core`); re-validated server-side. */
  readonly stats: readonly { readonly key: string; readonly enteredText: string }[];
  readonly handSample: number | null;
}

export type SaveHudSnapshotResult =
  | { readonly ok: true; readonly profile: PlayerProfileView }
  | { readonly ok: false; readonly message: string };

export type SaveHudSnapshotAction = (input: SaveHudSnapshotInput) => Promise<SaveHudSnapshotResult>;

export interface AddPlayerNoteInput {
  readonly playerId: string;
  readonly body: string;
}

export type AddPlayerNoteResult =
  | { readonly ok: true; readonly profile: PlayerProfileView }
  | { readonly ok: false; readonly message: string };

export type AddPlayerNoteAction = (input: AddPlayerNoteInput) => Promise<AddPlayerNoteResult>;

/* -------------------------------------------------------------------------- */
/* ADAPTIVE opponent inputs (WP-J design contract §2.3, §6)                     */
/* -------------------------------------------------------------------------- */

/**
 * One seat the client asks for opponent data about.
 *
 * The nickname travels FROM the client because the table already knows it — the seat lineup
 * is the store's own state — and re-reading it server-side would be a second source of truth
 * for a label. Nothing about a decision depends on it; it is display text.
 */
export interface AdaptiveSeatInput {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly nickname: string | null;
}

/**
 * One reading of one stat, as `apps/web/src/server/adaptive-service.ts` mapped it.
 *
 * Structurally identical to `AdaptiveStatObservation` in `@gto-self/adaptive-core`, and
 * deliberately so: the value that crosses the wire is the value the composition layer
 * consumes, with no re-shaping step in between that could drift.
 */
export interface AdaptiveStatObservationWire {
  readonly key: AdaptiveStatKey;
  readonly source: AdaptiveStatSource;
  /** 0..10000. CentiPercent and basis points are the same unit; no conversion happens. */
  readonly valueBps: number;
  /** The DENOMINATOR actually observed. `0` means unknown and carries no weight. */
  readonly sampleN: number;
  /** A scope caveat the UI shows verbatim (`CLAUDE.md` rule 3), or `null`. */
  readonly note: string | null;
}

/** Everything the ADAPTIVE layer is allowed to know about one seated opponent. */
export interface AdaptiveOpponentInputWire {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly nickname: string | null;
  readonly observations: readonly AdaptiveStatObservationWire[];
  /** Provenance: the exact `player_hud_snapshots` row the MANUAL_HUD readings came from. */
  readonly manualHudSnapshotId: string | null;
  /** Epoch milliseconds, UTC. Formatted at the very last moment, in the component. */
  readonly manualHudRecordedAt: number | null;
  /** Provenance: the exact `player_model_snapshots` row the LEARNED_MODEL readings came from. */
  readonly learnedSnapshotId: string | null;
  readonly learnedModelVersion: number | null;
  /** Provenance: the exact `player_external_hud_snapshots` row EXTERNAL_HUD came from (WP-K). */
  readonly externalHudSnapshotId: string | null;
  /** Epoch milliseconds, UTC. Formatted at the very last moment, in the component. */
  readonly externalHudRecordedAt: number | null;
}

/**
 * All-or-nothing on purpose. A lineup that came back with one seat's reads missing would be
 * indistinguishable from a lineup in which that opponent is genuinely unknown, and ADAPTIVE
 * would quietly adapt against a partial table. A failed read is reported as a failure.
 */
export type LoadAdaptiveInputsResult =
  | { readonly ok: true; readonly inputs: readonly AdaptiveOpponentInputWire[] }
  | { readonly ok: false; readonly message: string };

/** The server action, as the client component sees it. */
export type LoadAdaptiveInputsAction = (
  seats: readonly AdaptiveSeatInput[],
) => Promise<LoadAdaptiveInputsResult>;

/* -------------------------------------------------------------------------- */
/* Seat-state persistence (WP-5 / ADR-0075)                                    */
/* -------------------------------------------------------------------------- */

/**
 * The error codes THIS layer produces itself.
 *
 * `code` on the failure branches below is a plain `string` rather than this union, because a
 * rejection raised inside `@gto-self/db` keeps its OWN `DbErrorCode` verbatim — paraphrasing a
 * `CHECK` violation into one of these would swallow the database's verdict (`CLAUDE.md` rule 5).
 * These are the ones the server actions in `src/server/` mint, and the only ones a caller can
 * branch on safely.
 */
export const SEAT_STATE_ERROR_CODES = [
  /** The submitted shape, seat index, occupancy/player/stack combination or money value is wrong. */
  'INVALID_INPUT',
  /** No such session, no such seat row, or no such player. */
  'NOT_FOUND',
  /** The sitting has ended (`closed_at` is set); nothing about it may change. */
  'SESSION_CLOSED',
  /** ADR-0076: one player may occupy at most one seat in a session. */
  'PLAYER_ALREADY_SEATED',
  /**
   * ADR-0079: `requireNew` was asked for and the typed nickname already names a player.
   *
   * The refusal is NOT an error about the nickname's shape — the name is fine, it simply is
   * not new — so it is its own code rather than an `INVALID_INPUT`. The UI turns it into
   * "this player already exists; pick them from the list", which keeps their full profile
   * instead of collapsing it to the two or three stats that were just typed. Nothing at all
   * is written when it is raised: no `players` row, no `EXTERNAL_HUD` snapshot, no seat.
   *
   * The message names the matched player (their STORED nickname, which is not necessarily
   * what was typed, and their id) so the UI can point at the right row in the picker.
   */
  'PLAYER_EXISTS',
] as const;

export type SeatStateErrorCode = (typeof SEAT_STATE_ERROR_CODES)[number];

/**
 * One seat's CURRENT state, as the table store holds it between hands.
 *
 * `stack` travels as an integer milliBB rather than as the text the user typed, and that is a
 * deliberate exception to the "text, re-parsed server-side" rule the setup form follows
 * (`session-setup/contract.ts`). It has to be: this boundary carries the SETTLED stacks after a
 * hand as well as a hand-corrected one, and an in-progress hand is memory-only (ADR-0059), so
 * there is no text for the settled case and no way for the server to recompute the number. The
 * value the user typed is still never destroyed — the store parsed it once with `Money.parseBB`
 * and this IS that parse, not a bucket of it (`CLAUDE.md` rule 1, rule 3). The server re-checks
 * every property the money type guarantees: integer, in range, positive when the seat holds a
 * player, exactly zero when it does not.
 */
export interface SessionSeatStateValue {
  readonly seat: SeatIndex;
  readonly occupancy: 'ACTIVE' | 'SITTING_OUT' | 'EMPTY';
  /** `null` iff `occupancy === 'EMPTY'`, matching `TableSeat` and the `session_seats` CHECK. */
  readonly playerId: string | null;
  /** Integer milliBB. `0` iff EMPTY; strictly positive otherwise. */
  readonly stack: number;
  /**
   * `true` while `stack` above is a number nobody has confirmed since the hand that disturbed
   * it — the seat's 확인 필요 mark (ADR-0078b).
   *
   * It travels and is STORED because the number already was: a quick-skipped hand leaves the
   * still-live seats holding their pre-hand figures, and a mark that lived only in memory let
   * a reload render unverified money as confirmed money. Sent on every seat of every sync,
   * never optional, so a sync that is about something else cannot silently clear a warning.
   */
  readonly stackUnverified: boolean;
}

/**
 * A whole between-hands seat-state write: the seats that changed plus the button.
 *
 * The button always travels, because it is one column and sending it unconditionally removes
 * the "did the caller mean null or mean unchanged?" ambiguity an optional field would create.
 */
export interface SyncSessionSeatsValue {
  readonly sessionId: string;
  readonly seats: readonly SessionSeatStateValue[];
  readonly buttonSeat: SeatIndex | null;
}

export type SyncSessionSeatsResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };

/** The server action, as the client component sees it. Passed as a prop, never imported. */
export type SyncSessionSeatsAction = (
  input: SyncSessionSeatsValue,
) => Promise<SyncSessionSeatsResult>;

/**
 * Shape validation for the seat-state write. A server action is a public HTTP endpoint, so this
 * input is untrusted no matter what the client component sends. SHAPE and RANGE only: whether
 * the session is open, the seat exists, and the occupancy/player/stack triple is coherent is
 * decided by `seat-state-service.ts` and by `session_seats`' own CHECK constraints.
 */
export const sessionSeatStateSchema = z.object({
  seat: z
    .number()
    .int()
    .min(0)
    .max(SEAT_INDEXES.length - 1),
  occupancy: z.enum(['ACTIVE', 'SITTING_OUT', 'EMPTY']),
  playerId: z.string().min(1).max(200).nullable(),
  // Integer milliBB, in the money type's own range. `> 0` for an occupied seat and `=== 0` for
  // an EMPTY one are decided by the service, which knows which occupancy it is looking at.
  stack: z.number().int().min(0).max(Money.MAX_MILLI_BB),
  // REQUIRED, not optional-with-a-default: an absent flag would be indistinguishable from a
  // confirmed stack, and this write is the column's only writer (ADR-0078b).
  stackUnverified: z.boolean(),
});

export const syncSessionSeatsSchema = z.object({
  sessionId: z.string().min(1).max(200),
  seats: z.array(sessionSeatStateSchema).min(1).max(SEAT_INDEXES.length),
  buttonSeat: z
    .number()
    .int()
    .min(0)
    .max(SEAT_INDEXES.length - 1)
    .nullable(),
});

/* -------------------------------------------------------------------------- */
/* Typed EXTERNAL_HUD entry + seat player replacement (WP-2/WP-3 / ADR-0076)   */
/* -------------------------------------------------------------------------- */

/**
 * The ten external-HUD numbers, as the user typed them, keyed by `ExternalHudStatKey`.
 *
 * A field the user left blank is ABSENT from this map — never present as `""`, never as `"0"`.
 * Absence is how "unknown" travels end to end (ADR-0076), and the server drops a blank string
 * to absence again rather than storing a zero.
 */
export type ExternalHudEntryStats = Readonly<Partial<Record<ExternalHudStatKey, string>>>;

/**
 * Put a player in one seat (WP-2): REPLACE the person in an occupied seat, or SEAT somebody at
 * an empty one.
 *
 * Exactly ONE of `playerId` (picked from the dropdown) and `nickname` (typed, new or existing)
 * is supplied. A typed nickname goes through the SAME normalize-then-reuse path the setup form
 * uses, so an existing nickname is that existing player and never a duplicate row (ADR-0076).
 *
 * The two cases differ in exactly one way, and `stack` is it:
 *
 * - **Occupied seat (replace).** `stack` MUST be `null`. Nobody knows what the new occupant has
 *   in front of them, and handing them the previous player's number would be an invented money
 *   value (`CLAUDE.md` rule 1/5); the seat keeps what it held, the client marks it DIRTY, and
 *   the user types the real figure through the seat-state write above. Occupancy is untouched.
 * - **EMPTY seat (seat).** `stack` is REQUIRED and must be a positive integer milliBB — the
 *   chips the user just counted in front of the person who sat down. The seat becomes `ACTIVE`
 *   and takes that stack. The seat is NOT dirty afterwards: the value came from the user.
 *
 * Sending a stack for an occupied seat, or omitting one for an empty seat, is `INVALID_INPUT`
 * rather than a silently applied default.
 */
export interface ReplaceSeatPlayerValue {
  readonly sessionId: string;
  readonly seat: SeatIndex;
  /** An existing player picked by id, or `null` when a nickname was typed instead. */
  readonly playerId: string | null;
  /** A typed nickname (new or existing), or `null` when a player id was picked instead. */
  readonly nickname: string | null;
  /**
   * `true` when the request came from `새 플레이어 추가` — the caller means a player who does
   * NOT exist yet (ADR-0079).
   *
   * The two intents are separated HERE rather than left to coincide. With `requireNew`, a
   * nickname that normalizes onto an existing player is refused with `PLAYER_EXISTS` and
   * NOTHING is written; a `playerId` alongside it is `INVALID_INPUT`, because "create a new
   * player" and "use this existing one" are contradictory instructions.
   *
   * `false` is the picker path and the unchanged one: reuse-by-nickname stays correct for the
   * setup form, the bulk import and choosing an existing player from the roster.
   *
   * Why it matters: ADAPTIVE reads the LATEST `EXTERNAL_HUD` snapshot whole and never merges
   * per key (ADR-0069), so typing two stats under `새 플레이어 추가` against a name that already
   * has a ten-stat profile silently collapses that profile to two.
   */
  readonly requireNew: boolean;
  /**
   * The starting stack in integer milliBB when this call SEATS somebody at an EMPTY seat, and
   * `null` when it replaces the occupant of a seat that already holds one. Never optional in
   * the first case and never accepted in the second — see the two bullets above.
   */
  readonly stack: number | null;
  /** Optional typed HUD readings appended as a NEW snapshot. `{}` means none were entered. */
  readonly externalHud: ExternalHudEntryStats;
}

export type ReplaceSeatPlayerResult =
  | {
      readonly ok: true;
      readonly seat: SeatIndex;
      /** The player the seat now holds — resolved server-side, never echoed back unchecked. */
      readonly playerId: string;
      /** That player's stored nickname, which for an existing player is NOT what was typed. */
      readonly nickname: string;
      /** `true` when this nickname created a new `players` row. */
      readonly createdPlayer: boolean;
      /**
       * `true` when the call FILLED an empty seat rather than replacing an occupant.
       *
       * The client's dirty handling turns on it: a replaced seat is dirty, because the new
       * occupant's chips are unknown; a newly seated one is NOT, because the stack in this very
       * request is the number the user just counted.
       */
      readonly seatedEmpty: boolean;
      /**
       * `true` when a NEW `EXTERNAL_HUD` snapshot was written. `false` both when nothing was
       * typed and when what was typed is byte-identical to the player's latest snapshot.
       */
      readonly externalHudAppended: boolean;
      /** Freshly read, so the caller can `adaptiveStore.upsertInput` without a second trip. */
      readonly adaptiveInput: AdaptiveOpponentInputWire;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** The server action, as the client component sees it. Passed as a prop, never imported. */
export type ReplaceSeatPlayerAction = (
  input: ReplaceSeatPlayerValue,
) => Promise<ReplaceSeatPlayerResult>;

/**
 * Append one hand-typed `EXTERNAL_HUD` snapshot for a seated player (WP-3).
 *
 * `seatIndex` travels because the returned `AdaptiveOpponentInputWire` is keyed and ORDERED by
 * seat (`adaptiveOpponentList`), exactly as `AdaptiveSeatInput` already carries it for the
 * lineup read. The nickname is NOT sent: the server reads it off the `players` row it has to
 * load anyway, so there is one fewer client-supplied field to trust.
 */
export interface SaveExternalHudSnapshotValue {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly stats: ExternalHudEntryStats;
}

export type SaveExternalHudSnapshotResult =
  | {
      readonly ok: true;
      readonly playerId: string;
      /** `false` when the entry is byte-identical to the latest snapshot, so nothing was written. */
      readonly appended: boolean;
      readonly adaptiveInput: AdaptiveOpponentInputWire;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** The server action, as the client component sees it. Passed as a prop, never imported. */
export type SaveExternalHudSnapshotAction = (
  input: SaveExternalHudSnapshotValue,
) => Promise<SaveExternalHudSnapshotResult>;

/**
 * Shape validation for both typed-HUD paths. Keys are checked as plain bounded strings here and
 * turned into `ExternalHudStatKey`s by the server, exactly as `session-setup/contract.ts`'s
 * `hudSchema` does for the manual HUD — a `z.record` over the key enum would demand all ten.
 */
export const externalHudEntrySchema = z.record(z.string().max(64), z.string().max(64));

export const replaceSeatPlayerSchema = z.object({
  sessionId: z.string().min(1).max(200),
  seat: z
    .number()
    .int()
    .min(0)
    .max(SEAT_INDEXES.length - 1),
  playerId: z.string().min(1).max(200).nullable(),
  nickname: z
    .string()
    .max(MAX_NICKNAME_LENGTH * 4)
    .nullable(),
  // REQUIRED, not optional-with-a-default: defaulting it to `false` would silently restore the
  // exact degradation ADR-0079 exists to stop, and defaulting it to `true` would break the
  // picker. The caller states which of the two controls it is (`CLAUDE.md` rule 5).
  requireNew: z.boolean(),
  // Integer milliBB and in the money type's range. Whether it is REQUIRED (an empty seat) or
  // FORBIDDEN (an occupied one), and whether it is positive, is decided by the service, which
  // is the side that knows what the seat currently holds.
  stack: z.number().int().min(0).max(Money.MAX_MILLI_BB).nullable(),
  externalHud: externalHudEntrySchema,
});

export const saveExternalHudSnapshotSchema = z.object({
  playerId: z.string().min(1).max(200),
  seatIndex: z
    .number()
    .int()
    .min(0)
    .max(SEAT_INDEXES.length - 1),
  stats: externalHudEntrySchema,
});
