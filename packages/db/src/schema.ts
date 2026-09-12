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
import { Money, type Id } from '@gto-self/shared';
import {
  BET_SIZE_BUCKETS,
  BET_SIZE_KINDS,
  EXTERNAL_HUD_STAT_KEYS,
  HUD_STAT_KEYS,
  LINEUP_SHAPES,
  MAX_CENTI_PERCENT,
  MAX_HAND_SAMPLE,
  MAX_NOTE_LENGTH,
  MAX_OBSERVATION_COUNT,
  MAX_TIMESTAMP,
  MODEL_STAT_KEYS,
  OBSERVED_METRICS,
  OBSERVED_POSITIONS,
  OBSERVED_STREETS,
  POSITION_RELATIONS,
  POSTFLOP_SPOT_FAMILIES,
  POT_TYPES,
  PREFLOP_SIZE_BUCKETS,
  PREFLOP_SPOT_FAMILIES,
  type ShowOutcome,
} from '@gto-self/player-core';

/**
 * `player-core`'s `ShowOutcome` members as a runtime list. `model.ts` exports the type but
 * no array for it, and `player-core` is out of this WP's boundary; the `Record` keeps the
 * list exhaustive AT COMPILE TIME in both directions — a new member fails to type here, and
 * a removed one fails too — so the CHECK cannot drift from the union.
 */
const SHOW_OUTCOME_MEMBERS: Record<ShowOutcome, true> = { WON: true, LOST: true, UNKNOWN: true };
export const SHOW_OUTCOMES = Object.keys(SHOW_OUTCOME_MEMBERS) as readonly ShowOutcome[];

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

/** `0 <= column <= MAX_OBSERVATION_COUNT`, for an opportunity/action/sample count. */
const countRange = (column: AnySQLiteColumn): SQL =>
  sql`${isIntegral(column)} and ${column} >= 0 and ${column} <= ${sql.raw(String(MAX_OBSERVATION_COUNT))}`;

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
// player_external_hud_snapshots (+ readings) — WP-K
// ---------------------------------------------------------------------------

/**
 * A LIFETIME reading imported in bulk from a third-party HUD, as opposed to
 * `player_hud_snapshots` (`MANUAL_HUD_ENTRY`, a session-scale reading typed in by hand).
 * See `@gto-self/player-core`'s `externalHud.ts` module doc for why this is a sibling
 * table rather than a widened `player_hud_snapshots`.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE, exactly like `player_hud_snapshots` — see the
 * `player_external_hud_snapshots_no_update`/`_no_delete` triggers in this table's own
 * migration (drizzle-kit cannot emit a trigger, so they are hand-authored there, same as
 * `0001` and `0007`).
 *
 * `sample_n` is nullable and stays `NULL` for every row `WP-K` writes: the source
 * screenshots show a lifetime total but not a hand count, and one is never fabricated.
 * `NULL` here is a fact about what we don't know, not a confidence signal by itself —
 * `adaptive-core` gives an `EXTERNAL_HUD` reading real confidence regardless.
 *
 * Permanently separate from `player_hud_snapshots` and `player_observations`: no view
 * averages this with either, and there must never be one.
 */
export const playerExternalHudSnapshots = sqliteTable(
  'player_external_hud_snapshots',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    /** Single-member union in the domain; the CHECK keeps it self-describing in storage. */
    source: text('source').notNull(),
    /** Single-member union today: every external profile imported is a lifetime total. */
    scope: text('scope').notNull(),
    /** Single-member union today: `WP-K` only imports profiles described as established. */
    reliability: text('reliability').notNull(),
    recordedAt: integer('recorded_at').notNull(),
    /** Always NULL today — see the table doc. Never defaulted to 0 or a guessed value. */
    sampleN: integer('sample_n'),
    /** Groups every player row one bulk-import run wrote, for audit only. */
    importBatchId: text('import_batch_id').notNull(),
  },
  (t) => [
    index('player_external_hud_snapshots_player_recorded_idx').on(t.playerId, t.recordedAt, t.id),
    index('player_external_hud_snapshots_batch_idx').on(t.importBatchId),
    check('player_external_hud_snapshots_source', sql`${t.source} = 'EXTERNAL_HUD'`),
    check('player_external_hud_snapshots_scope', sql`${t.scope} = 'LIFETIME'`),
    check('player_external_hud_snapshots_reliability', sql`${t.reliability} = 'ESTABLISHED'`),
    check('player_external_hud_snapshots_recorded_at_range', timeWindow(t.recordedAt)),
    check(
      'player_external_hud_snapshots_sample_n_range',
      sql`${t.sampleN} is null or (${isIntegral(t.sampleN)} and ${t.sampleN} >= 0 and ${t.sampleN} <= ${sql.raw(String(MAX_HAND_SAMPLE))})`,
    ),
    check(
      'player_external_hud_snapshots_import_batch_not_empty',
      sql`length(${t.importBatchId}) > 0`,
    ),
  ],
);

/**
 * One stat reading inside one external HUD snapshot. `stat_key` is the generic 10-member
 * `ExternalHudStatKey` vocabulary (`@gto-self/player-core`), NOT `HudStatKey` — deliberately
 * a different CHECK list, so this table's own street-blind `CBET_ANY_STREET` etc. can never
 * be confused with `player_hud_snapshot_stats`' per-street keys.
 *
 * A stat the source did not report gets NO ROW here, never a `NULL`/`0` value — omission is
 * how "unknown" survives end to end (`CLAUDE.md` rule 3).
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE, same reasoning as `player_hud_snapshot_stats`.
 */
export const playerExternalHudSnapshotStats = sqliteTable(
  'player_external_hud_snapshot_stats',
  {
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => playerExternalHudSnapshots.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    statKey: text('stat_key').notNull(),
    enteredText: text('entered_text').notNull(),
    /** Hundredths of a percentage point, 0..10000. NOT money, and never a float. */
    valueCentipercent: integer('value_centipercent').notNull(),
    ordinal: integer('ordinal').notNull(),
  },
  (t) => [
    primaryKey({
      name: 'player_external_hud_snapshot_stats_pk',
      columns: [t.snapshotId, t.statKey],
    }),
    uniqueIndex('player_external_hud_snapshot_stats_ordinal_unique').on(t.snapshotId, t.ordinal),
    check(
      'player_external_hud_snapshot_stats_key',
      sql`${t.statKey} in ${inList(EXTERNAL_HUD_STAT_KEYS)}`,
    ),
    check(
      'player_external_hud_snapshot_stats_entered_text_not_empty',
      sql`length(${t.enteredText}) > 0`,
    ),
    check(
      'player_external_hud_snapshot_stats_value_range',
      sql`${isIntegral(t.valueCentipercent)} and ${t.valueCentipercent} >= 0 and ${t.valueCentipercent} <= ${sql.raw(String(MAX_CENTI_PERCENT))}`,
    ),
    check('player_external_hud_snapshot_stats_ordinal_non_negative', sql`${t.ordinal} >= 0`),
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
    /**
     * This SEAT's own `AutoTopUpPolicy.enabled`, or NULL when the seat records no policy.
     * 0/1 rather than a boolean column so the integrality CHECK reads like its neighbours.
     *
     * Auto top-up is a per-seat preference, not one session-wide switch: `sessions`' own
     * two columns are the DEFAULT the seats are seeded from at session creation, and each
     * seat is free to diverge from it afterwards.
     */
    autoTopUpEnabled: integer('auto_top_up_enabled'),
    /**
     * This seat's `AutoTopUpPolicy.targetStack` in milliBB. NULL exactly when
     * `auto_top_up_enabled` is NULL, so "no policy" is one fact rather than two half-facts.
     *
     * `AutoTopUpPolicy.threshold` has deliberately NO column here, exactly as on `sessions`:
     * a seat row stores `threshold = targetStack` and `updateSessionSeatAutoTopUp` REFUSES a
     * policy whose threshold differs rather than dropping it. A column nothing can write
     * would be a stub (`CLAUDE.md` rule 5).
     */
    autoTopUpTargetStack: integer('auto_top_up_target_stack'),
    /**
     * `1` while `stack` is a number nobody has confirmed since the hand that disturbed it
     * (ADR-0078b): the seat is showing its pre-hand figure with a 확인 필요 mark on it, and
     * the mark has to survive a reload or an UNVERIFIED number renders as a confirmed one.
     *
     * NOT NULL with a `0` default, unlike the nullable `auto_top_up_*` pair above: "no
     * policy recorded" is a real third state for auto top-up, while a stack is either
     * confirmed or it is not. Every row written before migration `0010` is `0` — the safe
     * reading, because before that migration a corrected stack was the only stack the seat
     * could be storing. 0/1 rather than a boolean column so the integrality CHECK reads
     * exactly like its neighbours.
     *
     * Cleared where the in-memory mark is cleared: when the user states the stack.
     */
    stackUnverified: integer('stack_unverified').notNull().default(0),
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
    check(
      'session_seats_auto_top_up_enabled_boolean',
      sql`${t.autoTopUpEnabled} is null or (${isIntegral(t.autoTopUpEnabled)} and ${t.autoTopUpEnabled} in (0, 1))`,
    ),
    check(
      'session_seats_auto_top_up_target_stack_range',
      sql`${t.autoTopUpTargetStack} is null or (${moneyRange(t.autoTopUpTargetStack)} and ${t.autoTopUpTargetStack} > 0)`,
    ),
    // Both columns describe ONE policy, so both are present or neither is. Written the
    // long way, like `session_seats_empty_iff_no_player`, so it means the same thing in
    // SQLite and PostgreSQL.
    check(
      'session_seats_auto_top_up_pair',
      sql`(${t.autoTopUpEnabled} is null and ${t.autoTopUpTargetStack} is null) or (${t.autoTopUpEnabled} is not null and ${t.autoTopUpTargetStack} is not null)`,
    ),
    check(
      'session_seats_stack_unverified_boolean',
      sql`${isIntegral(t.stackUnverified)} and ${t.stackUnverified} in (0, 1)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// hands + hand_players + hand_events
// ---------------------------------------------------------------------------

/**
 * How a stored hand reached us (ADR-0059f). A CHECKed enum, unlike `hand_events.kind`:
 * this vocabulary is ours, not the engine's, and it is part of what a later import path
 * must declare about itself.
 *
 * `MANUAL_PRACTICE` — played at our own training table.
 * `MANUAL_REVIEW`  — entered by hand while reviewing a hand from elsewhere.
 *
 * There is deliberately no `IMPORTED`/`SCRAPED` member: nothing in this product reads a
 * poker client (`CLAUDE.md`, hard product boundary).
 */
export const HAND_SOURCES = ['MANUAL_PRACTICE', 'MANUAL_REVIEW'] as const;
export type HandSource = (typeof HAND_SOURCES)[number];

/** The stored-representation version every hand this milestone writes carries. */
export const CURRENT_HAND_SCHEMA_VERSION = 1;

/**
 * A hand header. The hand ITSELF is its ordered `hand_events` log; this row carries only
 * what the log does not: which session it belongs to, and when it was recorded.
 *
 * `hand_number` is duplicated from `HAND_STARTED` because a "session's hands in order" read
 * needs an indexed column. It is a CHECKED projection, not drift: the repository refuses to
 * write a header whose `hand_number` disagrees with the log's own.
 *
 * `source` and `schema_version` were added additively by `0004_completed_hand_history.sql`
 * (ADR-0059f). `source` says HOW the hand reached us — today always `MANUAL_PRACTICE`,
 * because nothing else can enter one. `schema_version` is the version of the STORED
 * REPRESENTATION (the event-log encoding in `hand_events.payload_json`), so a later
 * encoding change can be migrated per row instead of guessed at on read.
 *
 * A finished hand is IMMUTABLE in the database: `0004` adds `BEFORE DELETE` on every row
 * and `BEFORE UPDATE ... WHEN OLD.finished_at IS NOT NULL` triggers (ADR-0060). Read that
 * migration alongside this file.
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
    /** How the hand reached us. `MANUAL_PRACTICE` for a hand played at our own table. */
    source: text('source').notNull().default('MANUAL_PRACTICE'),
    /** Version of the stored representation of the log. 1 = `encodeHandEvent` as of C0. */
    schemaVersion: integer('schema_version').notNull().default(1),
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
    check('hands_source', sql`${t.source} in ${inList(HAND_SOURCES)}`),
    check(
      'hands_schema_version_positive',
      sql`${isIntegral(t.schemaVersion)} and ${t.schemaVersion} >= 1`,
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

// ---------------------------------------------------------------------------
// analysis_runs + analysis_run_players
// ---------------------------------------------------------------------------

/**
 * How a whole analysis run ended (prompt §33, ADR-0062d).
 *
 * `PARTIAL` is a first-class outcome, not an error to be rounded to `FAILED` or hidden as
 * `SUCCESS`: one player's computation failing must be reported as exactly that.
 */
export const ANALYSIS_RUN_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED'] as const;
export type AnalysisRunStatus = (typeof ANALYSIS_RUN_STATUSES)[number];

/**
 * What the run did for ONE player.
 *
 * `NO_CHANGES` is the idempotency outcome (ADR-0062c): the player's latest snapshot was
 * computed from the same input hash under the same algorithm version, so nothing was
 * written. It is a success, and it is deliberately distinguishable from `SNAPSHOT_CREATED`.
 */
export const ANALYSIS_PLAYER_OUTCOMES = ['SNAPSHOT_CREATED', 'NO_CHANGES', 'FAILED'] as const;
export type AnalysisPlayerOutcome = (typeof ANALYSIS_PLAYER_OUTCOMES)[number];

/** Caller-supplied branded ids for the two derived-layer roots (ADR-0007, ADR-0040). */
export type AnalysisRunId = Id<'AnalysisRun'>;
export type ModelSnapshotId = Id<'ModelSnapshot'>;

/**
 * One audited execution of "세션 분석 및 반영" (prompt §15).
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE (`0005`, same pattern as ADR-0037/ADR-0060): a run
 * is a historical fact. A re-run is a NEW row.
 *
 * The run has no `input_hash` column on purpose. Input identity is PER PLAYER — one run
 * covers many players, each with its own eligible hand set — so the hash lives on
 * `player_model_snapshots`, where the `NO_CHANGES` gate actually compares it.
 *
 * The counts are what the run OBSERVED across the players it processed; they are recorded
 * for audit and are never summed into a player's model.
 */
export const analysisRuns = sqliteTable(
  'analysis_runs',
  {
    id: text('id').primaryKey(),
    /** The session whose completed hands defined the run's SCOPE (ADR-0062b). */
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at').notNull(),
    /** `ANALYSIS_ALGORITHM_VERSION` the run executed under. */
    algorithmVersion: integer('algorithm_version').notNull(),
    status: text('status').notNull(),
    handCount: integer('hand_count').notNull(),
    playerCount: integer('player_count').notNull(),
    observationCount: integer('observation_count').notNull(),
    showCount: integer('show_count').notNull(),
    /** Run-level failure metadata, verbatim JSON. NULL when the run did not fail overall. */
    errorJson: text('error_json'),
  },
  (t) => [
    index('analysis_runs_session_started_idx').on(t.sessionId, t.startedAt, t.id),
    check('analysis_runs_id_not_empty', sql`length(${t.id}) > 0`),
    check('analysis_runs_started_at_range', timeWindow(t.startedAt)),
    check(
      'analysis_runs_finished_at_range',
      sql`${isIntegral(t.finishedAt)} and ${t.finishedAt} >= ${t.startedAt} and ${t.finishedAt} <= ${sql.raw(String(MAX_TIMESTAMP))}`,
    ),
    check(
      'analysis_runs_algorithm_version_positive',
      sql`${isIntegral(t.algorithmVersion)} and ${t.algorithmVersion} >= 1`,
    ),
    check('analysis_runs_status', sql`${t.status} in ${inList(ANALYSIS_RUN_STATUSES)}`),
    check('analysis_runs_hand_count_range', countRange(t.handCount)),
    check('analysis_runs_player_count_range', countRange(t.playerCount)),
    check('analysis_runs_observation_count_range', countRange(t.observationCount)),
    check('analysis_runs_show_count_range', countRange(t.showCount)),
    check(
      'analysis_runs_error_json_not_empty',
      sql`${t.errorJson} is null or length(${t.errorJson}) > 0`,
    ),
  ],
);

/**
 * The per-player outcome of one run (prompt §33). PK `(run_id, player_id)`: a run reports
 * exactly one outcome per player, and a second report would be a bug, not a second row.
 *
 * `snapshot_id` is non-NULL exactly when the outcome is `SNAPSHOT_CREATED` — enforced by
 * CHECK, so "created a snapshot" cannot be claimed without pointing at one.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE.
 */
export const analysisRunPlayers = sqliteTable(
  'analysis_run_players',
  {
    runId: text('run_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    outcome: text('outcome').notNull(),
    snapshotId: text('snapshot_id').references((): AnySQLiteColumn => playerModelSnapshots.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    /** This player's failure metadata, verbatim JSON. NULL unless the outcome is `FAILED`. */
    errorJson: text('error_json'),
  },
  (t) => [
    primaryKey({ name: 'analysis_run_players_pk', columns: [t.runId, t.playerId] }),
    index('analysis_run_players_player_idx').on(t.playerId, t.runId),
    check('analysis_run_players_outcome', sql`${t.outcome} in ${inList(ANALYSIS_PLAYER_OUTCOMES)}`),
    // Written the long way so it means the same thing in SQLite and PostgreSQL.
    check(
      'analysis_run_players_snapshot_iff_created',
      sql`(${t.outcome} = 'SNAPSHOT_CREATED' and ${t.snapshotId} is not null) or (${t.outcome} <> 'SNAPSHOT_CREATED' and ${t.snapshotId} is null)`,
    ),
    check(
      'analysis_run_players_error_only_when_failed',
      sql`${t.errorJson} is null or (${t.outcome} = 'FAILED' and length(${t.errorJson}) > 0)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// player_model_snapshots (+ its four child tables)
// ---------------------------------------------------------------------------

/**
 * One immutable, versioned DERIVED player model (prompt §21, §24, ADR-0062c).
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE. `v1` is never overwritten when `v2` arrives:
 * `UNIQUE(player_id, model_version)` plus the insert-only triggers make a rewrite
 * impossible, and the repository assigns `latest + 1` inside the same transaction that
 * writes the row.
 *
 * `input_hash` + `algorithm_version` are the idempotency gate: a run whose recomputation
 * produces both values equal to this player's latest snapshot writes NOTHING and reports
 * `NO_CHANGES`. They are the reason a second click cannot double a count.
 *
 * The confidence CONFIG is stored (`k` and both display thresholds) rather than the
 * derived weights: a stored `weightBps` would be a second opinion that could drift from
 * `player-core`'s own integer formula, while an old snapshot without its `k` would be
 * uninterpretable. Each child row therefore stores the OPPORTUNITY COUNT its confidence
 * was computed from, and `snapshotConfidence(n, config)` reproduces the record exactly —
 * the formula is pure integer arithmetic, so this is bit-identical, not approximately
 * equal. Bet-size bucket boundaries are deliberately NOT stored: the bucket LABEL each
 * observation was given is stored verbatim, so the boundaries are not needed to read a
 * snapshot back, and `algorithm_version` records which engine produced them.
 */
export const playerModelSnapshots = sqliteTable(
  'player_model_snapshots',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    /** Monotonic per player, starting at 1. Assigned by the repository as `latest + 1`. */
    modelVersion: integer('model_version').notNull(),
    analysisRunId: text('analysis_run_id')
      .notNull()
      .references(() => analysisRuns.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    algorithmVersion: integer('algorithm_version').notNull(),
    /** Deterministic identity of the eligible raw-hand set this was computed from. */
    inputHash: text('input_hash').notNull(),
    sourceHandCount: integer('source_hand_count').notNull(),
    sourceObservationCount: integer('source_observation_count').notNull(),
    sourceShowCount: integer('source_show_count').notNull(),
    createdAt: integer('created_at').notNull(),
    /** `SnapshotConfidenceMetadata.k` — the `K` in `n / (n + K)` actually applied. */
    confidenceK: integer('confidence_k').notNull(),
    confidenceLearningThreshold: integer('confidence_learning_threshold').notNull(),
    confidenceKnownThreshold: integer('confidence_known_threshold').notNull(),
    /** The sample `SnapshotConfidenceMetadata.overall` was computed from. */
    confidenceOverallOpportunities: integer('confidence_overall_opportunities').notNull(),
  },
  (t) => [
    uniqueIndex('player_model_snapshots_player_version_unique').on(t.playerId, t.modelVersion),
    index('player_model_snapshots_player_created_idx').on(t.playerId, t.createdAt, t.id),
    index('player_model_snapshots_run_idx').on(t.analysisRunId),
    check('player_model_snapshots_id_not_empty', sql`length(${t.id}) > 0`),
    check(
      'player_model_snapshots_model_version_positive',
      sql`${isIntegral(t.modelVersion)} and ${t.modelVersion} >= 1`,
    ),
    check(
      'player_model_snapshots_algorithm_version_positive',
      sql`${isIntegral(t.algorithmVersion)} and ${t.algorithmVersion} >= 1`,
    ),
    check('player_model_snapshots_input_hash_not_empty', sql`length(${t.inputHash}) > 0`),
    check('player_model_snapshots_source_hand_count_range', countRange(t.sourceHandCount)),
    check(
      'player_model_snapshots_source_observation_count_range',
      countRange(t.sourceObservationCount),
    ),
    check('player_model_snapshots_source_show_count_range', countRange(t.sourceShowCount)),
    check('player_model_snapshots_created_at_range', timeWindow(t.createdAt)),
    check(
      'player_model_snapshots_confidence_k_positive',
      sql`${isIntegral(t.confidenceK)} and ${t.confidenceK} >= 1`,
    ),
    check(
      'player_model_snapshots_confidence_thresholds',
      sql`${isIntegral(t.confidenceLearningThreshold)} and ${t.confidenceLearningThreshold} >= 1 and ${isIntegral(t.confidenceKnownThreshold)} and ${t.confidenceLearningThreshold} < ${t.confidenceKnownThreshold}`,
    ),
    check(
      'player_model_snapshots_confidence_overall_range',
      countRange(t.confidenceOverallOpportunities),
    ),
  ],
);

/**
 * `PlayerModelContent.globalStats` — one `ModelStatCount` per row.
 *
 * `position` is NULLABLE and `NULL` is its OWN bucket ("every position together"), never
 * the sum of the six positional rows and never merged with them (ADR-0035, ADR-0062).
 * Exactly as `player_observations` does it, TWO partial unique indexes enforce that,
 * because a plain `UNIQUE(..., position)` admits two NULL rows in both dialects.
 *
 * `ordinal` preserves the engine's own array order, so a reload reproduces
 * `globalStats` element-for-element rather than re-deriving a sort this layer would have
 * to keep in step with `analysis-core`.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE.
 */
export const playerModelStats = sqliteTable(
  'player_model_stats',
  {
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => playerModelSnapshots.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    ordinal: integer('ordinal').notNull(),
    statKey: text('stat_key').notNull(),
    /** NULL is a distinct bucket, never "unknown" and never "all positions summed". */
    position: text('position'),
    opportunities: integer('opportunities').notNull(),
    actions: integer('actions').notNull(),
    /** The sample `SnapshotConfidence` was computed from; the weight is derived on read. */
    confidenceOpportunities: integer('confidence_opportunities').notNull(),
  },
  (t) => [
    primaryKey({ name: 'player_model_stats_pk', columns: [t.snapshotId, t.ordinal] }),
    uniqueIndex('player_model_stats_context_unique')
      .on(t.snapshotId, t.statKey, t.position)
      .where(sql`${t.position} is not null`),
    uniqueIndex('player_model_stats_context_null_position_unique')
      .on(t.snapshotId, t.statKey)
      .where(sql`${t.position} is null`),
    check('player_model_stats_ordinal_non_negative', sql`${t.ordinal} >= 0`),
    check('player_model_stats_key', sql`${t.statKey} in ${inList(MODEL_STAT_KEYS)}`),
    check(
      'player_model_stats_position',
      sql`${t.position} is null or ${t.position} in ${inList(OBSERVED_POSITIONS)}`,
    ),
    check('player_model_stats_opportunities_range', countRange(t.opportunities)),
    check('player_model_stats_actions_range', countRange(t.actions)),
    check(
      'player_model_stats_actions_within_opportunities',
      sql`${t.actions} <= ${t.opportunities}`,
    ),
    check('player_model_stats_confidence_range', countRange(t.confidenceOpportunities)),
  ],
);

/**
 * `PlayerModelContent.spotStats` — one `SpotStatCount` per row (ADR-0062a's
 * `player_spot_stats`).
 *
 * The `SpotDescriptor` is stored as COLUMNS, and the canonical `spot_key` is stored beside
 * them. Both, deliberately: the columns are the lossless record (a key is a lossy
 * projection and nothing should ever have to parse one back into dimensions), and the key
 * is what the UI groups and looks up by. They cannot drift, because the decoder re-derives
 * the key with `player-core`'s own `spotKey` and reports `CORRUPT_ROW` on a disagreement.
 *
 * The phase discriminator is enforced: a PREFLOP row carries `opponent_position` and no
 * postflop dimension; a POSTFLOP row carries all four postflop dimensions and no
 * `opponent_position`.
 *
 * Effect and verb counts are explicit columns rather than a JSON document: they are the
 * numbers a later query will actually filter and aggregate on, and their sums are CHECKed
 * against `opportunities`, which a blob could not be. `ALL_IN` has no effect column on
 * purpose — an all-in FUNCTIONED as a call, a bet or a raise, and its verb is preserved
 * separately so the shove is still visible (`CLAUDE.md` rule 3).
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE.
 */
export const playerSpotStats = sqliteTable(
  'player_spot_stats',
  {
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => playerModelSnapshots.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    ordinal: integer('ordinal').notNull(),
    spotKey: text('spot_key').notNull(),
    phase: text('phase').notNull(),
    /** A `PreflopSpotFamily` on a PREFLOP row, a `PostflopSpotFamily` on a POSTFLOP row. */
    family: text('family').notNull(),
    position: text('position').notNull(),
    /** PREFLOP only: who created the situation. NULL for RFI / VS_LIMP / BB_OPTION. */
    opponentPosition: text('opponent_position'),
    lineup: text('lineup').notNull(),
    /** POSTFLOP only. */
    street: text('street'),
    /** POSTFLOP only. */
    relation: text('relation'),
    /** POSTFLOP only. */
    potType: text('pot_type'),
    /** POSTFLOP only. `NONE` when not facing a bet — a bucket, not a zero-sized bet. */
    facingSize: text('facing_size'),
    opportunities: integer('opportunities').notNull(),
    effectFold: integer('effect_fold').notNull(),
    effectCheck: integer('effect_check').notNull(),
    effectCall: integer('effect_call').notNull(),
    effectBet: integer('effect_bet').notNull(),
    effectRaise: integer('effect_raise').notNull(),
    verbFold: integer('verb_fold').notNull(),
    verbCheck: integer('verb_check').notNull(),
    verbCall: integer('verb_call').notNull(),
    verbBet: integer('verb_bet').notNull(),
    verbRaise: integer('verb_raise').notNull(),
    verbAllIn: integer('verb_all_in').notNull(),
    confidenceOpportunities: integer('confidence_opportunities').notNull(),
  },
  (t) => [
    primaryKey({ name: 'player_spot_stats_pk', columns: [t.snapshotId, t.ordinal] }),
    uniqueIndex('player_spot_stats_spot_unique').on(t.snapshotId, t.spotKey),
    index('player_spot_stats_spot_key_idx').on(t.spotKey),
    check('player_spot_stats_ordinal_non_negative', sql`${t.ordinal} >= 0`),
    check('player_spot_stats_spot_key_not_empty', sql`length(${t.spotKey}) > 0`),
    check('player_spot_stats_phase', sql`${t.phase} in ('PREFLOP', 'POSTFLOP')`),
    check(
      'player_spot_stats_family',
      sql`(${t.phase} = 'PREFLOP' and ${t.family} in ${inList(PREFLOP_SPOT_FAMILIES)}) or (${t.phase} = 'POSTFLOP' and ${t.family} in ${inList(POSTFLOP_SPOT_FAMILIES)})`,
    ),
    check('player_spot_stats_position', sql`${t.position} in ${inList(OBSERVED_POSITIONS)}`),
    check('player_spot_stats_lineup', sql`${t.lineup} in ${inList(LINEUP_SHAPES)}`),
    check(
      'player_spot_stats_preflop_dimensions',
      sql`${t.phase} <> 'PREFLOP' or (${t.street} is null and ${t.relation} is null and ${t.potType} is null and ${t.facingSize} is null and (${t.opponentPosition} is null or ${t.opponentPosition} in ${inList(OBSERVED_POSITIONS)}))`,
    ),
    check(
      'player_spot_stats_postflop_dimensions',
      sql`${t.phase} <> 'POSTFLOP' or (${t.opponentPosition} is null and ${t.street} in ${inList(OBSERVED_STREETS)} and ${t.relation} in ${inList(POSITION_RELATIONS)} and ${t.potType} in ${inList(POT_TYPES)} and ${t.facingSize} in ${inList(BET_SIZE_BUCKETS)})`,
    ),
    check('player_spot_stats_opportunities_range', countRange(t.opportunities)),
    check('player_spot_stats_effect_fold_range', countRange(t.effectFold)),
    check('player_spot_stats_effect_check_range', countRange(t.effectCheck)),
    check('player_spot_stats_effect_call_range', countRange(t.effectCall)),
    check('player_spot_stats_effect_bet_range', countRange(t.effectBet)),
    check('player_spot_stats_effect_raise_range', countRange(t.effectRaise)),
    check('player_spot_stats_verb_fold_range', countRange(t.verbFold)),
    check('player_spot_stats_verb_check_range', countRange(t.verbCheck)),
    check('player_spot_stats_verb_call_range', countRange(t.verbCall)),
    check('player_spot_stats_verb_bet_range', countRange(t.verbBet)),
    check('player_spot_stats_verb_raise_range', countRange(t.verbRaise)),
    check('player_spot_stats_verb_all_in_range', countRange(t.verbAllIn)),
    // Every decision in the bucket is classified exactly once, under both vocabularies.
    check(
      'player_spot_stats_effects_sum',
      sql`${t.effectFold} + ${t.effectCheck} + ${t.effectCall} + ${t.effectBet} + ${t.effectRaise} = ${t.opportunities}`,
    ),
    check(
      'player_spot_stats_verbs_sum',
      sql`${t.verbFold} + ${t.verbCheck} + ${t.verbCall} + ${t.verbBet} + ${t.verbRaise} + ${t.verbAllIn} = ${t.opportunities}`,
    ),
    check('player_spot_stats_confidence_range', countRange(t.confidenceOpportunities)),
  ],
);

/**
 * `PlayerModelContent.betSizes` — one aggressive action, with the ACTUAL integer milliBB
 * amounts preserved (prompt §19, `CLAUDE.md` rules 1 and 3).
 *
 * A separate table rather than a JSON document on the snapshot: this list grows linearly
 * with hands and its whole point is that the raw amounts stay queryable. `bucket` is the
 * explicitly-heuristic LABEL beside them, never instead of them, and it accepts a member of
 * either bucket vocabulary because a preflop raise is bucketed in big blinds and a postflop
 * bet as a fraction of the pot.
 *
 * `hand_id` is a real foreign key: an observation is evidence about a stored hand, and one
 * that outlived its hand would be unauditable. Raw history cannot be deleted anyway
 * (ADR-0060), so RESTRICT here is a statement of intent rather than a live constraint.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE.
 */
export const playerModelBetSizes = sqliteTable(
  'player_model_bet_sizes',
  {
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => playerModelSnapshots.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    ordinal: integer('ordinal').notNull(),
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    kind: text('kind').notNull(),
    spotKey: text('spot_key').notNull(),
    /** The player's street contribution AFTER the action — raise-TO semantics. milliBB. */
    toAmount: integer('to_amount').notNull(),
    amount: integer('amount').notNull(),
    potBefore: integer('pot_before').notNull(),
    currentBetBefore: integer('current_bet_before').notNull(),
    bigBlind: integer('big_blind').notNull(),
    bucket: text('bucket').notNull(),
  },
  (t) => [
    primaryKey({ name: 'player_model_bet_sizes_pk', columns: [t.snapshotId, t.ordinal] }),
    index('player_model_bet_sizes_hand_idx').on(t.handId),
    index('player_model_bet_sizes_snapshot_kind_idx').on(t.snapshotId, t.kind),
    check('player_model_bet_sizes_ordinal_non_negative', sql`${t.ordinal} >= 0`),
    check('player_model_bet_sizes_kind', sql`${t.kind} in ${inList(BET_SIZE_KINDS)}`),
    check('player_model_bet_sizes_spot_key_not_empty', sql`length(${t.spotKey}) > 0`),
    check('player_model_bet_sizes_to_amount_range', moneyRange(t.toAmount)),
    check('player_model_bet_sizes_amount_range', moneyRange(t.amount)),
    check('player_model_bet_sizes_pot_before_range', moneyRange(t.potBefore)),
    check('player_model_bet_sizes_current_bet_before_range', moneyRange(t.currentBetBefore)),
    check('player_model_bet_sizes_big_blind_range', moneyRange(t.bigBlind)),
    check(
      'player_model_bet_sizes_bucket',
      // Deduplicated: the two vocabularies share `SMALL` and `LARGE`.
      sql`${t.bucket} in ${inList([...new Set([...BET_SIZE_BUCKETS, ...PREFLOP_SIZE_BUCKETS])])}`,
    ),
  ],
);

/**
 * `PlayerModelContent.showEvidence` — a hand the player EXPLICITLY revealed (ADR-0062f).
 *
 * Only a `HOLE_CARDS_SET { revealed: true }` event produces one of these. A MUCK produces
 * NO row: unknown cards are represented by the absence of a record, never by a guess.
 *
 * `cards` and `board` are stored as the canonical card TEXT (`"As Kd"`), which is exactly
 * what the user would read back, and are decoded through `shared`'s own `parseCards`.
 * `cards` may legitimately hold ONE card — the engine accepts a partial reveal — so the
 * CHECK pins the two legal lengths (2 or 5 characters) rather than requiring a pair, and
 * the board CHECK pins 0 / 3 / 4 / 5 cards.
 *
 * `spot_keys_json` is a JSON array of the spot keys the player was observed in during the
 * hand, in action order. It is a list of already-stored keys, kept in order, with no
 * queryable dimension of its own — the ADR-0038 case for a document rather than a table.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE.
 */
export const playerModelShowEvidence = sqliteTable(
  'player_model_show_evidence',
  {
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => playerModelSnapshots.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    ordinal: integer('ordinal').notNull(),
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    position: text('position').notNull(),
    /** `"As Kd"` — or `"As"` for a legal one-card reveal. */
    cardsText: text('cards_text').notNull(),
    /** `""` when no board was dealt; otherwise 3, 4 or 5 cards. */
    boardText: text('board_text').notNull(),
    lastStreet: text('last_street').notNull(),
    spotKeysJson: text('spot_keys_json').notNull(),
    outcome: text('outcome').notNull(),
    /** Gross chips won in this hand, milliBB. Zero when the player won nothing. */
    wonGross: integer('won_gross').notNull(),
  },
  (t) => [
    primaryKey({ name: 'player_model_show_evidence_pk', columns: [t.snapshotId, t.ordinal] }),
    uniqueIndex('player_model_show_evidence_hand_unique').on(t.snapshotId, t.handId),
    index('player_model_show_evidence_hand_idx').on(t.handId),
    check('player_model_show_evidence_ordinal_non_negative', sql`${t.ordinal} >= 0`),
    check(
      'player_model_show_evidence_position',
      sql`${t.position} in ${inList(OBSERVED_POSITIONS)}`,
    ),
    // ONE card is legal (a partial reveal); two is the norm. 2 or 5 characters.
    check('player_model_show_evidence_cards_length', sql`length(${t.cardsText}) in (2, 5)`),
    // 0, 3, 4 or 5 cards: "", 8, 11 or 14 characters.
    check('player_model_show_evidence_board_length', sql`length(${t.boardText}) in (0, 8, 11, 14)`),
    check(
      'player_model_show_evidence_last_street',
      sql`${t.lastStreet} in ${inList(['PREFLOP', ...OBSERVED_STREETS])}`,
    ),
    check('player_model_show_evidence_spot_keys_not_empty', sql`length(${t.spotKeysJson}) > 0`),
    check('player_model_show_evidence_outcome', sql`${t.outcome} in ${inList(SHOW_OUTCOMES)}`),
    check('player_model_show_evidence_won_gross_range', moneyRange(t.wonGross)),
    check('player_model_show_evidence_won_gross_non_negative', sql`${t.wonGross} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// strategy_decision_traces
// ---------------------------------------------------------------------------

/** Caller-supplied branded id for one Hero decision point's stored REFERENCE trace. */
export type StrategyDecisionTraceId = Id<'StrategyDecisionTrace'>;

/** The only strategy mode that exists today (Strategy A+B). */
export const STRATEGY_TRACE_MODES = ['REFERENCE'] as const;
export type StrategyTraceMode = (typeof STRATEGY_TRACE_MODES)[number];

/** ADR-0056's provenance vocabulary, applied per-trace to `primaryAction`'s recommendation. */
export const STRATEGY_TRACE_PROVENANCE_QUALITIES = ['SOURCE', 'DERIVED', 'HEURISTIC'] as const;
export type StrategyTraceProvenanceQuality = (typeof STRATEGY_TRACE_PROVENANCE_QUALITIES)[number];

/** How this trace reached storage. `ONLINE` — generated as the hand was played/persisted. */
export const STRATEGY_TRACE_SOURCES = ['ONLINE', 'BACKFILL'] as const;
export type StrategyTraceSource = (typeof STRATEGY_TRACE_SOURCES)[number];

/** `poker-core`'s street enum, applied to the decision point's street. */
export const STRATEGY_TRACE_STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'] as const;
export type StrategyTraceStreet = (typeof STRATEGY_TRACE_STREETS)[number];

/** `poker-core`'s action vocabulary, applied to the Hero action actually taken. */
export const STRATEGY_TRACE_ACTIONS = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'] as const;
export type StrategyTraceAction = (typeof STRATEGY_TRACE_ACTIONS)[number];

/** `0 <= column <= 10000` — a basis-points fraction (ADR-0016/ADR-0056's integer convention). */
const bpsRange = (column: AnySQLiteColumn): SQL =>
  sql`${isIntegral(column)} and ${column} >= 0 and ${column} <= 10000`;

/**
 * One Hero decision point in a COMPLETED hand: what the REFERENCE strategy engine
 * recommended at that moment, computed by replaying `hand_events` after the hand was
 * persisted (that generation logic lives elsewhere — this table only stores the result).
 *
 * `id` is `${handId}:${commandSeq}`, caller-supplied and stable, exactly like `hands.id`
 * (ADR-0007) — never autoincrement. `(hand_id, command_seq)` is additionally indexed
 * UNIQUE so the natural key cannot be duplicated under a different `id`.
 *
 * `actions_json` is a JSON-encoded array of `{action, frequencyBps, toAmountMbb}` rows;
 * decoding it into `player-core`/`strategy-core` types is a repository concern, not a
 * storage concern (ADR-0038's case for a document over a table applies here as it does to
 * `player_model_show_evidence.spot_keys_json`).
 *
 * `heroEquityBps`, `potOddsBps` and `spr` are nullable: a decision point does not always
 * have an equity/pot-odds/SPR figure available (e.g. a preflop-only spot with no board).
 * `spr` is stored as a plain nullable integer with no invented scaling — `poker-core`'s own
 * `spr()` returns a float ratio and has no precedent integer encoding in this schema; a
 * later phase that needs sub-integer precision adds it deliberately, in its own migration.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE (same posture as `player_model_snapshots` and the
 * rest of the derived layer, ADR-0059/ADR-0060's "completed hand history is immutable"
 * extended to this derived-but-permanent per-decision record): a trace is recomputed as a
 * NEW row (a new `strategy_version`), never rewritten in place.
 */
export const strategyDecisionTraces = sqliteTable(
  'strategy_decision_traces',
  {
    id: text('id').primaryKey(),
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    commandSeq: integer('command_seq').notNull(),
    street: text('street').notNull(),
    heroSeat: integer('hero_seat').notNull(),
    strategyMode: text('strategy_mode').notNull(),
    strategyVersion: text('strategy_version').notNull(),
    family: text('family').notNull(),
    /** JSON array of `{action, frequencyBps, toAmountMbb}`. Decoded by the repository. */
    actionsJson: text('actions_json').notNull(),
    primaryAction: text('primary_action').notNull(),
    /** The recommended raise/bet-to amount, milliBB. NULL for FOLD/CHECK/CALL recommendations. */
    recommendedToAmountMbb: integer('recommended_to_amount_mbb'),
    heroEquityBps: integer('hero_equity_bps'),
    potOddsBps: integer('pot_odds_bps'),
    /** A plain integer ratio, no invented scaling — see the table doc comment. */
    spr: integer('spr'),
    provenanceQuality: text('provenance_quality').notNull(),
    environmentStatus: text('environment_status').notNull(),
    actualHeroAction: text('actual_hero_action').notNull(),
    computedAt: integer('computed_at').notNull(),
    source: text('source').notNull(),
  },
  (t) => [
    uniqueIndex('strategy_decision_traces_hand_command_unique').on(t.handId, t.commandSeq),
    check('strategy_decision_traces_id_not_empty', sql`length(${t.id}) > 0`),
    check('strategy_decision_traces_command_seq_non_negative', sql`${t.commandSeq} >= 0`),
    check('strategy_decision_traces_street', sql`${t.street} in ${inList(STRATEGY_TRACE_STREETS)}`),
    check('strategy_decision_traces_hero_seat_range', seatRange(t.heroSeat)),
    check(
      'strategy_decision_traces_strategy_mode',
      sql`${t.strategyMode} in ${inList(STRATEGY_TRACE_MODES)}`,
    ),
    check(
      'strategy_decision_traces_strategy_version_not_empty',
      sql`length(${t.strategyVersion}) > 0`,
    ),
    check('strategy_decision_traces_family_not_empty', sql`length(${t.family}) > 0`),
    check('strategy_decision_traces_actions_json_not_empty', sql`length(${t.actionsJson}) > 0`),
    check(
      'strategy_decision_traces_primary_action',
      sql`${t.primaryAction} in ${inList(STRATEGY_TRACE_ACTIONS)}`,
    ),
    check(
      'strategy_decision_traces_recommended_to_amount_range',
      sql`${t.recommendedToAmountMbb} is null or (${moneyRange(t.recommendedToAmountMbb)} and ${t.recommendedToAmountMbb} >= 0)`,
    ),
    check(
      'strategy_decision_traces_hero_equity_range',
      sql`${t.heroEquityBps} is null or (${bpsRange(t.heroEquityBps)})`,
    ),
    check(
      'strategy_decision_traces_pot_odds_range',
      sql`${t.potOddsBps} is null or (${bpsRange(t.potOddsBps)})`,
    ),
    check(
      'strategy_decision_traces_spr_range',
      sql`${t.spr} is null or (${isIntegral(t.spr)} and ${t.spr} >= 0)`,
    ),
    check(
      'strategy_decision_traces_provenance_quality',
      sql`${t.provenanceQuality} in ${inList(STRATEGY_TRACE_PROVENANCE_QUALITIES)}`,
    ),
    check(
      'strategy_decision_traces_environment_status_not_empty',
      sql`length(${t.environmentStatus}) > 0`,
    ),
    check(
      'strategy_decision_traces_actual_hero_action',
      sql`${t.actualHeroAction} in ${inList(STRATEGY_TRACE_ACTIONS)}`,
    ),
    check('strategy_decision_traces_computed_at_range', timeWindow(t.computedAt)),
    check('strategy_decision_traces_source', sql`${t.source} in ${inList(STRATEGY_TRACE_SOURCES)}`),
  ],
);

// ---------------------------------------------------------------------------
// skipped_hands
// ---------------------------------------------------------------------------

/** Caller-supplied branded id for one skipped-hand audit row. */
export type SkippedHandId = Id<'SkippedHand'>;

/**
 * WHY the user skipped the hand (ADR-0073, added additively by `0009`).
 *
 * `QUICK_SKIP` — "this hand really happened, I just did not enter the rest of it".
 * `HERO_FOLDED_UNOBSERVED` — Hero was dealt in and had already FOLDED at skip time, so the
 * rest of the hand played out without us and is genuinely unobserved.
 *
 * The column is NULLABLE and `NULL` is NOT a third member: it means "recorded before this
 * column existed", i.e. a row whose reason was never captured. Every row written from now on
 * carries a value — the client derives it from the view and always sends one.
 */
export const SKIPPED_HAND_REASONS = ['QUICK_SKIP', 'HERO_FOLDED_UNOBSERVED'] as const;
export type SkippedHandReason = (typeof SKIPPED_HAND_REASONS)[number];

/**
 * A best-effort audit row for a hand the user chose to SKIP rather than play or persist.
 *
 * A skipped hand never becomes a `hands` row and never feeds analysis — there is
 * deliberately no FK to `hands` here, and nothing joins this table against the completed
 * hand history. It exists only so a session's skip count is auditable.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE: a skip is a historical fact about what the user
 * did, exactly like `analysis_runs` records that a run happened.
 */
export const skippedHands = sqliteTable(
  'skipped_hands',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    handNumber: integer('hand_number').notNull(),
    skippedAt: integer('skipped_at').notNull(),
    /**
     * Why the hand was skipped, or NULL on a row written before `0009` existed. NULL is
     * "not recorded", never a third reason and never a default — see `SKIPPED_HAND_REASONS`.
     */
    reason: text('reason'),
  },
  (t) => [
    index('skipped_hands_session_idx').on(t.sessionId, t.skippedAt, t.id),
    check('skipped_hands_id_not_empty', sql`length(${t.id}) > 0`),
    check('skipped_hands_hand_number_non_negative', sql`${t.handNumber} >= 0`),
    check('skipped_hands_skipped_at_range', timeWindow(t.skippedAt)),
    check(
      'skipped_hands_reason',
      sql`${t.reason} is null or ${t.reason} in ${inList(SKIPPED_HAND_REASONS)}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// adaptive_strategy_traces
// ---------------------------------------------------------------------------

/** Caller-supplied branded id for one Hero decision point's stored ADAPTIVE trace. */
export type AdaptiveStrategyTraceId = Id<'AdaptiveStrategyTrace'>;

/**
 * Did the composition layer actually move anything?
 *
 * `ADAPTED` — at least one rule cleared its confidence gate and the recommendation differs
 * from (or was deliberately re-derived over) the REFERENCE baseline.
 * `INSUFFICIENT_DATA` — nothing cleared the gate; the stored `adaptive_actions_json` IS the
 * baseline, verbatim. No adaptive number is ever invented in that state (`CLAUDE.md` rule 2).
 */
export const ADAPTIVE_TRACE_STATUSES = ['ADAPTED', 'INSUFFICIENT_DATA'] as const;
export type AdaptiveTraceStatus = (typeof ADAPTIVE_TRACE_STATUSES)[number];

/**
 * How this trace reached storage. `LIVE` — composed at the table while the hand was being
 * played. `BACKFILL` — recomputed later over already-persisted history.
 *
 * Deliberately NOT `STRATEGY_TRACE_SOURCES`: that vocabulary's `ONLINE` member names the
 * post-hand replay path of `strategy_decision_traces`, which is a different provenance from
 * an in-session composition. Two vocabularies, because they mean two different things.
 */
export const ADAPTIVE_TRACE_SOURCES = ['LIVE', 'BACKFILL'] as const;
export type AdaptiveTraceSource = (typeof ADAPTIVE_TRACE_SOURCES)[number];

/**
 * One Hero decision point's DERIVED ADAPTIVE recommendation: what the composition layer
 * proposed after folding opponent-specific evidence into the REFERENCE baseline, together
 * with the whole audit trail that produced it.
 *
 * **A SEPARATE TABLE from `strategy_decision_traces`, deliberately.** That table's
 * `strategy_mode` CHECK is `in ('REFERENCE')` and STAYS that way: a REFERENCE trace is what
 * the solver-facing engine says about a spot with no knowledge of who is sitting in it, and
 * an ADAPTIVE trace is a derived opinion about one specific opponent. Widening the existing
 * CHECK would have made the two indistinguishable to every consumer that reads that table
 * expecting player-independent baselines — including the analysis layer. Two tables cannot
 * be confused; one table with a mode column can. This row instead POINTS AT its baseline
 * through `reference_trace_id`, so the derivation is auditable in both directions.
 *
 * `id` is `${handId}:${commandSeq}:ADAPTIVE`, caller-supplied and stable, exactly like
 * `hands.id` (ADR-0007) — never autoincrement. `(hand_id, command_seq)` is additionally
 * indexed UNIQUE so the natural key cannot be duplicated under a different `id`.
 *
 * Five JSON documents carry the audit trail, decoded into typed structures by
 * `rows.ts` and never cast: `baseline_actions_json` / `adaptive_actions_json`
 * (`{action, frequencyBps, toAmountMbb}` rows, before and after), `frequency_delta_json`
 * (per-kind SIGNED bps), `adjustments_json` (every rule that fired, with its stat, sample
 * size, confidence, sources and reason — `CLAUDE.md` rule 3: the evidence is stored, not
 * just the conclusion), and the two snapshot-id maps that pin exactly which manual HUD row
 * and which learned model snapshot each opponent's numbers came from.
 *
 * `reference_trace_id` is NULLABLE: a LIVE composition happens while the hand is still in
 * progress, so the `strategy_decision_traces` row for that decision point may not exist yet
 * (it is written from the completed-hand replay). A FK that could not be satisfied at write
 * time would have forced the caller to either drop the link or invent a row.
 *
 * `primary_villain_player_id` is NULLABLE for the same class of reason: a heads-up-to-the-
 * pot spot always has one, an `INSUFFICIENT_DATA` trace over an unknown lineup may not.
 *
 * INSERT-ONLY, ENFORCED BY THE DATABASE (`0007_adaptive_strategy_traces.sql`, same posture
 * as `strategy_decision_traces` and the rest of the derived layer): a recomposition is a
 * NEW row under a new `adaptive_policy_version`, never a rewrite of an existing one. What
 * the app recommended at the moment the user acted is a historical fact.
 */
export const adaptiveStrategyTraces = sqliteTable(
  'adaptive_strategy_traces',
  {
    id: text('id').primaryKey(),
    handId: text('hand_id')
      .notNull()
      .references(() => hands.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    commandSeq: integer('command_seq').notNull(),
    /** The `strategy_decision_traces` row this was derived from, when one exists yet. */
    referenceTraceId: text('reference_trace_id').references(() => strategyDecisionTraces.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    street: text('street').notNull(),
    heroSeat: integer('hero_seat').notNull(),
    status: text('status').notNull(),
    adaptivePolicyVersion: text('adaptive_policy_version').notNull(),
    primaryVillainPlayerId: text('primary_villain_player_id').references(() => players.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    opponentCount: integer('opponent_count').notNull(),
    /** JSON array of `{action, frequencyBps, toAmountMbb}` — the REFERENCE mix, verbatim. */
    baselineActionsJson: text('baseline_actions_json').notNull(),
    /** JSON array of `{action, frequencyBps, toAmountMbb}` — the composed mix. */
    adaptiveActionsJson: text('adaptive_actions_json').notNull(),
    /** JSON array of `{action, deltaBps}` — per-kind SIGNED movement, adaptive minus baseline. */
    frequencyDeltaJson: text('frequency_delta_json').notNull(),
    baselinePrimaryAction: text('baseline_primary_action').notNull(),
    adaptivePrimaryAction: text('adaptive_primary_action').notNull(),
    /** The baseline bet/raise-to amount, milliBB. NULL for a FOLD/CHECK/CALL baseline. */
    baselineToAmountMbb: integer('baseline_to_amount_mbb'),
    /** The composed bet/raise-to amount, milliBB. NULL when no size was recommended. */
    adaptiveToAmountMbb: integer('adaptive_to_amount_mbb'),
    /** Index into the engine's pot-fraction buckets; `-1` is ALL_IN. NULL when unsized. */
    baselineSizingBucket: integer('baseline_sizing_bucket'),
    adaptiveSizingBucket: integer('adaptive_sizing_bucket'),
    /** Total probability mass moved, in bps: `sum(|adaptive - baseline|) / 2`. */
    totalShiftBps: integer('total_shift_bps').notNull(),
    /** 1 when the global shift cap actually bound and scaled the contributions down. */
    capApplied: integer('cap_applied').notNull(),
    /** JSON array of every rule that fired, with its full evidence. */
    adjustmentsJson: text('adjustments_json').notNull(),
    /** JSON array of `{playerId, snapshotId}` — which manual HUD row each opponent used. */
    manualHudSnapshotIdsJson: text('manual_hud_snapshot_ids_json').notNull(),
    /** JSON array of `{playerId, snapshotId}` — which learned snapshot each opponent used. */
    playerModelSnapshotIdsJson: text('player_model_snapshot_ids_json').notNull(),
    /** The PRIMARY villain's learned-snapshot `modelVersion`. NULL when none was used. */
    playerModelVersion: integer('player_model_version'),
    computedAt: integer('computed_at').notNull(),
    source: text('source').notNull(),
  },
  (t) => [
    uniqueIndex('adaptive_strategy_traces_hand_command_unique').on(t.handId, t.commandSeq),
    check('adaptive_strategy_traces_id_not_empty', sql`length(${t.id}) > 0`),
    check(
      'adaptive_strategy_traces_command_seq_non_negative',
      sql`${isIntegral(t.commandSeq)} and ${t.commandSeq} >= 0`,
    ),
    check(
      'adaptive_strategy_traces_reference_trace_id_not_empty',
      sql`${t.referenceTraceId} is null or length(${t.referenceTraceId}) > 0`,
    ),
    check('adaptive_strategy_traces_street', sql`${t.street} in ${inList(STRATEGY_TRACE_STREETS)}`),
    check(
      'adaptive_strategy_traces_hero_seat_range',
      sql`${isIntegral(t.heroSeat)} and ${seatRange(t.heroSeat)}`,
    ),
    check(
      'adaptive_strategy_traces_status',
      sql`${t.status} in ${inList(ADAPTIVE_TRACE_STATUSES)}`,
    ),
    check(
      'adaptive_strategy_traces_policy_version_not_empty',
      sql`length(${t.adaptivePolicyVersion}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_primary_villain_not_empty',
      sql`${t.primaryVillainPlayerId} is null or length(${t.primaryVillainPlayerId}) > 0`,
    ),
    check('adaptive_strategy_traces_opponent_count_range', countRange(t.opponentCount)),
    check(
      'adaptive_strategy_traces_baseline_actions_json_not_empty',
      sql`length(${t.baselineActionsJson}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_adaptive_actions_json_not_empty',
      sql`length(${t.adaptiveActionsJson}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_frequency_delta_json_not_empty',
      sql`length(${t.frequencyDeltaJson}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_baseline_primary_action',
      sql`${t.baselinePrimaryAction} in ${inList(STRATEGY_TRACE_ACTIONS)}`,
    ),
    check(
      'adaptive_strategy_traces_adaptive_primary_action',
      sql`${t.adaptivePrimaryAction} in ${inList(STRATEGY_TRACE_ACTIONS)}`,
    ),
    check(
      'adaptive_strategy_traces_baseline_to_amount_range',
      sql`${t.baselineToAmountMbb} is null or (${moneyRange(t.baselineToAmountMbb)} and ${t.baselineToAmountMbb} >= 0)`,
    ),
    check(
      'adaptive_strategy_traces_adaptive_to_amount_range',
      sql`${t.adaptiveToAmountMbb} is null or (${moneyRange(t.adaptiveToAmountMbb)} and ${t.adaptiveToAmountMbb} >= 0)`,
    ),
    check(
      'adaptive_strategy_traces_baseline_sizing_bucket_range',
      sql`${t.baselineSizingBucket} is null or (${isIntegral(t.baselineSizingBucket)} and ${t.baselineSizingBucket} >= -1 and ${t.baselineSizingBucket} <= 7)`,
    ),
    check(
      'adaptive_strategy_traces_adaptive_sizing_bucket_range',
      sql`${t.adaptiveSizingBucket} is null or (${isIntegral(t.adaptiveSizingBucket)} and ${t.adaptiveSizingBucket} >= -1 and ${t.adaptiveSizingBucket} <= 7)`,
    ),
    check('adaptive_strategy_traces_total_shift_bps_range', bpsRange(t.totalShiftBps)),
    check(
      'adaptive_strategy_traces_cap_applied_boolean',
      sql`${isIntegral(t.capApplied)} and ${t.capApplied} in (0, 1)`,
    ),
    check(
      'adaptive_strategy_traces_adjustments_json_not_empty',
      sql`length(${t.adjustmentsJson}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_manual_hud_ids_json_not_empty',
      sql`length(${t.manualHudSnapshotIdsJson}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_model_snapshot_ids_json_not_empty',
      sql`length(${t.playerModelSnapshotIdsJson}) > 0`,
    ),
    check(
      'adaptive_strategy_traces_player_model_version_positive',
      sql`${t.playerModelVersion} is null or (${isIntegral(t.playerModelVersion)} and ${t.playerModelVersion} >= 1)`,
    ),
    check('adaptive_strategy_traces_computed_at_range', timeWindow(t.computedAt)),
    check('adaptive_strategy_traces_source', sql`${t.source} in ${inList(ADAPTIVE_TRACE_SOURCES)}`),
  ],
);
