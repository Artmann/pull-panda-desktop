CREATE TABLE IF NOT EXISTS `etags` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`etag` text NOT NULL,
	`last_modified` text,
	`validated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `etags_endpoint_resource_idx` ON `etags` (`endpoint_type`,`resource_id`);--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `details_synced_at` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `github_numeric_id` integer;