/**
 * Migrations and the pragmas that make the schema mean anything.
 *
 * A schema full of REFERENCES clauses with `foreign_keys` off is decoration, so the
 * enforcement itself is asserted here — not merely that the DDL contains the word.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  defaultMigrationsFolder,
  foreignKeysEnabled,
  openDatabase,
  openTestDatabase,
} from '../src/client.js';
import { playerHudSnapshots, players } from '../src/schema.js';

const TABLES = [
  'game_presets',
  'players',
  'player_hud_snapshots',
  'player_hud_snapshot_stats',
  'player_notes',
  'player_observations',
  'sessions',
  'session_seats',
  'hands',
  'hand_players',
  'hand_events',
  // 0005 — the derived player-learning layer (ADR-0062a).
  'analysis_runs',
  'analysis_run_players',
  'player_model_snapshots',
  'player_model_stats',
  'player_spot_stats',
  'player_model_bet_sizes',
  'player_model_show_evidence',
  // 0006 — REFERENCE strategy decision traces, and the skip audit table.
  'strategy_decision_traces',
  'skipped_hands',
  // 0007 — derived ADAPTIVE strategy traces.
  'adaptive_strategy_traces',
  // 0008 — external (third-party) HUD lifetime profiles (WP-K).
  'player_external_hud_snapshots',
  'player_external_hud_snapshot_stats',
];

/**
 * Every column whose value is an integer BY DEFINITION: money in milliBB, a count, a
 * centipercent, or an epoch-ms timestamp. Each must CHECK `typeof(col) = 'integer'`.
 */
const INTEGRAL_COLUMNS: readonly (readonly [string, string])[] = [
  ['game_presets', 'created_at'],
  ['game_presets', 'updated_at'],
  ['players', 'created_at'],
  ['players', 'updated_at'],
  ['player_hud_snapshots', 'recorded_at'],
  ['player_hud_snapshots', 'hand_sample'],
  ['player_hud_snapshot_stats', 'value_centipercent'],
  ['player_notes', 'created_at'],
  ['player_observations', 'opportunities'],
  ['player_observations', 'actions'],
  ['player_observations', 'first_observed_at'],
  ['player_observations', 'last_observed_at'],
  ['sessions', 'created_at'],
  ['sessions', 'updated_at'],
  ['sessions', 'closed_at'],
  ['sessions', 'auto_top_up_enabled'],
  ['sessions', 'auto_top_up_target_stack'],
  ['session_seats', 'stack'],
  ['session_seats', 'auto_top_up_enabled'],
  ['session_seats', 'auto_top_up_target_stack'],
  ['hands', 'started_at'],
  ['hands', 'finished_at'],
  ['hands', 'schema_version'],
  ['hand_players', 'starting_stack'],
  ['analysis_runs', 'started_at'],
  ['analysis_runs', 'finished_at'],
  ['analysis_runs', 'algorithm_version'],
  ['analysis_runs', 'hand_count'],
  ['analysis_runs', 'player_count'],
  ['analysis_runs', 'observation_count'],
  ['analysis_runs', 'show_count'],
  ['player_model_snapshots', 'model_version'],
  ['player_model_snapshots', 'algorithm_version'],
  ['player_model_snapshots', 'source_hand_count'],
  ['player_model_snapshots', 'source_observation_count'],
  ['player_model_snapshots', 'source_show_count'],
  ['player_model_snapshots', 'created_at'],
  ['player_model_snapshots', 'confidence_k'],
  ['player_model_snapshots', 'confidence_learning_threshold'],
  ['player_model_snapshots', 'confidence_known_threshold'],
  ['player_model_snapshots', 'confidence_overall_opportunities'],
  ['player_model_stats', 'opportunities'],
  ['player_model_stats', 'actions'],
  ['player_model_stats', 'confidence_opportunities'],
  ['player_spot_stats', 'opportunities'],
  ['player_spot_stats', 'effect_fold'],
  ['player_spot_stats', 'effect_check'],
  ['player_spot_stats', 'effect_call'],
  ['player_spot_stats', 'effect_bet'],
  ['player_spot_stats', 'effect_raise'],
  ['player_spot_stats', 'verb_fold'],
  ['player_spot_stats', 'verb_check'],
  ['player_spot_stats', 'verb_call'],
  ['player_spot_stats', 'verb_bet'],
  ['player_spot_stats', 'verb_raise'],
  ['player_spot_stats', 'verb_all_in'],
  ['player_spot_stats', 'confidence_opportunities'],
  ['player_model_bet_sizes', 'to_amount'],
  ['player_model_bet_sizes', 'amount'],
  ['player_model_bet_sizes', 'pot_before'],
  ['player_model_bet_sizes', 'current_bet_before'],
  ['player_model_bet_sizes', 'big_blind'],
  ['player_model_show_evidence', 'won_gross'],
  ['strategy_decision_traces', 'recommended_to_amount_mbb'],
  ['strategy_decision_traces', 'hero_equity_bps'],
  ['strategy_decision_traces', 'pot_odds_bps'],
  ['strategy_decision_traces', 'spr'],
  ['strategy_decision_traces', 'computed_at'],
  ['skipped_hands', 'skipped_at'],
  // 0007 — every INTEGER column of `adaptive_strategy_traces`, without exception.
  ['adaptive_strategy_traces', 'command_seq'],
  ['adaptive_strategy_traces', 'hero_seat'],
  ['adaptive_strategy_traces', 'opponent_count'],
  ['adaptive_strategy_traces', 'baseline_to_amount_mbb'],
  ['adaptive_strategy_traces', 'adaptive_to_amount_mbb'],
  ['adaptive_strategy_traces', 'baseline_sizing_bucket'],
  ['adaptive_strategy_traces', 'adaptive_sizing_bucket'],
  ['adaptive_strategy_traces', 'total_shift_bps'],
  ['adaptive_strategy_traces', 'cap_applied'],
  ['adaptive_strategy_traces', 'player_model_version'],
  ['adaptive_strategy_traces', 'computed_at'],
  // 0008 — external (third-party) HUD lifetime profiles (WP-K).
  ['player_external_hud_snapshots', 'recorded_at'],
  ['player_external_hud_snapshots', 'sample_n'],
  ['player_external_hud_snapshot_stats', 'value_centipercent'],
];

/**
 * A migrations folder frozen at `idx <= through`, built from the COMMITTED artifacts rather
 * than retyped, so an upgrade test cannot drift from what actually ships.
 */
function freezeMigrations(dir: string, through: number): string {
  const older = join(dir, `drizzle-${through}`);
  mkdirSync(join(older, 'meta'), { recursive: true });
  const journal = JSON.parse(
    readFileSync(join(defaultMigrationsFolder(), 'meta', '_journal.json'), 'utf8'),
  ) as { entries: { tag: string; idx: number }[] };
  const kept = journal.entries.filter((entry) => entry.idx <= through);
  expect(kept).toHaveLength(through + 1);
  for (const entry of kept) {
    cpSync(join(defaultMigrationsFolder(), `${entry.tag}.sql`), join(older, `${entry.tag}.sql`));
  }
  writeFileSync(
    join(older, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries: kept }),
  );
  return older;
}

describe('migrations', () => {
  it('apply from an empty database and create every Phase-3 table', () => {
    const handle = openTestDatabase();
    try {
      const rows = handle.sqlite
        .prepare(`select name from sqlite_master where type = 'table' order by name`)
        .all() as readonly { readonly name: string }[];
      const names = rows.map((row) => row.name);
      for (const table of TABLES) expect(names).toContain(table);
    } finally {
      handle.close();
    }
  });

  it('creates no table Phase 3 did not ask for', () => {
    const handle = openTestDatabase();
    try {
      const rows = handle.sqlite
        .prepare(
          `select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'`,
        )
        .all() as readonly { readonly name: string }[];
      expect(rows.map((row) => row.name).sort()).toEqual([...TABLES].sort());
    } finally {
      handle.close();
    }
  });

  it('are applied from committed artifacts, and re-applying is a no-op', () => {
    const handle = openTestDatabase();
    try {
      const applied = handle.sqlite
        .prepare(`select count(*) as n from __drizzle_migrations`)
        .get() as { readonly n: number };
      expect(applied.n).toBeGreaterThan(0);
    } finally {
      handle.close();
    }
  });

  it('enforces foreign keys — an orphan child row is REJECTED', () => {
    const handle = openTestDatabase();
    try {
      expect(foreignKeysEnabled(handle)).toBe(true);
      expect(() =>
        handle.db
          .insert(playerHudSnapshots)
          .values({
            id: 'snap-orphan',
            playerId: 'no-such-player',
            source: 'MANUAL_HUD_ENTRY',
            recordedAt: 1_700_000_000_000,
            handSample: null,
          })
          .run(),
      ).toThrow(/FOREIGN KEY constraint failed/u);
    } finally {
      handle.close();
    }
  });

  it('enforces the CHECK constraints the schema declares', () => {
    const handle = openTestDatabase();
    try {
      expect(() =>
        handle.db
          .insert(players)
          .values({
            id: 'p-bad',
            nickname: 'Dan',
            normalizedNickname: 'dan',
            displayAlias: null,
            createdAt: 2_000,
            // updated_at must not precede created_at.
            updatedAt: 1_000,
            archived: false,
          })
          .run(),
      ).toThrow(/CHECK constraint failed/u);
    } finally {
      handle.close();
    }
  });

  it('stores money as INTEGER columns — no REAL column exists anywhere', () => {
    const handle = openTestDatabase();
    try {
      const columns = handle.sqlite
        .prepare(
          `select m.name as tbl, c.name as col, c.type as type
             from sqlite_master m join pragma_table_info(m.name) c
            where m.type = 'table' and m.name not like 'sqlite_%' and m.name not like '__drizzle%'`,
        )
        .all() as readonly { readonly tbl: string; readonly col: string; readonly type: string }[];
      const real = columns.filter((column) =>
        /real|float|double|numeric|decimal/iu.test(column.type),
      );
      expect(real).toEqual([]);
      const money = columns.filter((column) => ['stack', 'starting_stack'].includes(column.col));
      expect(money.length).toBeGreaterThan(0);
      for (const column of money) expect(column.type.toLowerCase()).toBe('integer');
    } finally {
      handle.close();
    }
  });

  /**
   * A declared type of INTEGER proves nothing on its own: SQLite INTEGER is an AFFINITY,
   * and `93701.5` is stored verbatim as a REAL in such a column. Every money, count,
   * centipercent and epoch-ms column must therefore also CHECK `typeof(col) = 'integer'`.
   */
  it('CHECKS integrality on every money, count, centipercent and epoch-ms column', () => {
    const handle = openTestDatabase();
    try {
      const ddl = new Map(
        (
          handle.sqlite
            .prepare(`select name, sql from sqlite_master where type = 'table' and sql is not null`)
            .all() as readonly { readonly name: string; readonly sql: string }[]
        ).map((row) => [row.name, row.sql]),
      );
      for (const [table, column] of INTEGRAL_COLUMNS) {
        expect(ddl.get(table), `${table} is missing from the schema`).toBeDefined();
        expect(
          ddl.get(table) ?? '',
          `${table}.${column} does not CHECK typeof(...) = 'integer'`,
        ).toContain(`typeof("${table}"."${column}") = 'integer'`);
      }
    } finally {
      handle.close();
    }
  });

  it('REJECTS a fractional money write AT THE CONSTRAINT, not later at the decoder', () => {
    const handle = openTestDatabase();
    try {
      handle.sqlite
        .prepare(
          `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
        )
        .run();
      handle.sqlite
        .prepare(
          `insert into sessions values ('s1', null, null, '{}', null, null, 0, 1700000000000, 1700000000000, null, null, null)`,
        )
        .run();
      handle.sqlite
        .prepare(
          `insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 100000, null, null, 0)`,
        )
        .run();

      // The write the review reproduced: accepted before, stored as a REAL, and only
      // discovered on read as a permanently unreadable row.
      expect(() =>
        handle.sqlite.prepare(`update session_seats set stack = 93701.5 where seat = 0`).run(),
      ).toThrow(/CHECK constraint failed/u);
      expect(() =>
        handle.sqlite
          .prepare(`insert into session_seats values ('s1', 1, 'ACTIVE', 'p1', 0.5, null, null, 0)`)
          .run(),
      ).toThrow(/CHECK constraint failed/u);

      const stored = handle.sqlite
        .prepare(`select stack, typeof(stack) as t from session_seats where seat = 0`)
        .get() as { readonly stack: number; readonly t: string };
      expect(stored).toEqual({ stack: 100_000, t: 'integer' });
    } finally {
      handle.close();
    }
  });

  it('REJECTS a fractional timestamp, count and centipercent the same way', () => {
    const handle = openTestDatabase();
    try {
      expect(() =>
        handle.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000.5, 1700000000000.5, 0)`,
          )
          .run(),
      ).toThrow(/CHECK constraint failed/u);

      handle.sqlite
        .prepare(
          `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
        )
        .run();
      expect(() =>
        handle.sqlite
          .prepare(
            `insert into player_observations values ('o1', 'p1', 'VPIP', null, 10.5, 3, 1700000000000, 1700000000000)`,
          )
          .run(),
      ).toThrow(/CHECK constraint failed/u);

      handle.sqlite
        .prepare(
          `insert into player_hud_snapshots values ('s1', 'p1', 'MANUAL_HUD_ENTRY', 1700000000000, 1240)`,
        )
        .run();
      expect(() =>
        handle.sqlite
          .prepare(`insert into player_hud_snapshot_stats values ('s1', 'VPIP', '23.5', 2350.5, 0)`)
          .run(),
      ).toThrow(/CHECK constraint failed/u);
      // ... and a fractional HUD hand sample.
      expect(() =>
        handle.sqlite
          .prepare(
            `insert into player_hud_snapshots values ('s2', 'p1', 'MANUAL_HUD_ENTRY', 1700000000000, 1240.5)`,
          )
          .run(),
      ).toThrow(/CHECK constraint failed/u);
    } finally {
      handle.close();
    }
  });

  it('declares no CURRENT_TIMESTAMP default — the DB never reads the clock', () => {
    const handle = openTestDatabase();
    try {
      const ddl = handle.sqlite
        .prepare(`select sql from sqlite_master where sql is not null`)
        .all() as readonly { readonly sql: string }[];
      const text = ddl.map((row) => row.sql).join('\n');
      expect(text).not.toMatch(/current_timestamp/iu);
      expect(text).not.toMatch(/autoincrement/iu);
      expect(handle.db.get(sql`select 1 as one`)).toBeDefined();
    } finally {
      handle.close();
    }
  });
  /**
   * The UPGRADE path, not the from-scratch one. `openTestDatabase` always replays every
   * migration into an empty database, so it would never catch a `0002` that only works on a
   * virgin schema — and `0002` adds columns to a table that already has children pointing at
   * it. A generated table-recreate here would CASCADE the `session_seats` rows away with
   * foreign keys enforced (the pragma that disables them is a no-op inside the migrator's
   * transaction), so the rows below are the assertion that matters.
   */
  it('applies 0002 to a populated database that already has 0000 and 0001', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-'));
    try {
      // A migrations folder frozen at 0001, built from the committed artifacts.
      const older = join(dir, 'drizzle-0001');
      mkdirSync(join(older, 'meta'), { recursive: true });
      const journal = JSON.parse(
        readFileSync(join(defaultMigrationsFolder(), 'meta', '_journal.json'), 'utf8'),
      ) as { entries: { tag: string; idx: number }[] };
      const kept = journal.entries.filter((entry) => entry.idx <= 1);
      expect(kept).toHaveLength(2);
      for (const entry of kept) {
        cpSync(
          join(defaultMigrationsFolder(), `${entry.tag}.sql`),
          join(older, `${entry.tag}.sql`),
        );
      }
      writeFileSync(
        join(older, 'meta', '_journal.json'),
        JSON.stringify({ ...journal, entries: kept }),
      );

      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 3, 1700000000000, 1700000000000, null)`,
          )
          .run();
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 93701)`)
          .run();
        before.sqlite.prepare(`insert into session_seats values ('s1', 1, 'EMPTY', null, 0)`).run();
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // The session and BOTH seat rows survived the migration.
        expect(after.sqlite.prepare(`select count(*) as n from sessions`).get()).toEqual({ n: 1 });
        expect(after.sqlite.prepare(`select count(*) as n from session_seats`).get()).toEqual({
          n: 2,
        });
        const row = after.sqlite
          .prepare(
            `select label, hand_number as hn, auto_top_up_enabled as e, auto_top_up_target_stack as t from sessions where id = 's1'`,
          )
          .get() as Record<string, unknown>;
        expect(row).toEqual({ label: 'grind', hn: 3, e: null, t: null });
        // The new constraints are live on the upgraded table.
        expect(() =>
          after.sqlite
            .prepare(
              `update sessions set auto_top_up_enabled = 1, auto_top_up_target_stack = 100000.5`,
            )
            .run(),
        ).toThrow(/CHECK constraint failed/u);
        // The index the schema declares is still there exactly once.
        const indexes = after.sqlite
          .prepare(`select name from sqlite_master where type = 'index' and tbl_name = 'sessions'`)
          .all() as readonly { readonly name: string }[];
        expect(indexes.filter((i) => i.name === 'sessions_created_idx')).toHaveLength(1);
        // No leftover scratch table from a table-recreate.
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * The same UPGRADE path for `0003`, which adds the per-seat auto top-up columns to
   * `session_seats` — a table with rows that a generated 12-step recreate would DROP, and
   * whose rows are the child side of a CASCADE from `sessions`. The seat rows below are the
   * assertion that matters (ADR-0046).
   */
  it('applies 0003 to a populated database that already has 0000..0002', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-0003-'));
    try {
      const older = join(dir, 'drizzle-0002');
      mkdirSync(join(older, 'meta'), { recursive: true });
      const journal = JSON.parse(
        readFileSync(join(defaultMigrationsFolder(), 'meta', '_journal.json'), 'utf8'),
      ) as { entries: { tag: string; idx: number }[] };
      const kept = journal.entries.filter((entry) => entry.idx <= 2);
      expect(kept).toHaveLength(3);
      for (const entry of kept) {
        cpSync(
          join(defaultMigrationsFolder(), `${entry.tag}.sql`),
          join(older, `${entry.tag}.sql`),
        );
      }
      writeFileSync(
        join(older, 'meta', '_journal.json'),
        JSON.stringify({ ...journal, entries: kept }),
      );

      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 3, 1700000000000, 1700000000000, null, 1, 100000)`,
          )
          .run();
        // Five columns: at 0002 `session_seats` does not have the policy columns yet.
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 93701)`)
          .run();
        before.sqlite.prepare(`insert into session_seats values ('s1', 1, 'EMPTY', null, 0)`).run();
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // Both seat rows survived, with every stored value unchanged and a NULL policy.
        expect(
          after.sqlite
            .prepare(
              `select seat, occupancy, player_id, stack, auto_top_up_enabled as e,
                      auto_top_up_target_stack as t from session_seats order by seat`,
            )
            .all(),
        ).toEqual([
          { seat: 0, occupancy: 'ACTIVE', player_id: 'p1', stack: 93_701, e: null, t: null },
          { seat: 1, occupancy: 'EMPTY', player_id: null, stack: 0, e: null, t: null },
        ]);
        // The session's own 0002 policy columns are untouched by 0003.
        expect(
          after.sqlite
            .prepare(
              `select auto_top_up_enabled as e, auto_top_up_target_stack as t from sessions where id = 's1'`,
            )
            .get(),
        ).toEqual({ e: 1, t: 100_000 });
        // The new constraints are live on the upgraded table.
        expect(() =>
          after.sqlite
            .prepare(
              `update session_seats set auto_top_up_enabled = 1, auto_top_up_target_stack = 100000.5 where seat = 0`,
            )
            .run(),
        ).toThrow(/CHECK constraint failed: session_seats_auto_top_up_target_stack_range/u);
        expect(() =>
          after.sqlite
            .prepare(`update session_seats set auto_top_up_enabled = 1 where seat = 0`)
            .run(),
        ).toThrow(/CHECK constraint failed: session_seats_auto_top_up_pair/u);
        // The index the schema declares is still there exactly once, and no scratch table.
        const indexes = after.sqlite
          .prepare(
            `select name from sqlite_master where type = 'index' and tbl_name = 'session_seats'`,
          )
          .all() as readonly { readonly name: string }[];
        expect(indexes.filter((i) => i.name === 'session_seats_player_idx')).toHaveLength(1);
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * The UPGRADE path for `0004`, on a database that already holds RAW HISTORY.
   *
   * This is the one migration in the project where the generated output would have been
   * catastrophic rather than merely wrong: `drizzle-kit` emits `DROP TABLE hands` for this
   * diff, and `hand_events`/`hand_players` cascade from it with foreign keys enforced (the
   * `PRAGMA foreign_keys=OFF` it emits is a no-op inside the migrator's transaction —
   * ADR-0046). Every stored hand of every past session would be gone.
   *
   * So the assertions that matter are the row-by-row ones below: the header, the lineup and
   * the log survive BYTE-IDENTICALLY, the new columns arrive with their defaults, and the
   * database is structurally sound afterwards.
   */
  it('applies 0004 to a populated database that already has 0000..0003, without losing raw history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-0004-'));
    try {
      const older = freezeMigrations(dir, 3);
      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 2, 1700000000000, 1700000000000, null, 1, 100000)`,
          )
          .run();
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 93701, 1, 100000)`)
          .run();
        // Five columns: at 0003 `hands` has neither `source` nor `schema_version`.
        before.sqlite
          .prepare(`insert into hands values ('h1', 's1', 0, 1700000000000, 1700000030000)`)
          .run();
        before.sqlite
          .prepare(`insert into hands values ('h2', 's1', 1, 1700000060000, null)`)
          .run();
        before.sqlite.prepare(`insert into hand_players values ('h1', 0, 'p1', 100000)`).run();
        before.sqlite.prepare(`insert into hand_players values ('h1', 1, null, 50000)`).run();
        before.sqlite
          .prepare(
            `insert into hand_events values ('h1', 0, 'e1', 0, 'USER', 'HAND_STARTED', '{"kind":"HAND_STARTED"}')`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into hand_events values ('h1', 1, 'e2', 1, 'ENGINE', 'HAND_FINISHED', '{"kind":"HAND_FINISHED"}')`,
          )
          .run();
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // Every pre-existing row survived, unchanged, with the new columns DEFAULTED.
        expect(
          after.sqlite
            .prepare(
              `select id, session_id, hand_number, started_at, finished_at, source,
                      schema_version from hands order by hand_number`,
            )
            .all(),
        ).toEqual([
          {
            id: 'h1',
            session_id: 's1',
            hand_number: 0,
            started_at: 1_700_000_000_000,
            finished_at: 1_700_000_030_000,
            source: 'MANUAL_PRACTICE',
            schema_version: 1,
          },
          {
            id: 'h2',
            session_id: 's1',
            hand_number: 1,
            started_at: 1_700_000_060_000,
            finished_at: null,
            source: 'MANUAL_PRACTICE',
            schema_version: 1,
          },
        ]);
        expect(after.sqlite.prepare(`select * from hand_players order by seat`).all()).toEqual([
          { hand_id: 'h1', seat: 0, player_id: 'p1', starting_stack: 100_000 },
          { hand_id: 'h1', seat: 1, player_id: null, starting_stack: 50_000 },
        ]);
        expect(after.sqlite.prepare(`select * from hand_events order by seq`).all()).toEqual([
          {
            hand_id: 'h1',
            seq: 0,
            event_id: 'e1',
            command_seq: 0,
            origin: 'USER',
            kind: 'HAND_STARTED',
            payload_json: '{"kind":"HAND_STARTED"}',
          },
          {
            hand_id: 'h1',
            seq: 1,
            event_id: 'e2',
            command_seq: 1,
            origin: 'ENGINE',
            kind: 'HAND_FINISHED',
            payload_json: '{"kind":"HAND_FINISHED"}',
          },
        ]);
        // Nothing else was disturbed on the way past.
        expect(after.sqlite.prepare(`select count(*) as n from session_seats`).get()).toEqual({
          n: 1,
        });

        // The database is structurally sound, and no scratch table from a recreate exists.
        expect(after.sqlite.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(after.sqlite.pragma('foreign_key_check')).toEqual([]);
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);
        const indexes = after.sqlite
          .prepare(`select name from sqlite_master where type = 'index' and tbl_name = 'hands'`)
          .all() as readonly { readonly name: string }[];
        expect(indexes.filter((i) => i.name === 'hands_session_hand_number_unique')).toHaveLength(
          1,
        );
        expect(indexes.filter((i) => i.name === 'hands_session_started_idx')).toHaveLength(1);

        // The new constraints and the new guards are live on the UPGRADED table, not only
        // on a database built from scratch.
        expect(() => after.sqlite.prepare(`update hands set source = 'SCRAPED'`).run()).toThrow(
          /CHECK constraint failed: hands_source|is immutable once finished/u,
        );
        expect(() => after.sqlite.prepare(`delete from hands where id = 'h2'`).run()).toThrow(
          /is immutable/u,
        );
        expect(() => after.sqlite.prepare(`update hand_events set origin = 'USER'`).run()).toThrow(
          /is insert-only/u,
        );
        expect(() =>
          after.sqlite.prepare(`update hands set hand_number = 9 where id = 'h1'`).run(),
        ).toThrow(/is immutable once finished/u);
        // ... and the UNFINISHED header can still be finished exactly once.
        after.sqlite.prepare(`update hands set finished_at = 1700000090000 where id = 'h2'`).run();
        expect(
          after.sqlite.prepare(`select finished_at as f from hands where id = 'h2'`).get(),
        ).toEqual({ f: 1_700_000_090_000 });
        expect(() =>
          after.sqlite
            .prepare(`update hands set finished_at = 1700000099000 where id = 'h2'`)
            .run(),
        ).toThrow(/is immutable once finished/u);
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * The UPGRADE path for `0005`, the derived player-learning layer (ADR-0062).
   *
   * `0005` is purely additive — seven new tables and fourteen triggers — so the risk it
   * carries is the opposite of `0004`'s: not that it destroys raw history, but that the new
   * constraints and guards exist only on a database built from scratch. So this test
   * populates a database at `0004` with real rows in every pre-existing table, migrates, and
   * then asserts that (a) nothing pre-existing moved, and (b) the new tables, CHECKs and
   * insert-only triggers are live ON THE UPGRADED FILE.
   */
  it('applies 0005 to a populated database that already has 0000..0004', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-0005-'));
    try {
      const older = freezeMigrations(dir, 4);
      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 1, 1700000000000, 1700000000000, null, 1, 100000)`,
          )
          .run();
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 93701, 1, 100000)`)
          .run();
        before.sqlite
          .prepare(
            `insert into hands values ('h1', 's1', 0, 1700000000000, 1700000030000, 'MANUAL_PRACTICE', 1)`,
          )
          .run();
        before.sqlite.prepare(`insert into hand_players values ('h1', 0, 'p1', 100000)`).run();
        before.sqlite
          .prepare(
            `insert into hand_events values ('h1', 0, 'e1', 0, 'USER', 'HAND_STARTED', '{"kind":"HAND_STARTED"}')`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into player_observations values ('o1', 'p1', 'VPIP', null, 10, 3, 1700000000000, 1700000000000)`,
          )
          .run();
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // Nothing pre-existing moved. `player_observations` in particular is untouched by
        // the derived layer and stays the manually-driven surface (ADR-0062a).
        expect(after.sqlite.prepare(`select * from hands`).all()).toEqual([
          {
            id: 'h1',
            session_id: 's1',
            hand_number: 0,
            started_at: 1_700_000_000_000,
            finished_at: 1_700_000_030_000,
            source: 'MANUAL_PRACTICE',
            schema_version: 1,
          },
        ]);
        expect(after.sqlite.prepare(`select * from hand_events`).all()).toHaveLength(1);
        expect(after.sqlite.prepare(`select * from hand_players`).all()).toHaveLength(1);
        expect(after.sqlite.prepare(`select * from player_observations`).all()).toEqual([
          {
            id: 'o1',
            player_id: 'p1',
            metric: 'VPIP',
            position: null,
            opportunities: 10,
            actions: 3,
            first_observed_at: 1_700_000_000_000,
            last_observed_at: 1_700_000_000_000,
          },
        ]);
        expect(after.sqlite.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(after.sqlite.pragma('foreign_key_check')).toEqual([]);
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);

        // The new tables exist and accept a real run + snapshot on the UPGRADED file.
        after.sqlite
          .prepare(
            `insert into analysis_runs values ('r1', 's1', 1700000040000, 1700000041000, 1, 'SUCCESS', 1, 1, 5, 0, null)`,
          )
          .run();
        after.sqlite
          .prepare(
            `insert into player_model_snapshots values ('m1', 'p1', 1, 'r1', 1, 'deadbeef', 1, 5, 0, 1700000041000, 30, 5, 30, 1)`,
          )
          .run();
        after.sqlite
          .prepare(`insert into player_model_stats values ('m1', 0, 'VPIP', null, 10, 3, 10)`)
          .run();
        after.sqlite
          .prepare(
            `insert into analysis_run_players values ('r1', 'p1', 'SNAPSHOT_CREATED', 'm1', null)`,
          )
          .run();

        // ... and the new CHECKs and guards are live, not merely declared.
        expect(() =>
          after.sqlite
            .prepare(
              `insert into player_model_snapshots values ('m2', 'p1', 1, 'r1', 1, 'x', 1, 1, 0, 1700000041000, 30, 5, 30, 1)`,
            )
            .run(),
        ).toThrow(/UNIQUE constraint failed/u);
        expect(() =>
          after.sqlite
            .prepare(
              `insert into analysis_run_players values ('r1', 'p1', 'SNAPSHOT_CREATED', null, null)`,
            )
            .run(),
        ).toThrow(/CHECK constraint failed/u);
        expect(() =>
          after.sqlite.prepare(`update player_model_snapshots set input_hash = 'x'`).run(),
        ).toThrow(/is insert-only/u);
        expect(() => after.sqlite.prepare(`delete from analysis_runs`).run()).toThrow(
          /is insert-only/u,
        );
        expect(() => after.sqlite.prepare(`delete from player_model_stats`).run()).toThrow(
          /is insert-only/u,
        );
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * 0007 adds ONE table and nothing else, but "additive" is a claim about the generated
   * SQL, not about what the migrator does to a file that already holds real history. This
   * seeds a database at 0006 — a session, a hand with a lineup and an event, and a REFERENCE
   * trace pointing at that hand — then applies 0007 and asserts that nothing moved, that the
   * new table's FKs, CHECKs and insert-only triggers are live on the UPGRADED file, and that
   * `strategy_decision_traces` in particular is untouched (its `strategy_mode` CHECK still
   * admits only REFERENCE, which is the whole reason the adaptive trace is a separate table).
   */
  it('applies 0007 to a populated database that already has 0000..0006', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-0007-'));
    try {
      const older = freezeMigrations(dir, 6);
      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 1, 1700000000000, 1700000000000, null, 1, 100000)`,
          )
          .run();
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 93701, 1, 100000)`)
          .run();
        before.sqlite
          .prepare(
            `insert into hands values ('h1', 's1', 0, 1700000000000, 1700000030000, 'MANUAL_PRACTICE', 1)`,
          )
          .run();
        before.sqlite.prepare(`insert into hand_players values ('h1', 0, 'p1', 100000)`).run();
        before.sqlite
          .prepare(
            `insert into hand_events values ('h1', 0, 'e1', 0, 'USER', 'HAND_STARTED', '{"kind":"HAND_STARTED"}')`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into strategy_decision_traces values ('h1:0', 'h1', 0, 'FLOP', 0, 'REFERENCE', 'strategy-v1', 'CBET_IP', '[{"action":"BET","frequencyBps":10000,"toAmountMbb":5000}]', 'BET', 5000, 5200, 3300, 4, 'HEURISTIC', 'OK', 'BET', 1700000040000, 'ONLINE')`,
          )
          .run();
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // Nothing pre-existing moved — the REFERENCE trace least of all.
        expect(after.sqlite.prepare(`select * from hands`).all()).toEqual([
          {
            id: 'h1',
            session_id: 's1',
            hand_number: 0,
            started_at: 1_700_000_000_000,
            finished_at: 1_700_000_030_000,
            source: 'MANUAL_PRACTICE',
            schema_version: 1,
          },
        ]);
        expect(after.sqlite.prepare(`select * from hand_events`).all()).toHaveLength(1);
        expect(after.sqlite.prepare(`select * from hand_players`).all()).toHaveLength(1);
        expect(after.sqlite.prepare(`select * from strategy_decision_traces`).all()).toEqual([
          {
            id: 'h1:0',
            hand_id: 'h1',
            command_seq: 0,
            street: 'FLOP',
            hero_seat: 0,
            strategy_mode: 'REFERENCE',
            strategy_version: 'strategy-v1',
            family: 'CBET_IP',
            actions_json: '[{"action":"BET","frequencyBps":10000,"toAmountMbb":5000}]',
            primary_action: 'BET',
            recommended_to_amount_mbb: 5_000,
            hero_equity_bps: 5_200,
            pot_odds_bps: 3_300,
            spr: 4,
            provenance_quality: 'HEURISTIC',
            environment_status: 'OK',
            actual_hero_action: 'BET',
            computed_at: 1_700_000_040_000,
            source: 'ONLINE',
          },
        ]);
        expect(after.sqlite.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(after.sqlite.pragma('foreign_key_check')).toEqual([]);
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);

        // `strategy_decision_traces` is NOT widened: ADAPTIVE is a separate table, and this
        // is the assertion that says so.
        expect(() =>
          after.sqlite
            .prepare(
              `insert into strategy_decision_traces values ('h1:1', 'h1', 1, 'FLOP', 0, 'ADAPTIVE', 'v1', 'F', '[]', 'BET', null, null, null, null, 'HEURISTIC', 'OK', 'BET', 1700000040000, 'ONLINE')`,
            )
            .run(),
        ).toThrow(/CHECK constraint failed/u);

        // The new table exists and accepts a real trace on the UPGRADED file.
        const trace = (over: {
          id: string;
          handId?: string;
          seq?: number;
          shift?: string;
          cap?: string;
        }): string =>
          `insert into adaptive_strategy_traces values ('${over.id}', '${over.handId ?? 'h1'}', ${over.seq ?? 0}, 'h1:0', 'FLOP', 0, 'ADAPTED', 'adaptive-v1', 'p1', 1, ` +
          `'[{"action":"BET","frequencyBps":10000,"toAmountMbb":5000}]', ` +
          `'[{"action":"BET","frequencyBps":10000,"toAmountMbb":6000}]', ` +
          `'[{"action":"BET","deltaBps":0}]', 'BET', 'BET', 5000, 6000, 3, 4, ` +
          `${over.shift ?? '1850'}, ${over.cap ?? '0'}, '[]', '[]', '[]', 1, 1700000050000, 'LIVE')`;

        after.sqlite.prepare(trace({ id: 'h1:0:ADAPTIVE' })).run();
        expect(
          after.sqlite.prepare(`select count(*) as n from adaptive_strategy_traces`).get(),
        ).toEqual({ n: 1 });

        // ... and its FK, its UNIQUE natural key and its CHECKs are live, not merely declared.
        expect(() =>
          after.sqlite.prepare(trace({ id: 'orphan', handId: 'no-such-hand', seq: 9 })).run(),
        ).toThrow(/FOREIGN KEY constraint failed/u);
        expect(() => after.sqlite.prepare(trace({ id: 'h1:0:ADAPTIVE-2', seq: 0 })).run()).toThrow(
          /UNIQUE constraint failed/u,
        );
        expect(() =>
          after.sqlite.prepare(trace({ id: 'h1:1:ADAPTIVE', seq: 1, cap: '2' })).run(),
        ).toThrow(/CHECK constraint failed/u);
        expect(() =>
          after.sqlite.prepare(trace({ id: 'h1:2:ADAPTIVE', seq: 2, shift: '1850.5' })).run(),
        ).toThrow(/CHECK constraint failed/u);

        // ... and so are the insert-only guards.
        expect(() =>
          after.sqlite.prepare(`update adaptive_strategy_traces set total_shift_bps = 0`).run(),
        ).toThrow(/is insert-only/u);
        expect(() => after.sqlite.prepare(`delete from adaptive_strategy_traces`).run()).toThrow(
          /is insert-only/u,
        );
        expect(
          after.sqlite.prepare(`select total_shift_bps as bps from adaptive_strategy_traces`).get(),
        ).toEqual({ bps: 1_850 });
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * 0009 adds ONE nullable column to `skipped_hands` and claims to be purely additive. Two
   * things could make that claim false, and both are asserted here on a file that already
   * holds real skip history:
   *
   *   1. A table REWRITE (the 12-step `__new_skipped_hands` dance `drizzle-kit generate`
   *      emits for a CHECK change) would DROP the table and take its `skipped_hands_no_update`
   *      / `_no_delete` triggers with it, silently deleting the insert-only guarantee. The
   *      migration is hand-written `ALTER TABLE ... ADD COLUMN` for exactly that reason, and
   *      the trigger assertions below are what would catch a regression to the generated form.
   *   2. Backfilling a reason onto the existing rows would INVENT an audit fact. A pre-0009
   *      row must come out `NULL` — "the reason was never recorded".
   */
  it('applies 0009 to a populated database that already has 0000..0008', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-0009-'));
    try {
      const older = freezeMigrations(dir, 8);
      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 1, 1700000000000, 1700000000000, null, 1, 100000)`,
          )
          .run();
        before.sqlite
          .prepare(`insert into skipped_hands values ('k1', 's1', 4, 1700000000000)`)
          .run();
        // The column does not exist yet — this is what makes the row below a real "old" row.
        expect(() => before.sqlite.prepare(`select reason from skipped_hands`).all()).toThrow(
          /no such column/u,
        );
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // The pre-existing row survived, and its reason is NULL — never backfilled.
        expect(after.sqlite.prepare(`select * from skipped_hands`).all()).toEqual([
          {
            id: 'k1',
            session_id: 's1',
            hand_number: 4,
            skipped_at: 1_700_000_000_000,
            reason: null,
          },
        ]);
        expect(after.sqlite.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(after.sqlite.pragma('foreign_key_check')).toEqual([]);
        // No table rewrite happened: the 12-step dance leaves this behind on failure.
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);
        // ... and the index the table was created with is still the original one.
        expect(
          after.sqlite
            .prepare(
              `select name from sqlite_master where type = 'index' and tbl_name = 'skipped_hands'`,
            )
            .all(),
        ).toContainEqual({ name: 'skipped_hands_session_idx' });

        // Both members are accepted on the UPGRADED file...
        after.sqlite
          .prepare(`insert into skipped_hands values ('k2', 's1', 5, 1700000010000, 'QUICK_SKIP')`)
          .run();
        after.sqlite
          .prepare(
            `insert into skipped_hands values ('k3', 's1', 6, 1700000020000, 'HERO_FOLDED_UNOBSERVED')`,
          )
          .run();
        expect(after.sqlite.prepare(`select reason from skipped_hands order by id`).all()).toEqual([
          { reason: null },
          { reason: 'QUICK_SKIP' },
          { reason: 'HERO_FOLDED_UNOBSERVED' },
        ]);

        // ... and anything else is refused BY THE CHECK, not merely by the TypeScript union.
        expect(() =>
          after.sqlite
            .prepare(
              `insert into skipped_hands values ('k4', 's1', 7, 1700000030000, 'HERO_SAT_OUT')`,
            )
            .run(),
        ).toThrow(/CHECK constraint failed: skipped_hands_reason/u);
        expect(() =>
          after.sqlite
            .prepare(`insert into skipped_hands values ('k5', 's1', 8, 1700000040000, '')`)
            .run(),
        ).toThrow(/CHECK constraint failed: skipped_hands_reason/u);

        // The insert-only triggers SURVIVED the migration — nothing dropped the table.
        expect(
          after.sqlite
            .prepare(
              `select name from sqlite_master where type = 'trigger' and tbl_name = 'skipped_hands' order by name`,
            )
            .all(),
        ).toEqual([{ name: 'skipped_hands_no_delete' }, { name: 'skipped_hands_no_update' }]);
        expect(() =>
          after.sqlite
            .prepare(`update skipped_hands set reason = 'QUICK_SKIP' where id = 'k1'`)
            .run(),
        ).toThrow(/is insert-only/u);
        expect(() => after.sqlite.prepare(`delete from skipped_hands`).run()).toThrow(
          /is insert-only/u,
        );
        // The old row is STILL unrecorded after both refusals.
        expect(
          after.sqlite.prepare(`select reason from skipped_hands where id = 'k1'`).get(),
        ).toEqual({ reason: null });
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * 0010 adds ONE column to `session_seats` and claims to be purely additive (ADR-0078b).
   * `session_seats` is not insert-only, but it carries TWO foreign keys, EIGHT CHECK
   * constraints and `session_seats_player_idx`, and the 12-step table recreate
   * `drizzle-kit generate` emitted for this diff would `DROP TABLE session_seats` with
   * foreign keys ENFORCED (its `PRAGMA foreign_keys=OFF` is a no-op inside the migrator's
   * transaction — ADR-0046). Every seat row of every existing session would be gone.
   *
   * So this upgrades a file that already holds real seat state and asserts the three things
   * that would be false if the generated form ever came back:
   *
   *   1. Every pre-existing seat keeps its stack, its player, its occupancy and BOTH auto
   *      top-up columns — byte for byte.
   *   2. The new column defaults to `0` on those rows: "confirmed", which is the safe and
   *      the true reading, since the unverified mark did not exist before this migration.
   *   3. Nothing was rewritten: no `__new%` leftover, the index and both foreign keys are
   *      still there, and the new CHECK actually refuses a non-boolean.
   */
  it('applies 0010 to a populated database that already has 0000..0009', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gto-self-migrate-0010-'));
    try {
      const older = freezeMigrations(dir, 9);
      const url = join(dir, 'upgrade.db');
      const before = openDatabase({ url, migrationsFolder: older });
      try {
        before.sqlite
          .prepare(
            `insert into players values ('p1', 'Dan', 'dan', null, 1700000000000, 1700000000000, 0)`,
          )
          .run();
        before.sqlite
          .prepare(
            `insert into sessions values ('s1', 'grind', null, '{}', 0, 0, 3, 1700000000000, 1700000000000, null, 1, 100000)`,
          )
          .run();
        // Seven columns: at 0009 `session_seats` has no `stack_unverified`. An occupied seat
        // with a per-seat auto top-up policy, and an EMPTY one, so both shapes are exercised.
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 93701, 1, 250000)`)
          .run();
        before.sqlite
          .prepare(`insert into session_seats values ('s1', 5, 'EMPTY', null, 0, null, null)`)
          .run();
        // The column does not exist yet — this is what makes the two rows above real "old" rows.
        expect(() =>
          before.sqlite.prepare(`select stack_unverified from session_seats`).all(),
        ).toThrow(/no such column/u);
      } finally {
        before.close();
      }

      const after = openDatabase({ url });
      try {
        // Both pre-existing seats survived WHOLE — stack, player, occupancy and the auto
        // top-up pair — and the new column defaulted to 0 rather than being backfilled.
        expect(after.sqlite.prepare(`select * from session_seats order by seat`).all()).toEqual([
          {
            session_id: 's1',
            seat: 0,
            occupancy: 'ACTIVE',
            player_id: 'p1',
            stack: 93_701,
            auto_top_up_enabled: 1,
            auto_top_up_target_stack: 250_000,
            stack_unverified: 0,
          },
          {
            session_id: 's1',
            seat: 5,
            occupancy: 'EMPTY',
            player_id: null,
            stack: 0,
            auto_top_up_enabled: null,
            auto_top_up_target_stack: null,
            stack_unverified: 0,
          },
        ]);
        // The stack is still an INTEGER, not a REAL the rewrite round-tripped.
        expect(
          after.sqlite.prepare(`select typeof(stack) as t from session_seats where seat = 0`).get(),
        ).toEqual({ t: 'integer' });
        expect(after.sqlite.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(after.sqlite.pragma('foreign_key_check')).toEqual([]);
        // No table rewrite happened: the 12-step dance leaves this behind on failure.
        expect(
          after.sqlite.prepare(`select name from sqlite_master where name like '__new%'`).all(),
        ).toEqual([]);
        // ... the index the table was created with is still the original one ...
        expect(
          after.sqlite
            .prepare(
              `select name from sqlite_master where type = 'index' and tbl_name = 'session_seats'`,
            )
            .all(),
        ).toContainEqual({ name: 'session_seats_player_idx' });
        // ... and BOTH foreign keys survived, which a `DROP TABLE` would have taken with them.
        expect(
          (
            after.sqlite.pragma('foreign_key_list(session_seats)') as readonly {
              readonly table: string;
              readonly from: string;
              readonly to: string;
            }[]
          )
            .map((fk) => [fk.table, fk.from, fk.to])
            .sort(),
        ).toEqual(
          [
            ['players', 'player_id', 'id'],
            ['sessions', 'session_id', 'id'],
          ].sort(),
        );
        // The FK is still ENFORCED, not merely still declared.
        expect(() =>
          after.sqlite
            .prepare(
              `insert into session_seats values ('ghost', 1, 'EMPTY', null, 0, null, null, 0)`,
            )
            .run(),
        ).toThrow(/FOREIGN KEY constraint failed/u);

        // The flag round-trips on the UPGRADED file, both ways.
        after.sqlite.prepare(`update session_seats set stack_unverified = 1 where seat = 0`).run();
        expect(
          after.sqlite
            .prepare(`select seat, stack_unverified from session_seats order by seat`)
            .all(),
        ).toEqual([
          { seat: 0, stack_unverified: 1 },
          { seat: 5, stack_unverified: 0 },
        ]);
        // Marking a stack unverified does not disturb the stack itself.
        expect(
          after.sqlite.prepare(`select stack from session_seats where seat = 0`).get(),
        ).toEqual({ stack: 93_701 });

        // Anything but 0/1 is refused BY THE CHECK, not merely by the TypeScript boolean...
        for (const bad of [2, -1, 'yes']) {
          expect(() =>
            after.sqlite
              .prepare(`update session_seats set stack_unverified = ? where seat = 5`)
              .run(bad),
          ).toThrow(/CHECK constraint failed: session_seats_stack_unverified_boolean/u);
        }
        // A fractional value stays a REAL under INTEGER affinity and is caught by the
        // `typeof(...) = 'integer'` half of the CHECK, exactly as on `stack`. (`1.0` is NOT
        // tested: SQLite's INTEGER affinity converts a losslessly-integral REAL to INTEGER
        // before the constraint ever sees it, which is `auto_top_up_enabled`'s behaviour too.)
        expect(() =>
          after.sqlite
            .prepare(`update session_seats set stack_unverified = 0.5 where seat = 5`)
            .run(),
        ).toThrow(/CHECK constraint failed: session_seats_stack_unverified_boolean/u);
        // ... and NULL is refused by NOT NULL: "unknown" is not a third state for this column.
        expect(() =>
          after.sqlite
            .prepare(`update session_seats set stack_unverified = null where seat = 5`)
            .run(),
        ).toThrow(/NOT NULL constraint failed/u);
        // Every refusal above left seat 5 exactly as it was.
        expect(after.sqlite.prepare(`select * from session_seats where seat = 5`).get()).toEqual({
          session_id: 's1',
          seat: 5,
          occupancy: 'EMPTY',
          player_id: null,
          stack: 0,
          auto_top_up_enabled: null,
          auto_top_up_target_stack: null,
          stack_unverified: 0,
        });
      } finally {
        after.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
