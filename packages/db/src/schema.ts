/**
 * The Drizzle schema. STORAGE ONLY: no betting rules, no settlement arithmetic, no rake
 * computation, no strategy. Rows go in and come out; `poker-core` and `player-core`
 * decide what they mean.
 *
 * Conventions, all of them load-bearing:
 *
 * - **Money is an INTEGER column of milliBB.** There is no REAL column anywhere and no
 *   decimal string. This file never does money arithmetic (`CLAUDE.md` rule 1). SQLite's
 *   INTEGER is an *affinity* rather than a type, so integrality is asserted explicitly —
 *   see `isIntegral`.
 * - **Timestamps are INTEGER epoch milliseconds**, always supplied by the caller. No
 *   `CURRENT_TIMESTAMP` default exists: the DB never reads the clock (ADR-0007's sibling
 *   rule, `player-core/src/time.ts`).
 * - **Ids are TEXT and are supplied by the caller** (ADR-0007). Nothing here generates one,
 *   and there is no AUTOINCREMENT column.
 * - **Nothing is ever hard-deleted that another row points at.** Foreign keys use
 *   `RESTRICT` except where a child is definitionally part of its parent (a HUD snapshot's
 *   stat readings, a hand's events), which cascade.
 * - **The three manually-entered tables are insert-only IN THE DATABASE.** `player_notes`,
 *   `player_hud_snapshots` and `player_hud_snapshot_stats` carry `BEFORE UPDATE` and
 *   `BEFORE DELETE` triggers that `RAISE(ABORT, ...)`. Drizzle cannot express a trigger, so
 *   they live in the custom migration `0001_insert_only_guards.sql` — read it alongside this
 *   file. They are the guarantee; "the repository exports no update function" is only a
 *   convention on top of it (`CLAUDE.md` rule 3).
 * - **Kept portable to PostgreSQL.** No SQLite-only construct is used where a portable one
 *   exists; the places where portability needs a hand edit are marked `PG:`.
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { Money } from '@gto-self/shared';
import {
  HUD_STAT_KEYS,
  MAX_CENTI_PERCENT,
  MAX_HAND_SAMPLE,
  MAX_NOTE_LENGTH,
  MAX_OBSERVATION_COUNT,
  MAX_TIMESTAMP,
  OBSERVED_METRICS,
  OBSERVED_POSITIONS,
} from '@gto-self/player-core';

/**
 * A SQL literal list for a CHECK, built from a domain constant so the constraint and the
 * TypeScript union cannot drift apart at authoring time. The values are our own
 * compile-time constants; nothing user-supplied reaches `sql.raw`.
 *
 * Note the cost this buys: extending one of these unions needs a migration. That is the
 * intended trade for `metric` and `position`, which are part of a natural key, and for the
 * small stable enums. `hand_events.kind` deliberately has NO such CHECK — see that table.
 */
function inList(values: readonly string[]): SQL {
  return sql.raw(`(${values.map((value) => `'${value.replace(/'/gu, "''")}'`).join(', ')})`);
}

const MAX_MONEY = Money.MAX_MILLI_BB;

/**
 * `typeof(column) = 'integer'`.
 *
 * SQLite's INTEGER is an *affinity*, not a type: `update session_seats set stack = 93701.5`
 * is accepted and stores a REAL, and `stack >= 0 and stack <= 1000000000` is happily
 * satisfied by it. The decoders reject such a row on read (`CORRUPT_ROW`), so nothing lossy
 * is ever returned — but a write that succeeds and then can never be read back is worse
 * than a write that is refused. Every money, count, centipercent and epoch-ms column
 * therefore asserts integrality at the constraint.
 *
 * PG: redundant — `integer`/`bigint` reject a fractional value outright — so this term is
 * dropped when these CHECKs are translated.
 */
const isIntegral = (column: AnySQLiteColumn): SQL => sql`typeof(${column}) = 'integer'`;

/** `0 <= column <= MAX_TIMESTAMP`, the same window `player-core` validates. */
const timeWindow = (column: AnySQLiteColumn): SQL =>
  sql`${isIntegral(column)} and ${column} >= 0 and ${column} <= ${sql.raw(String(MAX_TIMESTAMP))}`;

/** `|column| <= Money.MAX_MILLI_BB`. Range only — this file never computes money. */
const moneyRange = (column: AnySQLiteColumn): SQL =>
  sql`${isIntegral(column)} and ${column} >= ${sql.raw(String(-MAX_MONEY))} and ${column} <= ${sql.raw(String(MAX_MONEY))}`;

const seatRange = (column: AnySQLiteColumn): SQL => sql`${column} >= 0 and ${column} <= 5`;

// ---------------------------------------------------------------------------
// game_presets
// ---------------------------------------------------------------------------

/**
 * One shipped or user-authored `TableConfig`, stored as the whole validated document.
 *
 * `config_json` is the ONLY source of truth for the preset. Flattening `TableConfig` into
 * columns would re-encode poker policy (rake rational, quantum, rounding mode, fee policy,
 * seven rule options) inside the persistence layer and let it drift from
 * `poker-core/src/config.ts`; the label and the stake are read back off the decoded config.
 * Reads validate through `poker-core`'s own `tableConfigSchema` + `validateTableConfig`, so
 * a row can never reach the engine unvalidated. Every money value inside the document is an
 * integer milliBB, exactly as `poker-core` encodes it.
 *
 * PG: `config_json` becomes `jsonb`.
 */
export const gamePresets = sqliteTable(
  'game_presets',
  {
    /** `TableConfig.presetId`, e.g. `CP_NL50_6MAX_ANTE`. */
    presetId: text('preset_id').primaryKey(),
    configJson: text('config_json').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    check('game_presets_preset_id_not_empty', sql`length(${t.presetId}) > 0`),
    check('game_presets_created_at_range', timeWindow(t.createdAt)),
    check('game_presets_updated_at_range', timeWindow(t.updatedAt)),
    check('game_presets_updated_not_before_created', sql`${t.updatedAt} >= ${t.createdAt}`),
  ],
);

// ---------------------------------------------------------------------------
// players
// ---------------------------------------------------------------------------

/**
 * Player identity: a MANUALLY ENTERED nickname (ADR-0033). Never derived from a poker
 * client or a hand-history id.
 *
 * Both `nickname` (verbatim, case and internal spacing preserved) and
 * `normalized_nickname` (NFKC + collapse + lowercase) are stored. The UNIQUE index is on
 * the NORMALIZED column — that is the identity key — while the entered text survives
 * untouched (`CLAUDE.md` rule 3). The same index answers the Phase-4 prefix autocomplete.
 *
 * There is no delete. `archived` retires a player, because snapshots, notes and
 * observations point here.
 *
 * PG: `archived` becomes `boolean` and the `in (0, 1)` CHECK is dropped as redundant.
 */
export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    nickname: text('nickname').notNull(),
    normalizedNickname: text('normalized_nickname').notNull(),
    displayAlias: text('display_alias'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull(),
  },
  (t) => [
    uniqueIndex('players_normalized_nickname_unique').on(t.normalizedNickname),
    check('players_id_not_empty', sql`length(${t.id}) > 0`),
    check('players_nickname_not_empty', sql`length(${t.nickname}) > 0`),
    check('players_normalized_not_empty', sql`length(${t.normalizedNickname}) > 0`),
    check(
      'players_display_alias_not_empty',
      sql`${t.displayAlias} is null or length(${t.displayAlias}) > 0`,
    ),
    check('players_archived_boolean', sql`${t.archived} in (0, 1)`),
    check('players_created_at_range', timeWindow(t.createdAt)),
    check('players_updated_at_range', timeWindow(t.updatedAt)),
    check('players_updated_not_before_created', sql`${t.updatedAt} >= ${t.createdAt}`),
  ],
);

// ---------------------------------------------------------------------------
// player_hud_snapshots (+ readings)
// ---------------------------------------------------------------------------

/**
 * TESTIMONY about what a third-party HUD displayed, typed in by the user.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE. A new reading is a NEW snapshot row. The
 * `player_hud_snapshots_no_update` / `_no_delete` triggers in
 * `drizzle/0001_insert_only_guards.sql` abort any UPDATE or DELETE, whoever issues it —
 * the repository, a raw Drizzle statement built from the exported table object, or raw
 * SQL (`CLAUDE.md` rule 3, ARCHITECTURE §C). The repository additionally exposes no
 * update path, but that is a convention on top of the guarantee, not the guarantee.
 *
 * `hand_sample` is nullable and `NULL` is NOT zero: an unknown HUD sample stays unknown.
 *
 * Permanently separate from `player_observations`. There is no view that averages the two
 * and there must never be one.
 */
export const playerHudSnapshots = sqliteTable(
  'player_hud_snapshots',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    /** Single-member union in the domain; the CHECK keeps it self-describing in storage. */
    source: text('source').notNull(),
    recordedAt: integer('recorded_at').notNull(),
    /** HUD-reported hand count, or NULL when the HUD showed none. */
    handSample: integer('hand_sample'),
  },
  (t) => [
    // Newest-first history for one player. Ascending is scanned backwards for DESC reads,
    // which keeps the index portable and avoids a per-dialect DESC index.
    index('player_hud_snapshots_player_recorded_idx').on(t.playerId, t.recordedAt, t.id),
    check('player_hud_snapshots_source', sql`${t.source} = 'MANUAL_HUD_ENTRY'`),
    check('player_hud_snapshots_recorded_at_range', timeWindow(t.recordedAt)),
    check(
      'player_hud_snapshots_hand_sample_range',
      sql`${t.handSample} is null or (${isIntegral(t.handSample)} and ${t.handSample} >= 0 and ${t.handSample} <= ${sql.raw(String(MAX_HAND_SAMPLE))})`,
    ),
  ],
);

/**
 * One stat reading inside one snapshot.
 *
 * `entered_text` (verbatim, e.g. `"23.5 %"`) and `value_centipercent` (the parsed integer)
 * are SEPARATE COLUMNS, never one. Re-parsing `entered_text` must reproduce
 * `value_centipercent`; the repository checks that on read and reports a corrupt row
 * rather than trusting either column alone.
 *
 * `ordinal` preserves the order the user entered the stats in, which the domain type keeps.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE, exactly as its parent is: overwriting
 * `entered_text` and `value_centipercent` together would defeat the read-time re-parse
 * check, so the `player_hud_snapshot_stats_no_update` / `_no_delete` triggers refuse both.
 * The FK is still declared `on delete cascade` — a snapshot cannot be deleted either, so
 * the cascade is unreachable and the declaration only records that these rows are
 * definitionally part of the snapshot.
 */
export const playerHudSnapshotStats = sqliteTable(
  'player_hud_snapshot_stats',
  {
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => playerHudSnapshots.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    statKey: text('stat_key').notNull(),
    enteredText: text('entered_text').notNull(),
    /** Hundredths of a percentage point, 0..10000. NOT money, and never a float. */
    valueCentipercent: integer('value_centipercent').notNull(),
    ordinal: integer('ordinal').notNull(),
  },
  (t) => [
    primaryKey({ name: 'player_hud_snapshot_stats_pk', columns: [t.snapshotId, t.statKey] }),
    uniqueIndex('player_hud_snapshot_stats_ordinal_unique').on(t.snapshotId, t.ordinal),
    check('player_hud_snapshot_stats_key', sql`${t.statKey} in ${inList(HUD_STAT_KEYS)}`),
    check('player_hud_snapshot_stats_entered_text_not_empty', sql`length(${t.enteredText}) > 0`),
    check(
      'player_hud_snapshot_stats_value_range',
      sql`${isIntegral(t.valueCentipercent)} and ${t.valueCentipercent} >= 0 and ${t.valueCentipercent} <= ${sql.raw(String(MAX_CENTI_PERCENT))}`,
    ),
    check('player_hud_snapshot_stats_ordinal_non_negative', sql`${t.ordinal} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// player_notes
// ---------------------------------------------------------------------------

/**
 * Free-text notes. APPEND-ONLY, ENFORCED BY THE DATABASE: an edit inserts a NEW row
 * carrying the original's `root_id` and a `supersedes_id` pointing at the version it
 * replaces. The `player_notes_no_update` / `_no_delete` triggers in
 * `drizzle/0001_insert_only_guards.sql` abort any UPDATE or DELETE, so an earlier body
 * cannot be overwritten by the repository, by a raw Drizzle statement, or by raw SQL
 * (`CLAUDE.md` rule 3).
 *
 * The partial UNIQUE index on `supersedes_id` keeps the version chain LINEAR: two rows
 * superseding the same version would hide both from `currentNotes` and lose the note.
 * `NULL` values stay distinct in both SQLite and PostgreSQL, which is what originals need.
 */
export const playerNotes = sqliteTable(
  'player_notes',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
    /** The FIRST version's id. Equal to `id` on an original. */
    rootId: text('root_id')
      .notNull()
      .references((): AnySQLiteColumn => playerNotes.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    /** The version this row replaces; NULL on an original. */
    supersedesId: text('supersedes_id').references((): AnySQLiteColumn => playerNotes.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
  },
  (t) => [
    index('player_notes_player_created_idx').on(t.playerId, t.createdAt, t.id),
    index('player_notes_root_created_idx').on(t.rootId, t.createdAt, t.id),
    uniqueIndex('player_notes_supersedes_unique')
      .on(t.supersedesId)
      .where(sql`${t.supersedesId} is not null`),
    check('player_notes_body_not_empty', sql`length(${t.body}) > 0`),
    check(
      'player_notes_body_max_length',
      sql`length(${t.body}) <= ${sql.raw(String(MAX_NOTE_LENGTH))}`,
    ),
    check('player_notes_created_at_range', timeWindow(t.createdAt)),
    check(
      'player_notes_root_chain',
      sql`(${t.supersedesId} is null and ${t.rootId} = ${t.id}) or (${t.supersedesId} is not null and ${t.rootId} <> ${t.id})`,
    ),
    check(
      'player_notes_no_self_supersede',
      sql`${t.supersedesId} is null or ${t.supersedesId} <> ${t.id}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// player_observations
// ---------------------------------------------------------------------------

/**
 * COUNTS WE RECORDED ourselves. `opportunities` and `actions` only — there is deliberately
 * NO rate column: a stored rate cannot be corrected, combined, or checked against its own
 * sample, and `player-core` derives it on demand.
 *
 * Natural key `(player_id, metric, position)` where `position` is NULLABLE and `NULL` is its
 * OWN bucket ("recorded without a position dimension"), not the sum of the six positional
 * ones. A plain `UNIQUE (player_id, metric, position)` does NOT enforce that: NULLs compare
 * distinct in SQLite and PostgreSQL alike, so it would happily admit two `NULL` rows. Hence
 * TWO partial unique indexes — one for the positional buckets, one for the `NULL` bucket.
 * Both dialects support partial indexes, so this stays portable.
 */
export const playerObservations = sqliteTable(
  'player_observations',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    metric: text('metric').notNull(),
    /** NULL is a distinct bucket, never "unknown" and never "all positions summed". */
    position: text('position'),
    opportunities: integer('opportunities').notNull(),
    actions: integer('actions').notNull(),
    firstObservedAt: integer('first_observed_at').notNull(),
    lastObservedAt: integer('last_observed_at').notNull(),
  },
  (t) => [
    uniqueIndex('player_observations_context_unique')
      .on(t.playerId, t.metric, t.position)
      .where(sql`${t.position} is not null`),
    uniqueIndex('player_observations_context_null_position_unique')
      .on(t.playerId, t.metric)
      .where(sql`${t.position} is null`),
    check('player_observations_metric', sql`${t.metric} in ${inList(OBSERVED_METRICS)}`),
    check(
      'player_observations_position',
      sql`${t.position} is null or ${t.position} in ${inList(OBSERVED_POSITIONS)}`,
    ),
    check(
      'player_observations_opportunities_range',
      sql`${isIntegral(t.opportunities)} and ${t.opportunities} >= 0 and ${t.opportunities} <= ${sql.raw(String(MAX_OBSERVATION_COUNT))}`,
    ),
    check(
      'player_observations_actions_range',
      sql`${isIntegral(t.actions)} and ${t.actions} >= 0 and ${t.actions} <= ${sql.raw(String(MAX_OBSERVATION_COUNT))}`,
    ),
    check(
      'player_observations_actions_within_opportunities',
      sql`${t.actions} <= ${t.opportunities}`,
    ),
    check('player_observations_first_observed_range', timeWindow(t.firstObservedAt)),
    check('player_observations_last_observed_range', timeWindow(t.lastObservedAt)),
    check(
      'player_observations_last_not_before_first',
      sql`${t.lastObservedAt} >= ${t.firstObservedAt}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// sessions + session_seats
// ---------------------------------------------------------------------------

/**
 * One sitting at our training table: the `TableState` between hands.
 *
 * `config_json` is the session's OWN copy of the effective `TableConfig` — including its
 * `RakeConfig` and `FeeConfig` — not a pointer to the preset. Editing a preset afterwards
 * must never retroactively change what a played session was configured with. `preset_id`
 * records the preset it was created from, when it came from one.
 *
 * PG: `config_json` becomes `jsonb`.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    label: text('label'),
    presetId: text('preset_id').references(() => gamePresets.presetId, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    configJson: text('config_json').notNull(),
    buttonSeat: integer('button_seat'),
    heroSeat: integer('hero_seat'),
    handNumber: integer('hand_number').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    closedAt: integer('closed_at'),
    /**
     * `AutoTopUpPolicy.enabled`, or NULL when the session records no policy at all. 0/1
     * rather than a boolean column so the integrality CHECK reads like its neighbours.
     */
    autoTopUpEnabled: integer('auto_top_up_enabled'),
    /**
     * `AutoTopUpPolicy.targetStack` in milliBB. NULL exactly when `auto_top_up_enabled`
     * is NULL, so "no policy" is one fact rather than two half-facts.
     *
     * `AutoTopUpPolicy.threshold` has deliberately NO column: Phase 4 collects only
     * enabled + target and stores `threshold = targetStack`, matching
     * `defaultAutoTopUpPolicy`. Phase 8 owns the editable threshold and adds its column
     * then; a column nothing can write would be a stub (`CLAUDE.md` rule 5).
     */
    autoTopUpTargetStack: integer('auto_top_up_target_stack'),
  },
  (t) => [
    index('sessions_created_idx').on(t.createdAt, t.id),
    check('sessions_label_not_empty', sql`${t.label} is null or length(${t.label}) > 0`),
    check(
      'sessions_button_seat_range',
      sql`${t.buttonSeat} is null or (${seatRange(t.buttonSeat)})`,
    ),
    check('sessions_hero_seat_range', sql`${t.heroSeat} is null or (${seatRange(t.heroSeat)})`),
    check('sessions_hand_number_non_negative', sql`${t.handNumber} >= 0`),
    check('sessions_created_at_range', timeWindow(t.createdAt)),
    check('sessions_updated_at_range', timeWindow(t.updatedAt)),
    check('sessions_updated_not_before_created', sql`${t.updatedAt} >= ${t.createdAt}`),
    check(
      'sessions_closed_at_range',
      sql`${t.closedAt} is null or (${isIntegral(t.closedAt)} and ${t.closedAt} >= ${t.createdAt} and ${t.closedAt} <= ${sql.raw(String(MAX_TIMESTAMP))})`,
    ),
    check(
      'sessions_auto_top_up_enabled_boolean',
      sql`${t.autoTopUpEnabled} is null or (${isIntegral(t.autoTopUpEnabled)} and ${t.autoTopUpEnabled} in (0, 1))`,
    ),
    check(
      'sessions_auto_top_up_target_stack_range',
      sql`${t.autoTopUpTargetStack} is null or (${moneyRange(t.autoTopUpTargetStack)} and ${t.autoTopUpTargetStack} > 0)`,
    ),
    // Both columns describe ONE policy, so both are present or neither is. Written the
    // long way, like `session_seats_empty_iff_no_player`, so it means the same thing in
    // SQLite and PostgreSQL.
    check(
      'sessions_auto_top_up_pair',
      sql`(${t.autoTopUpEnabled} is null and ${t.autoTopUpTargetStack} is null) or (${t.autoTopUpEnabled} is not null and ${t.autoTopUpTargetStack} is not null)`,
    ),
  ],
);

/**
 * One physical seat of a session. All six rows always exist, so occupancy is a fact about a
 * row rather than about a row's absence.
 *
 * `stack` is the ACTUAL entered stack in integer milliBB — never a normalized bucket.
 */
export const sessionSeats = sqliteTable(
  'session_seats',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    seat: integer('seat').notNull(),
    occupancy: text('occupancy').notNull(),
    playerId: text('player_id').references(() => players.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    stack: integer('stack').notNull(),
  },
  (t) => [
    primaryKey({ name: 'session_seats_pk', columns: [t.sessionId, t.seat] }),
    index('session_seats_player_idx').on(t.playerId),
    check('session_seats_seat_range', seatRange(t.seat)),
    check('session_seats_occupancy', sql`${t.occupancy} in ('ACTIVE', 'SITTING_OUT', 'EMPTY')`),
    // EMPTY iff no player. Written the long way so it means the same thing in SQLite and
    // PostgreSQL without relying on boolean-to-boolean comparison.
    check(
      'session_seats_empty_iff_no_player',
      sql`(${t.occupancy} = 'EMPTY' and ${t.playerId} is null) or (${t.occupancy} <> 'EMPTY' and ${t.playerId} is not null)`,
    ),
    check('session_seats_empty_stack_zero', sql`${t.occupancy} <> 'EMPTY' or ${t.stack} = 0`),
    check('session_seats_stack_non_negative', sql`${t.stack} >= 0`),
    check('session_seats_stack_range', moneyRange(t.stack)),
  ],
);

// ---------------------------------------------------------------------------
// hands + hand_players + hand_events
// ---------------------------------------------------------------------------

/**
 * A hand header. The hand ITSELF is its ordered `hand_events` log; this row carries only
 * what the log does not: which session it belongs to, and when it was recorded.
 *
 * `hand_number` is duplicated from `HAND_STARTED` because a "session's hands in order" read
 * needs an indexed column. It is a CHECKED projection, not drift: the repository refuses to
 * write a header whose `hand_number` disagrees with the log's own.
 */
export const hands = sqliteTable(
  'hands',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    handNumber: integer('hand_number').notNull(),
    startedAt: integer('started_at').notNull(),
    /** Set when the hand reached COMPLETE. NULL while it is still being entered. */
    finishedAt: integer('finished_at'),
  },
  (t) => [
    uniqueIndex('hands_session_hand_number_unique').on(t.sessionId, t.handNumber),
    index('hands_session_started_idx').on(t.sessionId, t.startedAt, t.id),
    check('hands_hand_number_non_negative', sql`${t.handNumber} >= 0`),
    check('hands_started_at_range', timeWindow(t.startedAt)),
    check(
      'hands_finished_at_range',
      sql`${t.finishedAt} is null or (${isIntegral(t.finishedAt)} and ${t.finishedAt} >= ${t.startedAt} and ${t.finishedAt} <= ${sql.raw(String(MAX_TIMESTAMP))})`,
    ),
  ],
);

/**
 * Who was dealt in, where, and with what ACTUAL starting stack.
 *
 * A projection of the log's `PLAYER_DEALT_IN` events, written in the same transaction as
 * the events and never edited afterwards, so "which hands did this player play" does not
 * require decoding every log. The LOG stays authoritative: `loadStoredHand` reads events
 * only and never consults this table.
 *
 * `player_id` is nullable — an unidentified opponent is seated without a `Player` record.
 */
export const handPlayers = sqliteTable(
  'hand_players',
  {
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    seat: integer('seat').notNull(),
    playerId: text('player_id').references(() => players.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    startingStack: integer('starting_stack').notNull(),
  },
  (t) => [
    primaryKey({ name: 'hand_players_pk', columns: [t.handId, t.seat] }),
    index('hand_players_player_idx').on(t.playerId, t.handId),
    check('hand_players_seat_range', seatRange(t.seat)),
    check('hand_players_starting_stack_positive', sql`${t.startingStack} > 0`),
    check('hand_players_starting_stack_range', moneyRange(t.startingStack)),
  ],
);

/**
 * The event log. `(hand_id, seq)` is the primary key AND the ordering key; `seq` is dense
 * and ascending from 0, which `poker-core`'s `decodeHandEvents` re-checks on read.
 *
 * `payload_json` holds the whole event exactly as `encodeHandEvent` produced it, including
 * its meta. The four meta columns beside it are indexed projections; the repository
 * verifies each against the decoded payload and reports a corrupt row on any disagreement,
 * so the projection can never quietly diverge from the document.
 *
 * `kind` deliberately has NO CHECK constraint. The authoritative validation is
 * `poker-core`'s own zod codec, which the repository runs on every read; pinning the event
 * vocabulary here as well would mean a migration every time the engine gains an event kind,
 * and would let this package hold a second, staler opinion about what a hand can contain.
 *
 * PG: `payload_json` becomes `jsonb`.
 */
export const handEvents = sqliteTable(
  'hand_events',
  {
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    seq: integer('seq').notNull(),
    /** `EventMeta.id`. Unique WITHIN a hand: a deterministic test IdFactory repeats across hands. */
    eventId: text('event_id').notNull(),
    commandSeq: integer('command_seq').notNull(),
    origin: text('origin').notNull(),
    kind: text('kind').notNull(),
    payloadJson: text('payload_json').notNull(),
  },
  (t) => [
    primaryKey({ name: 'hand_events_pk', columns: [t.handId, t.seq] }),
    uniqueIndex('hand_events_hand_event_id_unique').on(t.handId, t.eventId),
    index('hand_events_command_idx').on(t.handId, t.commandSeq, t.seq),
    check('hand_events_seq_non_negative', sql`${t.seq} >= 0`),
    check('hand_events_command_seq_non_negative', sql`${t.commandSeq} >= 0`),
    check('hand_events_origin', sql`${t.origin} in ('USER', 'ENGINE')`),
    check('hand_events_kind_not_empty', sql`length(${t.kind}) > 0`),
    check('hand_events_event_id_not_empty', sql`length(${t.eventId}) > 0`),
  ],
);
