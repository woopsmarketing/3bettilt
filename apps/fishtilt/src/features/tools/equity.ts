/**
 * The equity calculator's view model — hero picks 2 cards, an opponent picks 2 cards, the
 * board is optional (0, 3, 4 or 5 cards), and the tool reports the exact heads-up equity
 * split three ways: hero / tie / opponent. No poker rule is decided here — every win/tie/
 * loss count comes straight from `@gto-self/learn-core`'s `exactHeadsUpEquity`, which
 * enumerates every possible runout (`packages/learn-core/src/equity/exact.ts`). This module
 * only arranges the selection state machine, the async call into that engine, and the
 * Korean copy (CLAUDE.md rules 2 and 5).
 *
 * ## Why an in-between board is blocked, not silently rounded
 *
 * A real poker board only ever has 0 (preflop), 3 (flop), 4 (turn) or 5 (river) cards —
 * `exactHeadsUpEquity` itself refuses any other length (`INVALID_BOARD_LENGTH`). A beginner
 * who has picked exactly 1 or 2 board cards has not made a small mistake this tool can round
 * away; they are mid-way through picking a flop (or clearing one), and the honest answer is
 * "not yet, here is what a legal board looks like" — never a number computed by pretending
 * the missing card does not matter (CLAUDE.md rule 5).
 *
 * ## The async seam, and the worker behind it
 *
 * The engine is exposed only through `computeExactEquityAsync`, an `async` function
 * returning `Promise<ExactEquity>`. WP-F2B gave it that shape while the body was still
 * synchronous, precisely so WP-O3 could change the body alone. WP-O3 then measured the
 * shipped page and did: worst-case preflop enumeration (`C(48,5)` = 1,712,304 runouts) holds
 * the main thread for 73ms unthrottled but 300ms at 4x CPU throttling and 461ms at 6x, which
 * trips `docs/FISHTILT_STATE.md` ruling 2's 250ms gate on a mid-range phone. The computation
 * now runs in `equityWorker.ts` and this module owns the request/response plumbing — see
 * "The worker seam" comment further down, next to the code. Callers are unchanged.
 *
 * Where a worker cannot be had, the SAME engine runs on this thread instead. There is no
 * estimate anywhere: both paths call `exactHeadsUpEquity` over the same cards.
 *
 * ## Percentages, from integer basis points only
 *
 * `ExactEquity.heroWinBps`/`tieBps`/`villainWinBps` are integers that sum to EXACTLY 10000.
 * `equityPercentages` re-derives the three DISPLAYED percentages from those integers alone
 * (never from the float `winProb`/`tieProb`/`loseProb`), using the same largest-remainder
 * apportionment `exact.ts` itself uses (`@gto-self/strategy-core`'s `apportion`) — but run
 * again at the DISPLAY's own resolution (tenths of a percent, i.e. a total of 1000, not
 * 10000). Rounding each bps field to one display decimal INDEPENDENTLY can still fail to sum
 * to 100.0%: three counts of, say, 3334/3333/3333 bps each round to "33.3%", summing to
 * 99.9%, even though the bps themselves summed to 10000 exactly. Re-apportioning at the
 * display's own resolution is what actually guarantees the three printed numbers add up to
 * 100.0% — the whole reason this function exists instead of reusing `format.ts`'s
 * general-purpose `formatPercent`.
 */
import { invariant, type Card } from '@gto-self/shared';
import { exactHeadsUpEquity, type ExactEquity } from '@gto-self/learn-core';
import { apportion } from '@gto-self/strategy-core';
import { isEquityWorkerResponse, type EquityWorkerRequest } from './equityWorkerProtocol.js';

/** Hero and the opponent each need exactly this many cards before anything can compute. */
export const EQUITY_HAND_SIZE = 2;

/** The board goes no further than the river. */
export const EQUITY_MAX_BOARD = 5;

/** Board lengths that are neither empty nor a legal street — always blocked, never rounded
 *  away. Mirrors `exact.ts`'s own `LEGAL_BOARD_LENGTHS = [0, 3, 4, 5]` by exclusion. */
const INVALID_BOARD_LENGTHS: ReadonlySet<number> = new Set([1, 2]);

export interface EquityPending {
  readonly status: 'PENDING';
  /** 0, 1 or 2 — how many more hero cards are needed. */
  readonly heroNeeded: number;
  /** 0, 1 or 2 — how many more opponent cards are needed. */
  readonly villainNeeded: number;
  /** True when the board is stuck at 1 or 2 cards — never a legal street. */
  readonly boardInvalid: boolean;
  /** How many board cards are currently selected (only meaningful with `boardInvalid`). */
  readonly boardCount: number;
}

export interface EquityReady {
  readonly status: 'READY';
  readonly hero: readonly [Card, Card];
  readonly villain: readonly [Card, Card];
  readonly board: readonly Card[];
}

export type EquitySelectionStatus = EquityPending | EquityReady;

function exactlyTwo(cards: readonly Card[], who: string): readonly [Card, Card] {
  const [a, b] = cards;
  invariant(
    cards.length === 2 && a !== undefined && b !== undefined,
    `${who} must hold exactly two cards once the selection is reported READY`,
  );
  return [a, b];
}

/**
 * The whole selection state machine. `PENDING` any time the selection cannot be sent to the
 * engine yet — either hand is short a card, or the board is stuck at 1 or 2 cards — and
 * carries everything the copy layer needs to say what is still missing. `READY` only once
 * hero and the opponent each hold exactly 2 cards and the board is a legal length. A card
 * can never be duplicated across hero/villain/board in the first place — the component
 * cross-references each `CardPicker`'s `usedCards` the same way `HandChecker.tsx` does — so
 * this function never has to detect or report a duplicate itself.
 */
export function equitySelectionStatus(
  heroCards: readonly Card[],
  villainCards: readonly Card[],
  boardCards: readonly Card[],
): EquitySelectionStatus {
  const heroNeeded = Math.max(0, EQUITY_HAND_SIZE - heroCards.length);
  const villainNeeded = Math.max(0, EQUITY_HAND_SIZE - villainCards.length);
  const boardInvalid = INVALID_BOARD_LENGTHS.has(boardCards.length);

  if (heroNeeded > 0 || villainNeeded > 0 || boardInvalid) {
    return {
      status: 'PENDING',
      heroNeeded,
      villainNeeded,
      boardInvalid,
      boardCount: boardCards.length,
    };
  }

  return {
    status: 'READY',
    hero: exactlyTwo(heroCards, '내 핸드'),
    villain: exactlyTwo(villainCards, '상대 핸드'),
    board: boardCards,
  };
}

/**
 * The beginner prompt for a `PENDING` selection — one sentence per outstanding issue, never
 * a bare error, in the order a reader fills the page in: hero, then opponent, then the
 * board. Can return more than one sentence at once (e.g. both hands still incomplete).
 */
export function equityPendingMessages(pending: EquityPending): readonly string[] {
  const messages: string[] = [];
  if (pending.heroNeeded > 0) {
    messages.push(`내 핸드 카드를 ${pending.heroNeeded}장 더 선택해주세요.`);
  }
  if (pending.villainNeeded > 0) {
    messages.push(`상대 핸드 카드를 ${pending.villainNeeded}장 더 선택해주세요.`);
  }
  if (pending.boardInvalid) {
    messages.push(
      `보드는 0장(프리플랍), 3장(플랍), 4장(턴), 5장(리버) 중 하나여야 합니다. 지금 보드에 ` +
        `${pending.boardCount}장이 선택되어 있어서 계산할 수 없습니다. 카드를 더 선택하거나 ` +
        `보드 카드를 지워주세요.`,
    );
  }
  return messages;
}

/**
 * The engine call, on whatever thread is running this. The worker below calls the SAME
 * `exactHeadsUpEquity`; this is also the fallback the page runs itself when there is no
 * worker to run it on, so the two paths cannot produce different numbers.
 *
 * Cannot fail from a real selection: `equitySelectionStatus` guarantees exactly 2 hero
 * cards, exactly 2 opponent cards and a legal board length before this is ever called, and
 * the component's cross-referenced `CardPicker`s make a duplicate card impossible to select
 * in the first place — so every error `exactHeadsUpEquity` can return is unreachable from
 * the UI. Checked, not silently trusted (the same discipline `exact.ts` itself uses for its
 * own internal `apportion` call).
 */
function computeExactEquityHere(
  heroCards: readonly Card[],
  villainCards: readonly Card[],
  board: readonly Card[],
): ExactEquity {
  const outcome = exactHeadsUpEquity(heroCards, villainCards, board);
  if (!outcome.ok) {
    throw new Error(
      `the equity calculator asked the engine for an impossible selection: ${outcome.error}`,
    );
  }
  return outcome.value;
}

/*
 * ---------------------------------------------------------------------------------------
 * The worker seam (WP-O3)
 * ---------------------------------------------------------------------------------------
 *
 * WP-F2B left `computeExactEquityAsync` async with a synchronous body so that "only that one
 * function's BODY changes" if WP-O3's measurement ever tripped ruling 2's 250 ms gate. It
 * did: on the shipped build the worst case (preflop, `C(48,5)` = 1,712,304 runouts) is 73 ms
 * of blocked main thread unthrottled, but 300 ms at 4x CPU throttling and 461 ms at 6x —
 * a mid-range phone is the 4x case (`docs/reports/WP_O3_PERFORMANCE.md` §6). The computation
 * is not made faster by moving it; it stops holding the main thread, which is what the gate
 * is about.
 *
 * The worker is created lazily on the first computation, not at module scope: `/tools/equity`
 * is prerendered static HTML, this module is imported during server rendering where there is
 * no `Worker` at all, and a visitor who never reaches a complete selection should not pay for
 * a second script.
 *
 * THE FALLBACK IS THE REAL ENGINE, NOT A PLACEHOLDER (CLAUDE.md rule 5). Anywhere a worker
 * cannot be had — server rendering, a test environment, a browser or CSP that refuses one,
 * a worker that fails to load, a response that does not survive validation — the answer is
 * computed by `computeExactEquityHere` on this thread, through `exactHeadsUpEquity`. The
 * page is slower in that case and nothing else changes; no path returns an estimate.
 */

/** Set once a worker is known to be unusable here. Never reset: a worker that failed to
 *  load will fail again, and retrying it per keystroke would add latency to every
 *  computation to re-learn the same fact. */
let workerUnavailable = false;

let equityWorkerInstance: Worker | null = null;

interface OutstandingRequest {
  readonly resolve: (equity: ExactEquity) => void;
  readonly reject: (reason: unknown) => void;
  /** Recomputes this exact request on this thread — used when the worker is abandoned while
   *  the request is still outstanding, so no caller is ever left with an unsettled promise. */
  readonly computeHere: () => ExactEquity;
}

const outstanding = new Map<number, OutstandingRequest>();
let nextRequestId = 1;

/** Give up on the worker and settle everything still in flight on this thread. */
function abandonWorker(): void {
  workerUnavailable = true;
  if (equityWorkerInstance !== null) {
    equityWorkerInstance.terminate();
    equityWorkerInstance = null;
  }
  const stranded = [...outstanding.values()];
  outstanding.clear();
  for (const request of stranded) {
    try {
      request.resolve(request.computeHere());
    } catch (error) {
      request.reject(error);
    }
  }
}

function receiveWorkerMessage(event: MessageEvent<unknown>): void {
  const response = event.data;
  // A message that is not one of ours — or one that fails the engine's own bps invariant —
  // is never rendered. The worker is abandoned and every outstanding request recomputed
  // here, rather than a plausible-looking number reaching the UI.
  if (!isEquityWorkerResponse(response)) {
    abandonWorker();
    return;
  }
  const request = outstanding.get(response.id);
  if (request === undefined) return;
  outstanding.delete(response.id);
  if (response.ok) {
    request.resolve(response.value);
    return;
  }
  request.reject(
    new Error(
      `the equity calculator asked the engine for an impossible selection: ${response.error}`,
    ),
  );
}

/** The live worker, or `null` when this environment cannot give us one. */
function equityWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (equityWorkerInstance !== null) return equityWorkerInstance;
  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    const created = new Worker(new URL('./equityWorker.ts', import.meta.url), { type: 'module' });
    created.addEventListener('message', receiveWorkerMessage);
    created.addEventListener('error', abandonWorker);
    created.addEventListener('messageerror', abandonWorker);
    equityWorkerInstance = created;
    return created;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/**
 * The async seam the component calls — unchanged signature, unchanged errors, unchanged
 * numbers. Resolves from the worker when there is one and from this thread when there is
 * not; both run `exactHeadsUpEquity` over the same cards.
 */
export async function computeExactEquityAsync(
  heroCards: readonly Card[],
  villainCards: readonly Card[],
  board: readonly Card[],
): Promise<ExactEquity> {
  const worker = equityWorker();
  if (worker === null) return computeExactEquityHere(heroCards, villainCards, board);

  const id = nextRequestId;
  nextRequestId += 1;
  return new Promise<ExactEquity>((resolve, reject) => {
    outstanding.set(id, {
      resolve,
      reject,
      computeHere: () => computeExactEquityHere(heroCards, villainCards, board),
    });
    const request: EquityWorkerRequest = {
      id,
      hero: [...heroCards],
      villain: [...villainCards],
      board: [...board],
    };
    try {
      worker.postMessage(request);
    } catch {
      abandonWorker();
    }
  });
}

export interface EquityPercentages {
  readonly heroPercent: string;
  readonly tiePercent: string;
  readonly villainPercent: string;
}

/** 0.1%-resolution total — 1000 tenths of a percent make exactly 100.0%. */
const DISPLAY_TENTHS_TOTAL = 1000;

/** `423` -> `"42.3%"`. Pure integer arithmetic — `tenths` is always an integer `0..1000`, so
 *  there is never a float left to round. */
function formatTenthsAsPercent(tenths: number): string {
  const whole = Math.trunc(tenths / 10);
  const fraction = tenths % 10;
  return `${whole}.${fraction}%`;
}

/**
 * The three displayed percentages, re-apportioned from the bps fields at the display's own
 * resolution so they always sum to exactly 100.0% (see the module doc's "Percentages"
 * section for why rounding each bps field independently is not good enough).
 */
export function equityPercentages(equity: ExactEquity): EquityPercentages {
  const apportioned = apportion(
    [equity.heroWinBps, equity.tieBps, equity.villainWinBps],
    DISPLAY_TENTHS_TOTAL,
  );
  invariant(apportioned.ok, 'apportioning equity bps into display tenths cannot fail');
  const [heroTenths, tieTenths, villainTenths] = apportioned.value;
  invariant(
    heroTenths !== undefined && tieTenths !== undefined && villainTenths !== undefined,
    'apportion of three inputs must return three outputs',
  );
  return {
    heroPercent: formatTenthsAsPercent(heroTenths),
    tiePercent: formatTenthsAsPercent(tieTenths),
    villainPercent: formatTenthsAsPercent(villainTenths),
  };
}

/**
 * `method`-keyed Korean copy, deliberately written as an exhaustive `Record` over
 * `ExactEquity['method']` rather than an `if (method === 'EXACT')` branch — the same
 * discipline `features/tools/copy.ts` uses for every closed-union error message. Today that
 * union has exactly one member (`'EXACT'`), because `computeExactEquityAsync` only ever
 * calls `exactHeadsUpEquity`, which is always exhaustive. The day a sampled path is added
 * upstream and `method` widens, this Record fails to typecheck until a `'추정'`-shaped entry
 * is written for it — the exact/estimated distinction the WP-F2B brief asks for is enforced
 * by the type system here, not left for a person to remember.
 */
const EQUITY_METHOD_LABEL: Readonly<Record<ExactEquity['method'], string>> = {
  EXACT: '정확 계산',
};

const EQUITY_METHOD_SENTENCE: Readonly<Record<ExactEquity['method'], string>> = {
  EXACT: '같은 상황을 가능한 카드 조합으로 모두 계산한 결과입니다.',
};

const EQUITY_COUNT_SENTENCE: Readonly<Record<ExactEquity['method'], (count: number) => string>> = {
  EXACT: (count) => `${count.toLocaleString('ko-KR')}가지 카드 조합을 모두 계산했습니다.`,
};

export function equityMethodLabel(equity: ExactEquity): string {
  return EQUITY_METHOD_LABEL[equity.method];
}

export function equityMethodSentence(equity: ExactEquity): string {
  return EQUITY_METHOD_SENTENCE[equity.method];
}

export function equityCountSentence(equity: ExactEquity): string {
  return EQUITY_COUNT_SENTENCE[equity.method](equity.runouts);
}

/** Fixed Korean labels the UI shows beside each of the three percentages. The three values
 *  are `heroWinBps` / `tieBps` / `villainWinBps` — PURE win, tie and loss probabilities that
 *  sum to 100%. None of them is 승률(Equity), which the lessons define as wins plus half the
 *  ties (`learn/equity.mdx`), so the labels say "이김", never "승률" (WP-S3-19, review A top
 *  MAJOR: the old "내 핸드 승률" label named the pot-share word for the pure-win number). */
export const EQUITY_HERO_LABEL = '내가 이김';
export const EQUITY_TIE_LABEL = '비김';
export const EQUITY_VILLAIN_LABEL = '상대가 이김';

export const EQUITY_RESET_LABEL = '카드 초기화';
export const EQUITY_SWAP_LABEL = '핸드 바꾸기';
