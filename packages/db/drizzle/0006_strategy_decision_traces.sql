-- Two new derived/audit tables, both insert-only.
--
-- `strategy_decision_traces` — what the REFERENCE strategy engine recommended at each Hero
-- decision point of a completed hand, computed by replaying `hand_events` after the hand
-- was persisted (ADR-0056's provenance vocabulary, generation logic lives outside this
-- package). `skipped_hands` — a best-effort audit row for a hand the user chose to skip
-- rather than play or persist; it never becomes a `hands` row and never feeds analysis, so
-- it deliberately carries no FK to `hands`.
--
-- Purely ADDITIVE: two new tables, no existing table touched. `drizzle-kit generate`
-- produced the `CREATE TABLE` / `CREATE INDEX` statements below unchanged; the four
-- insert-only triggers at the bottom are hand-authored, exactly as `0005`'s were, because
-- `drizzle-kit` cannot emit a trigger. Keep them in step with `src/schema.ts` by hand — the
-- exhaustive trigger-list assertion in `tests/insert-only.test.ts` is the only tripwire
-- that notices a missing one.

CREATE TABLE `skipped_hands` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`hand_number` integer NOT NULL,
	`skipped_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "skipped_hands_id_not_empty" CHECK(length("skipped_hands"."id") > 0),
	CONSTRAINT "skipped_hands_hand_number_non_negative" CHECK("skipped_hands"."hand_number" >= 0),
	CONSTRAINT "skipped_hands_skipped_at_range" CHECK(typeof("skipped_hands"."skipped_at") = 'integer' and "skipped_hands"."skipped_at" >= 0 and "skipped_hands"."skipped_at" <= 32503680000000)
);
--> statement-breakpoint
CREATE INDEX `skipped_hands_session_idx` ON `skipped_hands` (`session_id`,`skipped_at`,`id`);--> statement-breakpoint
CREATE TABLE `strategy_decision_traces` (
	`id` text PRIMARY KEY NOT NULL,
	`hand_id` text NOT NULL,
	`command_seq` integer NOT NULL,
	`street` text NOT NULL,
	`hero_seat` integer NOT NULL,
	`strategy_mode` text NOT NULL,
	`strategy_version` text NOT NULL,
	`family` text NOT NULL,
	`actions_json` text NOT NULL,
	`primary_action` text NOT NULL,
	`recommended_to_amount_mbb` integer,
	`hero_equity_bps` integer,
	`pot_odds_bps` integer,
	`spr` integer,
	`provenance_quality` text NOT NULL,
	`environment_status` text NOT NULL,
	`actual_hero_action` text NOT NULL,
	`computed_at` integer NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "strategy_decision_traces_id_not_empty" CHECK(length("strategy_decision_traces"."id") > 0),
	CONSTRAINT "strategy_decision_traces_command_seq_non_negative" CHECK("strategy_decision_traces"."command_seq" >= 0),
	CONSTRAINT "strategy_decision_traces_street" CHECK("strategy_decision_traces"."street" in ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
	CONSTRAINT "strategy_decision_traces_hero_seat_range" CHECK("strategy_decision_traces"."hero_seat" >= 0 and "strategy_decision_traces"."hero_seat" <= 5),
	CONSTRAINT "strategy_decision_traces_strategy_mode" CHECK("strategy_decision_traces"."strategy_mode" in ('REFERENCE')),
	CONSTRAINT "strategy_decision_traces_strategy_version_not_empty" CHECK(length("strategy_decision_traces"."strategy_version") > 0),
	CONSTRAINT "strategy_decision_traces_family_not_empty" CHECK(length("strategy_decision_traces"."family") > 0),
	CONSTRAINT "strategy_decision_traces_actions_json_not_empty" CHECK(length("strategy_decision_traces"."actions_json") > 0),
	CONSTRAINT "strategy_decision_traces_primary_action" CHECK("strategy_decision_traces"."primary_action" in ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN')),
	CONSTRAINT "strategy_decision_traces_recommended_to_amount_range" CHECK("strategy_decision_traces"."recommended_to_amount_mbb" is null or (typeof("strategy_decision_traces"."recommended_to_amount_mbb") = 'integer' and "strategy_decision_traces"."recommended_to_amount_mbb" >= -1000000000 and "strategy_decision_traces"."recommended_to_amount_mbb" <= 1000000000 and "strategy_decision_traces"."recommended_to_amount_mbb" >= 0)),
	CONSTRAINT "strategy_decision_traces_hero_equity_range" CHECK("strategy_decision_traces"."hero_equity_bps" is null or (typeof("strategy_decision_traces"."hero_equity_bps") = 'integer' and "strategy_decision_traces"."hero_equity_bps" >= 0 and "strategy_decision_traces"."hero_equity_bps" <= 10000)),
	CONSTRAINT "strategy_decision_traces_pot_odds_range" CHECK("strategy_decision_traces"."pot_odds_bps" is null or (typeof("strategy_decision_traces"."pot_odds_bps") = 'integer' and "strategy_decision_traces"."pot_odds_bps" >= 0 and "strategy_decision_traces"."pot_odds_bps" <= 10000)),
	CONSTRAINT "strategy_decision_traces_spr_range" CHECK("strategy_decision_traces"."spr" is null or (typeof("strategy_decision_traces"."spr") = 'integer' and "strategy_decision_traces"."spr" >= 0)),
	CONSTRAINT "strategy_decision_traces_provenance_quality" CHECK("strategy_decision_traces"."provenance_quality" in ('SOURCE', 'DERIVED', 'HEURISTIC')),
	CONSTRAINT "strategy_decision_traces_environment_status_not_empty" CHECK(length("strategy_decision_traces"."environment_status") > 0),
	CONSTRAINT "strategy_decision_traces_actual_hero_action" CHECK("strategy_decision_traces"."actual_hero_action" in ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN')),
	CONSTRAINT "strategy_decision_traces_computed_at_range" CHECK(typeof("strategy_decision_traces"."computed_at") = 'integer' and "strategy_decision_traces"."computed_at" >= 0 and "strategy_decision_traces"."computed_at" <= 32503680000000),
	CONSTRAINT "strategy_decision_traces_source" CHECK("strategy_decision_traces"."source" in ('ONLINE', 'BACKFILL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strategy_decision_traces_hand_command_unique` ON `strategy_decision_traces` (`hand_id`,`command_seq`);--> statement-breakpoint

-- INSERT-ONLY GUARDS (ADR-0037's pattern, extended to this derived-but-permanent and
-- audit data). Every UPDATE and every DELETE on both tables aborts, whoever issues it —
-- the repository, a raw Drizzle statement built from the barrel-exported table object, or
-- raw SQL.

CREATE TRIGGER `strategy_decision_traces_no_update`
BEFORE UPDATE ON `strategy_decision_traces`
BEGIN
	SELECT RAISE(ABORT, 'strategy_decision_traces is insert-only: a recomputed trace is a new row, never an UPDATE');
END;
--> statement-breakpoint
CREATE TRIGGER `strategy_decision_traces_no_delete`
BEFORE DELETE ON `strategy_decision_traces`
BEGIN
	SELECT RAISE(ABORT, 'strategy_decision_traces is insert-only: a stored decision trace is never deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `skipped_hands_no_update`
BEFORE UPDATE ON `skipped_hands`
BEGIN
	SELECT RAISE(ABORT, 'skipped_hands is insert-only: a skip is a historical fact, never rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER `skipped_hands_no_delete`
BEFORE DELETE ON `skipped_hands`
BEGIN
	SELECT RAISE(ABORT, 'skipped_hands is insert-only: a skip audit row is never deleted');
END;
