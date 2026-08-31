/**
 * The wire contract for completed-hand persistence (ADR-0059).
 *
 * PURE and client-safe: no React, no `@gto-self/db`, no Node built-ins. The table's client
 * component imports the TYPES and takes the action as a PROP; `src/server/actions/
 * hand-history.ts` imports the same module, so neither side can drift from the other's idea
 * of what a completed hand looks like on the wire.
 *
 * What travels is the hand's own ENCODED EVENT LOG — `encodeHandEvents(hand.events)` from
 * `poker-core`, which is plain JSON by construction. Nothing derived travels: no pot, no
 * stack, no winner, no rake. The server decodes the log with the engine's own codec and
 * re-folds it with `loadHand`, so the state it stores is a state the engine computed on the
 * server, never one the browser asserted (ADR-0039, `CLAUDE.md` rule 1).
 *
 * The timestamps are the CLIENT's clock — the browser is the only place that knows when the
 * user actually started and finished entering the hand. They are untrusted and the server
 * clamps them against its own clock; see `server/hand-history-service.ts`.
 *
 * This is NOT a hot path. The persist is fired AFTER the hand reaches `COMPLETE`, unawaited,
 * and no poker transition ever waits on it (ADR-0043).
 */
import { z } from 'zod';

export interface PersistCompletedHandValue {
  readonly sessionId: string;
  /**
   * `encodeHandEvents(hand.events)` — the whole log, in order, exactly as the engine encodes
   * it. Typed `unknown` here on purpose: the only thing that may interpret it is
   * `poker-core`'s own decoder, on the server.
   */
  readonly events: readonly unknown[];
  /** Client clock, epoch ms, taken when the hand was dealt. */
  readonly startedAt: number;
  /** Client clock, epoch ms, taken when the hand reached `COMPLETE`. */
  readonly finishedAt: number;
}

/**
 * `ALREADY_PERSISTED` is a SUCCESS: the database is the authority on exactly-once
 * (ADR-0059d), so a duplicate callback, a Strict-Mode double effect or a retry that raced a
 * success all resolve to "this hand is stored".
 */
export type PersistCompletedHandOutcome = 'PERSISTED' | 'ALREADY_PERSISTED';

export type PersistCompletedHandResult =
  | {
      readonly ok: true;
      readonly handId: string;
      readonly outcome: PersistCompletedHandOutcome;
    }
  | {
      /**
       * The originating domain code (`EngineErrorCode`, `DbErrorCode`) or one of this
       * module's own, kept verbatim so the banner shows the real verdict rather than a
       * paraphrase (`CLAUDE.md` rule 3).
       */
      readonly ok: false;
      readonly code: string;
      readonly message: string;
    };

/** The server action, as the client component sees it. Passed as a prop, never imported. */
export type PersistCompletedHandAction = (
  input: PersistCompletedHandValue,
) => Promise<PersistCompletedHandResult>;

/**
 * Shape validation for what arrives at the server action. A server action is a public HTTP
 * endpoint, so this input is untrusted no matter what the client component sends.
 *
 * SHAPE only: whether the events are a legal hand log is decided by `decodeHandEvents` and
 * `loadHand`, whether the session exists by `@gto-self/db`, and whether the timestamps are
 * plausible by the service's clamp. The event cap is a denial-of-service bound, not a poker
 * fact — a real hand is a few dozen events; 5000 is far past any hand a person can enter.
 */
export const persistCompletedHandSchema = z.object({
  sessionId: z.string().min(1).max(200),
  events: z.array(z.unknown()).min(1).max(5000),
  startedAt: z.number(),
  finishedAt: z.number(),
});
