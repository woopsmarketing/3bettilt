# @gto-self/db

Drizzle ORM + SQLite persistence. **Storage only, never game logic.**

Rows go in and come out; `poker-core` and `player-core` decide what they mean. No betting
rules, no settlement arithmetic, no rake computation, no strategy lives here.

See `docs/ARCHITECTURE.md` for the layering rules that govern this package.

## Invariants

- **Money is an INTEGER column of milliBB.** No `REAL`, no decimal string, and no money
  arithmetic anywhere in this package (`CLAUDE.md` rule 1). SQLite INTEGER is an _affinity_
  rather than a type, so every money, count, centipercent and epoch-ms column also CHECKs
  `typeof(col) = 'integer'` — a fractional write is refused, not stored and discovered later.
- **Ids and timestamps are supplied by the caller** (ADR-0007). Nothing here generates an
  id or reads the clock; timestamps are INTEGER epoch milliseconds.
- **Row -> domain always goes through the domain's own validator** — `createPlayer`,
  `createHudSnapshot`, `createNote`, `createObservation`, `tableConfigSchema`,
  `decodeHandEvent` — never a cast. A row that fails validation is a typed `CORRUPT_ROW`.
- **Manual HUD snapshots and notes are append-only, ENFORCED BY THE DATABASE.**
  `player_notes`, `player_hud_snapshots` and `player_hud_snapshot_stats` carry `BEFORE
UPDATE` and `BEFORE DELETE` triggers that abort (`drizzle/0001_insert_only_guards.sql`).
  The table objects are exported for reads, so a raw `db.update(playerNotes)` is reachable
  — and is refused by SQLite. A revision is a new row; a new reading is a new snapshot
  (`CLAUDE.md` rule 3). The repositories also export no update function, but that is a
  convention on top of the guarantee, not the guarantee.
- **No player is ever hard-deleted.** `archivePlayer` retires one.

## Tables (Phase 3)

| Table                        | Holds                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| `game_presets`               | A `TableConfig` document, validated by `poker-core`        |
| `players`                    | Manually entered identity; unique on `normalized_nickname` |
| `player_hud_snapshots`       | Third-party HUD testimony, insert-only                     |
| `player_hud_snapshot_stats`  | One reading: verbatim `entered_text` + parsed value        |
| `player_notes`               | Append-only note versions (`root_id`, `supersedes_id`)     |
| `player_observations`        | Counts we recorded. Never a rate                           |
| `sessions` / `session_seats` | A sitting's own `TableConfig` copy and its six seats       |
| `hands` / `hand_players`     | Hand header and the dealt-in projection                    |
| `hand_events`                | The authoritative ordered event log                        |

`gto_*` tables and `player_aggregates` are Phase 9 and are deliberately absent.

## Commands

| Command                        | What it does                                      |
| ------------------------------ | ------------------------------------------------- |
| `pnpm db:generate`             | Regenerate migrations into `drizzle/` from schema |
| `pnpm db:migrate`              | Apply committed migrations (`GTO_SELF_DB_URL`)    |
| `pnpm vitest run --project db` | Integration tests against real in-memory SQLite   |

Migrations in `drizzle/` are **committed artifacts**. Nothing applies a schema diff at
runtime. `PRAGMA foreign_keys = ON` is set on every connection — SQLite does not enforce
foreign keys by default.

`0000_*.sql` is generated from `src/schema.ts` and must stay byte-identical to what
`pnpm db:generate` produces from it. `0001_insert_only_guards.sql` is a **custom**
migration, because `drizzle-kit` cannot emit a trigger; it is maintained by hand and its
PostgreSQL equivalent is written out in its header.
