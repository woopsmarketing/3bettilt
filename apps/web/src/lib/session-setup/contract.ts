/**
 * The wire contract between the session-setup form and the server actions behind it.
 *
 * PURE and client-safe: no React, no `@gto-self/db`, no Node built-ins. Both the client
 * component and `src/server/actions/session.ts` import it, so neither can drift from the
 * other's idea of what a submission looks like.
 *
 * Everything the user typed travels as TEXT (`CLAUDE.md` rule 3). The client parses a stack
 * only to show inline feedback; the server re-parses the same text with `Money.parseBB` and
 * that parse is the authoritative one. No client-computed money number is ever transmitted
 * or stored.
 */
import { z } from 'zod';
import { MAX_NICKNAME_LENGTH } from '@gto-self/player-core';
import type { HudStatKey } from '@gto-self/player-core';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, SeatIndex } from '@gto-self/poker-core';

/** The three occupancy states a physical seat can be put in from the setup form. */
export type SeatOccupancyChoice = 'ACTIVE' | 'SITTING_OUT' | 'EMPTY';

export const SEAT_OCCUPANCY_CHOICES: readonly SeatOccupancyChoice[] = [
  'ACTIVE',
  'SITTING_OUT',
  'EMPTY',
];

/** One physical seat, exactly as it was typed. */
export interface SeatFormValue {
  readonly occupancy: SeatOccupancyChoice;
  /** Verbatim entered nickname. Never rewritten by validation. */
  readonly nickname: string;
  /** Set when the nickname was picked from the autocomplete; cleared once it is edited. */
  readonly existingPlayerId: string | null;
  /** Verbatim entered stack in BB. Parsed, never replaced. */
  readonly stackText: string;
  readonly isHero: boolean;
  /** Optional manual HUD reading: verbatim percent text per stat. Never required. */
  readonly hud: Readonly<Partial<Record<HudStatKey, string>>>;
  /** Optional HUD hand sample. Empty means "the HUD showed none", which is NOT zero. */
  readonly hudHandsText: string;
}

export interface SessionFormValue {
  readonly presetId: string;
  readonly anteEnabled: boolean;
  readonly label: string;
  readonly buttonSeat: SeatIndex | null;
  readonly autoTopUpEnabled: boolean;
  readonly autoTopUpTargetText: string;
  /** Exactly six entries, indexed by physical seat. */
  readonly seats: readonly SeatFormValue[];
}

/**
 * One thing wrong with the submission, addressed to the control that owns it.
 *
 * `seat === null` means the whole form. `code` carries the ORIGINATING domain code
 * (`EngineErrorCode`, `PlayerErrorCode`, `DbErrorCode`) whenever the issue came from a
 * domain rejection, so the UI shows the engine's own verdict rather than a paraphrase.
 */
export interface FormIssue {
  readonly seat: SeatIndex | null;
  readonly field: string;
  readonly message: string;
  readonly code: string | null;
}

export type StartSessionResult =
  | { readonly ok: true; readonly sessionId: string }
  | { readonly ok: false; readonly issues: readonly FormIssue[] };

export interface PlayerMatch {
  readonly id: string;
  readonly nickname: string;
  readonly kind: 'EXACT' | 'PREFIX' | 'SUBSTRING';
}

export type SearchPlayersResult =
  | { readonly ok: true; readonly matches: readonly PlayerMatch[] }
  | { readonly ok: false; readonly message: string };

/**
 * The two server actions the form needs, as plain function types.
 *
 * They are passed to the client component as PROPS rather than imported by it: a
 * `'use server'` module pulls in `@gto-self/db` and a native SQLite binding, which must
 * never be reachable from a client bundle or from a component test.
 */
export type StartSessionAction = (input: SessionFormValue) => Promise<StartSessionResult>;
export type SearchPlayersAction = (query: string) => Promise<SearchPlayersResult>;

// ---------------------------------------------------------------------------
// Per-seat auto top-up
// ---------------------------------------------------------------------------

/**
 * One seat's auto top-up preference, exactly as it was typed.
 *
 * Auto top-up is a SEAT preference, not one session-wide switch: the setup form's single
 * control is only the session DEFAULT that seeds each occupied seat, and this is how one
 * seat diverges from it afterwards. The setup form itself gains no per-seat field.
 *
 * It lives beside the setup contract rather than in `lib/table/contract.ts` because it is
 * SESSION state (ADR-0045), and for the same reason that file exists: the client component
 * takes the action as a PROP typed here and never imports the `'use server'` module.
 *
 * `targetText` is what the user typed, and it travels as TEXT. The server re-parses it with
 * `Money.parseBB` and that parse is the authoritative one — no client-computed money number
 * is ever transmitted or stored (`CLAUDE.md` rule 1, rule 3).
 */
export interface SeatAutoTopUpValue {
  readonly sessionId: string;
  readonly seat: SeatIndex;
  readonly enabled: boolean;
  /** Verbatim entered target stack in BB. Parsed, never replaced. */
  readonly targetText: string;
}

/**
 * On success the STORED policy comes back, so the table renders what the database now
 * holds rather than what the form believed it sent.
 */
export type UpdateSeatAutoTopUpResult =
  | { readonly ok: true; readonly seat: SeatIndex; readonly policy: AutoTopUpPolicy }
  | { readonly ok: false; readonly issues: readonly FormIssue[] };

/** The table-side toggle's server action, as the client component sees it. */
export type UpdateSeatAutoTopUpAction = (
  input: SeatAutoTopUpValue,
) => Promise<UpdateSeatAutoTopUpResult>;

/**
 * Shape validation for the per-seat toggle. A server action is a public HTTP endpoint, so
 * this input is untrusted no matter what the client component sends. SHAPE only: whether
 * `targetText` is money is decided afterwards by `Money.parseBB`, and whether the seat and
 * session exist is decided by `@gto-self/db`.
 */
export const seatAutoTopUpSchema = z.object({
  sessionId: z.string().min(1).max(200),
  // Range only. `isSeatIndex` on the server is what turns this into a `SeatIndex`.
  seat: z
    .number()
    .int()
    .min(0)
    .max(SEAT_INDEXES.length - 1),
  enabled: z.boolean(),
  targetText: z.string().max(64),
});

/**
 * Shape validation for what actually arrives at the server action. A server action is a
 * public HTTP endpoint: its input is untrusted no matter what the client component sends.
 * This checks SHAPE only — every value's meaning is decided afterwards by `planSession`
 * and by the domain packages.
 */
// Keys are checked against `HUD_STAT_KEYS` by `planSession`, which owns what a stat key
// means; this only proves the field is a string map and not, say, an array.
const hudSchema = z.record(z.string().max(64), z.string().max(64));

const seatSchema = z.object({
  occupancy: z.enum(['ACTIVE', 'SITTING_OUT', 'EMPTY']),
  nickname: z.string().max(MAX_NICKNAME_LENGTH * 4),
  existingPlayerId: z.string().min(1).max(200).nullable(),
  stackText: z.string().max(64),
  isHero: z.boolean(),
  hud: hudSchema,
  hudHandsText: z.string().max(32),
});

export const sessionFormSchema = z.object({
  presetId: z.string().min(1).max(200),
  anteEnabled: z.boolean(),
  label: z.string().max(200),
  // Range only. `isSeatIndex` in `planSession` is what turns this into a `SeatIndex`.
  buttonSeat: z
    .number()
    .int()
    .min(0)
    .max(SEAT_INDEXES.length - 1)
    .nullable(),
  autoTopUpEnabled: z.boolean(),
  autoTopUpTargetText: z.string().max(64),
  seats: z.array(seatSchema).length(SEAT_INDEXES.length),
});
