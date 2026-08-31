/**
 * Starting a session: the whole write, as one function over a database handle.
 *
 * Kept separate from `actions/session.ts` so it can be exercised against a real in-memory
 * database in a test, and so the ids and the clock are INJECTED (ADR-0007) rather than
 * reached for. The `'use server'` wrapper adds nothing but the real handle, the real clock
 * and `cryptoIdFactory`.
 *
 * Everything one submission writes happens in ONE transaction: a partial session — players
 * created, no session — must not be left behind. `poker-core` decides whether the table is
 * playable, `player-core` decides whether a nickname is a nickname, and `@gto-self/db`
 * decides whether a row may exist; this module only sequences them and reports whatever
 * they said.
 */
import { asId, Money, type PlayerId, type SessionId } from '@gto-self/shared';
import type { IdFactory } from '@gto-self/shared';
import { createHudSnapshot, createPlayer, timestamp } from '@gto-self/player-core';
import type { Timestamp } from '@gto-self/player-core';
import { isSeatIndex } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, SeatIndex } from '@gto-self/poker-core';
import {
  findPlayerById,
  findPlayerByNormalizedNickname,
  getPreset,
  getSession,
  insertHudSnapshot,
  insertPlayer,
  insertPreset,
  insertSession,
  searchPlayersByNicknamePrefix,
  updateSessionSeatAutoTopUp,
  updateSessionSeatOccupancy,
  type DbError,
  type GtoDatabase,
} from '@gto-self/db';
import type {
  FormIssue,
  PlayerMatch,
  SearchPlayersResult,
  SessionFormValue,
  StartSessionResult,
  UpdateSeatAutoTopUpResult,
  UpdateSeatOccupancyResult,
} from '../lib/session-setup/contract.js';
import {
  seatAutoTopUpSchema,
  seatOccupancySchema,
  sessionFormSchema,
} from '../lib/session-setup/contract.js';
import { buildTableState, planSession, type SeatPlan } from '../lib/session-setup/plan.js';

/** How many autocomplete candidates the setup form asks for. */
export const PLAYER_SEARCH_LIMIT = 8;

/** Thrown to unwind the transaction. Never escapes this module. */
class Rollback extends Error {
  constructor(readonly issues: readonly FormIssue[]) {
    super('session setup rolled back');
    this.name = 'Rollback';
  }
}

const issue = (
  seat: SeatIndex | null,
  field: string,
  message: string,
  code: string | null = null,
): FormIssue => ({ seat, field, message, code });

/** A `DbError` kept whole — its own code and message, so nothing is swallowed. */
function fromDbError(error: DbError, seat: SeatIndex | null, field: string): FormIssue {
  return issue(seat, field, error.message, error.code);
}

export interface StartSessionDeps {
  readonly ids: IdFactory;
  readonly now: Timestamp;
}

/**
 * Resolve one seat's player: an id the user picked, an existing nickname, or a new player.
 *
 * The nickname lookup is what stops two seats — or two sessions — creating duplicate
 * players for the same person. `players.normalized_nickname` is UNIQUE, so this is a reuse
 * path rather than a race guard, but reusing deliberately means the seat points at the
 * player's whole history instead of a fresh empty one.
 */
function resolvePlayer(db: GtoDatabase, seat: SeatPlan, deps: StartSessionDeps): PlayerId {
  if (seat.existingPlayerId !== null) {
    const found = findPlayerById(db, asId<'Player'>(seat.existingPlayerId));
    if (!found.ok) throw new Rollback([fromDbError(found.error, seat.seat, 'nickname')]);
    if (found.value === null) {
      throw new Rollback([
        issue(
          seat.seat,
          'nickname',
          'that player no longer exists; retype the nickname',
          'NOT_FOUND',
        ),
      ]);
    }
    return found.value.id;
  }

  const existing = findPlayerByNormalizedNickname(db, seat.nickname);
  if (!existing.ok) throw new Rollback([fromDbError(existing.error, seat.seat, 'nickname')]);
  if (existing.value !== null) return existing.value.id;

  const created = createPlayer({
    id: asId<'Player'>(deps.ids.next()),
    nickname: seat.nickname,
    createdAt: deps.now,
  });
  if (!created.ok) {
    throw new Rollback([issue(seat.seat, 'nickname', created.error.message, created.error.code)]);
  }
  const inserted = insertPlayer(db, created.value);
  if (!inserted.ok) throw new Rollback([fromDbError(inserted.error, seat.seat, 'nickname')]);
  return inserted.value.id;
}

/** Internal. The optional manual HUD reading for one seat. Never required. */
function recordHudSnapshot(
  db: GtoDatabase,
  seat: SeatPlan,
  playerId: PlayerId,
  deps: StartSessionDeps,
): void {
  if (seat.hud.length === 0) return;
  const snapshot = createHudSnapshot({
    id: asId<'Snapshot'>(deps.ids.next()),
    playerId,
    recordedAt: deps.now,
    handSample: seat.hudHandSample,
    stats: seat.hud,
  });
  if (!snapshot.ok) {
    throw new Rollback([issue(seat.seat, 'hud', snapshot.error.message, snapshot.error.code)]);
  }
  const written = insertHudSnapshot(db, snapshot.value);
  if (!written.ok) throw new Rollback([fromDbError(written.error, seat.seat, 'hud')]);
}

/**
 * Internal. Each OCCUPIED seat's starting policy, seeded from the session-level default.
 *
 * Auto top-up is a per-seat preference (real-user Alpha feedback), and the setup form
 * deliberately still collects only one session-level default — so every seat that actually
 * holds a player starts on that default and diverges from it later through
 * `updateSeatAutoTopUp`. `plan.seats` is exactly the seats that will be seated: ACTIVE or
 * SITTING_OUT with a player, never EMPTY.
 *
 * A `null` session policy seeds NOTHING: no seat records a policy, which is a different
 * fact from every seat recording a disabled one.
 */
function seedSeatAutoTopUp(
  sessionPolicy: AutoTopUpPolicy | null,
  seats: readonly SeatPlan[],
): Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>> {
  if (sessionPolicy === null) return {};
  const seeded: Partial<Record<SeatIndex, AutoTopUpPolicy>> = {};
  for (const seat of seats) seeded[seat.seat] = sessionPolicy;
  return seeded;
}

/**
 * Validate, resolve, build and write. Returns the new `SessionId`, or every issue the user
 * has to fix. `input` is untrusted: it arrives over the network at a server action.
 */
export function startSession(
  db: GtoDatabase,
  input: unknown,
  deps: StartSessionDeps,
): StartSessionResult {
  const shape = sessionFormSchema.safeParse(input);
  if (!shape.success) {
    return {
      ok: false,
      issues: shape.error.issues.map((detail) =>
        issue(
          null,
          detail.path.join('.') || 'form',
          `submitted form is malformed: ${detail.message}`,
        ),
      ),
    };
  }
  // The AUTHORITATIVE parse of every entered stack: the client's own parse exists only to
  // draw inline feedback and never reaches this side as a number (`prompt` D5).
  const planned = planSession(shape.data as SessionFormValue);
  if (!planned.ok) return { ok: false, issues: planned.issues };
  const plan = planned.value;

  try {
    const sessionId = db.transaction((tx): SessionId => {
      // Drizzle's transaction object IS a database for the repositories' purposes; a
      // repository that opens its own transaction (`insertSession` does) becomes a
      // SAVEPOINT inside this one rather than a second BEGIN.
      const scoped = tx as GtoDatabase;

      const playerIds = new Map<SeatIndex, PlayerId>();
      for (const seat of plan.seats) {
        const playerId = resolvePlayer(scoped, seat, deps);
        playerIds.set(seat.seat, playerId);
        recordHudSnapshot(scoped, seat, playerId, deps);
      }

      const table = buildTableState(plan, (seat) => {
        const playerId = playerIds.get(seat);
        if (playerId === undefined)
          throw new Rollback([issue(seat, 'nickname', 'seat has no player')]);
        return playerId;
      });
      if (!table.ok) throw new Rollback(table.issues);

      // `sessions.preset_id` is a RESTRICT foreign key onto `game_presets`, and the pragma
      // that enforces it is on: the preset row has to exist before the session names it.
      const stored = getPreset(scoped, plan.preset.presetId);
      if (!stored.ok) throw new Rollback([fromDbError(stored.error, null, 'presetId')]);
      if (stored.value === null) {
        const written = insertPreset(scoped, plan.preset, deps.now);
        if (!written.ok) throw new Rollback([fromDbError(written.error, null, 'presetId')]);
      }

      const id = asId<'Session'>(deps.ids.next());
      const record = insertSession(scoped, {
        id,
        label: plan.label,
        presetId: plan.preset.presetId,
        table: table.value,
        autoTopUp: plan.autoTopUp,
        seatAutoTopUp: seedSeatAutoTopUp(plan.autoTopUp, plan.seats),
        createdAt: deps.now,
        updatedAt: deps.now,
        closedAt: null,
      });
      if (!record.ok) throw new Rollback([fromDbError(record.error, null, 'form')]);
      return id;
    });
    return { ok: true, sessionId };
  } catch (error) {
    if (error instanceof Rollback) return { ok: false, issues: error.issues };
    throw error;
  }
}

/**
 * Set ONE seat's own auto top-up policy. The table-side toggle.
 *
 * `input` is untrusted — this is reached from a public server action — so it is re-validated
 * from scratch: the shape through `seatAutoTopUpSchema`, the seat through `isSeatIndex`, and
 * the target through `Money.parseBB` on the TEXT the user typed. No client-computed money
 * number is ever trusted or stored (`CLAUDE.md` rule 1).
 *
 * `threshold` is stored as `targetStack`, exactly the shape `defaultAutoTopUpPolicy`
 * produces and the only shape the seat row can hold; the repository refuses anything else
 * rather than dropping the value.
 *
 * The SESSION is then checked before anything is written, because a valid shape carrying a
 * valid amount can still name a row that must not take one: a session whose sitting has
 * ENDED (`closed_at` set), or a seat that holds no player. Neither has an effect today —
 * `topUpPlan` only tops up ACTIVE seats, and the table only renders a chip for an occupied
 * one — but this is a public HTTP endpoint, and a policy written onto an EMPTY seat is a
 * preference that surfaces the moment Phase 8 seats somebody there.
 *
 * Not on a hot path: this is a toggle between hands, and no hand transition awaits it.
 */
export function updateSeatAutoTopUp(db: GtoDatabase, input: unknown): UpdateSeatAutoTopUpResult {
  const shape = seatAutoTopUpSchema.safeParse(input);
  if (!shape.success) {
    return {
      ok: false,
      issues: shape.error.issues.map((detail) =>
        issue(
          null,
          detail.path.join('.') || 'autoTopUp',
          `submitted value is malformed: ${detail.message}`,
        ),
      ),
    };
  }
  const { sessionId, enabled, targetText } = shape.data;
  if (!isSeatIndex(shape.data.seat)) {
    return { ok: false, issues: [issue(null, 'seat', `seat ${shape.data.seat} is not a seat`)] };
  }
  const seat: SeatIndex = shape.data.seat;

  // The AUTHORITATIVE parse of the entered target. The client's own parse exists only to
  // draw inline feedback and never reaches this side as a number.
  const target = Money.parseBB(targetText);
  if (!target.ok) {
    return {
      ok: false,
      issues: [issue(seat, 'autoTopUpTargetText', `top-up target in BB: ${target.error}`)],
    };
  }
  if (target.value <= 0) {
    return {
      ok: false,
      issues: [
        issue(
          seat,
          'autoTopUpTargetText',
          'the top-up target must be positive',
          'STACK_NOT_POSITIVE',
        ),
      ],
    };
  }

  const id = asId<'Session'>(sessionId);
  const stored = getSession(db, id);
  if (!stored.ok) return { ok: false, issues: [fromDbError(stored.error, seat, 'autoTopUp')] };
  if (stored.value === null) {
    return {
      ok: false,
      issues: [issue(seat, 'sessionId', `session ${sessionId} does not exist`, 'NOT_FOUND')],
    };
  }
  if (stored.value.closedAt !== null) {
    return {
      ok: false,
      issues: [
        issue(
          seat,
          'sessionId',
          `session ${sessionId} has ended and cannot be changed`,
          'CONFLICT',
        ),
      ],
    };
  }
  if (stored.value.table.seats[seat].occupancy === 'EMPTY') {
    return {
      ok: false,
      issues: [issue(seat, 'seat', `seat ${seat} holds no player`, 'SEAT_EMPTY')],
    };
  }

  const policy: AutoTopUpPolicy = {
    enabled,
    targetStack: target.value,
    threshold: target.value,
  };
  const written = updateSessionSeatAutoTopUp(db, id, seat, policy);
  if (!written.ok) return { ok: false, issues: [fromDbError(written.error, seat, 'autoTopUp')] };
  return { ok: true, seat, policy };
}

/**
 * Set ONE seat's occupancy: `ACTIVE` <-> `SITTING_OUT`. The table-side `S` toggle
 * (`docs/UX.md`).
 *
 * `input` is untrusted — this is reached from a public server action — so it is
 * re-validated from scratch: the shape through `seatOccupancySchema`, the seat through
 * `isSeatIndex`. Mirrors `updateSeatAutoTopUp` immediately above: the SESSION is checked
 * before anything is written — a session whose sitting has ENDED (`closed_at` set), or a
 * seat that holds no player, must both be refused rather than accepted onto a row that
 * cannot mean anything there.
 *
 * Not on a hot path: this is a between-hands toggle, and it is applied to the STORE
 * synchronously before this is ever called (`tableStore.ts` — `setSeatOccupancy`); no hand
 * transition awaits it (ADR-0043).
 */
export function updateSeatOccupancy(db: GtoDatabase, input: unknown): UpdateSeatOccupancyResult {
  const shape = seatOccupancySchema.safeParse(input);
  if (!shape.success) {
    return {
      ok: false,
      issues: shape.error.issues.map((detail) =>
        issue(
          null,
          detail.path.join('.') || 'occupancy',
          `submitted value is malformed: ${detail.message}`,
        ),
      ),
    };
  }
  const { sessionId, occupancy } = shape.data;
  if (!isSeatIndex(shape.data.seat)) {
    return { ok: false, issues: [issue(null, 'seat', `seat ${shape.data.seat} is not a seat`)] };
  }
  const seat: SeatIndex = shape.data.seat;

  const id = asId<'Session'>(sessionId);
  const stored = getSession(db, id);
  if (!stored.ok) return { ok: false, issues: [fromDbError(stored.error, seat, 'occupancy')] };
  if (stored.value === null) {
    return {
      ok: false,
      issues: [issue(seat, 'sessionId', `session ${sessionId} does not exist`, 'NOT_FOUND')],
    };
  }
  if (stored.value.closedAt !== null) {
    return {
      ok: false,
      issues: [
        issue(
          seat,
          'sessionId',
          `session ${sessionId} has ended and cannot be changed`,
          'CONFLICT',
        ),
      ],
    };
  }
  if (stored.value.table.seats[seat].occupancy === 'EMPTY') {
    return {
      ok: false,
      issues: [issue(seat, 'seat', `seat ${seat} holds no player`, 'SEAT_EMPTY')],
    };
  }

  const written = updateSessionSeatOccupancy(db, id, seat, occupancy);
  if (!written.ok) return { ok: false, issues: [fromDbError(written.error, seat, 'occupancy')] };
  return { ok: true, seat, occupancy };
}

/** The setup form's nickname autocomplete. Not on any hot path — see `docs/UX.md`. */
export function searchPlayers(db: GtoDatabase, query: unknown): SearchPlayersResult {
  if (typeof query !== 'string') return { ok: false, message: 'search query must be text' };
  const trimmed = query.slice(0, 200);
  const found = searchPlayersByNicknamePrefix(db, trimmed, { limit: PLAYER_SEARCH_LIMIT });
  if (!found.ok) return { ok: false, message: found.error.message };
  const matches: PlayerMatch[] = found.value.map((match) => ({
    id: match.player.id,
    nickname: match.player.nickname,
    kind: match.kind,
  }));
  return { ok: true, matches };
}

/** The clock, in one place, so nothing else in this directory reads it. */
export const nowTimestamp = (): Timestamp => timestamp(Date.now());
