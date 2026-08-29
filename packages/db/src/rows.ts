/**
 * Row -> domain conversion. The ONE place a stored row becomes a domain value.
 *
 * Every function here goes through a domain constructor or codec — `createPlayer`,
 * `createHudSnapshot`, `createNote`, `createObservation`, `tableConfigSchema`,
 * `decodeHandEvent` — never a cast. A row that fails validation returns `CORRUPT_ROW`; it
 * is never coerced into a plausible object (`CLAUDE.md` rule 5).
 *
 * Nothing here computes money, and nothing here reads the clock.
 */
import {
  asId,
  isOk,
  Money,
  ok,
  type HandId,
  type MilliBB,
  type PlayerId,
  type SessionId,
} from '@gto-self/shared';
import {
  decodeHandEvent,
  isSeatIndex,
  makeBySeat,
  validateTableConfig,
  tableConfigSchema,
  type HandEvent,
  type SeatIndex,
  type SeatOccupancy,
  type TableConfig,
  type TableSeat,
  type TableState,
} from '@gto-self/poker-core';
import {
  createHudSnapshot,
  createNote,
  createObservation,
  createPlayer,
  isObservedMetric,
  isObservedPosition,
  normalizeNickname,
  recordObservation,
  setArchived,
  validateTimestamp,
  type ObservedMetric,
  type ObservedPosition,
  type Player,
  type PlayerHudSnapshot,
  type PlayerNote,
  type PlayerObservation,
  type Timestamp,
} from '@gto-self/player-core';
import { dbErr, fromEngineError, fromPlayerError, type DbResult } from './errors.js';
import type {
  gamePresets,
  handEvents,
  handPlayers,
  hands,
  playerHudSnapshotStats,
  playerHudSnapshots,
  playerNotes,
  playerObservations,
  players,
  sessionSeats,
  sessions,
} from './schema.js';

export type PlayerRow = typeof players.$inferSelect;
export type HudSnapshotRow = typeof playerHudSnapshots.$inferSelect;
export type HudStatRow = typeof playerHudSnapshotStats.$inferSelect;
export type NoteRow = typeof playerNotes.$inferSelect;
export type ObservationRow = typeof playerObservations.$inferSelect;
export type PresetRow = typeof gamePresets.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionSeatRow = typeof sessionSeats.$inferSelect;
export type HandRow = typeof hands.$inferSelect;
export type HandPlayerRow = typeof handPlayers.$inferSelect;
export type HandEventRow = typeof handEvents.$inferSelect;

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

function decodeTimestamp(value: number, field: string, table: string): DbResult<Timestamp> {
  const result = validateTimestamp(value, field);
  if (!result.ok) return fromPlayerError(result.error, { table, field });
  return result;
}

function decodeSeat(value: number, field: string, table: string): DbResult<SeatIndex> {
  if (!isSeatIndex(value)) {
    return dbErr('CORRUPT_ROW', `${field} must be a seat index 0..5, got ${value}`, {
      table,
      field,
      actual: String(value),
    });
  }
  return ok(value);
}

/** Range check only. This package never does money arithmetic. */
function decodeMoney(value: number, field: string, table: string): DbResult<MilliBB> {
  if (!Number.isInteger(value) || Math.abs(value) > Money.MAX_MILLI_BB) {
    return dbErr(
      'CORRUPT_ROW',
      `${field} must be an integer milliBB within +/-${Money.MAX_MILLI_BB}, got ${value}`,
      { table, field, actual: String(value) },
    );
  }
  return ok(value as MilliBB);
}

function parseJson(text: string, field: string, table: string, id?: string): DbResult<unknown> {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch (error) {
    return dbErr('CORRUPT_ROW', `${field} is not valid JSON: ${String(error)}`, {
      table,
      field,
      ...(id === undefined ? {} : { id }),
    });
  }
}

// ---------------------------------------------------------------------------
// TableConfig
// ---------------------------------------------------------------------------

/**
 * Shape-validated by `poker-core`'s own zod schema, then semantically validated by
 * `validateTableConfig`. Both, because the first proves the document has the right fields
 * and the second proves the money policy inside it is one the engine can actually run.
 */
export function decodeTableConfig(json: string, table: string, id?: string): DbResult<TableConfig> {
  const raw = parseJson(json, 'config_json', table, id);
  if (!raw.ok) return raw;
  const parsed = tableConfigSchema.safeParse(raw.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return dbErr(
      'CORRUPT_ROW',
      `config_json is not a TableConfig: ${issue === undefined ? 'unknown shape' : `${issue.path.join('.') || '(root)'}: ${issue.message}`}`,
      { table, field: 'config_json', ...(id === undefined ? {} : { id }) },
    );
  }
  const validated = validateTableConfig(parsed.data);
  if (!validated.ok) {
    return fromEngineError(validated.error, {
      table,
      field: 'config_json',
      ...(id === undefined ? {} : { id }),
    });
  }
  return ok(validated.value);
}

export interface StoredPreset {
  readonly config: TableConfig;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export function decodePresetRow(row: PresetRow): DbResult<StoredPreset> {
  const config = decodeTableConfig(row.configJson, 'game_presets', row.presetId);
  if (!config.ok) return config;
  if (config.value.presetId !== row.presetId) {
    return dbErr(
      'CORRUPT_ROW',
      `game_presets.preset_id "${row.presetId}" disagrees with config.presetId "${config.value.presetId}"`,
      { table: 'game_presets', id: row.presetId, field: 'preset_id' },
    );
  }
  const createdAt = decodeTimestamp(row.createdAt, 'created_at', 'game_presets');
  if (!createdAt.ok) return createdAt;
  const updatedAt = decodeTimestamp(row.updatedAt, 'updated_at', 'game_presets');
  if (!updatedAt.ok) return updatedAt;
  return ok({ config: config.value, createdAt: createdAt.value, updatedAt: updatedAt.value });
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/**
 * Rebuilt through `createPlayer` (which re-derives the normalized nickname and validates
 * the entered one) and then `setArchived` (which validates `updated_at` against
 * `created_at`). The re-derived normalized form must equal the stored column: that column
 * is the UNIQUE identity key, so a disagreement means the key is wrong, not merely stale.
 *
 * `createPlayer` also TRIMS `nickname` and `display_alias`. A stored `'  Dan  '` would
 * therefore read back as `'Dan'` — a read that silently changed the entered value. Both
 * are compared against the stored columns for exactly the reason `decodeNoteRow` compares
 * the body: a row that would change on read is a corrupt row, not a value to serve
 * (`CLAUDE.md` rule 3).
 */
export function decodePlayerRow(row: PlayerRow): DbResult<Player> {
  const createdAt = decodeTimestamp(row.createdAt, 'created_at', 'players');
  if (!createdAt.ok) return createdAt;
  const updatedAt = decodeTimestamp(row.updatedAt, 'updated_at', 'players');
  if (!updatedAt.ok) return updatedAt;

  const created = createPlayer({
    id: asId<'Player'>(row.id),
    nickname: row.nickname,
    displayAlias: row.displayAlias,
    createdAt: createdAt.value,
  });
  if (!created.ok) return fromPlayerError(created.error, { table: 'players', id: row.id });

  if (created.value.nickname !== row.nickname) {
    return dbErr(
      'CORRUPT_ROW',
      `players row ${row.id}: nickname has untrimmed whitespace and would change on read`,
      {
        table: 'players',
        id: row.id,
        field: 'nickname',
        expected: created.value.nickname,
        actual: row.nickname,
      },
    );
  }
  if (created.value.displayAlias !== row.displayAlias) {
    return dbErr(
      'CORRUPT_ROW',
      `players row ${row.id}: display_alias has untrimmed whitespace and would change on read`,
      {
        table: 'players',
        id: row.id,
        field: 'display_alias',
        expected: created.value.displayAlias ?? '(null)',
        actual: row.displayAlias ?? '(null)',
      },
    );
  }

  if (created.value.normalizedNickname !== row.normalizedNickname) {
    return dbErr(
      'CORRUPT_ROW',
      `players.normalized_nickname "${row.normalizedNickname}" is not the normalization of "${row.nickname}"`,
      {
        table: 'players',
        id: row.id,
        field: 'normalized_nickname',
        expected: created.value.normalizedNickname,
        actual: row.normalizedNickname,
      },
    );
  }

  const archived = setArchived(created.value, row.archived, updatedAt.value);
  if (!archived.ok) return fromPlayerError(archived.error, { table: 'players', id: row.id });
  return archived;
}

/** The row a `Player` writes. Both nickname forms are stored; neither replaces the other. */
export function playerToRow(player: Player): PlayerRow {
  return {
    id: player.id,
    nickname: player.nickname,
    normalizedNickname: player.normalizedNickname,
    displayAlias: player.displayAlias,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
    archived: player.archived,
  };
}

/** Normalization for a search query, taken from `player-core` so both sides agree. */
export const normalizeQuery = normalizeNickname;

// ---------------------------------------------------------------------------
// HUD snapshots
// ---------------------------------------------------------------------------

/**
 * Rebuilt through `createHudSnapshot`, which RE-PARSES each `entered_text`. The re-parsed
 * value must equal the stored `value_centipercent`; a disagreement is a corrupt row, never
 * a silent preference for one column over the other. That is what keeps the verbatim text
 * and the parsed integer honest as two separate columns (`CLAUDE.md` rule 3).
 */
export function decodeHudSnapshotRow(
  row: HudSnapshotRow,
  statRows: readonly HudStatRow[],
): DbResult<PlayerHudSnapshot> {
  const recordedAt = decodeTimestamp(row.recordedAt, 'recorded_at', 'player_hud_snapshots');
  if (!recordedAt.ok) return recordedAt;
  if (row.source !== 'MANUAL_HUD_ENTRY') {
    return dbErr('CORRUPT_ROW', `unknown HUD snapshot source "${row.source}"`, {
      table: 'player_hud_snapshots',
      id: row.id,
      field: 'source',
      expected: 'MANUAL_HUD_ENTRY',
      actual: row.source,
    });
  }
  const ordered = [...statRows].sort((a, b) => a.ordinal - b.ordinal);
  const snapshot = createHudSnapshot({
    id: asId<'Snapshot'>(row.id),
    playerId: asId<'Player'>(row.playerId),
    recordedAt: recordedAt.value,
    handSample: row.handSample,
    stats: ordered.map((stat) => ({
      // `createHudSnapshot` rejects an unknown key, so the cast is validated immediately.
      key: stat.statKey as PlayerHudSnapshot['stats'][number]['key'],
      enteredText: stat.enteredText,
    })),
  });
  if (!snapshot.ok) {
    return fromPlayerError(snapshot.error, { table: 'player_hud_snapshots', id: row.id });
  }
  for (const [index, reading] of snapshot.value.stats.entries()) {
    const stored = ordered[index];
    if (stored === undefined || reading.value !== stored.valueCentipercent) {
      return dbErr(
        'CORRUPT_ROW',
        `player_hud_snapshot_stats.${stored?.statKey ?? '(missing)'}: stored value ${stored?.valueCentipercent ?? '(missing)'} is not what re-parsing "${reading.enteredText}" produces (${reading.value})`,
        {
          table: 'player_hud_snapshot_stats',
          id: row.id,
          field: 'value_centipercent',
          expected: String(reading.value),
          actual: String(stored?.valueCentipercent ?? ''),
        },
      );
    }
  }
  return ok(snapshot.value);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * `createNote` validates the body and the timestamp; `root_id` / `supersedes_id` come from
 * the row, because a revision's chain is a stored fact and cannot be re-derived from one
 * row. The `root_id = id` / `root_id <> id` invariant is a CHECK constraint, re-asserted
 * here so a database written by other means still cannot produce a nonsense chain.
 */
export function decodeNoteRow(row: NoteRow): DbResult<PlayerNote> {
  const createdAt = decodeTimestamp(row.createdAt, 'created_at', 'player_notes');
  if (!createdAt.ok) return createdAt;
  const note = createNote({
    id: asId<'Note'>(row.id),
    playerId: asId<'Player'>(row.playerId),
    body: row.body,
    createdAt: createdAt.value,
  });
  if (!note.ok) return fromPlayerError(note.error, { table: 'player_notes', id: row.id });
  const isOriginal = row.supersedesId === null;
  if (isOriginal !== (row.rootId === row.id)) {
    return dbErr(
      'CORRUPT_ROW',
      `player_notes row ${row.id}: root_id must equal id exactly on an original version`,
      { table: 'player_notes', id: row.id, field: 'root_id' },
    );
  }
  if (note.value.body !== row.body) {
    return dbErr(
      'CORRUPT_ROW',
      `player_notes row ${row.id}: body has untrimmed whitespace and would change on read`,
      { table: 'player_notes', id: row.id, field: 'body' },
    );
  }
  return ok({
    ...note.value,
    rootId: asId<'Note'>(row.rootId),
    supersedesId: row.supersedesId === null ? null : asId<'Note'>(row.supersedesId),
  });
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

export function decodeMetric(value: string, table: string): DbResult<ObservedMetric> {
  if (!isObservedMetric(value)) {
    return dbErr('CORRUPT_ROW', `unknown observed metric "${value}"`, {
      table,
      field: 'metric',
      actual: value,
    });
  }
  return ok(value);
}

export function decodePosition(
  value: string | null,
  table: string,
): DbResult<ObservedPosition | null> {
  if (value === null) return ok(null);
  if (!isObservedPosition(value)) {
    return dbErr('CORRUPT_ROW', `unknown observed position "${value}"`, {
      table,
      field: 'position',
      actual: value,
    });
  }
  return ok(value);
}

/**
 * Rebuilt through `createObservation` at `first_observed_at`, then moved forward to
 * `last_observed_at` with a ZERO delta through `recordObservation`, so the ordering rule
 * the domain enforces is enforced on read too. No rate is stored and none is derived here.
 */
export function decodeObservationRow(row: ObservationRow): DbResult<PlayerObservation> {
  const metric = decodeMetric(row.metric, 'player_observations');
  if (!metric.ok) return metric;
  const position = decodePosition(row.position, 'player_observations');
  if (!position.ok) return position;
  const firstObservedAt = decodeTimestamp(
    row.firstObservedAt,
    'first_observed_at',
    'player_observations',
  );
  if (!firstObservedAt.ok) return firstObservedAt;
  const lastObservedAt = decodeTimestamp(
    row.lastObservedAt,
    'last_observed_at',
    'player_observations',
  );
  if (!lastObservedAt.ok) return lastObservedAt;

  const created = createObservation({
    id: asId<'Observation'>(row.id),
    playerId: asId<'Player'>(row.playerId),
    metric: metric.value,
    position: position.value,
    opportunities: row.opportunities,
    actions: row.actions,
    observedAt: firstObservedAt.value,
  });
  if (!created.ok) {
    return fromPlayerError(created.error, { table: 'player_observations', id: row.id });
  }
  if (lastObservedAt.value === firstObservedAt.value) return created;
  const moved = recordObservation(
    created.value,
    { opportunities: 0, actions: 0 },
    lastObservedAt.value,
  );
  if (!moved.ok) {
    return fromPlayerError(moved.error, { table: 'player_observations', id: row.id });
  }
  return moved;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * A stored session: its identity, the preset it came from (if any), and the `TableState`
 * it is currently in. The config is the session's OWN copy — see `schema.ts`.
 */
export interface SessionRecord {
  readonly id: SessionId;
  readonly label: string | null;
  readonly presetId: string | null;
  readonly table: TableState;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  /** Set when the sitting ended. `null` while it is live. */
  readonly closedAt: Timestamp | null;
}

const OCCUPANCIES: readonly SeatOccupancy[] = ['ACTIVE', 'SITTING_OUT', 'EMPTY'];

function decodeSessionSeatRow(row: SessionSeatRow): DbResult<TableSeat> {
  const seat = decodeSeat(row.seat, 'seat', 'session_seats');
  if (!seat.ok) return seat;
  if (!(OCCUPANCIES as readonly string[]).includes(row.occupancy)) {
    return dbErr('CORRUPT_ROW', `unknown seat occupancy "${row.occupancy}"`, {
      table: 'session_seats',
      field: 'occupancy',
      actual: row.occupancy,
    });
  }
  const occupancy = row.occupancy as SeatOccupancy;
  if ((occupancy === 'EMPTY') !== (row.playerId === null)) {
    return dbErr(
      'CORRUPT_ROW',
      `session_seats seat ${row.seat}: occupancy EMPTY and player_id null must agree`,
      { table: 'session_seats', field: 'occupancy' },
    );
  }
  const stack = decodeMoney(row.stack, 'stack', 'session_seats');
  if (!stack.ok) return stack;
  if (stack.value < 0) {
    return dbErr('CORRUPT_ROW', `session_seats seat ${row.seat}: stack must not be negative`, {
      table: 'session_seats',
      field: 'stack',
    });
  }
  return ok({
    seat: seat.value,
    occupancy,
    playerId: row.playerId === null ? null : asId<'Player'>(row.playerId),
    stack: stack.value,
  });
}

export function decodeSessionRow(
  row: SessionRow,
  seatRows: readonly SessionSeatRow[],
): DbResult<SessionRecord> {
  const config = decodeTableConfig(row.configJson, 'sessions', row.id);
  if (!config.ok) return config;
  const createdAt = decodeTimestamp(row.createdAt, 'created_at', 'sessions');
  if (!createdAt.ok) return createdAt;
  const updatedAt = decodeTimestamp(row.updatedAt, 'updated_at', 'sessions');
  if (!updatedAt.ok) return updatedAt;
  let closedAt: Timestamp | null = null;
  if (row.closedAt !== null) {
    const decoded = decodeTimestamp(row.closedAt, 'closed_at', 'sessions');
    if (!decoded.ok) return decoded;
    closedAt = decoded.value;
  }

  if (seatRows.length !== 6) {
    return dbErr(
      'CORRUPT_ROW',
      `session ${row.id} has ${seatRows.length} seat rows; all six always exist`,
      { table: 'session_seats', id: row.id },
    );
  }
  const bySeat = new Map<SeatIndex, TableSeat>();
  for (const seatRow of seatRows) {
    const decoded = decodeSessionSeatRow(seatRow);
    if (!decoded.ok) return decoded;
    if (bySeat.has(decoded.value.seat)) {
      return dbErr('CORRUPT_ROW', `session ${row.id} has seat ${decoded.value.seat} twice`, {
        table: 'session_seats',
        id: row.id,
      });
    }
    bySeat.set(decoded.value.seat, decoded.value);
  }
  const missing = ([0, 1, 2, 3, 4, 5] as const).find((seat) => !bySeat.has(seat));
  if (missing !== undefined) {
    return dbErr('CORRUPT_ROW', `session ${row.id} is missing seat ${missing}`, {
      table: 'session_seats',
      id: row.id,
    });
  }

  let buttonSeat: SeatIndex | null = null;
  if (row.buttonSeat !== null) {
    const decoded = decodeSeat(row.buttonSeat, 'button_seat', 'sessions');
    if (!decoded.ok) return decoded;
    buttonSeat = decoded.value;
  }
  let heroSeat: SeatIndex | null = null;
  if (row.heroSeat !== null) {
    const decoded = decodeSeat(row.heroSeat, 'hero_seat', 'sessions');
    if (!decoded.ok) return decoded;
    heroSeat = decoded.value;
  }
  if (!Number.isInteger(row.handNumber) || row.handNumber < 0) {
    return dbErr('CORRUPT_ROW', `sessions.hand_number must be a non-negative integer`, {
      table: 'sessions',
      id: row.id,
      field: 'hand_number',
      actual: String(row.handNumber),
    });
  }

  return ok({
    id: asId<'Session'>(row.id),
    label: row.label,
    presetId: row.presetId,
    table: {
      config: config.value,
      seats: makeBySeat((seat) => {
        const value = bySeat.get(seat);
        // Every seat was proved present above; `makeBySeat` needs a total function.
        if (value === undefined) throw new Error(`seat ${seat} vanished between checks`);
        return value;
      }),
      buttonSeat,
      heroSeat,
      handNumber: row.handNumber,
    },
    createdAt: createdAt.value,
    updatedAt: updatedAt.value,
    closedAt,
  });
}

// ---------------------------------------------------------------------------
// Hands
// ---------------------------------------------------------------------------

/** The hand header. The hand's TRUTH is its event log; this is what the log does not say. */
export interface HandRecord {
  readonly id: HandId;
  readonly sessionId: SessionId;
  readonly handNumber: number;
  readonly startedAt: Timestamp;
  readonly finishedAt: Timestamp | null;
}

export interface HandSeatRecord {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly startingStack: MilliBB;
}

export function decodeHandRow(row: HandRow): DbResult<HandRecord> {
  const startedAt = decodeTimestamp(row.startedAt, 'started_at', 'hands');
  if (!startedAt.ok) return startedAt;
  let finishedAt: Timestamp | null = null;
  if (row.finishedAt !== null) {
    const decoded = decodeTimestamp(row.finishedAt, 'finished_at', 'hands');
    if (!decoded.ok) return decoded;
    finishedAt = decoded.value;
  }
  if (!Number.isInteger(row.handNumber) || row.handNumber < 0) {
    return dbErr('CORRUPT_ROW', 'hands.hand_number must be a non-negative integer', {
      table: 'hands',
      id: row.id,
      field: 'hand_number',
      actual: String(row.handNumber),
    });
  }
  return ok({
    id: asId<'Hand'>(row.id),
    sessionId: asId<'Session'>(row.sessionId),
    handNumber: row.handNumber,
    startedAt: startedAt.value,
    finishedAt,
  });
}

export function decodeHandPlayerRow(row: HandPlayerRow): DbResult<HandSeatRecord> {
  const seat = decodeSeat(row.seat, 'seat', 'hand_players');
  if (!seat.ok) return seat;
  const startingStack = decodeMoney(row.startingStack, 'starting_stack', 'hand_players');
  if (!startingStack.ok) return startingStack;
  return ok({
    seat: seat.value,
    playerId: row.playerId === null ? null : asId<'Player'>(row.playerId),
    startingStack: startingStack.value,
  });
}

/**
 * One event row through `poker-core`'s zod codec. The four meta columns are indexed
 * projections of the payload; each is re-checked against the decoded event, so a
 * projection that drifted from the document is a corrupt row rather than a silent
 * mis-ordering.
 */
export function decodeHandEventRow(row: HandEventRow): DbResult<HandEvent> {
  const raw = parseJson(row.payloadJson, 'payload_json', 'hand_events', row.handId);
  if (!raw.ok) return raw;
  const decoded = decodeHandEvent(raw.value);
  if (!decoded.ok) {
    return fromEngineError(decoded.error, { table: 'hand_events', id: row.handId });
  }
  const event = decoded.value;
  const mismatch =
    event.id !== row.eventId
      ? 'event_id'
      : event.seq !== row.seq
        ? 'seq'
        : event.commandSeq !== row.commandSeq
          ? 'command_seq'
          : event.origin !== row.origin
            ? 'origin'
            : event.kind !== row.kind
              ? 'kind'
              : null;
  if (mismatch !== null) {
    return dbErr(
      'CORRUPT_ROW',
      `hand_events ${row.handId}#${row.seq}: column ${mismatch} disagrees with payload_json`,
      { table: 'hand_events', id: row.handId, field: mismatch },
    );
  }
  return ok(event);
}

/** Collect a list of Results, short-circuiting on the first failure. */
export function collect<T>(results: readonly DbResult<T>[]): DbResult<readonly T[]> {
  const values: T[] = [];
  for (const result of results) {
    if (!isOk(result)) return result;
    values.push(result.value);
  }
  return ok(values);
}
