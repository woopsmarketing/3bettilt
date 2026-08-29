/**
 * `players` — manually entered player identity.
 *
 * There is NO delete. `archivePlayer` retires a player, because snapshots, notes and
 * observations point at the id and must never dangle.
 *
 * Every mutation goes through `player-core`'s own mutators, so a stored nickname can never
 * bypass the domain's validation or its duplicate rule. The DB supplies the collision scope
 * (`player-core` never reads storage) and holds the UNIQUE index as the last line.
 */
import { and, eq, ne, sql } from 'drizzle-orm';
import { ok, type PlayerId } from '@gto-self/shared';
import {
  normalizeNickname,
  renamePlayer,
  searchPlayersByNickname,
  setArchived,
  setDisplayAlias,
  type NicknameMatch,
  type NicknameOwner,
  type Player,
  type Timestamp,
} from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, fromPlayerError, type DbResult } from '../errors.js';
import { players } from '../schema.js';
import { collect, decodePlayerRow, playerToRow } from '../rows.js';

/** Insert a player built by `createPlayer`. Fails CONFLICT on a duplicate normalized nickname. */
export function insertPlayer(db: GtoDatabase, player: Player): DbResult<Player> {
  const conflict = findPlayerByNormalizedNickname(db, player.normalizedNickname);
  if (!conflict.ok) return conflict;
  if (conflict.value !== null) {
    return dbErr('CONFLICT', `a player named "${conflict.value.nickname}" already exists`, {
      table: 'players',
      id: conflict.value.id,
      field: 'normalized_nickname',
    });
  }
  const written = attempt({ table: 'players', id: player.id }, () =>
    db.insert(players).values(playerToRow(player)).run(),
  );
  if (!written.ok) return written;
  return ok(player);
}

/** `null` when absent. */
export function findPlayerById(db: GtoDatabase, id: PlayerId): DbResult<Player | null> {
  const rows = attempt({ table: 'players', id }, () =>
    db.select().from(players).where(eq(players.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodePlayerRow(row);
}

/**
 * Exact identity lookup. The argument is normalized here with `player-core`'s own
 * `normalizeNickname`, so a caller may pass either the entered or the normalized form.
 */
export function findPlayerByNormalizedNickname(
  db: GtoDatabase,
  nickname: string,
): DbResult<Player | null> {
  const normalized = normalizeNickname(nickname);
  if (normalized === '') return ok(null);
  const rows = attempt({ table: 'players' }, () =>
    db.select().from(players).where(eq(players.normalizedNickname, normalized)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodePlayerRow(row);
}

export interface PlayerListOptions {
  /** Include archived players. Default false. */
  readonly includeArchived?: boolean;
  readonly limit?: number;
}

/** Every player, ordered by normalized nickname. Archived players are excluded by default. */
export function listPlayers(
  db: GtoDatabase,
  options: PlayerListOptions = {},
): DbResult<readonly Player[]> {
  const rows = attempt({ table: 'players' }, () => {
    const query = db.select().from(players);
    const filtered =
      options.includeArchived === true ? query : query.where(eq(players.archived, false));
    const ordered = filtered.orderBy(players.normalizedNickname, players.id);
    return options.limit === undefined ? ordered.all() : ordered.limit(options.limit).all();
  });
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodePlayerRow));
}

/** Escapes the LIKE wildcards so a nickname containing `%` or `_` searches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, (match) => `\\${match}`);
}

/**
 * The Phase-4 autocomplete. The SQL narrows to a PREFIX of the normalized nickname, which
 * the UNIQUE index on `normalized_nickname` serves directly; the ranking (EXACT before
 * PREFIX) is then `player-core`'s `searchPlayersByNickname`, so the DB and the domain can
 * never disagree about what "matches" means.
 *
 * Substring matches are deliberately NOT fetched: an unanchored `LIKE '%q%'` cannot use the
 * index. A caller that wants them can pass the full `listPlayers` result to
 * `searchPlayersByNickname` itself.
 */
export function searchPlayersByNicknamePrefix(
  db: GtoDatabase,
  query: string,
  options: { readonly limit?: number; readonly includeArchived?: boolean } = {},
): DbResult<readonly NicknameMatch<Player>[]> {
  const normalized = normalizeNickname(query);
  if (normalized === '') return ok([]);
  const rows = attempt({ table: 'players' }, () => {
    const prefix = sql`${players.normalizedNickname} like ${`${escapeLike(normalized)}%`} escape '\\'`;
    const where =
      options.includeArchived === true ? prefix : and(prefix, eq(players.archived, false));
    return db
      .select()
      .from(players)
      .where(where)
      .orderBy(players.normalizedNickname, players.id)
      .all();
  });
  if (!rows.ok) return rows;
  const decoded = collect(rows.value.map(decodePlayerRow));
  if (!decoded.ok) return decoded;
  return ok(searchPlayersByNickname(decoded.value, query, { limit: options.limit }));
}

/** Internal. The already-taken normalized nicknames a rename must not collide with. */
function collisionScope(
  db: GtoDatabase,
  normalized: string,
  selfId: PlayerId,
): DbResult<readonly NicknameOwner[]> {
  const rows = attempt({ table: 'players' }, () =>
    db
      .select({ id: players.id, normalizedNickname: players.normalizedNickname })
      .from(players)
      .where(and(eq(players.normalizedNickname, normalized), ne(players.id, selfId)))
      .all(),
  );
  if (!rows.ok) return rows;
  return ok(
    rows.value.map((row) => ({
      id: row.id as PlayerId,
      normalizedNickname: row.normalizedNickname,
    })),
  );
}

/** Internal. Load, apply a `player-core` mutator, write back. */
function mutate(
  db: GtoDatabase,
  id: PlayerId,
  apply: (player: Player) => DbResult<Player>,
): DbResult<Player> {
  const existing = findPlayerById(db, id);
  if (!existing.ok) return existing;
  if (existing.value === null) {
    return dbErr('NOT_FOUND', `player ${id} does not exist`, { table: 'players', id });
  }
  const updated = apply(existing.value);
  if (!updated.ok) return updated;
  const row = playerToRow(updated.value);
  const written = attempt({ table: 'players', id }, () =>
    db
      .update(players)
      .set({
        nickname: row.nickname,
        normalizedNickname: row.normalizedNickname,
        displayAlias: row.displayAlias,
        updatedAt: row.updatedAt,
        archived: row.archived,
      })
      .where(eq(players.id, id))
      .run(),
  );
  if (!written.ok) return written;
  return ok(updated.value);
}

/**
 * Rename. Both the entered nickname and the re-derived normalized form are rewritten; the
 * duplicate check runs through `player-core` against the rows that actually exist.
 */
export function renamePlayerNickname(
  db: GtoDatabase,
  id: PlayerId,
  nickname: string,
  at: Timestamp,
): DbResult<Player> {
  const normalized = normalizeNickname(nickname);
  const scope = collisionScope(db, normalized, id);
  if (!scope.ok) return scope;
  return mutate(db, id, (player) => {
    const renamed = renamePlayer(player, nickname, at, { existing: scope.value });
    if (!renamed.ok) {
      return renamed.error.code === 'DUPLICATE_NICKNAME'
        ? dbErr('CONFLICT', renamed.error.message, {
            table: 'players',
            id,
            field: 'normalized_nickname',
            domainCode: renamed.error.code,
          })
        : fromPlayerError(renamed.error, { table: 'players', id });
    }
    return renamed;
  });
}

/** Set or clear the display alias. `null` clears it. */
export function setPlayerAlias(
  db: GtoDatabase,
  id: PlayerId,
  alias: string | null,
  at: Timestamp,
): DbResult<Player> {
  return mutate(db, id, (player) => {
    const updated = setDisplayAlias(player, alias, at);
    return updated.ok ? updated : fromPlayerError(updated.error, { table: 'players', id });
  });
}

/**
 * Retire (or un-retire) a player. This is the ONLY removal this package offers: a hard
 * delete would orphan snapshots, notes, observations, session seats and hand seats.
 */
export function archivePlayer(
  db: GtoDatabase,
  id: PlayerId,
  archived: boolean,
  at: Timestamp,
): DbResult<Player> {
  return mutate(db, id, (player) => {
    const updated = setArchived(player, archived, at);
    return updated.ok ? updated : fromPlayerError(updated.error, { table: 'players', id });
  });
}
