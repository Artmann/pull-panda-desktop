ALTER TABLE `pull_requests` ADD `body` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `body_html` text;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD `is_draft` integer DEFAULT false NOT NULL;