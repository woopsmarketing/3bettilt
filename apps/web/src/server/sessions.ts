/**
 * Server-side session reads. Server-only, like everything under `src/server/`.
 */
import { asId } from '@gto-self/shared';
import { findPlayerById, getSession, type SessionRecord } from '@gto-self/db';
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
  return {
    record: found.value,
    nicknames,
    seatAutoTopUp: found.value.seatAutoTopUp,
    warnings,
  };
}
