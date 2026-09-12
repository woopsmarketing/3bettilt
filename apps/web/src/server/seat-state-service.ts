/**
 * The between-hands seat-state writes: re-syncing the seats and the button (WP-5, ADR-0075),
 * and replacing the player who sits in one seat (WP-2, ADR-0076).
 *
 * Kept separate from `actions/seat-state.ts` for the same reason `session-service.ts` is kept
 * separate from `actions/session.ts`: it is exercised against a REAL in-memory database, and
 * the clock and the id factory are INJECTED (ADR-0007) rather than reached for.
 *
 * What this module is NOT allowed to touch, and does not:
 *
 * - `hands`, `hand_events` and every analysis snapshot. A completed hand's stored stacks are
 *   history. Nothing here reads or rewrites them (ADR-0075).
 * - `sessions.hand_number`. `insertCompletedHand` advances it inside the hand's own
 *   transaction and `loadSessionView` reconciles it; this module adds no second writer.
 * - Both `auto_top_up_*` columns. Auto top-up is a per-seat PREFERENCE (ADR-0045) and
 *   `updateSessionSeatAutoTopUp` remains its only writer — `updateSessionSeats` deliberately
 *   cannot express them.
 * - `strategy-core`. REFERENCE is bit-identical across everything in this file.
 *
 * `input` is untrusted everywhere below: a server action is a public HTTP endpoint, so every
 * shape, every seat index and every money value is re-validated here from scratch no matter
 * what the client component believes it sent.
 */
import { asId, Money, type IdFactory } from '@gto-self/shared';
import type { Timestamp } from '@gto-self/player-core';
import { isSeatIndex, SEAT_INDEXES } from '@gto-self/poker-core';
import type { SeatIndex } from '@gto-self/poker-core';
import {
  findPlayerByNormalizedNickname,
  getSession,
  updateSessionButtonSeat,
  updateSessionSeats,
  type SessionRecord,
  type SessionSeatStateUpdate,
  type GtoDatabase,
} from '@gto-self/db';
import type { ReplaceSeatPlayerResult, SyncSessionSeatsResult } from '../lib/table/contract.js';
import { replaceSeatPlayerSchema, syncSessionSeatsSchema } from '../lib/table/contract.js';
import { resolveOrCreatePlayer } from './session-service.js';
import { loadAdaptiveOpponentInput } from './adaptive-service.js';
import {
  appendTypedExternalHud,
  externalHudEntryIsEmpty,
  type ExternalHudEntryDeps,
} from './external-hud-entry-service.js';

export interface SeatStateDeps {
  readonly ids: IdFactory;
  /** The server's own clock reading, taken once at the action boundary. */
  readonly now: Timestamp;
}

interface Refusal {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

const refuse = (code: string, message: string): Refusal => ({ ok: false, code, message });

/**
 * Thrown to unwind `replaceSeatPlayer`'s transaction. Never escapes this module.
 *
 * A refusal decided AFTER a player may already have been created has to roll back, or a
 * rejected replacement leaves a stray `players` row that the nickname lookup would then reuse.
 */
class SeatPlayerRollback extends Error {
  constructor(
    readonly code: string,
    readonly reason: string,
  ) {
    super(reason);
    this.name = 'SeatPlayerRollback';
  }
}

/**
 * Internal. The session, or the reason it may not be written to.
 *
 * Exactly the check `updateSeatAutoTopUp` / `updateSeatOccupancy` already make, in the same
 * order: a session that does not exist is `NOT_FOUND`, and a session whose sitting has ENDED
 * refuses every change rather than accepting one onto a closed record.
 */
function openSession(db: GtoDatabase, sessionId: string): SessionRecord | Refusal {
  const id = asId<'Session'>(sessionId);
  const stored = getSession(db, id);
  if (!stored.ok) return refuse(stored.error.code, stored.error.message);
  if (stored.value === null) {
    return refuse('NOT_FOUND', `session ${sessionId} does not exist`);
  }
  if (stored.value.closedAt !== null) {
    return refuse('SESSION_CLOSED', `session ${sessionId} has ended and cannot be changed`);
  }
  return stored.value;
}

const isRefusal = (value: SessionRecord | Refusal): value is Refusal => 'ok' in value;

/**
 * Internal. Everything the MONEY value on one seat has to be, checked here and not deferred.
 *
 * The `session_seats` CHECKs would catch a negative or a fractional stack, but they would catch
 * it as a thrown constraint violation halfway through a transaction, and they permit `0` on an
 * occupied seat — which the engine does not (`seatPlayer` refuses `STACK_NOT_POSITIVE`) and
 * which is the exact shape of the auto-top-up defect this phase exists to stop recurring. So
 * the money rule is stated once, positively, before anything is written (`CLAUDE.md` rule 1).
 */
function seatStateProblem(seat: {
  readonly seat: number;
  readonly occupancy: 'ACTIVE' | 'SITTING_OUT' | 'EMPTY';
  readonly playerId: string | null;
  readonly stack: number;
}): string | null {
  if (!Money.isMilliBB(seat.stack)) {
    return `seat ${seat.seat}: stack must be an integer number of milliBB within range`;
  }
  if (seat.occupancy === 'EMPTY') {
    if (seat.playerId !== null) return `seat ${seat.seat}: an EMPTY seat holds no player`;
    if (seat.stack !== 0) return `seat ${seat.seat}: an EMPTY seat holds no chips`;
    return null;
  }
  if (seat.playerId === null) return `seat ${seat.seat}: an occupied seat must name a player`;
  if (seat.stack <= 0) return `seat ${seat.seat}: a seated stack must be positive`;
  return null;
}

/**
 * WP-5's server-side half: write the CURRENT seat state and the button in one call.
 *
 * All the seats travel together rather than one call per seat because they are one fact about
 * one moment — the table between two hands — and `updateSessionSeats` applies them in a single
 * transaction that either lands whole or writes nothing.
 *
 * The button is written SECOND and separately, because `packages/db` keeps it on the `sessions`
 * row and deliberately does not fold it into the seat updater. A seat write that lands followed
 * by a button write that fails is reported as a failure, and the seats stay written: that is the
 * honest description of what happened, and the caller's next sync carries the button again.
 *
 * A player seated twice is REFUSED here (ADR-0076) even though `session_seats` would accept it:
 * two seats holding one person makes the adaptive lineup ambiguous, and `loadAdaptiveOpponentInputs`
 * already refuses to read it.
 */
export function syncSessionSeats(
  db: GtoDatabase,
  input: unknown,
  deps: SeatStateDeps,
): SyncSessionSeatsResult {
  const shape = syncSessionSeatsSchema.safeParse(input);
  if (!shape.success) {
    const detail = shape.error.issues
      .map((problem) => `${problem.path.join('.') || 'input'}: ${problem.message}`)
      .join('; ');
    return refuse('INVALID_INPUT', `submitted seat state is malformed: ${detail}`);
  }
  const { sessionId, seats, buttonSeat } = shape.data;

  const seen = new Set<number>();
  const seatedPlayers = new Set<string>();
  const updates: SessionSeatStateUpdate[] = [];
  for (const seat of seats) {
    if (!isSeatIndex(seat.seat)) {
      return refuse('INVALID_INPUT', `seat ${seat.seat} is not a seat`);
    }
    if (seen.has(seat.seat)) {
      return refuse('INVALID_INPUT', `seat ${seat.seat} was supplied twice`);
    }
    seen.add(seat.seat);
    const problem = seatStateProblem(seat);
    if (problem !== null) return refuse('INVALID_INPUT', problem);
    if (seat.playerId !== null) {
      if (seatedPlayers.has(seat.playerId)) {
        return refuse(
          'PLAYER_ALREADY_SEATED',
          `player ${seat.playerId} cannot occupy two seats in one session`,
        );
      }
      seatedPlayers.add(seat.playerId);
    }
    updates.push({
      seat: seat.seat,
      occupancy: seat.occupancy,
      playerId: seat.playerId === null ? null : asId<'Player'>(seat.playerId),
      stack: Money.mbb(seat.stack),
      // Stored, not just marked in memory (ADR-0078b). A seat whose stack is still the
      // pre-hand figure after a quick skip comes back from a reload STILL marked 확인 필요,
      // instead of presenting an unconfirmed number as a confirmed one.
      stackUnverified: seat.stackUnverified,
    });
  }

  if (buttonSeat !== null && !isSeatIndex(buttonSeat)) {
    return refuse('INVALID_INPUT', `seat ${buttonSeat} is not a seat`);
  }

  const session = openSession(db, sessionId);
  if (isRefusal(session)) return session;

  // The seats NOT named in this write may still hold one of the players named in it. Checking
  // only the payload would let a swap that moves a player onto a second seat through, so the
  // stored lineup is checked too — minus the seats this very call is overwriting.
  for (const stored of SEAT_INDEXES) {
    if (seen.has(stored)) continue;
    const held = session.table.seats[stored].playerId;
    if (held !== null && seatedPlayers.has(held)) {
      return refuse(
        'PLAYER_ALREADY_SEATED',
        `player ${held} already occupies seat ${stored} in this session`,
      );
    }
  }

  const written = updateSessionSeats(db, session.id, updates, deps.now);
  if (!written.ok) return refuse(written.error.code, written.error.message);

  const button = updateSessionButtonSeat(db, session.id, buttonSeat, deps.now);
  if (!button.ok) return refuse(button.error.code, button.error.message);

  return { ok: true };
}

/**
 * WP-2's server-side half: put a player in one seat — replacing the occupant of a seat that has
 * one, or seating somebody at an EMPTY seat.
 *
 * The whole thing runs in ONE transaction, so a nickname that creates a player and is then
 * refused for sitting twice leaves no orphan `players` row behind — the same guarantee
 * `startSession` makes about a rejected submission.
 *
 * The two cases differ only in what happens to the seat's MONEY, and the difference is the
 * whole point:
 *
 * - **Replacing.** The stack and the occupancy are carried over UNCHANGED, and `stack` must not
 *   be sent. Nobody knows what the new occupant has in front of them, and claiming the previous
 *   player's chips for them would be an invented money value (`CLAUDE.md` rule 1/5). The client
 *   marks the seat dirty and the user types the real figure through `syncSessionSeats`.
 * - **Seating an EMPTY seat.** `stack` is REQUIRED and must be positive — the chips the user
 *   just counted. The seat becomes `ACTIVE` and takes it, and the seat is NOT dirty, because the
 *   number came from the user rather than from a guess.
 *
 * The seating case is validated to the SAME rules `poker-core`'s `seatPlayer` applies to an
 * empty seat — a positive integer stack, and a table total that stays inside `Money.MAX_MILLI_BB`
 * — without importing the engine: this is the DB path (`updateSessionSeats`), and the checks are
 * restated here so the write cannot land outside what the engine would have allowed.
 *
 * Re-selecting the player who is ALREADY in the seat is allowed and is not a duplicate: it
 * rewrites the same three values, and it is the path by which a HUD reading is typed for the
 * current occupant while the replacement form is open.
 */
export function replaceSeatPlayer(
  db: GtoDatabase,
  input: unknown,
  deps: SeatStateDeps,
): ReplaceSeatPlayerResult {
  const shape = replaceSeatPlayerSchema.safeParse(input);
  if (!shape.success) {
    const detail = shape.error.issues
      .map((problem) => `${problem.path.join('.') || 'input'}: ${problem.message}`)
      .join('; ');
    return refuse('INVALID_INPUT', `submitted seat player is malformed: ${detail}`);
  }
  const { sessionId, playerId, stack, externalHud, requireNew } = shape.data;
  const nickname = shape.data.nickname === null ? null : shape.data.nickname.trim();

  if (!isSeatIndex(shape.data.seat)) {
    return refuse('INVALID_INPUT', `seat ${shape.data.seat} is not a seat`);
  }
  const seat: SeatIndex = shape.data.seat;

  // EXACTLY one identity. Both would be two answers to one question, and neither is no answer
  // at all; guessing which one the client meant is how a seat ends up holding the wrong person.
  const hasNickname = nickname !== null && nickname !== '';
  if (playerId === null && !hasNickname) {
    return refuse('INVALID_INPUT', 'name the player by id or by nickname');
  }
  if (playerId !== null && hasNickname) {
    return refuse('INVALID_INPUT', 'name the player by id OR by nickname, not both');
  }
  // ADR-0079. "Create a new player" and "use this existing one" are contradictory
  // instructions, and picking one of them for the caller is how a seat ends up holding the
  // wrong person — the same reasoning as the two refusals immediately above.
  if (requireNew && playerId !== null) {
    return refuse(
      'INVALID_INPUT',
      'a new player is named by nickname; a player id names one that already exists',
    );
  }

  const session = openSession(db, sessionId);
  if (isRefusal(session)) return session;

  // ADR-0079: `새 플레이어 추가` means NEW. A nickname that normalizes onto somebody who already
  // exists is REFUSED here — outside the transaction, before a `players` row, an `EXTERNAL_HUD`
  // snapshot or a seat write is even attempted, so a refusal leaves the database untouched.
  //
  // Reuse-by-nickname is still right everywhere it was: the setup form, the bulk import and
  // `requireNew: false` below all keep going through `resolveOrCreatePlayer` unchanged. What is
  // refused is only the COMBINATION of "create a new player" with a name that is not new, which
  // reused the match and then appended a two-stat snapshot over a ten-stat profile — and since
  // ADAPTIVE reads the latest snapshot whole and never merges per key (ADR-0069), the effective
  // profile collapsed to the two.
  if (requireNew) {
    const match = findPlayerByNormalizedNickname(db, nickname ?? '');
    if (!match.ok) return refuse(match.error.code, match.error.message);
    if (match.value !== null) {
      return refuse(
        'PLAYER_EXISTS',
        `"${match.value.nickname}" (${match.value.id}) already exists; pick them from the player list instead of adding a new one, so their existing profile is kept`,
      );
    }
  }

  const current = session.table.seats[seat];
  const seatedEmpty = current.occupancy === 'EMPTY';

  // The money rule, stated before anything is written and never defaulted. A stack sent for an
  // occupied seat is an instruction this call refuses to carry out (that is `syncSessionSeats`'
  // job); a stack MISSING for an empty seat is the one value nobody can supply but the user.
  if (!seatedEmpty && stack !== null) {
    return refuse(
      'INVALID_INPUT',
      `seat ${seat} already holds a player; correct its stack through the seat-state write instead`,
    );
  }
  let seatedStack = current.stack;
  if (seatedEmpty) {
    if (stack === null) {
      return refuse('INVALID_INPUT', `seat ${seat} is empty; a starting stack is required`);
    }
    if (!Money.isMilliBB(stack) || stack <= 0) {
      return refuse('INVALID_INPUT', `seat ${seat}: a starting stack must be positive`);
    }
    // `seatPlayer`'s second range rule: six per-seat stacks that are each in range can still
    // sum past `Money.MAX_MILLI_BB`, and `startHand` would then throw out of the engine.
    // A plain number on purpose: this is a SUM under test against the range, not a stored value.
    let total: number = stack;
    for (const other of SEAT_INDEXES) {
      if (other !== seat) total += session.table.seats[other].stack;
    }
    if (total > Money.MAX_MILLI_BB) {
      return refuse(
        'INVALID_INPUT',
        `seat ${seat}: that stack would put the table total out of range`,
      );
    }
    seatedStack = Money.mbb(stack);
  }

  const hudDeps: ExternalHudEntryDeps = { ids: deps.ids, now: deps.now };

  try {
    return db.transaction((tx): ReplaceSeatPlayerResult => {
      // Drizzle's transaction object IS a database for the repositories' purposes; a repository
      // that opens its own transaction becomes a SAVEPOINT inside this one, not a second BEGIN.
      const scoped = tx as GtoDatabase;

      const resolved = resolveOrCreatePlayer(
        scoped,
        { existingPlayerId: playerId, nickname: nickname ?? '' },
        deps,
      );
      if (!resolved.ok) {
        throw new SeatPlayerRollback(resolved.code ?? 'INVALID_INPUT', resolved.message);
      }

      // ADR-0076: one player, at most one seat. The seat being replaced is excluded, so
      // re-picking the current occupant is a no-op rather than a self-collision.
      for (const other of SEAT_INDEXES) {
        if (other === seat) continue;
        if (session.table.seats[other].playerId === resolved.playerId) {
          throw new SeatPlayerRollback(
            'PLAYER_ALREADY_SEATED',
            `${resolved.nickname} already occupies seat ${other} in this session`,
          );
        }
      }

      let externalHudAppended = false;
      if (!externalHudEntryIsEmpty(externalHud)) {
        const appended = appendTypedExternalHud(scoped, resolved.playerId, externalHud, hudDeps);
        if (!appended.ok) throw new SeatPlayerRollback(appended.code, appended.message);
        externalHudAppended = appended.appended;
      }

      const written = updateSessionSeats(
        scoped,
        session.id,
        [
          {
            seat,
            // Replacing carries occupancy and stack over UNCHANGED — this call swaps the person,
            // not the seat's state, so a sitting-out seat stays sitting out. Seating an empty
            // one makes it ACTIVE with the stack the user just counted.
            occupancy: seatedEmpty ? 'ACTIVE' : current.occupancy,
            playerId: resolved.playerId,
            stack: seatedStack,
            // The stored half of the client's dirty mark (ADR-0078b). REPLACING carries the
            // previous occupant's number over, and nobody has counted the new occupant's chips
            // — that stack is UNVERIFIED and stays marked so across a reload. SEATING an empty
            // seat takes the stack in this very request, which the user just counted, so it is
            // confirmed and is not marked.
            stackUnverified: !seatedEmpty,
          },
        ],
        deps.now,
      );
      if (!written.ok) throw new SeatPlayerRollback(written.error.code, written.error.message);

      const refreshed = loadAdaptiveOpponentInput(
        scoped,
        resolved.playerId,
        seat,
        resolved.nickname,
      );
      if (!refreshed.ok) throw new SeatPlayerRollback('READ_FAILED', refreshed.message);

      return {
        ok: true,
        seat,
        playerId: resolved.playerId,
        nickname: resolved.nickname,
        createdPlayer: resolved.created,
        seatedEmpty,
        externalHudAppended,
        adaptiveInput: refreshed.input,
      };
    });
  } catch (error) {
    if (error instanceof SeatPlayerRollback) return refuse(error.code, error.reason);
    throw error;
  }
}
