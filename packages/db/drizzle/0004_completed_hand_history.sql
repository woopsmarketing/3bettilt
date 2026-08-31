-- Completed raw hand history: `source` + `schema_version` on `hands` (ADR-0059f), and
-- DB-level immutability for raw history (ADR-0060).
--
-- HAND-WRITTEN, NOT GENERATED — for the second time, and for the same reason as `0003`.
-- `drizzle-kit generate` emits the SQLite 12-step table-recreate for this diff:
--
--   1. Its `INSERT INTO __new_hands(... "source", "schema_version") SELECT ..., "source",
--      "schema_version" FROM "hands"` selects the two columns being ADDED, so it fails with
--      `no such column` on any database, empty or not.
--   2. Its `PRAGMA foreign_keys=OFF` is a NO-OP inside the migrator's transaction, so
--      `DROP TABLE hands` would run with foreign keys ENFORCED and take every `hand_events`
--      and `hand_players` row of every stored hand with it (ADR-0046). Dropping and
--      rebuilding the very table this migration exists to make immutable is not a migration
--      strategy.
--
-- `ALTER TABLE ... ADD COLUMN` is correct here: no table rewrite, existing rows are not
-- touched, and SQLite appends the column definition verbatim to the stored CREATE TABLE, so
-- the constraint text below is what `0000` would have produced. SQLite DOES accept a
-- column-level CHECK (and a NOT NULL with a non-NULL DEFAULT) on ADD COLUMN — `0003` already
-- relies on the first half of that. Existing rows get the DEFAULT, which both CHECKs accept;
-- SQLite does not re-validate existing rows against a newly added CHECK, and it does not
-- need to.
--
-- `source` is a CHECKed enum, unlike `hand_events.kind`: this vocabulary is OURS (how a hand
-- reached us), not the engine's event vocabulary, so pinning it here cannot go stale behind
-- poker-core. `schema_version` versions the STORED REPRESENTATION of the log, so a later
-- encoding change is a per-row migration rather than a guess on read.
--
-- PG: `ALTER TABLE hands ADD COLUMN source text NOT NULL DEFAULT 'MANUAL_PRACTICE';
-- ALTER TABLE hands ADD CONSTRAINT hands_source CHECK (...)`, dropping the `typeof(...)`
-- terms, which `integer` makes redundant.

ALTER TABLE `hands` ADD `source` text DEFAULT 'MANUAL_PRACTICE' NOT NULL CONSTRAINT "hands_source" CHECK("hands"."source" in ('MANUAL_PRACTICE', 'MANUAL_REVIEW'));--> statement-breakpoint
ALTER TABLE `hands` ADD `schema_version` integer DEFAULT 1 NOT NULL CONSTRAINT "hands_schema_version_positive" CHECK(typeof("hands"."schema_version") = 'integer' and "hands"."schema_version" >= 1);--> statement-breakpoint

-- IMMUTABILITY GUARDS for raw hand history (ADR-0060), the same pattern as
-- `0001_insert_only_guards.sql`: `drizzle-kit` cannot emit a trigger, so this is
-- hand-maintained and must be kept in step with `src/schema.ts` by hand. The tripwire is the
-- exhaustive trigger-list assertion in `tests/insert-only.test.ts`.
--
-- `hand_events` and `hand_players` are INSERT-ONLY outright: a hand's log and its dealt-in
-- projection are written in one transaction and are never revised. A correction is a new
-- record with explicit supersession metadata, never a rewrite of what happened.
--
-- `hands` is the one table with a legitimate UPDATE: `markHandFinished` sets `finished_at`
-- exactly once, and a future live-persistence phase will insert a header early and finish it
-- later. So the header guard is CONDITIONAL — a row whose `finished_at` is already non-null
-- is frozen — while DELETE is refused unconditionally. That also makes the `ON DELETE
-- CASCADE` from `hands` to `hand_events`/`hand_players` unreachable: history cannot be
-- removed by removing its header.
--
-- PG: `BEFORE UPDATE ... FOR EACH ROW WHEN (OLD.finished_at IS NOT NULL) EXECUTE FUNCTION
-- gto_self_immutable()`, plus one `BEFORE DELETE` trigger per table.

CREATE TRIGGER `hand_events_no_update`
BEFORE UPDATE ON `hand_events`
BEGIN
	SELECT RAISE(ABORT, 'hand_events is insert-only: a recorded hand event is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `hand_events_no_delete`
BEFORE DELETE ON `hand_events`
BEGIN
	SELECT RAISE(ABORT, 'hand_events is insert-only: a recorded hand event is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `hand_players_no_update`
BEFORE UPDATE ON `hand_players`
BEGIN
	SELECT RAISE(ABORT, 'hand_players is insert-only: the dealt-in lineup of a hand is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `hand_players_no_delete`
BEFORE DELETE ON `hand_players`
BEGIN
	SELECT RAISE(ABORT, 'hand_players is insert-only: the dealt-in lineup of a hand is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `hands_no_update_once_finished`
BEFORE UPDATE ON `hands`
WHEN OLD.`finished_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'hands is immutable once finished: a completed hand is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `hands_no_delete`
BEFORE DELETE ON `hands`
BEGIN
	SELECT RAISE(ABORT, 'hands is immutable: a stored hand is never deleted');
END;
