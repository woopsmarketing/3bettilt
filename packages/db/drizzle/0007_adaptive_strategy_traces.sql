-- One new derived table, insert-only.
--
-- `adaptive_strategy_traces` — what the ADAPTIVE composition layer recommended at one Hero
-- decision point after folding opponent-specific evidence into the REFERENCE baseline, plus
-- the whole audit trail (every rule that fired, its stat, sample size, confidence, sources
-- and reason, and the exact HUD / learned-snapshot ids each opponent's numbers came from).
--
-- It is a SEPARATE table from `strategy_decision_traces` ON PURPOSE. That table's
-- `strategy_mode` CHECK is `in ('REFERENCE')` and is NOT touched here: a REFERENCE trace is
-- what the engine says about a spot with no knowledge of who is sitting in it, and widening
-- that CHECK would have made a derived, player-specific opinion indistinguishable from a
-- player-independent baseline to every consumer of that table. This row instead POINTS at
-- its baseline through the nullable `reference_trace_id` FK.
--
-- Purely ADDITIVE: one new table, no existing table touched. `drizzle-kit generate` produced
-- the `CREATE TABLE` / `CREATE UNIQUE INDEX` statements below unchanged; the two insert-only
-- triggers at the bottom are hand-authored, exactly as `0001`'s and `0006`'s were, because
-- `drizzle-kit` cannot emit a trigger. Keep them in step with `src/schema.ts` by hand — the
-- exhaustive trigger-list assertion in `tests/insert-only.test.ts` is the only tripwire that
-- notices a missing one.

CREATE TABLE `adaptive_strategy_traces` (
	`id` text PRIMARY KEY NOT NULL,
	`hand_id` text NOT NULL,
	`command_seq` integer NOT NULL,
	`reference_trace_id` text,
	`street` text NOT NULL,
	`hero_seat` integer NOT NULL,
	`status` text NOT NULL,
	`adaptive_policy_version` text NOT NULL,
	`primary_villain_player_id` text,
	`opponent_count` integer NOT NULL,
	`baseline_actions_json` text NOT NULL,
	`adaptive_actions_json` text NOT NULL,
	`frequency_delta_json` text NOT NULL,
	`baseline_primary_action` text NOT NULL,
	`adaptive_primary_action` text NOT NULL,
	`baseline_to_amount_mbb` integer,
	`adaptive_to_amount_mbb` integer,
	`baseline_sizing_bucket` integer,
	`adaptive_sizing_bucket` integer,
	`total_shift_bps` integer NOT NULL,
	`cap_applied` integer NOT NULL,
	`adjustments_json` text NOT NULL,
	`manual_hud_snapshot_ids_json` text NOT NULL,
	`player_model_snapshot_ids_json` text NOT NULL,
	`player_model_version` integer,
	`computed_at` integer NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`reference_trace_id`) REFERENCES `strategy_decision_traces`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`primary_villain_player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "adaptive_strategy_traces_id_not_empty" CHECK(length("adaptive_strategy_traces"."id") > 0),
	CONSTRAINT "adaptive_strategy_traces_command_seq_non_negative" CHECK(typeof("adaptive_strategy_traces"."command_seq") = 'integer' and "adaptive_strategy_traces"."command_seq" >= 0),
	CONSTRAINT "adaptive_strategy_traces_reference_trace_id_not_empty" CHECK("adaptive_strategy_traces"."reference_trace_id" is null or length("adaptive_strategy_traces"."reference_trace_id") > 0),
	CONSTRAINT "adaptive_strategy_traces_street" CHECK("adaptive_strategy_traces"."street" in ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
	CONSTRAINT "adaptive_strategy_traces_hero_seat_range" CHECK(typeof("adaptive_strategy_traces"."hero_seat") = 'integer' and "adaptive_strategy_traces"."hero_seat" >= 0 and "adaptive_strategy_traces"."hero_seat" <= 5),
	CONSTRAINT "adaptive_strategy_traces_status" CHECK("adaptive_strategy_traces"."status" in ('ADAPTED', 'INSUFFICIENT_DATA')),
	CONSTRAINT "adaptive_strategy_traces_policy_version_not_empty" CHECK(length("adaptive_strategy_traces"."adaptive_policy_version") > 0),
	CONSTRAINT "adaptive_strategy_traces_primary_villain_not_empty" CHECK("adaptive_strategy_traces"."primary_villain_player_id" is null or length("adaptive_strategy_traces"."primary_villain_player_id") > 0),
	CONSTRAINT "adaptive_strategy_traces_opponent_count_range" CHECK(typeof("adaptive_strategy_traces"."opponent_count") = 'integer' and "adaptive_strategy_traces"."opponent_count" >= 0 and "adaptive_strategy_traces"."opponent_count" <= 100000000),
	CONSTRAINT "adaptive_strategy_traces_baseline_actions_json_not_empty" CHECK(length("adaptive_strategy_traces"."baseline_actions_json") > 0),
	CONSTRAINT "adaptive_strategy_traces_adaptive_actions_json_not_empty" CHECK(length("adaptive_strategy_traces"."adaptive_actions_json") > 0),
	CONSTRAINT "adaptive_strategy_traces_frequency_delta_json_not_empty" CHECK(length("adaptive_strategy_traces"."frequency_delta_json") > 0),
	CONSTRAINT "adaptive_strategy_traces_baseline_primary_action" CHECK("adaptive_strategy_traces"."baseline_primary_action" in ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN')),
	CONSTRAINT "adaptive_strategy_traces_adaptive_primary_action" CHECK("adaptive_strategy_traces"."adaptive_primary_action" in ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN')),
	CONSTRAINT "adaptive_strategy_traces_baseline_to_amount_range" CHECK("adaptive_strategy_traces"."baseline_to_amount_mbb" is null or (typeof("adaptive_strategy_traces"."baseline_to_amount_mbb") = 'integer' and "adaptive_strategy_traces"."baseline_to_amount_mbb" >= -1000000000 and "adaptive_strategy_traces"."baseline_to_amount_mbb" <= 1000000000 and "adaptive_strategy_traces"."baseline_to_amount_mbb" >= 0)),
	CONSTRAINT "adaptive_strategy_traces_adaptive_to_amount_range" CHECK("adaptive_strategy_traces"."adaptive_to_amount_mbb" is null or (typeof("adaptive_strategy_traces"."adaptive_to_amount_mbb") = 'integer' and "adaptive_strategy_traces"."adaptive_to_amount_mbb" >= -1000000000 and "adaptive_strategy_traces"."adaptive_to_amount_mbb" <= 1000000000 and "adaptive_strategy_traces"."adaptive_to_amount_mbb" >= 0)),
	CONSTRAINT "adaptive_strategy_traces_baseline_sizing_bucket_range" CHECK("adaptive_strategy_traces"."baseline_sizing_bucket" is null or (typeof("adaptive_strategy_traces"."baseline_sizing_bucket") = 'integer' and "adaptive_strategy_traces"."baseline_sizing_bucket" >= -1 and "adaptive_strategy_traces"."baseline_sizing_bucket" <= 7)),
	CONSTRAINT "adaptive_strategy_traces_adaptive_sizing_bucket_range" CHECK("adaptive_strategy_traces"."adaptive_sizing_bucket" is null or (typeof("adaptive_strategy_traces"."adaptive_sizing_bucket") = 'integer' and "adaptive_strategy_traces"."adaptive_sizing_bucket" >= -1 and "adaptive_strategy_traces"."adaptive_sizing_bucket" <= 7)),
	CONSTRAINT "adaptive_strategy_traces_total_shift_bps_range" CHECK(typeof("adaptive_strategy_traces"."total_shift_bps") = 'integer' and "adaptive_strategy_traces"."total_shift_bps" >= 0 and "adaptive_strategy_traces"."total_shift_bps" <= 10000),
	CONSTRAINT "adaptive_strategy_traces_cap_applied_boolean" CHECK(typeof("adaptive_strategy_traces"."cap_applied") = 'integer' and "adaptive_strategy_traces"."cap_applied" in (0, 1)),
	CONSTRAINT "adaptive_strategy_traces_adjustments_json_not_empty" CHECK(length("adaptive_strategy_traces"."adjustments_json") > 0),
	CONSTRAINT "adaptive_strategy_traces_manual_hud_ids_json_not_empty" CHECK(length("adaptive_strategy_traces"."manual_hud_snapshot_ids_json") > 0),
	CONSTRAINT "adaptive_strategy_traces_model_snapshot_ids_json_not_empty" CHECK(length("adaptive_strategy_traces"."player_model_snapshot_ids_json") > 0),
	CONSTRAINT "adaptive_strategy_traces_player_model_version_positive" CHECK("adaptive_strategy_traces"."player_model_version" is null or (typeof("adaptive_strategy_traces"."player_model_version") = 'integer' and "adaptive_strategy_traces"."player_model_version" >= 1)),
	CONSTRAINT "adaptive_strategy_traces_computed_at_range" CHECK(typeof("adaptive_strategy_traces"."computed_at") = 'integer' and "adaptive_strategy_traces"."computed_at" >= 0 and "adaptive_strategy_traces"."computed_at" <= 32503680000000),
	CONSTRAINT "adaptive_strategy_traces_source" CHECK("adaptive_strategy_traces"."source" in ('LIVE', 'BACKFILL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adaptive_strategy_traces_hand_command_unique` ON `adaptive_strategy_traces` (`hand_id`,`command_seq`);--> statement-breakpoint

-- INSERT-ONLY GUARDS (ADR-0037's pattern, extended to this derived-but-permanent record).
-- Every UPDATE and every DELETE aborts, whoever issues it — the repository, a raw Drizzle
-- statement built from the barrel-exported table object, or raw SQL.

CREATE TRIGGER `adaptive_strategy_traces_no_update`
BEFORE UPDATE ON `adaptive_strategy_traces`
BEGIN
	SELECT RAISE(ABORT, 'adaptive_strategy_traces is insert-only: a recomposition is a new row under a new adaptive_policy_version, never an UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER `adaptive_strategy_traces_no_delete`
BEFORE DELETE ON `adaptive_strategy_traces`
BEGIN
	SELECT RAISE(ABORT, 'adaptive_strategy_traces is insert-only: what the app recommended when the user acted is never deleted');
END;
