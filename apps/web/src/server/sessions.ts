/**
 * Server-side session reads. Server-only, like everything under `src/server/`.
 */
import { asId } from '@gto-self/shared';
import {
  findPlayerById,
  getSession,
  listCompletedHandsForSession,
  maxStoredHandNumber,
  type SessionRecord,
} from '@gto-self/db';
import type { PlayerId } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, SeatIndex } from '@gto-self/poker-core';
import { database } from './db.js';

/**
 * A stored session plus the nicknames its seats point at.
 *
 * The nicknames are looked up here rather than in the client component: `players` is
 * persistence, and the table view is presentation. `null` means the row is gone, which the
 * route turns into a 404.
 */
export interface SessionView {
  /**
   * The stored session. Its `table.handNumber` is the DURABLE high-water mark — the stored
   * counter raised to `max(hands.hand_number)` when the two disagree — so a reloaded table
   * numbers its next hand after the last one it stored rather than colliding with it. See
   * the comment in `loadSessionView`.
   */
  readonly record: SessionRecord;
  /** `playerId` -> entered nickname, for the seats that hold a player. */
  readonly nicknames: Readonly<Record<string, string>>;
  /**
   * Each seat's OWN auto top-up policy, keyed by physical seat; a seat with no entry
   * records none. Auto top-up is a per-seat preference, not one session-wide switch, so the
   * table needs this alongside `record.autoTopUp` — which is only the session DEFAULT the
   * seats were seeded from.
   *
   * The same value as `record.seatAutoTopUp`, surfaced here because the table takes it as
   * its own prop rather than digging it out of the record.
   */
  readonly seatAutoTopUp: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
  /**
   * The seats whose stored stack is UNVERIFIED — a pre-hand figure nobody has confirmed since
   * the hand that disturbed it (ADR-0078b). A seat with no entry is confirmed, so `{}` means
   * every seat's number has been stated by the user or settled from a completed hand.
   *
   * It is on the view because the RELOAD is the whole point: a quick skip leaves the still-live
   * seats holding pre-hand stacks, and those numbers were already persisted while the 확인 필요
   * mark lived only in memory — so a reload rendered unconfirmed money as confirmed money. The
   * table restores the mark from this.
   *
   * The same value as `record.seatStackUnverified`, surfaced here for the same reason
   * `seatAutoTopUp` is: the table takes it as its own prop.
   */
  readonly seatStackUnverified: Readonly<Partial<Record<SeatIndex, true>>>;
  /**
   * How many COMPLETED hands of this session are durably stored, at page-load time
   * (ADR-0059). `null` means the count itself could not be read — which is a different fact
   * from "none stored" and is rendered as such.
   *
   * It is the load-time value only: the table increments its own copy as each hand it
   * finishes is persisted. It exists so a reload can SHOW that history survived, which is
   * the only way the user can tell that the write boundary did its job.
   */
  readonly storedHandCount: number | null;
  /** Non-empty when a seated player could not be read back. Shown, never hidden. */
  readonly warnings: readonly string[];
}

export function loadSessionView(sessionId: string): SessionView | null {
  const db = database();
  const found = getSession(db, asId<'Session'>(sessionId));
  if (!found.ok) {
    // A stored row that will not decode is a real failure, not an absent session: it must
    // not be rendered as "no such session".
    throw new Error(`session ${sessionId} could not be read: ${found.error.message}`);
  }
  if (found.value === null) return null;

  const nicknames: Record<string, string> = {};
  const warnings: string[] = [];
  for (const seat of SEAT_INDEXES) {
    const playerId: PlayerId | null = found.value.table.seats[seat].playerId;
    if (playerId === null || nicknames[playerId] !== undefined) continue;
    const player = findPlayerById(db, playerId);
    if (!player.ok) {
      warnings.push(`seat ${seat + 1}: ${player.error.message}`);
      continue;
    }
    if (player.value === null) {
      warnings.push(`seat ${seat + 1}: player ${playerId} no longer exists`);
      continue;
    }
    nicknames[playerId] = player.value.nickname;
  }
  const storedHands = listCompletedHandsForSession(db, found.value.id);
  if (!storedHands.ok) {
    warnings.push(`저장된 핸드 수를 읽지 못했습니다: ${storedHands.error.message}`);
  }

  // Resume hand numbering from the DURABLE high-water mark, never from 0.
  //
  // `table.handNumber` is the number the NEXT hand takes, and `hands` carries
  // `UNIQUE(session_id, hand_number)`. A reload that handed the store a stale counter made
  // every hand of the new page life collide on that index and be permanently unstorable
  // (review R1/B1).
  //
  // `insertCompletedHand` now advances `sessions.hand_number` in the hand's own transaction,
  // so `found.value.table.handNumber` is normally already correct; `max(hands.hand_number)`
  // is taken alongside it because a session written BEFORE that fix still carries `0` with
  // real hands behind it. The larger is the only safe mark, and a read failure must not
  // silently lower it — it is surfaced and the stored counter is kept.
  const storedMark = maxStoredHandNumber(db, found.value.id);
  if (!storedMark.ok) {
    warnings.push(`핸드 번호 이어쓰기 기준을 읽지 못했습니다: ${storedMark.error.message}`);
  }
  const markFromHands =
    storedMark.ok && storedMark.value !== null
      ? storedMark.value + 1
      : found.value.table.handNumber;
  const highWater = Math.max(found.value.table.handNumber, markFromHands);
  const record: SessionRecord =
    highWater === found.value.table.handNumber
      ? found.value
      : { ...found.value, table: { ...found.value.table, handNumber: highWater } };

  return {
    record,
    nicknames,
    seatAutoTopUp: found.value.seatAutoTopUp,
    seatStackUnverified: found.value.seatStackUnverified,
    storedHandCount: storedHands.ok ? storedHands.value.length : null,
    warnings,
  };
}
