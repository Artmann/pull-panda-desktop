CREATE TABLE `inaccessible_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`detected_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `head_ref_name` text;