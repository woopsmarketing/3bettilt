/**
 * Migrations and the pragmas that make the schema mean anything.
 *
 * A schema full of REFERENCES clauses with `foreign_keys` off is decoration, so the
 * enforcement itself is asserted here — not merely that the DDL contains the word.
 */
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { foreignKeysEnabled, openTestDatabase } from '../src/client.js';
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
  ['session_seats', 'stack'],
  ['hands', 'started_at'],
  ['hands', 'finished_at'],
  ['hand_players', 'starting_stack'],
];

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
          `insert into sessions values ('s1', null, null, '{}', null, null, 0, 1700000000000, 1700000000000, null)`,
        )
        .run();
      handle.sqlite
        .prepare(`insert into session_seats values ('s1', 0, 'ACTIVE', 'p1', 100000)`)
        .run();

      // The write the review reproduced: accepted before, stored as a REAL, and only
      // discovered on read as a permanently unreadable row.
      expect(() =>
        handle.sqlite.prepare(`update session_seats set stack = 93701.5 where seat = 0`).run(),
      ).toThrow(/CHECK constraint failed/u);
      expect(() =>
        handle.sqlite
          .prepare(`insert into session_seats values ('s1', 1, 'ACTIVE', 'p1', 0.5)`)
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
});
