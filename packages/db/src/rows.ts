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
  parseCards,
  type Card,
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
  type AutoTopUpPolicy,
  type HandEvent,
  type SeatIndex,
  type SeatOccupancy,
  type TableConfig,
  type TableSeat,
  type TableState,
} from '@gto-self/poker-core';
import {
  BET_SIZE_BUCKETS,
  BET_SIZE_KINDS,
  createExternalHudSnapshot,
  createHudSnapshot,
  createNote,
  createObservation,
  createPlayer,
  isModelStatKey,
  isObservedMetric,
  isObservedPosition,
  LINEUP_SHAPES,
  MODEL_STAT_KEYS,
  normalizeNickname,
  OBSERVED_POSITIONS,
  OBSERVED_STREETS,
  POSITION_RELATIONS,
  POSTFLOP_SPOT_FAMILIES,
  POT_TYPES,
  PREFLOP_SIZE_BUCKETS,
  PREFLOP_SPOT_FAMILIES,
  recordObservation,
  setArchived,
  snapshotConfidence,
  spotKey,
  validateSnapshotConfidenceConfig,
  validateTimestamp,
  type BetSizeObservation,
  type ModelStatCount,
  type ObservedMetric,
  type ObservedPosition,
  type ObservedStreet,
  type Player,
  type PlayerExternalHudSnapshot,
  type PlayerHudSnapshot,
  type PlayerModelSnapshot,
  type PlayerNote,
  type PlayerObservation,
  type ShowEvidence,
  type SnapshotConfidenceConfig,
  type SpotDescriptor,
  type SpotStatCount,
  type Timestamp,
} from '@gto-self/player-core';
import { dbErr, fromEngineError, fromPlayerError, type DbResult } from './errors.js';
import {
  ADAPTIVE_TRACE_SOURCES,
  ADAPTIVE_TRACE_STATUSES,
  ANALYSIS_PLAYER_OUTCOMES,
  ANALYSIS_RUN_STATUSES,
  HAND_SOURCES,
  SHOW_OUTCOMES,
  STRATEGY_TRACE_ACTIONS,
  STRATEGY_TRACE_MODES,
  STRATEGY_TRACE_PROVENANCE_QUALITIES,
  STRATEGY_TRACE_SOURCES,
  STRATEGY_TRACE_STREETS,
  type AdaptiveStrategyTraceId,
  type AdaptiveTraceSource,
  type AdaptiveTraceStatus,
  type AnalysisPlayerOutcome,
  type AnalysisRunId,
  type AnalysisRunStatus,
  type HandSource,
  type ModelSnapshotId,
  SKIPPED_HAND_REASONS,
  type SkippedHandId,
  type SkippedHandReason,
  type StrategyDecisionTraceId,
  type StrategyTraceAction,
  type StrategyTraceMode,
  type StrategyTraceProvenanceQuality,
  type StrategyTraceSource,
  type StrategyTraceStreet,
} from './schema.js';
import type {
  adaptiveStrategyTraces,
  analysisRunPlayers,
  analysisRuns,
  gamePresets,
  handEvents,
  handPlayers,
  hands,
  playerExternalHudSnapshotStats,
  playerExternalHudSnapshots,
  playerHudSnapshotStats,
  playerHudSnapshots,
  playerModelBetSizes,
  playerModelShowEvidence,
  playerModelSnapshots,
  playerModelStats,
  playerNotes,
  playerObservations,
  players,
  playerSpotStats,
  sessionSeats,
  sessions,
  skippedHands,
  strategyDecisionTraces,
} from './schema.js';

export type PlayerRow = typeof players.$inferSelect;
export type HudSnapshotRow = typeof playerHudSnapshots.$inferSelect;
export type HudStatRow = typeof playerHudSnapshotStats.$inferSelect;
export type ExternalHudSnapshotRow = typeof playerExternalHudSnapshots.$inferSelect;
export type ExternalHudStatRow = typeof playerExternalHudSnapshotStats.$inferSelect;
export type NoteRow = typeof playerNotes.$inferSelect;
export type ObservationRow = typeof playerObservations.$inferSelect;
export type PresetRow = typeof gamePresets.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionSeatRow = typeof sessionSeats.$inferSelect;
export type HandRow = typeof hands.$inferSelect;
export type HandPlayerRow = typeof handPlayers.$inferSelect;
export type HandEventRow = typeof handEvents.$inferSelect;
export type AnalysisRunRow = typeof analysisRuns.$inferSelect;
export type AnalysisRunPlayerRow = typeof analysisRunPlayers.$inferSelect;
export type ModelSnapshotRow = typeof playerModelSnapshots.$inferSelect;
export type ModelStatRow = typeof playerModelStats.$inferSelect;
export type SpotStatRow = typeof playerSpotStats.$inferSelect;
export type ModelBetSizeRow = typeof playerModelBetSizes.$inferSelect;
export type ModelShowEvidenceRow = typeof playerModelShowEvidence.$inferSelect;
export type StrategyDecisionTraceRow = typeof strategyDecisionTraces.$inferSelect;
export type AdaptiveStrategyTraceRow = typeof adaptiveStrategyTraces.$inferSelect;
export type SkippedHandRow = typeof skippedHands.$inferSelect;

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

/**
 * Same re-parse-and-compare discipline as `decodeHudSnapshotRow`, for the external HUD
 * sibling table. `sample_n` passes through as-is (it is expected to be `null` for every
 * row `WP-K` writes, but the decoder does not assert that — a future source populating a
 * real value is not corruption).
 */
export function decodeExternalHudSnapshotRow(
  row: ExternalHudSnapshotRow,
  statRows: readonly ExternalHudStatRow[],
): DbResult<PlayerExternalHudSnapshot> {
  const recordedAt = decodeTimestamp(
    row.recordedAt,
    'recorded_at',
    'player_external_hud_snapshots',
  );
  if (!recordedAt.ok) return recordedAt;
  if (row.source !== 'EXTERNAL_HUD') {
    return dbErr('CORRUPT_ROW', `unknown external HUD snapshot source "${row.source}"`, {
      table: 'player_external_hud_snapshots',
      id: row.id,
      field: 'source',
      expected: 'EXTERNAL_HUD',
      actual: row.source,
    });
  }
  const ordered = [...statRows].sort((a, b) => a.ordinal - b.ordinal);
  const snapshot = createExternalHudSnapshot({
    id: asId<'Snapshot'>(row.id),
    playerId: asId<'Player'>(row.playerId),
    recordedAt: recordedAt.value,
    importBatchId: row.importBatchId,
    stats: ordered.map((stat) => ({
      // `createExternalHudSnapshot` rejects an unknown key, so the cast is validated
      // immediately.
      key: stat.statKey as PlayerExternalHudSnapshot['stats'][number]['key'],
      enteredText: stat.enteredText,
    })),
  });
  if (!snapshot.ok) {
    return fromPlayerError(snapshot.error, { table: 'player_external_hud_snapshots', id: row.id });
  }
  for (const [index, reading] of snapshot.value.stats.entries()) {
    const stored = ordered[index];
    if (stored === undefined || reading.value !== stored.valueCentipercent) {
      return dbErr(
        'CORRUPT_ROW',
        `player_external_hud_snapshot_stats.${stored?.statKey ?? '(missing)'}: stored value ${stored?.valueCentipercent ?? '(missing)'} is not what re-parsing "${reading.enteredText}" produces (${reading.value})`,
        {
          table: 'player_external_hud_snapshot_stats',
          id: row.id,
          field: 'value_centipercent',
          expected: String(reading.value),
          actual: String(stored?.valueCentipercent ?? ''),
        },
      );
    }
  }
  return ok({ ...snapshot.value, sampleN: row.sampleN });
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
  /**
   * The between-hands auto top-up policy, or `null` when the session records none.
   *
   * Only `enabled` and `targetStack` are stored: Phase 4 sets `threshold = targetStack`,
   * matching `defaultAutoTopUpPolicy`, and `insertSession` REFUSES a policy whose
   * threshold differs rather than dropping it silently. Phase 8 owns the editable
   * threshold and the column it needs.
   */
  readonly autoTopUp: AutoTopUpPolicy | null;
  /**
   * Each seat's OWN policy, keyed by physical seat. A seat with no entry records none.
   *
   * A SIBLING of `autoTopUp`, never nested inside `table`: auto top-up is session state,
   * not table configuration (ADR-0045), and `TableState` is the engine's own type. The
   * session-level `autoTopUp` above is the DEFAULT each occupied seat is seeded from when
   * the session is created; a seat is free to diverge from it afterwards.
   *
   * Stored on `session_seats`, with the same two columns and the same `threshold =
   * targetStack` rule as the session row.
   */
  readonly seatAutoTopUp: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
  /**
   * The seats whose stored `stack` is UNVERIFIED — a pre-hand figure nobody has confirmed
   * since the hand that disturbed it (ADR-0078b). A seat with no entry is verified.
   *
   * A SIBLING of `table`, in the shape of `seatAutoTopUp` above and for the same reason:
   * `TableState` is the engine's own type and knows nothing about whether a number has been
   * confirmed by a human. The only value is the literal `true`, so "unverified" has exactly
   * one representation and `{}` is unambiguously "every seat is confirmed".
   *
   * Stored as `session_seats.stack_unverified` (migration `0010`). `insertSession` writes it,
   * `updateSessionSeats` writes it, and `updateSessionSeatAutoTopUp` /
   * `updateSessionSeatOccupancy` deliberately never touch it.
   */
  readonly seatStackUnverified: Readonly<Partial<Record<SeatIndex, true>>>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  /** Set when the sitting ended. `null` while it is live. */
  readonly closedAt: Timestamp | null;
}

const OCCUPANCIES: readonly SeatOccupancy[] = ['ACTIVE', 'SITTING_OUT', 'EMPTY'];

/** One seat row: the `TableSeat` the engine knows about, plus the seat's own policy. */
interface DecodedSessionSeat {
  readonly seat: TableSeat;
  readonly autoTopUp: AutoTopUpPolicy | null;
  /** `session_seats.stack_unverified` as a boolean. See `SessionRecord.seatStackUnverified`. */
  readonly stackUnverified: boolean;
}

function decodeSessionSeatRow(row: SessionSeatRow): DbResult<DecodedSessionSeat> {
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
  const autoTopUp = decodeAutoTopUpPair(
    row.autoTopUpEnabled,
    row.autoTopUpTargetStack,
    'session_seats',
    row.sessionId,
    `session_seats ${row.sessionId} seat ${row.seat}`,
  );
  if (!autoTopUp.ok) return autoTopUp;
  // NOT NULL with a `0` default since `0010`, and CHECKed to 0/1 — so anything else is a row
  // written around the schema, which is a corrupt row rather than a value to coerce.
  if (row.stackUnverified !== 0 && row.stackUnverified !== 1) {
    return dbErr(
      'CORRUPT_ROW',
      `session_seats.stack_unverified must be 0 or 1, got ${row.stackUnverified}`,
      {
        table: 'session_seats',
        id: row.sessionId,
        field: 'stack_unverified',
        actual: String(row.stackUnverified),
      },
    );
  }
  return ok({
    seat: {
      seat: seat.value,
      occupancy,
      playerId: row.playerId === null ? null : asId<'Player'>(row.playerId),
      stack: stack.value,
    },
    autoTopUp: autoTopUp.value,
    stackUnverified: row.stackUnverified === 1,
  });
}

/**
 * The two `auto_top_up_*` columns as one policy, or `null` when neither is set. Both
 * present or neither: a half-written policy is a corrupt row, not a policy with a guessed
 * half. `threshold` is not stored — it is `targetStack` by construction — so it is
 * re-derived here rather than defaulted to something else.
 *
 * ONE decoder for both `sessions` and `session_seats`, so the session default and a seat's
 * own policy can never disagree about what a stored policy means.
 */
function decodeAutoTopUpPair(
  enabled: number | null,
  target: number | null,
  table: string,
  id: string,
  subject: string,
): DbResult<AutoTopUpPolicy | null> {
  if (enabled === null && target === null) return ok(null);
  if (enabled === null || target === null) {
    return dbErr(
      'CORRUPT_ROW',
      `${subject}: auto_top_up_enabled and auto_top_up_target_stack must both be set or both be null`,
      { table, id, field: 'auto_top_up_enabled' },
    );
  }
  if (enabled !== 0 && enabled !== 1) {
    return dbErr('CORRUPT_ROW', `${table}.auto_top_up_enabled must be 0 or 1, got ${enabled}`, {
      table,
      id,
      field: 'auto_top_up_enabled',
      actual: String(enabled),
    });
  }
  const targetStack = decodeMoney(target, 'auto_top_up_target_stack', table);
  if (!targetStack.ok) return targetStack;
  if (targetStack.value <= 0) {
    return dbErr(
      'CORRUPT_ROW',
      `${table}.auto_top_up_target_stack must be positive, got ${targetStack.value}`,
      { table, id, field: 'auto_top_up_target_stack' },
    );
  }
  return ok({
    enabled: enabled === 1,
    targetStack: targetStack.value,
    threshold: targetStack.value,
  });
}

/** The session-level DEFAULT policy. See `decodeAutoTopUpPair`. */
function decodeAutoTopUp(row: SessionRow): DbResult<AutoTopUpPolicy | null> {
  return decodeAutoTopUpPair(
    row.autoTopUpEnabled,
    row.autoTopUpTargetStack,
    'sessions',
    row.id,
    `session ${row.id}`,
  );
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
  const seatAutoTopUp: Partial<Record<SeatIndex, AutoTopUpPolicy>> = {};
  const seatStackUnverified: Partial<Record<SeatIndex, true>> = {};
  for (const seatRow of seatRows) {
    const decoded = decodeSessionSeatRow(seatRow);
    if (!decoded.ok) return decoded;
    const seat = decoded.value.seat.seat;
    if (bySeat.has(seat)) {
      return dbErr('CORRUPT_ROW', `session ${row.id} has seat ${seat} twice`, {
        table: 'session_seats',
        id: row.id,
      });
    }
    bySeat.set(seat, decoded.value.seat);
    if (decoded.value.autoTopUp !== null) seatAutoTopUp[seat] = decoded.value.autoTopUp;
    if (decoded.value.stackUnverified) seatStackUnverified[seat] = true;
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

  const autoTopUp = decodeAutoTopUp(row);
  if (!autoTopUp.ok) return autoTopUp;

  return ok({
    id: asId<'Session'>(row.id),
    label: row.label,
    presetId: row.presetId,
    autoTopUp: autoTopUp.value,
    seatAutoTopUp,
    seatStackUnverified,
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
  /** How the hand reached us (ADR-0059f). */
  readonly source: HandSource;
  /** Version of the stored representation of this hand's log. */
  readonly schemaVersion: number;
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
  if (!(HAND_SOURCES as readonly string[]).includes(row.source)) {
    return dbErr('CORRUPT_ROW', `unknown hand source "${row.source}"`, {
      table: 'hands',
      id: row.id,
      field: 'source',
      expected: HAND_SOURCES.join(' | '),
      actual: row.source,
    });
  }
  if (!Number.isInteger(row.schemaVersion) || row.schemaVersion < 1) {
    return dbErr('CORRUPT_ROW', 'hands.schema_version must be a positive integer', {
      table: 'hands',
      id: row.id,
      field: 'schema_version',
      actual: String(row.schemaVersion),
    });
  }
  return ok({
    id: asId<'Hand'>(row.id),
    sessionId: asId<'Session'>(row.sessionId),
    handNumber: row.handNumber,
    startedAt: startedAt.value,
    finishedAt,
    source: row.source as HandSource,
    schemaVersion: row.schemaVersion,
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

// ---------------------------------------------------------------------------
// The derived player-learning layer (ADR-0062)
// ---------------------------------------------------------------------------

/** Internal. Membership in one of `player-core`'s vocabulary arrays, as a type guard. */
function memberOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

/** Internal. A `CORRUPT_ROW` for a column holding a value outside its vocabulary. */
function badMember<T>(
  table: string,
  field: string,
  value: string,
  expected: readonly string[],
  id?: string,
): DbResult<T> {
  return dbErr('CORRUPT_ROW', `${table}.${field} holds unknown value "${value}"`, {
    table,
    field,
    expected: expected.join(' | '),
    actual: value,
    ...(id === undefined ? {} : { id }),
  });
}

/** Internal. A non-negative integer count. */
function decodeCount(value: number, field: string, table: string): DbResult<number> {
  if (!Number.isInteger(value) || value < 0) {
    return dbErr('CORRUPT_ROW', `${table}.${field} must be a non-negative integer, got ${value}`, {
      table,
      field,
      actual: String(value),
    });
  }
  return ok(value);
}

export interface AnalysisRunRecord {
  readonly id: AnalysisRunId;
  readonly sessionId: SessionId;
  readonly startedAt: Timestamp;
  readonly finishedAt: Timestamp;
  readonly algorithmVersion: number;
  readonly status: AnalysisRunStatus;
  readonly handCount: number;
  readonly playerCount: number;
  readonly observationCount: number;
  readonly showCount: number;
  /** Verbatim failure metadata as the caller supplied it. Never re-interpreted here. */
  readonly errorJson: string | null;
}

export interface AnalysisRunPlayerRecord {
  readonly runId: AnalysisRunId;
  readonly playerId: PlayerId;
  readonly outcome: AnalysisPlayerOutcome;
  readonly snapshotId: ModelSnapshotId | null;
  readonly errorJson: string | null;
}

/** One run with every per-player outcome it reported. */
export interface AnalysisRunReport {
  readonly run: AnalysisRunRecord;
  /** Ordered by player id, so two reads of the same run are identical. */
  readonly players: readonly AnalysisRunPlayerRecord[];
}

export function decodeAnalysisRunRow(row: AnalysisRunRow): DbResult<AnalysisRunRecord> {
  const startedAt = decodeTimestamp(row.startedAt, 'started_at', 'analysis_runs');
  if (!startedAt.ok) return startedAt;
  const finishedAt = decodeTimestamp(row.finishedAt, 'finished_at', 'analysis_runs');
  if (!finishedAt.ok) return finishedAt;
  if (!memberOf(ANALYSIS_RUN_STATUSES, row.status)) {
    return badMember('analysis_runs', 'status', row.status, ANALYSIS_RUN_STATUSES, row.id);
  }
  const counts = collect([
    decodeCount(row.algorithmVersion, 'algorithm_version', 'analysis_runs'),
    decodeCount(row.handCount, 'hand_count', 'analysis_runs'),
    decodeCount(row.playerCount, 'player_count', 'analysis_runs'),
    decodeCount(row.observationCount, 'observation_count', 'analysis_runs'),
    decodeCount(row.showCount, 'show_count', 'analysis_runs'),
  ]);
  if (!counts.ok) return counts;
  return ok({
    id: asId<'AnalysisRun'>(row.id),
    sessionId: asId<'Session'>(row.sessionId),
    startedAt: startedAt.value,
    finishedAt: finishedAt.value,
    algorithmVersion: row.algorithmVersion,
    status: row.status,
    handCount: row.handCount,
    playerCount: row.playerCount,
    observationCount: row.observationCount,
    showCount: row.showCount,
    errorJson: row.errorJson,
  });
}

export function decodeAnalysisRunPlayerRow(
  row: AnalysisRunPlayerRow,
): DbResult<AnalysisRunPlayerRecord> {
  if (!memberOf(ANALYSIS_PLAYER_OUTCOMES, row.outcome)) {
    return badMember(
      'analysis_run_players',
      'outcome',
      row.outcome,
      ANALYSIS_PLAYER_OUTCOMES,
      row.runId,
    );
  }
  return ok({
    runId: asId<'AnalysisRun'>(row.runId),
    playerId: asId<'Player'>(row.playerId),
    outcome: row.outcome,
    snapshotId: row.snapshotId === null ? null : asId<'ModelSnapshot'>(row.snapshotId),
    errorJson: row.errorJson,
  });
}

/**
 * The snapshot's confidence configuration, rebuilt and re-validated through `player-core`'s
 * own validator. Every per-row `SnapshotConfidence` is then reproduced from the row's stored
 * opportunity count with `snapshotConfidence(n, config)` — pure integer arithmetic, so the
 * reconstruction is bit-identical to what the engine computed rather than approximately
 * equal to it, and no derived weight is stored anywhere.
 */
function decodeConfidenceConfig(row: ModelSnapshotRow): DbResult<SnapshotConfidenceConfig> {
  const config: SnapshotConfidenceConfig = {
    k: row.confidenceK,
    learningThreshold: row.confidenceLearningThreshold,
    knownThreshold: row.confidenceKnownThreshold,
  };
  const validated = validateSnapshotConfidenceConfig(config);
  if (!validated.ok) {
    return fromPlayerError(validated.error, { table: 'player_model_snapshots', id: row.id });
  }
  return ok(config);
}

function decodeModelStatRow(
  row: ModelStatRow,
  config: SnapshotConfidenceConfig,
): DbResult<ModelStatCount> {
  if (!isModelStatKey(row.statKey)) {
    return badMember(
      'player_model_stats',
      'stat_key',
      row.statKey,
      MODEL_STAT_KEYS,
      row.snapshotId,
    );
  }
  if (row.position !== null && !isObservedPosition(row.position)) {
    return badMember(
      'player_model_stats',
      'position',
      row.position,
      OBSERVED_POSITIONS,
      row.snapshotId,
    );
  }
  const counts = collect([
    decodeCount(row.opportunities, 'opportunities', 'player_model_stats'),
    decodeCount(row.actions, 'actions', 'player_model_stats'),
    decodeCount(row.confidenceOpportunities, 'confidence_opportunities', 'player_model_stats'),
  ]);
  if (!counts.ok) return counts;
  return ok({
    key: row.statKey,
    position: row.position,
    opportunities: row.opportunities,
    actions: row.actions,
    confidence: snapshotConfidence(row.confidenceOpportunities, config),
  });
}

/**
 * The spot descriptor is rebuilt from its COLUMNS — the lossless record — and the stored
 * `spot_key` is then re-derived from it with `player-core`'s own `spotKey`. A disagreement
 * is a corrupt row, not a preference for one column over the other: the key is a lossy
 * projection kept for grouping, and nothing may ever have to parse one back into dimensions.
 */
function decodeSpotStatRow(
  row: SpotStatRow,
  config: SnapshotConfidenceConfig,
): DbResult<SpotStatCount> {
  const id = row.snapshotId;
  if (!isObservedPosition(row.position)) {
    return badMember('player_spot_stats', 'position', row.position, OBSERVED_POSITIONS, id);
  }
  if (!memberOf(LINEUP_SHAPES, row.lineup)) {
    return badMember('player_spot_stats', 'lineup', row.lineup, LINEUP_SHAPES, id);
  }
  let spot: SpotDescriptor;
  if (row.phase === 'PREFLOP') {
    if (!memberOf(PREFLOP_SPOT_FAMILIES, row.family)) {
      return badMember('player_spot_stats', 'family', row.family, PREFLOP_SPOT_FAMILIES, id);
    }
    if (row.opponentPosition !== null && !isObservedPosition(row.opponentPosition)) {
      return badMember(
        'player_spot_stats',
        'opponent_position',
        row.opponentPosition,
        OBSERVED_POSITIONS,
        id,
      );
    }
    spot = {
      phase: 'PREFLOP',
      family: row.family,
      position: row.position,
      opponentPosition: row.opponentPosition,
      lineup: row.lineup,
    };
  } else if (row.phase === 'POSTFLOP') {
    if (!memberOf(POSTFLOP_SPOT_FAMILIES, row.family)) {
      return badMember('player_spot_stats', 'family', row.family, POSTFLOP_SPOT_FAMILIES, id);
    }
    if (row.street === null || !memberOf(OBSERVED_STREETS, row.street)) {
      return badMember('player_spot_stats', 'street', String(row.street), OBSERVED_STREETS, id);
    }
    if (row.relation === null || !memberOf(POSITION_RELATIONS, row.relation)) {
      return badMember(
        'player_spot_stats',
        'relation',
        String(row.relation),
        POSITION_RELATIONS,
        id,
      );
    }
    if (row.potType === null || !memberOf(POT_TYPES, row.potType)) {
      return badMember('player_spot_stats', 'pot_type', String(row.potType), POT_TYPES, id);
    }
    if (row.facingSize === null || !memberOf(BET_SIZE_BUCKETS, row.facingSize)) {
      return badMember(
        'player_spot_stats',
        'facing_size',
        String(row.facingSize),
        BET_SIZE_BUCKETS,
        id,
      );
    }
    spot = {
      phase: 'POSTFLOP',
      street: row.street,
      family: row.family,
      position: row.position,
      relation: row.relation,
      lineup: row.lineup,
      potType: row.potType,
      facingSize: row.facingSize,
    };
  } else {
    return badMember('player_spot_stats', 'phase', row.phase, ['PREFLOP', 'POSTFLOP'], id);
  }
  const derived = spotKey(spot);
  if (derived !== row.spotKey) {
    return dbErr(
      'CORRUPT_ROW',
      `player_spot_stats.spot_key disagrees with its dimensions: stored "${row.spotKey}", derived "${derived}"`,
      { table: 'player_spot_stats', id, field: 'spot_key', expected: derived, actual: row.spotKey },
    );
  }
  const counts = collect(
    (
      [
        [row.opportunities, 'opportunities'],
        [row.effectFold, 'effect_fold'],
        [row.effectCheck, 'effect_check'],
        [row.effectCall, 'effect_call'],
        [row.effectBet, 'effect_bet'],
        [row.effectRaise, 'effect_raise'],
        [row.verbFold, 'verb_fold'],
        [row.verbCheck, 'verb_check'],
        [row.verbCall, 'verb_call'],
        [row.verbBet, 'verb_bet'],
        [row.verbRaise, 'verb_raise'],
        [row.verbAllIn, 'verb_all_in'],
        [row.confidenceOpportunities, 'confidence_opportunities'],
      ] as readonly (readonly [number, string])[]
    ).map(([value, field]) => decodeCount(value, field, 'player_spot_stats')),
  );
  if (!counts.ok) return counts;
  return ok({
    spotKey: row.spotKey,
    spot,
    opportunities: row.opportunities,
    // Built in `OBSERVED_ACTION_EFFECTS` / `OBSERVED_ACTIONS` order, which is the order
    // `analysis-core` emits, so `JSON.stringify` of a reloaded snapshot is byte-identical.
    effects: {
      FOLD: row.effectFold,
      CHECK: row.effectCheck,
      CALL: row.effectCall,
      BET: row.effectBet,
      RAISE: row.effectRaise,
    },
    verbs: {
      FOLD: row.verbFold,
      CHECK: row.verbCheck,
      CALL: row.verbCall,
      BET: row.verbBet,
      RAISE: row.verbRaise,
      ALL_IN: row.verbAllIn,
    },
    confidence: snapshotConfidence(row.confidenceOpportunities, config),
  });
}

function decodeBetSizeRow(row: ModelBetSizeRow): DbResult<BetSizeObservation> {
  const id = row.snapshotId;
  if (!memberOf(BET_SIZE_KINDS, row.kind)) {
    return badMember('player_model_bet_sizes', 'kind', row.kind, BET_SIZE_KINDS, id);
  }
  const buckets = [...BET_SIZE_BUCKETS, ...PREFLOP_SIZE_BUCKETS] as readonly string[];
  if (!buckets.includes(row.bucket)) {
    return badMember('player_model_bet_sizes', 'bucket', row.bucket, buckets, id);
  }
  const amounts = collect(
    (
      [
        [row.toAmount, 'to_amount'],
        [row.amount, 'amount'],
        [row.potBefore, 'pot_before'],
        [row.currentBetBefore, 'current_bet_before'],
        [row.bigBlind, 'big_blind'],
      ] as readonly (readonly [number, string])[]
    ).map(([value, field]) => decodeMoney(value, field, 'player_model_bet_sizes')),
  );
  if (!amounts.ok) return amounts;
  return ok({
    handId: asId<'Hand'>(row.handId),
    playerId: asId<'Player'>(row.playerId),
    kind: row.kind,
    spotKey: row.spotKey,
    toAmount: row.toAmount,
    amount: row.amount,
    potBefore: row.potBefore,
    currentBetBefore: row.currentBetBefore,
    bigBlind: row.bigBlind,
    bucket: row.bucket as BetSizeObservation['bucket'],
  });
}

/** Internal. `"As Kd"` -> cards, through `shared`'s own parser. `""` is zero cards. */
function decodeCardText(text: string, field: string, id: string): DbResult<readonly Card[]> {
  if (text.length === 0) return ok([]);
  const parsed = parseCards(text);
  if (!parsed.ok) {
    return dbErr('CORRUPT_ROW', `player_model_show_evidence.${field}: ${parsed.error}`, {
      table: 'player_model_show_evidence',
      id,
      field,
      actual: text,
    });
  }
  return ok(parsed.value);
}

function decodeShowEvidenceRow(row: ModelShowEvidenceRow): DbResult<ShowEvidence> {
  const id = row.snapshotId;
  if (!isObservedPosition(row.position)) {
    return badMember(
      'player_model_show_evidence',
      'position',
      row.position,
      OBSERVED_POSITIONS,
      id,
    );
  }
  const streets = ['PREFLOP', ...OBSERVED_STREETS] as readonly ('PREFLOP' | ObservedStreet)[];
  if (!memberOf(streets, row.lastStreet)) {
    return badMember('player_model_show_evidence', 'last_street', row.lastStreet, streets, id);
  }
  if (!memberOf(SHOW_OUTCOMES, row.outcome)) {
    return badMember('player_model_show_evidence', 'outcome', row.outcome, SHOW_OUTCOMES, id);
  }
  const cards = decodeCardText(row.cardsText, 'cards_text', id);
  if (!cards.ok) return cards;
  // A reveal is 1 or 2 cards: the engine accepts a partial reveal and a partial reveal is
  // preserved as entered, so this is NOT a "must be a pair" check.
  if (cards.value.length < 1 || cards.value.length > 2) {
    return dbErr(
      'CORRUPT_ROW',
      `player_model_show_evidence.cards_text must hold 1 or 2 cards, got ${cards.value.length}`,
      { table: 'player_model_show_evidence', id, field: 'cards_text', actual: row.cardsText },
    );
  }
  const board = decodeCardText(row.boardText, 'board_text', id);
  if (!board.ok) return board;
  if (![0, 3, 4, 5].includes(board.value.length)) {
    return dbErr(
      'CORRUPT_ROW',
      `player_model_show_evidence.board_text must hold 0, 3, 4 or 5 cards, got ${board.value.length}`,
      { table: 'player_model_show_evidence', id, field: 'board_text', actual: row.boardText },
    );
  }
  const raw = parseJson(row.spotKeysJson, 'spot_keys_json', 'player_model_show_evidence', id);
  if (!raw.ok) return raw;
  if (!Array.isArray(raw.value) || raw.value.some((key) => typeof key !== 'string')) {
    return dbErr(
      'CORRUPT_ROW',
      'player_model_show_evidence.spot_keys_json must be an array of strings',
      { table: 'player_model_show_evidence', id, field: 'spot_keys_json' },
    );
  }
  const wonGross = decodeMoney(row.wonGross, 'won_gross', 'player_model_show_evidence');
  if (!wonGross.ok) return wonGross;
  return ok({
    handId: asId<'Hand'>(row.handId),
    playerId: asId<'Player'>(row.playerId),
    position: row.position,
    cards: cards.value,
    board: board.value,
    lastStreet: row.lastStreet,
    spotKeys: raw.value as readonly string[],
    outcome: row.outcome,
    wonGross: row.wonGross,
  });
}

/** The child rows of one snapshot, each already ordered by its `ordinal` column. */
export interface ModelSnapshotChildRows {
  readonly stats: readonly ModelStatRow[];
  readonly spots: readonly SpotStatRow[];
  readonly betSizes: readonly ModelBetSizeRow[];
  readonly showEvidence: readonly ModelShowEvidenceRow[];
}

/** A snapshot header without its content — the version list the profile UI renders. */
export interface ModelSnapshotHeader {
  readonly snapshotId: ModelSnapshotId;
  readonly playerId: PlayerId;
  readonly modelVersion: number;
  readonly createdAt: Timestamp;
  readonly sourceHandCount: number;
  readonly analysisRunId: AnalysisRunId;
}

export function decodeModelSnapshotHeader(row: ModelSnapshotRow): DbResult<ModelSnapshotHeader> {
  const createdAt = decodeTimestamp(row.createdAt, 'created_at', 'player_model_snapshots');
  if (!createdAt.ok) return createdAt;
  const counts = collect([
    decodeCount(row.modelVersion, 'model_version', 'player_model_snapshots'),
    decodeCount(row.sourceHandCount, 'source_hand_count', 'player_model_snapshots'),
  ]);
  if (!counts.ok) return counts;
  return ok({
    snapshotId: asId<'ModelSnapshot'>(row.id),
    playerId: asId<'Player'>(row.playerId),
    modelVersion: row.modelVersion,
    createdAt: createdAt.value,
    sourceHandCount: row.sourceHandCount,
    analysisRunId: asId<'AnalysisRun'>(row.analysisRunId),
  });
}

/**
 * The whole snapshot, reassembled from its header and its four child tables.
 *
 * Array order comes from each child table's `ordinal` column rather than from a sort this
 * layer re-derives, so the reloaded `PlayerModelContent` is element-for-element what the
 * engine produced — the acceptance property is `JSON.stringify` equality, and a re-derived
 * sort would be a second opinion about `analysis-core`'s ordering.
 */
export function decodeModelSnapshot(
  row: ModelSnapshotRow,
  children: ModelSnapshotChildRows,
): DbResult<PlayerModelSnapshot> {
  const header = decodeModelSnapshotHeader(row);
  if (!header.ok) return header;
  const config = decodeConfidenceConfig(row);
  if (!config.ok) return config;
  const counts = collect([
    decodeCount(row.algorithmVersion, 'algorithm_version', 'player_model_snapshots'),
    decodeCount(row.sourceObservationCount, 'source_observation_count', 'player_model_snapshots'),
    decodeCount(row.sourceShowCount, 'source_show_count', 'player_model_snapshots'),
    decodeCount(
      row.confidenceOverallOpportunities,
      'confidence_overall_opportunities',
      'player_model_snapshots',
    ),
  ]);
  if (!counts.ok) return counts;
  const globalStats = collect(children.stats.map((stat) => decodeModelStatRow(stat, config.value)));
  if (!globalStats.ok) return globalStats;
  const spotStats = collect(children.spots.map((spot) => decodeSpotStatRow(spot, config.value)));
  if (!spotStats.ok) return spotStats;
  const betSizes = collect(children.betSizes.map(decodeBetSizeRow));
  if (!betSizes.ok) return betSizes;
  const showEvidence = collect(children.showEvidence.map(decodeShowEvidenceRow));
  if (!showEvidence.ok) return showEvidence;
  return ok({
    playerId: header.value.playerId,
    analysisAlgorithmVersion: row.algorithmVersion,
    inputHash: row.inputHash,
    sourceHandCount: row.sourceHandCount,
    sourceObservationCount: row.sourceObservationCount,
    sourceShowCount: row.sourceShowCount,
    globalStats: globalStats.value,
    spotStats: spotStats.value,
    showEvidence: showEvidence.value,
    betSizes: betSizes.value,
    confidence: {
      k: config.value.k,
      learningThreshold: config.value.learningThreshold,
      knownThreshold: config.value.knownThreshold,
      overall: snapshotConfidence(row.confidenceOverallOpportunities, config.value),
    },
    modelVersion: header.value.modelVersion,
    createdAt: header.value.createdAt,
  });
}

// ---------------------------------------------------------------------------
// strategy_decision_traces
// ---------------------------------------------------------------------------

/** One `{action, frequencyBps, toAmountMbb}` entry decoded out of `actions_json`. */
export interface StrategyTraceActionRow {
  readonly action: StrategyTraceAction;
  readonly frequencyBps: number;
  readonly toAmountMbb: MilliBB | null;
}

/** A decoded `strategy_decision_traces` row: the domain-facing shape a repository returns. */
export interface StrategyDecisionTrace {
  readonly id: StrategyDecisionTraceId;
  readonly handId: HandId;
  readonly commandSeq: number;
  readonly street: StrategyTraceStreet;
  readonly heroSeat: SeatIndex;
  readonly strategyMode: StrategyTraceMode;
  readonly strategyVersion: string;
  readonly family: string;
  readonly actions: readonly StrategyTraceActionRow[];
  readonly primaryAction: StrategyTraceAction;
  readonly recommendedToAmountMbb: MilliBB | null;
  readonly heroEquityBps: number | null;
  readonly potOddsBps: number | null;
  readonly spr: number | null;
  readonly provenanceQuality: StrategyTraceProvenanceQuality;
  readonly environmentStatus: string;
  readonly actualHeroAction: StrategyTraceAction;
  readonly computedAt: Timestamp;
  readonly source: StrategyTraceSource;
}

/** Internal. `0 <= value <= 10000`, an integer basis-points fraction. */
function decodeBps(value: number, field: string, table: string): DbResult<number> {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    return dbErr('CORRUPT_ROW', `${field} must be an integer 0..10000, got ${value}`, {
      table,
      field,
      actual: String(value),
    });
  }
  return ok(value);
}

/**
 * `actions_json` decoded into a typed array. Every element's `action` must be a member of
 * `STRATEGY_TRACE_ACTIONS`, `frequencyBps` an integer 0..10000, and `toAmountMbb` either
 * `null` or a money-ranged integer milliBB — a malformed or out-of-range element is a
 * `CORRUPT_ROW`, never silently dropped or coerced.
 */
function decodeStrategyTraceActions(
  row: StrategyDecisionTraceRow,
): DbResult<readonly StrategyTraceActionRow[]> {
  const parsed = parseJson(row.actionsJson, 'actions_json', 'strategy_decision_traces', row.id);
  if (!parsed.ok) return parsed;
  if (!Array.isArray(parsed.value)) {
    return dbErr('CORRUPT_ROW', 'strategy_decision_traces.actions_json is not an array', {
      table: 'strategy_decision_traces',
      field: 'actions_json',
      id: row.id,
    });
  }
  const decoded: StrategyTraceActionRow[] = [];
  for (const [index, raw] of parsed.value.entries()) {
    const field = `actions_json[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      return dbErr('CORRUPT_ROW', `${field} is not an object`, {
        table: 'strategy_decision_traces',
        field,
        id: row.id,
      });
    }
    const entry = raw as Record<string, unknown>;
    const { action, frequencyBps, toAmountMbb } = entry;
    if (typeof action !== 'string' || !memberOf(STRATEGY_TRACE_ACTIONS, action)) {
      return badMember(
        'strategy_decision_traces',
        field,
        typeof action === 'string' ? action : String(action),
        STRATEGY_TRACE_ACTIONS,
        row.id,
      );
    }
    if (typeof frequencyBps !== 'number') {
      return dbErr('CORRUPT_ROW', `${field}.frequencyBps must be a number`, {
        table: 'strategy_decision_traces',
        field,
        id: row.id,
      });
    }
    const bps = decodeBps(frequencyBps, `${field}.frequencyBps`, 'strategy_decision_traces');
    if (!bps.ok) return bps;
    let decodedToAmount: MilliBB | null = null;
    if (toAmountMbb !== null && toAmountMbb !== undefined) {
      if (typeof toAmountMbb !== 'number') {
        return dbErr('CORRUPT_ROW', `${field}.toAmountMbb must be a number or null`, {
          table: 'strategy_decision_traces',
          field,
          id: row.id,
        });
      }
      const money = decodeMoney(toAmountMbb, `${field}.toAmountMbb`, 'strategy_decision_traces');
      if (!money.ok) return money;
      decodedToAmount = money.value;
    }
    decoded.push({ action, frequencyBps: bps.value, toAmountMbb: decodedToAmount });
  }
  return ok(decoded);
}

/**
 * One stored REFERENCE strategy decision trace, decoded through the same vocabulary the
 * schema's CHECK constraints enforce. `actions_json` is decoded via
 * `decodeStrategyTraceActions`; nothing here re-derives `primaryAction` or the frequencies
 * from it — that reconciliation, if any is wanted, is a repository/consumer concern.
 */
export function decodeStrategyDecisionTraceRow(
  row: StrategyDecisionTraceRow,
): DbResult<StrategyDecisionTrace> {
  if (!memberOf(STRATEGY_TRACE_STREETS, row.street)) {
    return badMember(
      'strategy_decision_traces',
      'street',
      row.street,
      STRATEGY_TRACE_STREETS,
      row.id,
    );
  }
  const heroSeat = decodeSeat(row.heroSeat, 'hero_seat', 'strategy_decision_traces');
  if (!heroSeat.ok) return heroSeat;
  if (!memberOf(STRATEGY_TRACE_MODES, row.strategyMode)) {
    return badMember(
      'strategy_decision_traces',
      'strategy_mode',
      row.strategyMode,
      STRATEGY_TRACE_MODES,
      row.id,
    );
  }
  const actions = decodeStrategyTraceActions(row);
  if (!actions.ok) return actions;
  if (!memberOf(STRATEGY_TRACE_ACTIONS, row.primaryAction)) {
    return badMember(
      'strategy_decision_traces',
      'primary_action',
      row.primaryAction,
      STRATEGY_TRACE_ACTIONS,
      row.id,
    );
  }
  let recommendedToAmountMbb: MilliBB | null = null;
  if (row.recommendedToAmountMbb !== null) {
    const money = decodeMoney(
      row.recommendedToAmountMbb,
      'recommended_to_amount_mbb',
      'strategy_decision_traces',
    );
    if (!money.ok) return money;
    recommendedToAmountMbb = money.value;
  }
  let heroEquityBps: number | null = null;
  if (row.heroEquityBps !== null) {
    const bps = decodeBps(row.heroEquityBps, 'hero_equity_bps', 'strategy_decision_traces');
    if (!bps.ok) return bps;
    heroEquityBps = bps.value;
  }
  let potOddsBps: number | null = null;
  if (row.potOddsBps !== null) {
    const bps = decodeBps(row.potOddsBps, 'pot_odds_bps', 'strategy_decision_traces');
    if (!bps.ok) return bps;
    potOddsBps = bps.value;
  }
  if (row.spr !== null && (!Number.isInteger(row.spr) || row.spr < 0)) {
    return dbErr('CORRUPT_ROW', 'strategy_decision_traces.spr must be a non-negative integer', {
      table: 'strategy_decision_traces',
      field: 'spr',
      id: row.id,
      actual: String(row.spr),
    });
  }
  if (!memberOf(STRATEGY_TRACE_PROVENANCE_QUALITIES, row.provenanceQuality)) {
    return badMember(
      'strategy_decision_traces',
      'provenance_quality',
      row.provenanceQuality,
      STRATEGY_TRACE_PROVENANCE_QUALITIES,
      row.id,
    );
  }
  if (!memberOf(STRATEGY_TRACE_ACTIONS, row.actualHeroAction)) {
    return badMember(
      'strategy_decision_traces',
      'actual_hero_action',
      row.actualHeroAction,
      STRATEGY_TRACE_ACTIONS,
      row.id,
    );
  }
  const computedAt = decodeTimestamp(row.computedAt, 'computed_at', 'strategy_decision_traces');
  if (!computedAt.ok) return computedAt;
  if (!memberOf(STRATEGY_TRACE_SOURCES, row.source)) {
    return badMember(
      'strategy_decision_traces',
      'source',
      row.source,
      STRATEGY_TRACE_SOURCES,
      row.id,
    );
  }
  return ok({
    id: asId<'StrategyDecisionTrace'>(row.id),
    handId: asId<'Hand'>(row.handId),
    commandSeq: row.commandSeq,
    street: row.street,
    heroSeat: heroSeat.value,
    strategyMode: row.strategyMode,
    strategyVersion: row.strategyVersion,
    family: row.family,
    actions: actions.value,
    primaryAction: row.primaryAction,
    recommendedToAmountMbb,
    heroEquityBps,
    potOddsBps,
    spr: row.spr,
    provenanceQuality: row.provenanceQuality,
    environmentStatus: row.environmentStatus,
    actualHeroAction: row.actualHeroAction,
    computedAt: computedAt.value,
    source: row.source,
  });
}

// ---------------------------------------------------------------------------
// adaptive_strategy_traces
// ---------------------------------------------------------------------------

/** One `{action, frequencyBps, toAmountMbb}` entry of a baseline or adapted mix. */
export interface AdaptiveTraceAction {
  readonly action: StrategyTraceAction;
  readonly frequencyBps: number;
  readonly toAmountMbb: MilliBB | null;
}

/** One action kind's SIGNED movement, adapted minus baseline, in basis points. */
export interface AdaptiveTraceFrequencyDelta {
  readonly action: StrategyTraceAction;
  readonly deltaBps: number;
}

/**
 * One rule that fired, with the whole evidence chain that let it fire (design §3.4).
 *
 * `ruleId`, `stat`, `target` and `reasonKey` are stored as plain strings ON PURPOSE: those
 * vocabularies belong to the composition layer, and `@gto-self/db` must not import it (the
 * layering rule). They are validated as non-empty strings here; the composition layer's own
 * exhaustive maps are what give them meaning.
 */
/**
 * ONE source's own contribution to a pooled stat, kept separate from the other's.
 *
 * The pooled `estimateBps` on the adjustment is a blend. Storing only the source TAGS would
 * say two sources agreed to produce it while hiding that one of them was a 12-hand manual
 * reading and the other a 900-observation model — and the split cannot be recovered later,
 * because the learned model advances and the trace row can never be rewritten (ADR-0066).
 * `note` carries the caveat the composition layer attached to this reading, verbatim
 * (CLAUDE.md rule 3), or `null` when it attached none.
 */
export interface AdaptiveTraceSourceRef {
  readonly source: string;
  readonly valueBps: number;
  readonly sampleN: number;
  readonly note: string | null;
}

export interface AdaptiveTraceAdjustment {
  readonly ruleId: string;
  readonly stat: string;
  readonly opponentPlayerId: string;
  readonly priorBps: number;
  readonly observedBps: number;
  readonly estimateBps: number;
  readonly sampleN: number;
  readonly confidenceBps: number;
  /** Every contributing source with its OWN reading and denominator. Never pooled away. */
  readonly sources: readonly AdaptiveTraceSourceRef[];
  readonly target: string;
  /** SIGNED: a de-escalating rule contributes negatively. */
  readonly contributionBps: number;
  /**
   * SIGNED distance of the estimate from the zero-adjustment anchor. Persisted because
   * `contributionBps` alone cannot distinguish "this player is unremarkable on this stat"
   * (deviation ~0) from "this player is extreme and something held the rule back"
   * (deviation large, contribution 0).
   */
  readonly deviationBps: number;
  /**
   * Which ceiling zeroed or shrank this rule, or `null` when nothing did.
   *
   * Without it an INSERT-ONLY trace can never say WHY a recorded rule moved nothing — and
   * `AGGRESSIVE_PLAYER_BEHIND`, the multiway guard rail, is exactly the case a reader most
   * needs explained. A trace that cannot be repaired later must carry it at write time.
   */
  readonly cappedBy: string | null;
  readonly reasonKey: string;
}

/** Which stored snapshot one opponent's numbers came from. `null` — none was available. */
export interface AdaptiveTraceSnapshotRef {
  readonly playerId: string;
  readonly snapshotId: string | null;
}

/** A decoded `adaptive_strategy_traces` row: the domain-facing shape a repository returns. */
export interface AdaptiveStrategyTrace {
  readonly id: AdaptiveStrategyTraceId;
  readonly handId: HandId;
  readonly commandSeq: number;
  readonly referenceTraceId: StrategyDecisionTraceId | null;
  readonly street: StrategyTraceStreet;
  readonly heroSeat: SeatIndex;
  readonly status: AdaptiveTraceStatus;
  readonly adaptivePolicyVersion: string;
  readonly primaryVillainPlayerId: PlayerId | null;
  readonly opponentCount: number;
  readonly baselineActions: readonly AdaptiveTraceAction[];
  readonly adaptiveActions: readonly AdaptiveTraceAction[];
  readonly frequencyDeltas: readonly AdaptiveTraceFrequencyDelta[];
  readonly baselinePrimaryAction: StrategyTraceAction;
  readonly adaptivePrimaryAction: StrategyTraceAction;
  readonly baselineToAmountMbb: MilliBB | null;
  readonly adaptiveToAmountMbb: MilliBB | null;
  readonly baselineSizingBucket: number | null;
  readonly adaptiveSizingBucket: number | null;
  readonly totalShiftBps: number;
  readonly capApplied: boolean;
  readonly adjustments: readonly AdaptiveTraceAdjustment[];
  readonly manualHudSnapshotIds: readonly AdaptiveTraceSnapshotRef[];
  readonly playerModelSnapshotIds: readonly AdaptiveTraceSnapshotRef[];
  readonly playerModelVersion: number | null;
  readonly computedAt: Timestamp;
  readonly source: AdaptiveTraceSource;
}

const ADAPTIVE_TRACES = 'adaptive_strategy_traces';

/** Internal. A `CORRUPT_ROW` naming the exact JSON path that failed. */
function adaptiveCorrupt<T>(field: string, message: string, id: string): DbResult<T> {
  return dbErr('CORRUPT_ROW', `${ADAPTIVE_TRACES}.${field} ${message}`, {
    table: ADAPTIVE_TRACES,
    field,
    id,
  });
}

/** Internal. A SIGNED integer basis-points value, `-10000 <= value <= 10000`. */
function decodeSignedBps(value: number, field: string, id: string): DbResult<number> {
  if (!Number.isInteger(value) || value < -10_000 || value > 10_000) {
    return adaptiveCorrupt(field, `must be an integer -10000..10000, got ${value}`, id);
  }
  return ok(value);
}

/** Internal. A JSON column that must hold an array. */
function adaptiveJsonArray(text: string, field: string, id: string): DbResult<readonly unknown[]> {
  const parsed = parseJson(text, field, ADAPTIVE_TRACES, id);
  if (!parsed.ok) return parsed;
  if (!Array.isArray(parsed.value)) return adaptiveCorrupt(field, 'is not an array', id);
  return ok(parsed.value as readonly unknown[]);
}

/** Internal. One array element that must be a plain object. */
function adaptiveEntry(raw: unknown, field: string, id: string): DbResult<Record<string, unknown>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return adaptiveCorrupt(field, 'is not an object', id);
  }
  return ok(raw as Record<string, unknown>);
}

/** Internal. A required non-empty string property. */
function adaptiveString(
  entry: Record<string, unknown>,
  key: string,
  field: string,
  id: string,
): DbResult<string> {
  const value = entry[key];
  if (typeof value !== 'string' || value.length === 0) {
    return adaptiveCorrupt(`${field}.${key}`, 'must be a non-empty string', id);
  }
  return ok(value);
}

/** Internal. A required numeric property; the range check is the caller's. */
function adaptiveNumber(
  entry: Record<string, unknown>,
  key: string,
  field: string,
  id: string,
): DbResult<number> {
  const value = entry[key];
  if (typeof value !== 'number') {
    return adaptiveCorrupt(`${field}.${key}`, 'must be a number', id);
  }
  return ok(value);
}

/** Internal. A required property holding an unsigned integer basis-points value. */
function adaptiveUnsignedBps(
  entry: Record<string, unknown>,
  key: string,
  field: string,
  id: string,
): DbResult<number> {
  const value = adaptiveNumber(entry, key, field, id);
  if (!value.ok) return value;
  return decodeBps(value.value, `${field}.${key}`, ADAPTIVE_TRACES);
}

/** Internal. A required property naming one of `STRATEGY_TRACE_ACTIONS`. */
function adaptiveAction(
  entry: Record<string, unknown>,
  field: string,
  id: string,
): DbResult<StrategyTraceAction> {
  const value = entry.action;
  if (typeof value !== 'string' || !memberOf(STRATEGY_TRACE_ACTIONS, value)) {
    return badMember(
      ADAPTIVE_TRACES,
      `${field}.action`,
      typeof value === 'string' ? value : String(value),
      STRATEGY_TRACE_ACTIONS,
      id,
    );
  }
  return ok(value);
}

/**
 * `baseline_actions_json` / `adaptive_actions_json` decoded item by item. Every element's
 * `action` must be a member of `STRATEGY_TRACE_ACTIONS` — the SAME vocabulary the two
 * `*_primary_action` CHECKs enforce — `frequencyBps` an integer 0..10000, and `toAmountMbb`
 * either `null` or a money-ranged integer milliBB. A malformed element is a `CORRUPT_ROW`
 * naming its index, never silently dropped or coerced.
 */
function decodeAdaptiveActions(
  text: string,
  column: string,
  id: string,
): DbResult<readonly AdaptiveTraceAction[]> {
  const items = adaptiveJsonArray(text, column, id);
  if (!items.ok) return items;
  const decoded: AdaptiveTraceAction[] = [];
  for (const [index, raw] of items.value.entries()) {
    const field = `${column}[${index}]`;
    const entry = adaptiveEntry(raw, field, id);
    if (!entry.ok) return entry;
    const action = adaptiveAction(entry.value, field, id);
    if (!action.ok) return action;
    const frequency = adaptiveNumber(entry.value, 'frequencyBps', field, id);
    if (!frequency.ok) return frequency;
    const bps = decodeBps(frequency.value, `${field}.frequencyBps`, ADAPTIVE_TRACES);
    if (!bps.ok) return bps;
    let toAmountMbb: MilliBB | null = null;
    const rawAmount = entry.value.toAmountMbb;
    if (rawAmount !== null && rawAmount !== undefined) {
      if (typeof rawAmount !== 'number') {
        return adaptiveCorrupt(`${field}.toAmountMbb`, 'must be a number or null', id);
      }
      const money = decodeMoney(rawAmount, `${field}.toAmountMbb`, ADAPTIVE_TRACES);
      if (!money.ok) return money;
      toAmountMbb = money.value;
    }
    decoded.push({ action: action.value, frequencyBps: bps.value, toAmountMbb });
  }
  return ok(decoded);
}

/** `frequency_delta_json` decoded item by item. `deltaBps` is SIGNED: -10000..10000. */
function decodeAdaptiveDeltas(
  text: string,
  column: string,
  id: string,
): DbResult<readonly AdaptiveTraceFrequencyDelta[]> {
  const items = adaptiveJsonArray(text, column, id);
  if (!items.ok) return items;
  const decoded: AdaptiveTraceFrequencyDelta[] = [];
  for (const [index, raw] of items.value.entries()) {
    const field = `${column}[${index}]`;
    const entry = adaptiveEntry(raw, field, id);
    if (!entry.ok) return entry;
    const action = adaptiveAction(entry.value, field, id);
    if (!action.ok) return action;
    const delta = adaptiveNumber(entry.value, 'deltaBps', field, id);
    if (!delta.ok) return delta;
    const bps = decodeSignedBps(delta.value, `${field}.deltaBps`, id);
    if (!bps.ok) return bps;
    decoded.push({ action: action.value, deltaBps: bps.value });
  }
  return ok(decoded);
}

/**
 * `adjustments_json` decoded item by item — the audit trail that makes an adaptive number
 * defensible rather than asserted (`CLAUDE.md` rule 3).
 *
 * `priorBps`, `observedBps`, `estimateBps` and `confidenceBps` are unsigned 0..10000;
 * `contributionBps` is SIGNED, because a de-escalating rule moves mass the other way;
 * `deviationBps` is SIGNED for the same reason; `sampleN` is a non-negative count; `cappedBy`
 * is `null` or a non-empty token; `sources` is an array of `{source, valueBps, sampleN, note}`
 * objects, one per contributing source, never pooled into a bare name. Anything else is a
 * `CORRUPT_ROW` naming the element and the property — including a MISSING property, since
 * `undefined` silently reading back as "no cap" or "no caveat" would be a different claim
 * about the hand than the one that was stored.
 */
function decodeAdaptiveAdjustments(
  text: string,
  column: string,
  id: string,
): DbResult<readonly AdaptiveTraceAdjustment[]> {
  const items = adaptiveJsonArray(text, column, id);
  if (!items.ok) return items;
  const decoded: AdaptiveTraceAdjustment[] = [];
  for (const [index, raw] of items.value.entries()) {
    const field = `${column}[${index}]`;
    const entry = adaptiveEntry(raw, field, id);
    if (!entry.ok) return entry;

    const ruleId = adaptiveString(entry.value, 'ruleId', field, id);
    if (!ruleId.ok) return ruleId;
    const stat = adaptiveString(entry.value, 'stat', field, id);
    if (!stat.ok) return stat;
    const opponentPlayerId = adaptiveString(entry.value, 'opponentPlayerId', field, id);
    if (!opponentPlayerId.ok) return opponentPlayerId;
    const target = adaptiveString(entry.value, 'target', field, id);
    if (!target.ok) return target;
    const reasonKey = adaptiveString(entry.value, 'reasonKey', field, id);
    if (!reasonKey.ok) return reasonKey;

    const priorBps = adaptiveUnsignedBps(entry.value, 'priorBps', field, id);
    if (!priorBps.ok) return priorBps;
    const observedBps = adaptiveUnsignedBps(entry.value, 'observedBps', field, id);
    if (!observedBps.ok) return observedBps;
    const estimateBps = adaptiveUnsignedBps(entry.value, 'estimateBps', field, id);
    if (!estimateBps.ok) return estimateBps;
    const confidenceBps = adaptiveUnsignedBps(entry.value, 'confidenceBps', field, id);
    if (!confidenceBps.ok) return confidenceBps;

    const sampleRaw = adaptiveNumber(entry.value, 'sampleN', field, id);
    if (!sampleRaw.ok) return sampleRaw;
    const sampleN = decodeCount(sampleRaw.value, `${field}.sampleN`, ADAPTIVE_TRACES);
    if (!sampleN.ok) return sampleN;

    const contributionRaw = adaptiveNumber(entry.value, 'contributionBps', field, id);
    if (!contributionRaw.ok) return contributionRaw;
    const contributionBps = decodeSignedBps(contributionRaw.value, `${field}.contributionBps`, id);
    if (!contributionBps.ok) return contributionBps;

    const deviationRaw = adaptiveNumber(entry.value, 'deviationBps', field, id);
    if (!deviationRaw.ok) return deviationRaw;
    const deviationBps = decodeSignedBps(deviationRaw.value, `${field}.deviationBps`, id);
    if (!deviationBps.ok) return deviationBps;

    // `null` is the ordinary case (nothing capped the rule); any other value must be a real
    // non-empty token, never `undefined` smuggled in by a missing property.
    const rawCappedBy = entry.value.cappedBy;
    if (rawCappedBy !== null && (typeof rawCappedBy !== 'string' || rawCappedBy.length === 0)) {
      return adaptiveCorrupt(`${field}.cappedBy`, 'must be null or a non-empty string', id);
    }

    const rawSources = entry.value.sources;
    if (!Array.isArray(rawSources)) {
      return adaptiveCorrupt(`${field}.sources`, 'must be an array', id);
    }
    const sources: AdaptiveTraceSourceRef[] = [];
    for (const [sourceIndex, rawSource] of (rawSources as readonly unknown[]).entries()) {
      const sourceField = `${field}.sources[${sourceIndex}]`;
      const sourceEntry = adaptiveEntry(rawSource, sourceField, id);
      if (!sourceEntry.ok) return sourceEntry;

      const source = adaptiveString(sourceEntry.value, 'source', sourceField, id);
      if (!source.ok) return source;
      const valueBps = adaptiveUnsignedBps(sourceEntry.value, 'valueBps', sourceField, id);
      if (!valueBps.ok) return valueBps;
      const sourceSampleRaw = adaptiveNumber(sourceEntry.value, 'sampleN', sourceField, id);
      if (!sourceSampleRaw.ok) return sourceSampleRaw;
      const sourceSampleN = decodeCount(
        sourceSampleRaw.value,
        `${sourceField}.sampleN`,
        ADAPTIVE_TRACES,
      );
      if (!sourceSampleN.ok) return sourceSampleN;

      // A missing `note` is a DIFFERENT claim from "no caveat", so `undefined` is refused.
      const note = sourceEntry.value.note;
      if (note !== null && (typeof note !== 'string' || note.length === 0)) {
        return adaptiveCorrupt(`${sourceField}.note`, 'must be null or a non-empty string', id);
      }

      sources.push({
        source: source.value,
        valueBps: valueBps.value,
        sampleN: sourceSampleN.value,
        note,
      });
    }

    decoded.push({
      ruleId: ruleId.value,
      stat: stat.value,
      opponentPlayerId: opponentPlayerId.value,
      priorBps: priorBps.value,
      observedBps: observedBps.value,
      estimateBps: estimateBps.value,
      sampleN: sampleN.value,
      confidenceBps: confidenceBps.value,
      sources,
      target: target.value,
      contributionBps: contributionBps.value,
      deviationBps: deviationBps.value,
      cappedBy: rawCappedBy,
      reasonKey: reasonKey.value,
    });
  }
  return ok(decoded);
}

/**
 * `manual_hud_snapshot_ids_json` / `player_model_snapshot_ids_json` decoded item by item.
 * `snapshotId` is explicitly nullable — "this opponent had no snapshot" is a fact worth
 * storing, and is NOT the same as the opponent being absent from the list.
 */
function decodeAdaptiveSnapshotRefs(
  text: string,
  column: string,
  id: string,
): DbResult<readonly AdaptiveTraceSnapshotRef[]> {
  const items = adaptiveJsonArray(text, column, id);
  if (!items.ok) return items;
  const decoded: AdaptiveTraceSnapshotRef[] = [];
  for (const [index, raw] of items.value.entries()) {
    const field = `${column}[${index}]`;
    const entry = adaptiveEntry(raw, field, id);
    if (!entry.ok) return entry;
    const playerId = adaptiveString(entry.value, 'playerId', field, id);
    if (!playerId.ok) return playerId;
    const rawSnapshot = entry.value.snapshotId;
    let snapshotId: string | null = null;
    if (rawSnapshot !== null && rawSnapshot !== undefined) {
      if (typeof rawSnapshot !== 'string' || rawSnapshot.length === 0) {
        return adaptiveCorrupt(`${field}.snapshotId`, 'must be a non-empty string or null', id);
      }
      snapshotId = rawSnapshot;
    }
    decoded.push({ playerId: playerId.value, snapshotId });
  }
  return ok(decoded);
}

/**
 * One stored ADAPTIVE trace, decoded through the same vocabularies the schema's CHECK
 * constraints enforce and with every JSON document decoded element by element. Nothing here
 * re-derives a frequency, a delta or a primary action from the others — this is storage
 * read-back, not a re-computation of the composition (`CLAUDE.md` rule 5).
 */
export function decodeAdaptiveStrategyTraceRow(
  row: AdaptiveStrategyTraceRow,
): DbResult<AdaptiveStrategyTrace> {
  if (!Number.isInteger(row.commandSeq) || row.commandSeq < 0) {
    return adaptiveCorrupt('command_seq', 'must be a non-negative integer', row.id);
  }
  if (!memberOf(STRATEGY_TRACE_STREETS, row.street)) {
    return badMember(ADAPTIVE_TRACES, 'street', row.street, STRATEGY_TRACE_STREETS, row.id);
  }
  const heroSeat = decodeSeat(row.heroSeat, 'hero_seat', ADAPTIVE_TRACES);
  if (!heroSeat.ok) return heroSeat;
  if (!memberOf(ADAPTIVE_TRACE_STATUSES, row.status)) {
    return badMember(ADAPTIVE_TRACES, 'status', row.status, ADAPTIVE_TRACE_STATUSES, row.id);
  }
  if (row.adaptivePolicyVersion.length === 0) {
    return adaptiveCorrupt('adaptive_policy_version', 'must not be empty', row.id);
  }
  const opponentCount = decodeCount(row.opponentCount, 'opponent_count', ADAPTIVE_TRACES);
  if (!opponentCount.ok) return opponentCount;

  const baselineActions = decodeAdaptiveActions(
    row.baselineActionsJson,
    'baseline_actions_json',
    row.id,
  );
  if (!baselineActions.ok) return baselineActions;
  const adaptiveActions = decodeAdaptiveActions(
    row.adaptiveActionsJson,
    'adaptive_actions_json',
    row.id,
  );
  if (!adaptiveActions.ok) return adaptiveActions;
  const frequencyDeltas = decodeAdaptiveDeltas(
    row.frequencyDeltaJson,
    'frequency_delta_json',
    row.id,
  );
  if (!frequencyDeltas.ok) return frequencyDeltas;
  const adjustments = decodeAdaptiveAdjustments(row.adjustmentsJson, 'adjustments_json', row.id);
  if (!adjustments.ok) return adjustments;
  const manualHudSnapshotIds = decodeAdaptiveSnapshotRefs(
    row.manualHudSnapshotIdsJson,
    'manual_hud_snapshot_ids_json',
    row.id,
  );
  if (!manualHudSnapshotIds.ok) return manualHudSnapshotIds;
  const playerModelSnapshotIds = decodeAdaptiveSnapshotRefs(
    row.playerModelSnapshotIdsJson,
    'player_model_snapshot_ids_json',
    row.id,
  );
  if (!playerModelSnapshotIds.ok) return playerModelSnapshotIds;

  if (!memberOf(STRATEGY_TRACE_ACTIONS, row.baselinePrimaryAction)) {
    return badMember(
      ADAPTIVE_TRACES,
      'baseline_primary_action',
      row.baselinePrimaryAction,
      STRATEGY_TRACE_ACTIONS,
      row.id,
    );
  }
  if (!memberOf(STRATEGY_TRACE_ACTIONS, row.adaptivePrimaryAction)) {
    return badMember(
      ADAPTIVE_TRACES,
      'adaptive_primary_action',
      row.adaptivePrimaryAction,
      STRATEGY_TRACE_ACTIONS,
      row.id,
    );
  }

  let baselineToAmountMbb: MilliBB | null = null;
  if (row.baselineToAmountMbb !== null) {
    const money = decodeMoney(row.baselineToAmountMbb, 'baseline_to_amount_mbb', ADAPTIVE_TRACES);
    if (!money.ok) return money;
    baselineToAmountMbb = money.value;
  }
  let adaptiveToAmountMbb: MilliBB | null = null;
  if (row.adaptiveToAmountMbb !== null) {
    const money = decodeMoney(row.adaptiveToAmountMbb, 'adaptive_to_amount_mbb', ADAPTIVE_TRACES);
    if (!money.ok) return money;
    adaptiveToAmountMbb = money.value;
  }

  for (const [column, bucket] of [
    ['baseline_sizing_bucket', row.baselineSizingBucket],
    ['adaptive_sizing_bucket', row.adaptiveSizingBucket],
  ] as const) {
    if (bucket !== null && (!Number.isInteger(bucket) || bucket < -1 || bucket > 7)) {
      return adaptiveCorrupt(column, `must be an integer -1..7 or null, got ${bucket}`, row.id);
    }
  }

  const totalShiftBps = decodeBps(row.totalShiftBps, 'total_shift_bps', ADAPTIVE_TRACES);
  if (!totalShiftBps.ok) return totalShiftBps;
  if (row.capApplied !== 0 && row.capApplied !== 1) {
    return adaptiveCorrupt('cap_applied', `must be 0 or 1, got ${row.capApplied}`, row.id);
  }
  if (
    row.playerModelVersion !== null &&
    (!Number.isInteger(row.playerModelVersion) || row.playerModelVersion < 1)
  ) {
    return adaptiveCorrupt('player_model_version', 'must be a positive integer or null', row.id);
  }
  const computedAt = decodeTimestamp(row.computedAt, 'computed_at', ADAPTIVE_TRACES);
  if (!computedAt.ok) return computedAt;
  if (!memberOf(ADAPTIVE_TRACE_SOURCES, row.source)) {
    return badMember(ADAPTIVE_TRACES, 'source', row.source, ADAPTIVE_TRACE_SOURCES, row.id);
  }

  return ok({
    id: asId<'AdaptiveStrategyTrace'>(row.id),
    handId: asId<'Hand'>(row.handId),
    commandSeq: row.commandSeq,
    referenceTraceId:
      row.referenceTraceId === null ? null : asId<'StrategyDecisionTrace'>(row.referenceTraceId),
    street: row.street,
    heroSeat: heroSeat.value,
    status: row.status,
    adaptivePolicyVersion: row.adaptivePolicyVersion,
    primaryVillainPlayerId:
      row.primaryVillainPlayerId === null ? null : asId<'Player'>(row.primaryVillainPlayerId),
    opponentCount: opponentCount.value,
    baselineActions: baselineActions.value,
    adaptiveActions: adaptiveActions.value,
    frequencyDeltas: frequencyDeltas.value,
    baselinePrimaryAction: row.baselinePrimaryAction,
    adaptivePrimaryAction: row.adaptivePrimaryAction,
    baselineToAmountMbb,
    adaptiveToAmountMbb,
    baselineSizingBucket: row.baselineSizingBucket,
    adaptiveSizingBucket: row.adaptiveSizingBucket,
    totalShiftBps: totalShiftBps.value,
    capApplied: row.capApplied === 1,
    adjustments: adjustments.value,
    manualHudSnapshotIds: manualHudSnapshotIds.value,
    playerModelSnapshotIds: playerModelSnapshotIds.value,
    playerModelVersion: row.playerModelVersion,
    computedAt: computedAt.value,
    source: row.source,
  });
}

// ---------------------------------------------------------------------------
// skipped_hands
// ---------------------------------------------------------------------------

/** A decoded `skipped_hands` row. */
export interface SkippedHand {
  readonly id: SkippedHandId;
  readonly sessionId: SessionId;
  readonly handNumber: number;
  readonly skippedAt: Timestamp;
  /**
   * Why the hand was skipped. `null` ONLY on a row written before `0009` added the column —
   * "the reason was never recorded". It is not a default and not a third reason, so nothing
   * downstream may read it as one.
   */
  readonly reason: SkippedHandReason | null;
}

export function decodeSkippedHandRow(row: SkippedHandRow): DbResult<SkippedHand> {
  if (!Number.isInteger(row.handNumber) || row.handNumber < 0) {
    return dbErr('CORRUPT_ROW', 'skipped_hands.hand_number must be a non-negative integer', {
      table: 'skipped_hands',
      id: row.id,
      field: 'hand_number',
      actual: String(row.handNumber),
    });
  }
  const skippedAt = decodeTimestamp(row.skippedAt, 'skipped_at', 'skipped_hands');
  if (!skippedAt.ok) return skippedAt;
  // NULL is the one legal absence (a pre-`0009` row). Any OTHER unrecognised string is a
  // corrupt row and is REFUSED, never passed through as an opaque reason: the CHECK admits
  // exactly these two members, so a third value can only mean the file was written around it.
  if (row.reason !== null && !(SKIPPED_HAND_REASONS as readonly string[]).includes(row.reason)) {
    return dbErr('CORRUPT_ROW', `unknown skipped-hand reason "${row.reason}"`, {
      table: 'skipped_hands',
      id: row.id,
      field: 'reason',
      expected: SKIPPED_HAND_REASONS.join(' | '),
      actual: row.reason,
    });
  }
  return ok({
    id: asId<'SkippedHand'>(row.id),
    sessionId: asId<'Session'>(row.sessionId),
    handNumber: row.handNumber,
    skippedAt: skippedAt.value,
    reason: row.reason as SkippedHandReason | null,
  });
}
