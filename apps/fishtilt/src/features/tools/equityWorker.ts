/**
 * The equity calculator's Web Worker (WP-O3).
 *
 * ## Why this file exists
 *
 * `docs/FISHTILT_STATE.md` ruling 2 allowed a worker only on a measurement above 250 ms, and
 * ruling 20 left the call to WP-O3. Measured on the shipped build, `/tools/equity`'s worst
 * case — preflop, `C(48,5)` = 1,712,304 runouts — is 73 ms of blocked main thread
 * unthrottled but **300 ms at 4x CPU throttling and 461 ms at 6x** (medians of nine swaps,
 * `docs/reports/WP_O3_PERFORMANCE.md` §6). A mid-range phone is the 4x case, so the gate is
 * breached and this is the remedy ruling 2 names. The work does not get faster here; it
 * stops holding the main thread, so scrolling, focus, the card pickers and the page's own
 * `다시 계산 중…` state all keep working while it runs.
 *
 * ## No second engine
 *
 * This worker computes nothing itself. It decodes the cards, calls the same
 * `exactHeadsUpEquity` the page would have called on its own thread, and posts the result
 * back verbatim. There is no sampling path, no approximation and no cached table here — if
 * this file ever disagreed with the main-thread fallback in `equity.ts`, one of them would
 * be inventing a number (CLAUDE.md rules 2 and 5).
 */
import { exactHeadsUpEquity } from '@gto-self/learn-core';
import { asCard, type Card } from '@gto-self/shared';
import type { EquityWorkerResponse } from './equityWorkerProtocol.js';

/**
 * The worker's own global. `lib` in `tsconfig.json` is `DOM`, not `WebWorker` — the app is a
 * browser app and this one file is the exception — so the scope is named through a local
 * structural type rather than by widening the whole project's lib and changing how every
 * other file typechecks.
 */
interface EquityWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: EquityWorkerResponse): void;
}

const scope = globalThis as unknown as EquityWorkerScope;

/** Plain numbers back into branded cards. `asCard` throws on anything outside 0..51, which
 *  the handler below turns into a normal `ok: false` answer rather than an unhandled worker
 *  error — the page can then say something true about it. */
function decodeCards(value: unknown): readonly Card[] {
  if (!Array.isArray(value)) throw new Error('card list must be an array');
  return value.map((entry) => {
    if (typeof entry !== 'number') throw new Error('card must be a number');
    return asCard(entry);
  });
}

scope.addEventListener('message', (event) => {
  const request = event.data as Record<string, unknown> | null;
  const id = request === null ? undefined : request['id'];
  // No id means nothing to answer to — some other script's message, not ours.
  if (!Number.isInteger(id)) return;
  const requestId = id as number;

  try {
    const outcome = exactHeadsUpEquity(
      decodeCards(request?.['hero']),
      decodeCards(request?.['villain']),
      decodeCards(request?.['board']),
    );
    scope.postMessage(
      outcome.ok
        ? { id: requestId, ok: true, value: outcome.value }
        : { id: requestId, ok: false, error: outcome.error },
    );
  } catch (error) {
    scope.postMessage({
      id: requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
