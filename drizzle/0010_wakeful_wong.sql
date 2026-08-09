CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`events_json` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `chat_messages_pull_request_id_idx` ON `chat_messages` (`pull_request_id`);--> statement-breakpoint
CREATE INDEX `chat_messages_session_id_idx` ON `chat_messages` (`session_id`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`pull_request_id` text NOT NULL,
	`agent` text NOT NULL,
	`agent_session_id` text,
	`title` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `chat_sessions_pull_request_id_idx` ON `chat_sessions` (`pull_request_id`);