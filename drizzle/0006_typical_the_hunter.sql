CREATE TABLE `review_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`is_resolved` integer DEFAULT false NOT NULL,
	`resolved_by_login` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `review_threads_pull_request_id_idx` ON `review_threads` (`pull_request_id`);--> statement-breakpoint
CREATE INDEX `review_threads_github_id_idx` ON `review_threads` (`github_id`);