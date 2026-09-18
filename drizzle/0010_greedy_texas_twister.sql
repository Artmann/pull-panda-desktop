ALTER TABLE `pull_requests` ADD `last_viewed_at` text;--> statement-breakpoint
UPDATE `pull_requests` SET `last_viewed_at` = `updated_at`;
