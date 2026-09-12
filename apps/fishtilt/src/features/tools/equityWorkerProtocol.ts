/**
 * The message shapes `features/tools/equity.ts` (page side) and
 * `features/tools/equityWorker.ts` (worker side) exchange, plus the validator the page side
 * runs before it trusts anything that arrives from the worker.
 *
 * ## Why the protocol is plain numbers
 *
 * A `Card` is a branded integer 0..51 (`@gto-self/shared`), so a hand crosses the worker
 * boundary as an ordinary `number[]` under structured clone with nothing to serialize. The
 * worker re-validates each one through `asCard` rather than casting the brand back on: the
 * page and the worker are separate scripts, and "the sender is our own code" is exactly the
 * assumption that stops being true the first time something else posts to this port.
 *
 * ## Why the response is validated at all
 *
 * `window.onmessage` fires for messages this app did not send. The page side therefore
 * treats `event.data` as `unknown` and checks the invariant the engine itself guarantees —
 * `method === 'EXACT'` and three integer basis-point fields summing to exactly `BPS_TOTAL`
 * (`packages/learn-core/src/equity/exact.ts`) — before letting a value reach the UI. A
 * message that fails the check is never rendered and never silently patched into something
 * plausible (CLAUDE.md rule 5): the page abandons the worker and recomputes the answer on
 * its own thread, through the same engine.
 */
import type { ExactEquity } from '@gto-self/learn-core';

/** One computation the page asks the worker for. `id` is the page's own counter — the worker
 *  echoes it so a response can be matched to its request even out of order. */
export interface EquityWorkerRequest {
  readonly id: number;
  readonly hero: readonly number[];
  readonly villain: readonly number[];
  readonly board: readonly number[];
}

export type EquityWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly value: ExactEquity }
  /** The engine's own `ExactEquityError`, or the message of a throw while decoding cards. */
  | { readonly id: number; readonly ok: false; readonly error: string };

/** `heroWinBps + tieBps + villainWinBps` is exactly this, by `exact.ts`'s own contract. */
const BPS_TOTAL = 10000;

function isExactEquity(value: unknown): value is ExactEquity {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate['method'] !== 'EXACT') return false;
  const hero = candidate['heroWinBps'];
  const tie = candidate['tieBps'];
  const villain = candidate['villainWinBps'];
  if (!Number.isInteger(hero) || !Number.isInteger(tie) || !Number.isInteger(villain)) return false;
  return (hero as number) + (tie as number) + (villain as number) === BPS_TOTAL;
}

export function isEquityWorkerResponse(value: unknown): value is EquityWorkerResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (!Number.isInteger(candidate['id'])) return false;
  if (candidate['ok'] === true) return isExactEquity(candidate['value']);
  if (candidate['ok'] === false) return typeof candidate['error'] === 'string';
  return false;
}
