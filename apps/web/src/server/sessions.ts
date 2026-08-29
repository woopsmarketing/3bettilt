/**
 * Server-side session reads. Server-only, like everything under `src/server/`.
 */
import { asId } from '@gto-self/shared';
import { findPlayerById, getSession, type SessionRecord } from '@gto-self/db';
import type { PlayerId } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
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
  return { record: found.value, nicknames, warnings };
}
