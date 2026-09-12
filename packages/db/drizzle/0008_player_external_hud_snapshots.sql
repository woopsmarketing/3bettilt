-- Two new tables, insert-only (WP-K): a LIFETIME reading imported in bulk from a
-- third-party HUD, as a sibling of `player_hud_snapshots` rather than a widened version of
-- it. See `@gto-self/player-core`'s `externalHud.ts` module doc for why.
--
-- Purely ADDITIVE: two new tables, no existing table touched. `drizzle-kit generate`
-- produced the `CREATE TABLE` / `CREATE INDEX` statements below unchanged; the four
-- insert-only triggers at the bottom are hand-authored, exactly as `0001`'s, `0006`'s and
-- `0007`'s were, because `drizzle-kit` cannot emit a trigger. Keep them in step with
-- `src/schema.ts` by hand — the exhaustive trigger-list assertion in
-- `tests/insert-only.test.ts` is the only tripwire that notices a missing one.

CREATE TABLE `player_external_hud_snapshot_stats` (
	`snapshot_id` text NOT NULL,
	`stat_key` text NOT NULL,
	`entered_text` text NOT NULL,
	`value_centipercent` integer NOT NULL,
	`ordinal` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `stat_key`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_external_hud_snapshots`(`id`) ON UPDATE restrict ON DELETE cascade,
	CONSTRAINT "player_external_hud_snapshot_stats_key" CHECK("player_external_hud_snapshot_stats"."stat_key" in ('VPIP', 'PFR', 'THREE_BET', 'FOLD_TO_THREE_BET', 'STEAL', 'CBET_ANY_STREET', 'FOLD_TO_CBET_ANY_STREET', 'CHECK_RAISE_ANY_STREET', 'WTSD', 'WSD')),
	CONSTRAINT "player_external_hud_snapshot_stats_entered_text_not_empty" CHECK(length("player_external_hud_snapshot_stats"."entered_text") > 0),
	CONSTRAINT "player_external_hud_snapshot_stats_value_range" CHECK(typeof("player_external_hud_snapshot_stats"."value_centipercent") = 'integer' and "player_external_hud_snapshot_stats"."value_centipercent" >= 0 and "player_external_hud_snapshot_stats"."value_centipercent" <= 10000),
	CONSTRAINT "player_external_hud_snapshot_stats_ordinal_non_negative" CHECK("player_external_hud_snapshot_stats"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_external_hud_snapshot_stats_ordinal_unique` ON `player_external_hud_snapshot_stats` (`snapshot_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `player_external_hud_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`source` text NOT NULL,
	`scope` text NOT NULL,
	`reliability` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`sample_n` integer,
	`import_batch_id` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_external_hud_snapshots_source" CHECK("player_external_hud_snapshots"."source" = 'EXTERNAL_HUD'),
	CONSTRAINT "player_external_hud_snapshots_scope" CHECK("player_external_hud_snapshots"."scope" = 'LIFETIME'),
	CONSTRAINT "player_external_hud_snapshots_reliability" CHECK("player_external_hud_snapshots"."reliability" = 'ESTABLISHED'),
	CONSTRAINT "player_external_hud_snapshots_recorded_at_range" CHECK(typeof("player_external_hud_snapshots"."recorded_at") = 'integer' and "player_external_hud_snapshots"."recorded_at" >= 0 and "player_external_hud_snapshots"."recorded_at" <= 32503680000000),
	CONSTRAINT "player_external_hud_snapshots_sample_n_range" CHECK("player_external_hud_snapshots"."sample_n" is null or (typeof("player_external_hud_snapshots"."sample_n") = 'integer' and "player_external_hud_snapshots"."sample_n" >= 0 and "player_external_hud_snapshots"."sample_n" <= 100000000)),
	CONSTRAINT "player_external_hud_snapshots_import_batch_not_empty" CHECK(length("player_external_hud_snapshots"."import_batch_id") > 0)
);
--> statement-breakpoint
CREATE INDEX `player_external_hud_snapshots_player_recorded_idx` ON `player_external_hud_snapshots` (`player_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `player_external_hud_snapshots_batch_idx` ON `player_external_hud_snapshots` (`import_batch_id`);--> statement-breakpoint

-- INSERT-ONLY GUARDS (ADR-0037's pattern, same as `player_hud_snapshots`/`_stats` in
-- `0001`). Every UPDATE and every DELETE aborts, whoever issues it — the repository, a raw
-- Drizzle statement built from the barrel-exported table object, or raw SQL.

CREATE TRIGGER `player_external_hud_snapshots_no_update`
BEFORE UPDATE ON `player_external_hud_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'player_external_hud_snapshots is insert-only: a new reading is a new snapshot row, never an UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER `player_external_hud_snapshots_no_delete`
BEFORE DELETE ON `player_external_hud_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'player_external_hud_snapshots is insert-only: a snapshot is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_external_hud_snapshot_stats_no_update`
BEFORE UPDATE ON `player_external_hud_snapshot_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_external_hud_snapshot_stats is insert-only: entered_text and value_centipercent are never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `player_external_hud_snapshot_stats_no_delete`
BEFORE DELETE ON `player_external_hud_snapshot_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_external_hud_snapshot_stats is insert-only: a reading is never deleted');
END;