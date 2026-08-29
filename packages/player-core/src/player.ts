/**
 * Player identity.
 *
 * Identity is a MANUALLY ENTERED nickname plus our own observations, and nothing else.
 * It is never derived from a poker client, a hand-history id, or any site account
 * (ADR-0033, `CLAUDE.md` product boundary). Nothing in this file reads an external
 * system; ids and timestamps are injected by the caller (ADR-0007).
 *
 * `nickname` is what the user typed. `normalizedNickname` is a SEPARATE derived field
 * used for search and duplicate detection; it never replaces the entered value
 * (`CLAUDE.md` rule 3). Records are immutable — every mutator returns a new `Player`.
 * A player is retired by setting `archived`, never by deletion, because observations,
 * snapshots and notes reference the id.
 */
import { ok, type PlayerId } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import { validateTimestamp, type Timestamp } from './time.js';

/** Longest accepted nickname or alias, in code points after trimming. */
export const MAX_NICKNAME_LENGTH = 64;

export interface Player {
  readonly id: PlayerId;
  /**
   * Exactly what the user entered, minus surrounding whitespace. Case and internal
   * spacing are PRESERVED: `"DeepStack Dan"` is stored as typed.
   */
  readonly nickname: string;
  /** Derived from `nickname` by `normalizeNickname`. For search and dedup only. */
  readonly normalizedNickname: string;
  /** Optional display name. `null` means "show the nickname". */
  readonly displayAlias: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  /** Retired rather than deleted — referencing records must never dangle. */
  readonly archived: boolean;
}

/**
 * Anything that owns a normalized nickname, so duplicate detection can run against a
 * cheap projection (a `SELECT id, normalized_nickname` row) as well as a full `Player`.
 */
export interface NicknameOwner {
  readonly id: PlayerId;
  readonly normalizedNickname: string;
}

/**
 * Normalization for search and duplicate detection.
 *
 * 1. Unicode NFKC, so visually identical forms compare equal.
 * 2. Trim, and collapse every internal whitespace run to a single space.
 * 3. `toLowerCase()` — locale-INDEPENDENT on purpose. `toLocaleLowerCase()` would make
 *    the stored key depend on the machine's locale (Turkish dotless i), and a stored
 *    key that changes with the environment is not a key.
 *
 * Total. Returns `''` for input that is entirely whitespace; callers validate.
 */
export function normalizeNickname(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** True when two entered nicknames denote the same player identity. Total. */
export const sameNickname = (a: string, b: string): boolean =>
  normalizeNickname(a) === normalizeNickname(b);

const CONTROL = /\p{Cc}/u;

function validateName(
  raw: string,
  field: 'nickname' | 'displayAlias',
): PlayerResult<{ readonly entered: string; readonly normalized: string }> {
  const code = field === 'nickname' ? 'INVALID_NICKNAME' : 'INVALID_ALIAS';
  if (CONTROL.test(raw)) {
    return playerErr(code, `${field} must not contain control characters`, {
      field,
      value: JSON.stringify(raw),
    });
  }
  const entered = raw.trim();
  const normalized = normalizeNickname(raw);
  if (entered === '' || normalized === '') {
    return playerErr(code, `${field} must not be empty`, { field, value: JSON.stringify(raw) });
  }
  const length = [...entered].length;
  if (length > MAX_NICKNAME_LENGTH) {
    return playerErr(code, `${field} must be at most ${MAX_NICKNAME_LENGTH} characters`, {
      field,
      actual: length,
      max: MAX_NICKNAME_LENGTH,
    });
  }
  return ok({ entered, normalized });
}

/**
 * The already-existing players a new or renamed nickname must not collide with.
 * The caller supplies them; this package never reads storage.
 */
export interface NicknameScope {
  readonly existing?: readonly NicknameOwner[];
}

function findConflict(
  normalized: string,
  scope: NicknameScope,
  selfId?: PlayerId,
): NicknameOwner | undefined {
  return scope.existing?.find(
    (owner) => owner.id !== selfId && owner.normalizedNickname === normalized,
  );
}

function duplicate<T>(entered: string, conflict: NicknameOwner): PlayerResult<T> {
  return playerErr('DUPLICATE_NICKNAME', `a player named "${entered}" already exists`, {
    field: 'nickname',
    value: entered,
    conflictingId: conflict.id,
  });
}

export interface CreatePlayerInput {
  /** Injected by the caller (ADR-0007) — never generated here. */
  readonly id: PlayerId;
  readonly nickname: string;
  readonly displayAlias?: string | null;
  readonly createdAt: Timestamp;
}

/**
 * Total. Validates the nickname, derives the normalized form, and rejects a collision
 * against `scope.existing` with `DUPLICATE_NICKNAME`.
 *
 * `updatedAt` starts equal to `createdAt`; `archived` starts false.
 */
export function createPlayer(
  input: CreatePlayerInput,
  scope: NicknameScope = {},
): PlayerResult<Player> {
  const name = validateName(input.nickname, 'nickname');
  if (!name.ok) return name;

  const alias = input.displayAlias ?? null;
  let displayAlias: string | null = null;
  if (alias !== null) {
    const validated = validateName(alias, 'displayAlias');
    if (!validated.ok) return validated;
    displayAlias = validated.value.entered;
  }

  const createdAt = validateTimestamp(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;

  const conflict = findConflict(name.value.normalized, scope);
  if (conflict) return duplicate(name.value.entered, conflict);

  return ok({
    id: input.id,
    nickname: name.value.entered,
    normalizedNickname: name.value.normalized,
    displayAlias,
    createdAt: createdAt.value,
    updatedAt: createdAt.value,
    archived: false,
  });
}

function touch(player: Player, at: number): PlayerResult<Timestamp> {
  const updatedAt = validateTimestamp(at, 'updatedAt');
  if (!updatedAt.ok) return updatedAt;
  if (updatedAt.value < player.updatedAt) {
    return playerErr('TIMESTAMP_OUT_OF_ORDER', 'updatedAt must not move backwards', {
      field: 'updatedAt',
      playerId: player.id,
      actual: updatedAt.value,
      min: player.updatedAt,
    });
  }
  return ok(updatedAt.value);
}

/** Total. Renames a player, re-deriving the normalized form and re-checking collisions. */
export function renamePlayer(
  player: Player,
  nickname: string,
  at: Timestamp,
  scope: NicknameScope = {},
): PlayerResult<Player> {
  const name = validateName(nickname, 'nickname');
  if (!name.ok) return name;
  const updatedAt = touch(player, at);
  if (!updatedAt.ok) return updatedAt;
  const conflict = findConflict(name.value.normalized, scope, player.id);
  if (conflict) return duplicate(name.value.entered, conflict);
  return ok({
    ...player,
    nickname: name.value.entered,
    normalizedNickname: name.value.normalized,
    updatedAt: updatedAt.value,
  });
}

/** Total. `null` clears the alias. */
export function setDisplayAlias(
  player: Player,
  alias: string | null,
  at: Timestamp,
): PlayerResult<Player> {
  const updatedAt = touch(player, at);
  if (!updatedAt.ok) return updatedAt;
  if (alias === null) return ok({ ...player, displayAlias: null, updatedAt: updatedAt.value });
  const validated = validateName(alias, 'displayAlias');
  if (!validated.ok) return validated;
  return ok({ ...player, displayAlias: validated.value.entered, updatedAt: updatedAt.value });
}

/** Total. Archiving is how a player is retired; there is no delete in this domain. */
export function setArchived(
  player: Player,
  archived: boolean,
  at: Timestamp,
): PlayerResult<Player> {
  const updatedAt = touch(player, at);
  if (!updatedAt.ok) return updatedAt;
  return ok({ ...player, archived, updatedAt: updatedAt.value });
}

/** Total. Exact identity lookup by entered or normalized nickname. */
export function findByNickname<T extends NicknameOwner>(
  players: readonly T[],
  nickname: string,
): T | undefined {
  const normalized = normalizeNickname(nickname);
  return players.find((player) => player.normalizedNickname === normalized);
}

export type NicknameMatchKind = 'EXACT' | 'PREFIX' | 'SUBSTRING';

export interface NicknameMatch<T extends NicknameOwner> {
  readonly player: T;
  readonly kind: NicknameMatchKind;
}

const MATCH_RANK: Readonly<Record<NicknameMatchKind, number>> = {
  EXACT: 0,
  PREFIX: 1,
  SUBSTRING: 2,
};

/**
 * Total. Nickname autocomplete for session setup (Phase 4). Matching runs on the
 * normalized form; ranking is EXACT, then PREFIX, then SUBSTRING, and ties break
 * deterministically on the normalized nickname and then the id, so the list never
 * reorders itself between renders. A blank query matches nothing.
 */
export function searchPlayersByNickname<T extends NicknameOwner>(
  players: readonly T[],
  query: string,
  options: { readonly limit?: number } = {},
): readonly NicknameMatch<T>[] {
  const normalized = normalizeNickname(query);
  if (normalized === '') return [];
  const matches: NicknameMatch<T>[] = [];
  for (const player of players) {
    const candidate = player.normalizedNickname;
    const kind: NicknameMatchKind | null =
      candidate === normalized
        ? 'EXACT'
        : candidate.startsWith(normalized)
          ? 'PREFIX'
          : candidate.includes(normalized)
            ? 'SUBSTRING'
            : null;
    if (kind !== null) matches.push({ player, kind });
  }
  matches.sort(
    (a, b) =>
      MATCH_RANK[a.kind] - MATCH_RANK[b.kind] ||
      (a.player.normalizedNickname < b.player.normalizedNickname
        ? -1
        : a.player.normalizedNickname > b.player.normalizedNickname
          ? 1
          : 0) ||
      (a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0),
  );
  const { limit } = options;
  return limit === undefined ? matches : matches.slice(0, Math.max(0, limit));
}
