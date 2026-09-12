'use server';

/**
 * The skip-hand audit server action.
 *
 * A server action is a public endpoint, so its input is untrusted and is re-validated from
 * scratch by `logSkippedHand`. It is deliberately NOT on a hand path: the store's
 * `skipHand()` transition has already happened, synchronously, in the browser; the table
 * fires this afterwards and unawaited, and nothing about the skip itself waits on it
 * (ADR-0043) — see `lib/table/skip-hand-contract.ts` for the "best-effort audit only" note.
 */
import { cryptoIdFactory } from '@gto-self/shared';
import type { SkipHandAuditResult } from '../../lib/table/skip-hand-contract.js';
import { database } from '../db.js';
import { logSkippedHand, nowTimestamp } from '../skip-hand-service.js';

/** Record one skip-audit row. Best-effort: never blocks or reverts the skip itself. */
export async function logSkippedHandAction(input: unknown): Promise<SkipHandAuditResult> {
  return logSkippedHand(database(), input, { ids: cryptoIdFactory, now: nowTimestamp() });
}
