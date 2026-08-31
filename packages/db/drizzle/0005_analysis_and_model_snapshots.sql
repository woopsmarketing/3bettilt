-- The DERIVED player-learning layer (ADR-0062): analysis runs, versioned player model
-- snapshots, and the four child tables that hold a snapshot's content losslessly.
--
-- Purely ADDITIVE: seven new tables, no existing table touched. `drizzle-kit generate`
-- produced the `CREATE TABLE` / `CREATE INDEX` statements below unchanged (a create-only
-- diff has none of the 12-step-rewrite hazard of `0003`/`0004`); the fourteen insert-only
-- triggers at the bottom are hand-authored, because `drizzle-kit` cannot emit a trigger.
-- Keep them in step with `src/schema.ts` by hand — the exhaustive trigger-list assertion
-- in `tests/insert-only.test.ts` is the only tripwire that notices a missing one.
--
-- Nothing here touches raw history. `player_observations` is likewise untouched: it stays
-- the manually-driven live-observation surface and analysis never writes to it (ADR-0062a).
-- Derived data is deletable-and-rebuildable in principle; it is insert-only in practice so
-- that a snapshot the user has already read can never change under them, and so that a
-- rebuild is an explicit, deliberate act rather than an UPDATE nobody notices.
--
-- PG: identical DDL modulo the `typeof(...)` terms (redundant on a real `integer`) and one
-- `BEFORE UPDATE OR DELETE ... EXECUTE FUNCTION gto_self_insert_only()` trigger per table.

CREATE TABLE `analysis_run_players` (
	`run_id` text NOT NULL,
	`player_id` text NOT NULL,
	`outcome` text NOT NULL,
	`snapshot_id` text,
	`error_json` text,
	PRIMARY KEY(`run_id`, `player_id`),
	FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_model_snapshots`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "analysis_run_players_outcome" CHECK("analysis_run_players"."outcome" in ('SNAPSHOT_CREATED', 'NO_CHANGES', 'FAILED')),
	CONSTRAINT "analysis_run_players_snapshot_iff_created" CHECK(("analysis_run_players"."outcome" = 'SNAPSHOT_CREATED' and "analysis_run_players"."snapshot_id" is not null) or ("analysis_run_players"."outcome" <> 'SNAPSHOT_CREATED' and "analysis_run_players"."snapshot_id" is null)),
	CONSTRAINT "analysis_run_players_error_only_when_failed" CHECK("analysis_run_players"."error_json" is null or ("analysis_run_players"."outcome" = 'FAILED' and length("analysis_run_players"."error_json") > 0))
);
--> statement-breakpoint
CREATE INDEX `analysis_run_players_player_idx` ON `analysis_run_players` (`player_id`,`run_id`);--> statement-breakpoint
CREATE TABLE `analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`algorithm_version` integer NOT NULL,
	`status` text NOT NULL,
	`hand_count` integer NOT NULL,
	`player_count` integer NOT NULL,
	`observation_count` integer NOT NULL,
	`show_count` integer NOT NULL,
	`error_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "analysis_runs_id_not_empty" CHECK(length("analysis_runs"."id") > 0),
	CONSTRAINT "analysis_runs_started_at_range" CHECK(typeof("analysis_runs"."started_at") = 'integer' and "analysis_runs"."started_at" >= 0 and "analysis_runs"."started_at" <= 32503680000000),
	CONSTRAINT "analysis_runs_finished_at_range" CHECK(typeof("analysis_runs"."finished_at") = 'integer' and "analysis_runs"."finished_at" >= "analysis_runs"."started_at" and "analysis_runs"."finished_at" <= 32503680000000),
	CONSTRAINT "analysis_runs_algorithm_version_positive" CHECK(typeof("analysis_runs"."algorithm_version") = 'integer' and "analysis_runs"."algorithm_version" >= 1),
	CONSTRAINT "analysis_runs_status" CHECK("analysis_runs"."status" in ('SUCCESS', 'PARTIAL', 'FAILED')),
	CONSTRAINT "analysis_runs_hand_count_range" CHECK(typeof("analysis_runs"."hand_count") = 'integer' and "analysis_runs"."hand_count" >= 0 and "analysis_runs"."hand_count" <= 100000000),
	CONSTRAINT "analysis_runs_player_count_range" CHECK(typeof("analysis_runs"."player_count") = 'integer' and "analysis_runs"."player_count" >= 0 and "analysis_runs"."player_count" <= 100000000),
	CONSTRAINT "analysis_runs_observation_count_range" CHECK(typeof("analysis_runs"."observation_count") = 'integer' and "analysis_runs"."observation_count" >= 0 and "analysis_runs"."observation_count" <= 100000000),
	CONSTRAINT "analysis_runs_show_count_range" CHECK(typeof("analysis_runs"."show_count") = 'integer' and "analysis_runs"."show_count" >= 0 and "analysis_runs"."show_count" <= 100000000),
	CONSTRAINT "analysis_runs_error_json_not_empty" CHECK("analysis_runs"."error_json" is null or length("analysis_runs"."error_json") > 0)
);
--> statement-breakpoint
CREATE INDEX `analysis_runs_session_started_idx` ON `analysis_runs` (`session_id`,`started_at`,`id`);--> statement-breakpoint
CREATE TABLE `player_model_bet_sizes` (
	`snapshot_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`hand_id` text NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`spot_key` text NOT NULL,
	`to_amount` integer NOT NULL,
	`amount` integer NOT NULL,
	`pot_before` integer NOT NULL,
	`current_bet_before` integer NOT NULL,
	`big_blind` integer NOT NULL,
	`bucket` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ordinal`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_model_snapshots`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_model_bet_sizes_ordinal_non_negative" CHECK("player_model_bet_sizes"."ordinal" >= 0),
	CONSTRAINT "player_model_bet_sizes_kind" CHECK("player_model_bet_sizes"."kind" in ('PREFLOP_OPEN', 'PREFLOP_THREE_BET', 'PREFLOP_FOUR_BET_PLUS', 'POSTFLOP_BET', 'POSTFLOP_RAISE')),
	CONSTRAINT "player_model_bet_sizes_spot_key_not_empty" CHECK(length("player_model_bet_sizes"."spot_key") > 0),
	CONSTRAINT "player_model_bet_sizes_to_amount_range" CHECK(typeof("player_model_bet_sizes"."to_amount") = 'integer' and "player_model_bet_sizes"."to_amount" >= -1000000000 and "player_model_bet_sizes"."to_amount" <= 1000000000),
	CONSTRAINT "player_model_bet_sizes_amount_range" CHECK(typeof("player_model_bet_sizes"."amount") = 'integer' and "player_model_bet_sizes"."amount" >= -1000000000 and "player_model_bet_sizes"."amount" <= 1000000000),
	CONSTRAINT "player_model_bet_sizes_pot_before_range" CHECK(typeof("player_model_bet_sizes"."pot_before") = 'integer' and "player_model_bet_sizes"."pot_before" >= -1000000000 and "player_model_bet_sizes"."pot_before" <= 1000000000),
	CONSTRAINT "player_model_bet_sizes_current_bet_before_range" CHECK(typeof("player_model_bet_sizes"."current_bet_before") = 'integer' and "player_model_bet_sizes"."current_bet_before" >= -1000000000 and "player_model_bet_sizes"."current_bet_before" <= 1000000000),
	CONSTRAINT "player_model_bet_sizes_big_blind_range" CHECK(typeof("player_model_bet_sizes"."big_blind") = 'integer' and "player_model_bet_sizes"."big_blind" >= -1000000000 and "player_model_bet_sizes"."big_blind" <= 1000000000),
	CONSTRAINT "player_model_bet_sizes_bucket" CHECK("player_model_bet_sizes"."bucket" in ('NONE', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'POT', 'OVERBET', 'LIMP', 'MIN', 'STANDARD', 'HUGE'))
);
--> statement-breakpoint
CREATE INDEX `player_model_bet_sizes_hand_idx` ON `player_model_bet_sizes` (`hand_id`);--> statement-breakpoint
CREATE INDEX `player_model_bet_sizes_snapshot_kind_idx` ON `player_model_bet_sizes` (`snapshot_id`,`kind`);--> statement-breakpoint
CREATE TABLE `player_model_show_evidence` (
	`snapshot_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`hand_id` text NOT NULL,
	`player_id` text NOT NULL,
	`position` text NOT NULL,
	`cards_text` text NOT NULL,
	`board_text` text NOT NULL,
	`last_street` text NOT NULL,
	`spot_keys_json` text NOT NULL,
	`outcome` text NOT NULL,
	`won_gross` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ordinal`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_model_snapshots`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_model_show_evidence_ordinal_non_negative" CHECK("player_model_show_evidence"."ordinal" >= 0),
	CONSTRAINT "player_model_show_evidence_position" CHECK("player_model_show_evidence"."position" in ('UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
	CONSTRAINT "player_model_show_evidence_cards_length" CHECK(length("player_model_show_evidence"."cards_text") in (2, 5)),
	CONSTRAINT "player_model_show_evidence_board_length" CHECK(length("player_model_show_evidence"."board_text") in (0, 8, 11, 14)),
	CONSTRAINT "player_model_show_evidence_last_street" CHECK("player_model_show_evidence"."last_street" in ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
	CONSTRAINT "player_model_show_evidence_spot_keys_not_empty" CHECK(length("player_model_show_evidence"."spot_keys_json") > 0),
	CONSTRAINT "player_model_show_evidence_outcome" CHECK("player_model_show_evidence"."outcome" in ('WON', 'LOST', 'UNKNOWN')),
	CONSTRAINT "player_model_show_evidence_won_gross_range" CHECK(typeof("player_model_show_evidence"."won_gross") = 'integer' and "player_model_show_evidence"."won_gross" >= -1000000000 and "player_model_show_evidence"."won_gross" <= 1000000000),
	CONSTRAINT "player_model_show_evidence_won_gross_non_negative" CHECK("player_model_show_evidence"."won_gross" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_model_show_evidence_hand_unique` ON `player_model_show_evidence` (`snapshot_id`,`hand_id`);--> statement-breakpoint
CREATE INDEX `player_model_show_evidence_hand_idx` ON `player_model_show_evidence` (`hand_id`);--> statement-breakpoint
CREATE TABLE `player_model_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`model_version` integer NOT NULL,
	`analysis_run_id` text NOT NULL,
	`algorithm_version` integer NOT NULL,
	`input_hash` text NOT NULL,
	`source_hand_count` integer NOT NULL,
	`source_observation_count` integer NOT NULL,
	`source_show_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`confidence_k` integer NOT NULL,
	`confidence_learning_threshold` integer NOT NULL,
	`confidence_known_threshold` integer NOT NULL,
	`confidence_overall_opportunities` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_model_snapshots_id_not_empty" CHECK(length("player_model_snapshots"."id") > 0),
	CONSTRAINT "player_model_snapshots_model_version_positive" CHECK(typeof("player_model_snapshots"."model_version") = 'integer' and "player_model_snapshots"."model_version" >= 1),
	CONSTRAINT "player_model_snapshots_algorithm_version_positive" CHECK(typeof("player_model_snapshots"."algorithm_version") = 'integer' and "player_model_snapshots"."algorithm_version" >= 1),
	CONSTRAINT "player_model_snapshots_input_hash_not_empty" CHECK(length("player_model_snapshots"."input_hash") > 0),
	CONSTRAINT "player_model_snapshots_source_hand_count_range" CHECK(typeof("player_model_snapshots"."source_hand_count") = 'integer' and "player_model_snapshots"."source_hand_count" >= 0 and "player_model_snapshots"."source_hand_count" <= 100000000),
	CONSTRAINT "player_model_snapshots_source_observation_count_range" CHECK(typeof("player_model_snapshots"."source_observation_count") = 'integer' and "player_model_snapshots"."source_observation_count" >= 0 and "player_model_snapshots"."source_observation_count" <= 100000000),
	CONSTRAINT "player_model_snapshots_source_show_count_range" CHECK(typeof("player_model_snapshots"."source_show_count") = 'integer' and "player_model_snapshots"."source_show_count" >= 0 and "player_model_snapshots"."source_show_count" <= 100000000),
	CONSTRAINT "player_model_snapshots_created_at_range" CHECK(typeof("player_model_snapshots"."created_at") = 'integer' and "player_model_snapshots"."created_at" >= 0 and "player_model_snapshots"."created_at" <= 32503680000000),
	CONSTRAINT "player_model_snapshots_confidence_k_positive" CHECK(typeof("player_model_snapshots"."confidence_k") = 'integer' and "player_model_snapshots"."confidence_k" >= 1),
	CONSTRAINT "player_model_snapshots_confidence_thresholds" CHECK(typeof("player_model_snapshots"."confidence_learning_threshold") = 'integer' and "player_model_snapshots"."confidence_learning_threshold" >= 1 and typeof("player_model_snapshots"."confidence_known_threshold") = 'integer' and "player_model_snapshots"."confidence_learning_threshold" < "player_model_snapshots"."confidence_known_threshold"),
	CONSTRAINT "player_model_snapshots_confidence_overall_range" CHECK(typeof("player_model_snapshots"."confidence_overall_opportunities") = 'integer' and "player_model_snapshots"."confidence_overall_opportunities" >= 0 and "player_model_snapshots"."confidence_overall_opportunities" <= 100000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_model_snapshots_player_version_unique` ON `player_model_snapshots` (`player_id`,`model_version`);--> statement-breakpoint
CREATE INDEX `player_model_snapshots_player_created_idx` ON `player_model_snapshots` (`player_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `player_model_snapshots_run_idx` ON `player_model_snapshots` (`analysis_run_id`);--> statement-breakpoint
CREATE TABLE `player_model_stats` (
	`snapshot_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`stat_key` text NOT NULL,
	`position` text,
	`opportunities` integer NOT NULL,
	`actions` integer NOT NULL,
	`confidence_opportunities` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ordinal`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_model_snapshots`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_model_stats_ordinal_non_negative" CHECK("player_model_stats"."ordinal" >= 0),
	CONSTRAINT "player_model_stats_key" CHECK("player_model_stats"."stat_key" in ('VPIP', 'PFR', 'RFI', 'STEAL_ATTEMPT', 'FOLD_TO_STEAL', 'THREE_BET', 'FOLD_TO_THREE_BET', 'FOUR_BET', 'CBET_FLOP', 'CBET_TURN', 'CBET_RIVER', 'FOLD_TO_CBET_FLOP', 'FOLD_TO_CBET_TURN', 'FOLD_TO_CBET_RIVER', 'CHECK_RAISE_FLOP', 'CHECK_RAISE_TURN', 'CHECK_RAISE_RIVER', 'TURN_BARREL', 'RIVER_BARREL', 'WTSD', 'WSD')),
	CONSTRAINT "player_model_stats_position" CHECK("player_model_stats"."position" is null or "player_model_stats"."position" in ('UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
	CONSTRAINT "player_model_stats_opportunities_range" CHECK(typeof("player_model_stats"."opportunities") = 'integer' and "player_model_stats"."opportunities" >= 0 and "player_model_stats"."opportunities" <= 100000000),
	CONSTRAINT "player_model_stats_actions_range" CHECK(typeof("player_model_stats"."actions") = 'integer' and "player_model_stats"."actions" >= 0 and "player_model_stats"."actions" <= 100000000),
	CONSTRAINT "player_model_stats_actions_within_opportunities" CHECK("player_model_stats"."actions" <= "player_model_stats"."opportunities"),
	CONSTRAINT "player_model_stats_confidence_range" CHECK(typeof("player_model_stats"."confidence_opportunities") = 'integer' and "player_model_stats"."confidence_opportunities" >= 0 and "player_model_stats"."confidence_opportunities" <= 100000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_model_stats_context_unique` ON `player_model_stats` (`snapshot_id`,`stat_key`,`position`) WHERE "player_model_stats"."position" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `player_model_stats_context_null_position_unique` ON `player_model_stats` (`snapshot_id`,`stat_key`) WHERE "player_model_stats"."position" is null;--> statement-breakpoint
CREATE TABLE `player_spot_stats` (
	`snapshot_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`spot_key` text NOT NULL,
	`phase` text NOT NULL,
	`family` text NOT NULL,
	`position` text NOT NULL,
	`opponent_position` text,
	`lineup` text NOT NULL,
	`street` text,
	`relation` text,
	`pot_type` text,
	`facing_size` text,
	`opportunities` integer NOT NULL,
	`effect_fold` integer NOT NULL,
	`effect_check` integer NOT NULL,
	`effect_call` integer NOT NULL,
	`effect_bet` integer NOT NULL,
	`effect_raise` integer NOT NULL,
	`verb_fold` integer NOT NULL,
	`verb_check` integer NOT NULL,
	`verb_call` integer NOT NULL,
	`verb_bet` integer NOT NULL,
	`verb_raise` integer NOT NULL,
	`verb_all_in` integer NOT NULL,
	`confidence_opportunities` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ordinal`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_model_snapshots`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_spot_stats_ordinal_non_negative" CHECK("player_spot_stats"."ordinal" >= 0),
	CONSTRAINT "player_spot_stats_spot_key_not_empty" CHECK(length("player_spot_stats"."spot_key") > 0),
	CONSTRAINT "player_spot_stats_phase" CHECK("player_spot_stats"."phase" in ('PREFLOP', 'POSTFLOP')),
	CONSTRAINT "player_spot_stats_family" CHECK(("player_spot_stats"."phase" = 'PREFLOP' and "player_spot_stats"."family" in ('RFI', 'VS_LIMP', 'BB_OPTION', 'VS_OPEN', 'SQUEEZE', 'VS_THREE_BET', 'VS_FOUR_BET', 'VS_MULTI_RAISE')) or ("player_spot_stats"."phase" = 'POSTFLOP' and "player_spot_stats"."family" in ('CBET', 'FACING_CBET', 'DONK_LEAD', 'CHECKED_TO', 'FACING_BET', 'FACING_RAISE'))),
	CONSTRAINT "player_spot_stats_position" CHECK("player_spot_stats"."position" in ('UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
	CONSTRAINT "player_spot_stats_lineup" CHECK("player_spot_stats"."lineup" in ('HEADS_UP', 'MULTIWAY')),
	CONSTRAINT "player_spot_stats_preflop_dimensions" CHECK("player_spot_stats"."phase" <> 'PREFLOP' or ("player_spot_stats"."street" is null and "player_spot_stats"."relation" is null and "player_spot_stats"."pot_type" is null and "player_spot_stats"."facing_size" is null and ("player_spot_stats"."opponent_position" is null or "player_spot_stats"."opponent_position" in ('UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB')))),
	CONSTRAINT "player_spot_stats_postflop_dimensions" CHECK("player_spot_stats"."phase" <> 'POSTFLOP' or ("player_spot_stats"."opponent_position" is null and "player_spot_stats"."street" in ('FLOP', 'TURN', 'RIVER') and "player_spot_stats"."relation" in ('IP', 'OOP') and "player_spot_stats"."pot_type" in ('LIMPED', 'SINGLE_RAISED', 'THREE_BET', 'FOUR_BET_PLUS') and "player_spot_stats"."facing_size" in ('NONE', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'POT', 'OVERBET'))),
	CONSTRAINT "player_spot_stats_opportunities_range" CHECK(typeof("player_spot_stats"."opportunities") = 'integer' and "player_spot_stats"."opportunities" >= 0 and "player_spot_stats"."opportunities" <= 100000000),
	CONSTRAINT "player_spot_stats_effect_fold_range" CHECK(typeof("player_spot_stats"."effect_fold") = 'integer' and "player_spot_stats"."effect_fold" >= 0 and "player_spot_stats"."effect_fold" <= 100000000),
	CONSTRAINT "player_spot_stats_effect_check_range" CHECK(typeof("player_spot_stats"."effect_check") = 'integer' and "player_spot_stats"."effect_check" >= 0 and "player_spot_stats"."effect_check" <= 100000000),
	CONSTRAINT "player_spot_stats_effect_call_range" CHECK(typeof("player_spot_stats"."effect_call") = 'integer' and "player_spot_stats"."effect_call" >= 0 and "player_spot_stats"."effect_call" <= 100000000),
	CONSTRAINT "player_spot_stats_effect_bet_range" CHECK(typeof("player_spot_stats"."effect_bet") = 'integer' and "player_spot_stats"."effect_bet" >= 0 and "player_spot_stats"."effect_bet" <= 100000000),
	CONSTRAINT "player_spot_stats_effect_raise_range" CHECK(typeof("player_spot_stats"."effect_raise") = 'integer' and "player_spot_stats"."effect_raise" >= 0 and "player_spot_stats"."effect_raise" <= 100000000),
	CONSTRAINT "player_spot_stats_verb_fold_range" CHECK(typeof("player_spot_stats"."verb_fold") = 'integer' and "player_spot_stats"."verb_fold" >= 0 and "player_spot_stats"."verb_fold" <= 100000000),
	CONSTRAINT "player_spot_stats_verb_check_range" CHECK(typeof("player_spot_stats"."verb_check") = 'integer' and "player_spot_stats"."verb_check" >= 0 and "player_spot_stats"."verb_check" <= 100000000),
	CONSTRAINT "player_spot_stats_verb_call_range" CHECK(typeof("player_spot_stats"."verb_call") = 'integer' and "player_spot_stats"."verb_call" >= 0 and "player_spot_stats"."verb_call" <= 100000000),
	CONSTRAINT "player_spot_stats_verb_bet_range" CHECK(typeof("player_spot_stats"."verb_bet") = 'integer' and "player_spot_stats"."verb_bet" >= 0 and "player_spot_stats"."verb_bet" <= 100000000),
	CONSTRAINT "player_spot_stats_verb_raise_range" CHECK(typeof("player_spot_stats"."verb_raise") = 'integer' and "player_spot_stats"."verb_raise" >= 0 and "player_spot_stats"."verb_raise" <= 100000000),
	CONSTRAINT "player_spot_stats_verb_all_in_range" CHECK(typeof("player_spot_stats"."verb_all_in") = 'integer' and "player_spot_stats"."verb_all_in" >= 0 and "player_spot_stats"."verb_all_in" <= 100000000),
	CONSTRAINT "player_spot_stats_effects_sum" CHECK("player_spot_stats"."effect_fold" + "player_spot_stats"."effect_check" + "player_spot_stats"."effect_call" + "player_spot_stats"."effect_bet" + "player_spot_stats"."effect_raise" = "player_spot_stats"."opportunities"),
	CONSTRAINT "player_spot_stats_verbs_sum" CHECK("player_spot_stats"."verb_fold" + "player_spot_stats"."verb_check" + "player_spot_stats"."verb_call" + "player_spot_stats"."verb_bet" + "player_spot_stats"."verb_raise" + "player_spot_stats"."verb_all_in" = "player_spot_stats"."opportunities"),
	CONSTRAINT "player_spot_stats_confidence_range" CHECK(typeof("player_spot_stats"."confidence_opportunities") = 'integer' and "player_spot_stats"."confidence_opportunities" >= 0 and "player_spot_stats"."confidence_opportunities" <= 100000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_spot_stats_spot_unique` ON `player_spot_stats` (`snapshot_id`,`spot_key`);--> statement-breakpoint
CREATE INDEX `player_spot_stats_spot_key_idx` ON `player_spot_stats` (`spot_key`);--> statement-breakpoint

-- INSERT-ONLY GUARDS for the derived layer (ADR-0037's pattern, ADR-0062a's tables).
--
-- An analysis run is a historical fact and a snapshot is immutable and versioned: a new
-- model is `model_version + 1`, never an UPDATE of `v1`. Every UPDATE and every DELETE on
-- all seven tables aborts, whoever issues it — the repository, a raw Drizzle statement
-- built from the barrel-exported table object, or raw SQL.

CREATE TRIGGER `analysis_runs_no_update`
BEFORE UPDATE ON `analysis_runs`
BEGIN
	SELECT RAISE(ABORT, 'analysis_runs is insert-only: a run is a historical fact, and a re-run is a new row');
END;
--> statement-breakpoint
CREATE TRIGGER `analysis_runs_no_delete`
BEFORE DELETE ON `analysis_runs`
BEGIN
	SELECT RAISE(ABORT, 'analysis_runs is insert-only: an audited run is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `analysis_run_players_no_update`
BEFORE UPDATE ON `analysis_run_players`
BEGIN
	SELECT RAISE(ABORT, 'analysis_run_players is insert-only: a reported per-player outcome is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `analysis_run_players_no_delete`
BEFORE DELETE ON `analysis_run_players`
BEGIN
	SELECT RAISE(ABORT, 'analysis_run_players is insert-only: a reported per-player outcome is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_snapshots_no_update`
BEFORE UPDATE ON `player_model_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'player_model_snapshots is insert-only: a new model is a new version row, never an UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_snapshots_no_delete`
BEFORE DELETE ON `player_model_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'player_model_snapshots is insert-only: an earlier version stays inspectable forever');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_stats_no_update`
BEFORE UPDATE ON `player_model_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_model_stats is insert-only: a snapshot statistic is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_stats_no_delete`
BEFORE DELETE ON `player_model_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_model_stats is insert-only: a snapshot statistic is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_spot_stats_no_update`
BEFORE UPDATE ON `player_spot_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_spot_stats is insert-only: a snapshot spot bucket is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `player_spot_stats_no_delete`
BEFORE DELETE ON `player_spot_stats`
BEGIN
	SELECT RAISE(ABORT, 'player_spot_stats is insert-only: a snapshot spot bucket is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_bet_sizes_no_update`
BEFORE UPDATE ON `player_model_bet_sizes`
BEGIN
	SELECT RAISE(ABORT, 'player_model_bet_sizes is insert-only: an observed bet size is never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_bet_sizes_no_delete`
BEFORE DELETE ON `player_model_bet_sizes`
BEGIN
	SELECT RAISE(ABORT, 'player_model_bet_sizes is insert-only: an observed bet size is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_show_evidence_no_update`
BEFORE UPDATE ON `player_model_show_evidence`
BEGIN
	SELECT RAISE(ABORT, 'player_model_show_evidence is insert-only: revealed cards are recorded as shown, never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `player_model_show_evidence_no_delete`
BEFORE DELETE ON `player_model_show_evidence`
BEGIN
	SELECT RAISE(ABORT, 'player_model_show_evidence is insert-only: revealed-card evidence is never deleted');
END;
