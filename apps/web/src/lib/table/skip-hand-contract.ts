/**
 * The wire contract for the skip-hand audit row (`skipped_hands`, insert-only).
 *
 * PURE and client-safe: no React, no `@gto-self/db`, no Node built-ins — the same shape
 * `history-contract.ts` and `session-setup/contract.ts` follow, so `tableStore.ts` (and any
 * component test that renders the table) never has to import a `'use server'` module.
 *
 * This is a BEST-EFFORT AUDIT ONLY. `TableRoot.tsx` fires it unawaited, strictly AFTER the
 * synchronous `skipHand()` transition has already happened in the browser (`prompt` D1,
 * ADR-0043): nothing about the skip itself — the button rotation, the hand-number advance,
 * the dirty marks — depends on this call succeeding, arriving, or existing at all. A session
 * with no `logSkippedHand` prop still skips hands exactly the same way; the row is simply
 * not recorded for later review.
 *
 * What travels is `sessionId` and the SKIPPED hand's own `handNumber` — the number the table
 * held before `skipHand()` advanced it, i.e. `hand.state.handNumber` off the hand that was
 * just discarded. No event log, no stack, no card ever travels: a skipped hand is explicitly
 * NOT history (`CLAUDE.md` rule 2/3 do not apply to a hand that was thrown away, and nothing
 * here could feed a player observation even if it wanted to — see `packages/db`'s own
 * `skipped_hands` doc comment).
 */
import { z } from 'zod';

/**
 * WHY the hand was skipped. DERIVED from the view at skip time, never chosen by the user:
 *
 * - `HERO_FOLDED_UNOBSERVED` — Hero was dealt in and had already FOLDED, so the rest of the
 *   hand played out without us and is genuinely unobserved.
 * - `QUICK_SKIP` — everything else: the hand really happened, we simply stopped entering it.
 *
 * The column is nullable in storage, but `NULL` there means "written before the column
 * existed" (migration `0009`) and is NOT a member here: a client that can compute the reason
 * always sends one, so an absent value would be a lost fact rather than an unknown one
 * (`CLAUDE.md` rule 3).
 */
export const SKIP_HAND_REASONS = ['QUICK_SKIP', 'HERO_FOLDED_UNOBSERVED'] as const;
export type SkipHandReason = (typeof SKIP_HAND_REASONS)[number];

export interface SkipHandAuditValue {
  readonly sessionId: string;
  /** The skipped hand's own number (`hand.state.handNumber`), not the table's post-skip one. */
  readonly handNumber: number;
  /** Derived from the view at skip time — see `SKIP_HAND_REASONS`. Always sent. */
  readonly reason: SkipHandReason;
}

export type SkipHandAuditResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };

/** The server action, as the client component sees it. Passed as a prop, never imported. */
export type LogSkippedHandAction = (input: SkipHandAuditValue) => Promise<SkipHandAuditResult>;

/**
 * Shape validation for what arrives at the server action. A server action is a public HTTP
 * endpoint, so this input is untrusted no matter what the client component sends. SHAPE
 * only: whether the session exists is decided by `@gto-self/db`.
 */
export const skipHandAuditSchema = z.object({
  sessionId: z.string().min(1).max(200),
  handNumber: z.number().int().min(0),
  // REQUIRED, not optional-with-a-default: a missing reason is a malformed submission, and
  // defaulting one would fabricate an audit fact. NULL belongs to pre-`0009` rows only.
  reason: z.enum(SKIP_HAND_REASONS),
});
