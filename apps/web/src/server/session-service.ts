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
import { asId, type PlayerId, type SessionId } from '@gto-self/shared';
import type { IdFactory } from '@gto-self/shared';
import { createHudSnapshot, createPlayer, timestamp } from '@gto-self/player-core';
import type { Timestamp } from '@gto-self/player-core';
import type { SeatIndex } from '@gto-self/poker-core';
import {
  findPlayerById,
  findPlayerByNormalizedNickname,
  getPreset,
  insertHudSnapshot,
  insertPlayer,
  insertPreset,
  insertSession,
  searchPlayersByNicknamePrefix,
  type DbError,
  type GtoDatabase,
} from '@gto-self/db';
import type {
  FormIssue,
  PlayerMatch,
  SearchPlayersResult,
  SessionFormValue,
  StartSessionResult,
} from '../lib/session-setup/contract.js';
import { sessionFormSchema } from '../lib/session-setup/contract.js';
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
