-- Custom SQL migration file, put your code below! --

-- INSERT-ONLY GUARDS for the three MANUALLY ENTERED tables.
--
-- `CLAUDE.md` rule 3 says user input is never destroyed. Up to here that was a convention:
-- the repositories export no update function, but `src/index.ts` re-exports the Drizzle
-- table objects (later phases need them for reads), so `db.update(playerNotes).set({...})`,
-- `db.delete(playerHudSnapshots)` and plain SQL could all overwrite or remove an entered
-- value. Overwriting a HUD reading's `entered_text` and `value_centipercent` together even
-- survives the read-time re-parse check, so nothing downstream would notice.
--
-- The guarantee is therefore structural, in the database: every UPDATE and every DELETE on
-- these three tables aborts. A revision is a new row (`player_notes.supersedes_id`); a new
-- reading is a new snapshot. Nothing is ever overwritten or removed.
--
-- `drizzle-kit generate` cannot emit a trigger, which is why this is a custom migration
-- rather than part of the generated `0000` snapshot. Keep it in step with `src/schema.ts`
-- by hand.
--
-- PG: one `BEFORE UPDATE OR DELETE ON <table> FOR EACH ROW EXECUTE FUNCTION
-- gto_self_insert_only()` trigger per table, where `gto_self_insert_only()` is a
-- `plpgsql` function whose body is `RAISE EXCEPTION '% is insert-only', TG_TABLE_NAME;`.
-- SQLite has no stored functions and no combined UPDATE-OR-DELETE trigger, hence six.

CREATE TRIGGER `player_notes_no_update`
BEFORE UPDATE ON `player_notes`
BEGIN
	SELECT RAISE(ABORT, 'player_notes is insert-only: a revision is a new row (root_id/supersedes_id), never an UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER `player_notes_no_delete`
BEFORE DELETE ON `player_notes`
BEGIN
	SELECT RAISE(ABORT, 'player_notes is insert-only: a note version is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_hud_snapshots_no_update`
BEFORE UPDATE ON `player_hud_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'player_hud_snapshots is insert-only: a new reading is a new snapshot row, never an UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER `player_hud_snapshots_no_delete`
BEFORE DELETE ON `player_hud_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'player_hud_snapshots is insert-only: a snapshot is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_hud_snapshot_stats_no_update`
BEFORE UPDATE ON `player_hud_snapshot_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_hud_snapshot_stats is insert-only: entered_text and value_centipercent are never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `player_hud_snapshot_stats_no_delete`
BEFORE DELETE ON `player_hud_snapshot_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_hud_snapshot_stats is insert-only: a reading is never deleted');
END;
