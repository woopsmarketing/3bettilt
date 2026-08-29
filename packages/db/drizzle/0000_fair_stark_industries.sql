CREATE TABLE `game_presets` (
	`preset_id` text PRIMARY KEY NOT NULL,
	`config_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "game_presets_preset_id_not_empty" CHECK(length("game_presets"."preset_id") > 0),
	CONSTRAINT "game_presets_created_at_range" CHECK(typeof("game_presets"."created_at") = 'integer' and "game_presets"."created_at" >= 0 and "game_presets"."created_at" <= 32503680000000),
	CONSTRAINT "game_presets_updated_at_range" CHECK(typeof("game_presets"."updated_at") = 'integer' and "game_presets"."updated_at" >= 0 and "game_presets"."updated_at" <= 32503680000000),
	CONSTRAINT "game_presets_updated_not_before_created" CHECK("game_presets"."updated_at" >= "game_presets"."created_at")
);
--> statement-breakpoint
CREATE TABLE `hand_events` (
	`hand_id` text NOT NULL,
	`seq` integer NOT NULL,
	`event_id` text NOT NULL,
	`command_seq` integer NOT NULL,
	`origin` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`hand_id`, `seq`),
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE restrict ON DELETE cascade,
	CONSTRAINT "hand_events_seq_non_negative" CHECK("hand_events"."seq" >= 0),
	CONSTRAINT "hand_events_command_seq_non_negative" CHECK("hand_events"."command_seq" >= 0),
	CONSTRAINT "hand_events_origin" CHECK("hand_events"."origin" in ('USER', 'ENGINE')),
	CONSTRAINT "hand_events_kind_not_empty" CHECK(length("hand_events"."kind") > 0),
	CONSTRAINT "hand_events_event_id_not_empty" CHECK(length("hand_events"."event_id") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hand_events_hand_event_id_unique` ON `hand_events` (`hand_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `hand_events_command_idx` ON `hand_events` (`hand_id`,`command_seq`,`seq`);--> statement-breakpoint
CREATE TABLE `hand_players` (
	`hand_id` text NOT NULL,
	`seat` integer NOT NULL,
	`player_id` text,
	`starting_stack` integer NOT NULL,
	PRIMARY KEY(`hand_id`, `seat`),
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE restrict ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "hand_players_seat_range" CHECK("hand_players"."seat" >= 0 and "hand_players"."seat" <= 5),
	CONSTRAINT "hand_players_starting_stack_positive" CHECK("hand_players"."starting_stack" > 0),
	CONSTRAINT "hand_players_starting_stack_range" CHECK(typeof("hand_players"."starting_stack") = 'integer' and "hand_players"."starting_stack" >= -1000000000 and "hand_players"."starting_stack" <= 1000000000)
);
--> statement-breakpoint
CREATE INDEX `hand_players_player_idx` ON `hand_players` (`player_id`,`hand_id`);--> statement-breakpoint
CREATE TABLE `hands` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`hand_number` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "hands_hand_number_non_negative" CHECK("hands"."hand_number" >= 0),
	CONSTRAINT "hands_started_at_range" CHECK(typeof("hands"."started_at") = 'integer' and "hands"."started_at" >= 0 and "hands"."started_at" <= 32503680000000),
	CONSTRAINT "hands_finished_at_range" CHECK("hands"."finished_at" is null or (typeof("hands"."finished_at") = 'integer' and "hands"."finished_at" >= "hands"."started_at" and "hands"."finished_at" <= 32503680000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hands_session_hand_number_unique` ON `hands` (`session_id`,`hand_number`);--> statement-breakpoint
CREATE INDEX `hands_session_started_idx` ON `hands` (`session_id`,`started_at`,`id`);--> statement-breakpoint
CREATE TABLE `player_hud_snapshot_stats` (
	`snapshot_id` text NOT NULL,
	`stat_key` text NOT NULL,
	`entered_text` text NOT NULL,
	`value_centipercent` integer NOT NULL,
	`ordinal` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `stat_key`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `player_hud_snapshots`(`id`) ON UPDATE restrict ON DELETE cascade,
	CONSTRAINT "player_hud_snapshot_stats_key" CHECK("player_hud_snapshot_stats"."stat_key" in ('VPIP', 'PFR', 'THREE_BET', 'FOLD_TO_THREE_BET', 'CBET_FLOP', 'FOLD_TO_CBET_FLOP', 'WTSD', 'WON_AT_SHOWDOWN')),
	CONSTRAINT "player_hud_snapshot_stats_entered_text_not_empty" CHECK(length("player_hud_snapshot_stats"."entered_text") > 0),
	CONSTRAINT "player_hud_snapshot_stats_value_range" CHECK(typeof("player_hud_snapshot_stats"."value_centipercent") = 'integer' and "player_hud_snapshot_stats"."value_centipercent" >= 0 and "player_hud_snapshot_stats"."value_centipercent" <= 10000),
	CONSTRAINT "player_hud_snapshot_stats_ordinal_non_negative" CHECK("player_hud_snapshot_stats"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_hud_snapshot_stats_ordinal_unique` ON `player_hud_snapshot_stats` (`snapshot_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `player_hud_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`source` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`hand_sample` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_hud_snapshots_source" CHECK("player_hud_snapshots"."source" = 'MANUAL_HUD_ENTRY'),
	CONSTRAINT "player_hud_snapshots_recorded_at_range" CHECK(typeof("player_hud_snapshots"."recorded_at") = 'integer' and "player_hud_snapshots"."recorded_at" >= 0 and "player_hud_snapshots"."recorded_at" <= 32503680000000),
	CONSTRAINT "player_hud_snapshots_hand_sample_range" CHECK("player_hud_snapshots"."hand_sample" is null or (typeof("player_hud_snapshots"."hand_sample") = 'integer' and "player_hud_snapshots"."hand_sample" >= 0 and "player_hud_snapshots"."hand_sample" <= 100000000))
);
--> statement-breakpoint
CREATE INDEX `player_hud_snapshots_player_recorded_idx` ON `player_hud_snapshots` (`player_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE TABLE `player_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`root_id` text NOT NULL,
	`supersedes_id` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`root_id`) REFERENCES `player_notes`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`supersedes_id`) REFERENCES `player_notes`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_notes_body_not_empty" CHECK(length("player_notes"."body") > 0),
	CONSTRAINT "player_notes_body_max_length" CHECK(length("player_notes"."body") <= 4000),
	CONSTRAINT "player_notes_created_at_range" CHECK(typeof("player_notes"."created_at") = 'integer' and "player_notes"."created_at" >= 0 and "player_notes"."created_at" <= 32503680000000),
	CONSTRAINT "player_notes_root_chain" CHECK(("player_notes"."supersedes_id" is null and "player_notes"."root_id" = "player_notes"."id") or ("player_notes"."supersedes_id" is not null and "player_notes"."root_id" <> "player_notes"."id")),
	CONSTRAINT "player_notes_no_self_supersede" CHECK("player_notes"."supersedes_id" is null or "player_notes"."supersedes_id" <> "player_notes"."id")
);
--> statement-breakpoint
CREATE INDEX `player_notes_player_created_idx` ON `player_notes` (`player_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `player_notes_root_created_idx` ON `player_notes` (`root_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_notes_supersedes_unique` ON `player_notes` (`supersedes_id`) WHERE "player_notes"."supersedes_id" is not null;--> statement-breakpoint
CREATE TABLE `player_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`metric` text NOT NULL,
	`position` text,
	`opportunities` integer NOT NULL,
	`actions` integer NOT NULL,
	`first_observed_at` integer NOT NULL,
	`last_observed_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "player_observations_metric" CHECK("player_observations"."metric" in ('VPIP', 'PFR', 'THREE_BET', 'FOLD_TO_THREE_BET')),
	CONSTRAINT "player_observations_position" CHECK("player_observations"."position" is null or "player_observations"."position" in ('UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
	CONSTRAINT "player_observations_opportunities_range" CHECK(typeof("player_observations"."opportunities") = 'integer' and "player_observations"."opportunities" >= 0 and "player_observations"."opportunities" <= 100000000),
	CONSTRAINT "player_observations_actions_range" CHECK(typeof("player_observations"."actions") = 'integer' and "player_observations"."actions" >= 0 and "player_observations"."actions" <= 100000000),
	CONSTRAINT "player_observations_actions_within_opportunities" CHECK("player_observations"."actions" <= "player_observations"."opportunities"),
	CONSTRAINT "player_observations_first_observed_range" CHECK(typeof("player_observations"."first_observed_at") = 'integer' and "player_observations"."first_observed_at" >= 0 and "player_observations"."first_observed_at" <= 32503680000000),
	CONSTRAINT "player_observations_last_observed_range" CHECK(typeof("player_observations"."last_observed_at") = 'integer' and "player_observations"."last_observed_at" >= 0 and "player_observations"."last_observed_at" <= 32503680000000),
	CONSTRAINT "player_observations_last_not_before_first" CHECK("player_observations"."last_observed_at" >= "player_observations"."first_observed_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_observations_context_unique` ON `player_observations` (`player_id`,`metric`,`position`) WHERE "player_observations"."position" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `player_observations_context_null_position_unique` ON `player_observations` (`player_id`,`metric`) WHERE "player_observations"."position" is null;--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`normalized_nickname` text NOT NULL,
	`display_alias` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived` integer NOT NULL,
	CONSTRAINT "players_id_not_empty" CHECK(length("players"."id") > 0),
	CONSTRAINT "players_nickname_not_empty" CHECK(length("players"."nickname") > 0),
	CONSTRAINT "players_normalized_not_empty" CHECK(length("players"."normalized_nickname") > 0),
	CONSTRAINT "players_display_alias_not_empty" CHECK("players"."display_alias" is null or length("players"."display_alias") > 0),
	CONSTRAINT "players_archived_boolean" CHECK("players"."archived" in (0, 1)),
	CONSTRAINT "players_created_at_range" CHECK(typeof("players"."created_at") = 'integer' and "players"."created_at" >= 0 and "players"."created_at" <= 32503680000000),
	CONSTRAINT "players_updated_at_range" CHECK(typeof("players"."updated_at") = 'integer' and "players"."updated_at" >= 0 and "players"."updated_at" <= 32503680000000),
	CONSTRAINT "players_updated_not_before_created" CHECK("players"."updated_at" >= "players"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_normalized_nickname_unique` ON `players` (`normalized_nickname`);--> statement-breakpoint
CREATE TABLE `session_seats` (
	`session_id` text NOT NULL,
	`seat` integer NOT NULL,
	`occupancy` text NOT NULL,
	`player_id` text,
	`stack` integer NOT NULL,
	PRIMARY KEY(`session_id`, `seat`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE restrict ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "session_seats_seat_range" CHECK("session_seats"."seat" >= 0 and "session_seats"."seat" <= 5),
	CONSTRAINT "session_seats_occupancy" CHECK("session_seats"."occupancy" in ('ACTIVE', 'SITTING_OUT', 'EMPTY')),
	CONSTRAINT "session_seats_empty_iff_no_player" CHECK(("session_seats"."occupancy" = 'EMPTY' and "session_seats"."player_id" is null) or ("session_seats"."occupancy" <> 'EMPTY' and "session_seats"."player_id" is not null)),
	CONSTRAINT "session_seats_empty_stack_zero" CHECK("session_seats"."occupancy" <> 'EMPTY' or "session_seats"."stack" = 0),
	CONSTRAINT "session_seats_stack_non_negative" CHECK("session_seats"."stack" >= 0),
	CONSTRAINT "session_seats_stack_range" CHECK(typeof("session_seats"."stack") = 'integer' and "session_seats"."stack" >= -1000000000 and "session_seats"."stack" <= 1000000000)
);
--> statement-breakpoint
CREATE INDEX `session_seats_player_idx` ON `session_seats` (`player_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text,
	`preset_id` text,
	`config_json` text NOT NULL,
	`button_seat` integer,
	`hero_seat` integer,
	`hand_number` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`preset_id`) REFERENCES `game_presets`(`preset_id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "sessions_label_not_empty" CHECK("sessions"."label" is null or length("sessions"."label") > 0),
	CONSTRAINT "sessions_button_seat_range" CHECK("sessions"."button_seat" is null or ("sessions"."button_seat" >= 0 and "sessions"."button_seat" <= 5)),
	CONSTRAINT "sessions_hero_seat_range" CHECK("sessions"."hero_seat" is null or ("sessions"."hero_seat" >= 0 and "sessions"."hero_seat" <= 5)),
	CONSTRAINT "sessions_hand_number_non_negative" CHECK("sessions"."hand_number" >= 0),
	CONSTRAINT "sessions_created_at_range" CHECK(typeof("sessions"."created_at") = 'integer' and "sessions"."created_at" >= 0 and "sessions"."created_at" <= 32503680000000),
	CONSTRAINT "sessions_updated_at_range" CHECK(typeof("sessions"."updated_at") = 'integer' and "sessions"."updated_at" >= 0 and "sessions"."updated_at" <= 32503680000000),
	CONSTRAINT "sessions_updated_not_before_created" CHECK("sessions"."updated_at" >= "sessions"."created_at"),
	CONSTRAINT "sessions_closed_at_range" CHECK("sessions"."closed_at" is null or (typeof("sessions"."closed_at") = 'integer' and "sessions"."closed_at" >= "sessions"."created_at" and "sessions"."closed_at" <= 32503680000000))
);
--> statement-breakpoint
CREATE INDEX `sessions_created_idx` ON `sessions` (`created_at`,`id`);