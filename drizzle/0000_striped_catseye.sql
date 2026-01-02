CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`name` text NOT NULL,
	`state` text,
	`conclusion` text,
	`commit_sha` text,
	`suite_name` text,
	`duration_in_seconds` integer,
	`details_url` text,
	`message` text,
	`url` text,
	`github_created_at` text,
	`github_updated_at` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `checks_pull_request_id_idx` ON `checks` (`pull_request_id`);--> statement-breakpoint
CREATE TABLE `comment_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`content` text NOT NULL,
	`user_login` text,
	`user_id` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `comment_reactions_comment_id_idx` ON `comment_reactions` (`comment_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`review_id` text,
	`body` text,
	`path` text,
	`line` integer,
	`original_line` integer,
	`diff_hunk` text,
	`commit_id` text,
	`original_commit_id` text,
	`github_review_id` text,
	`github_review_thread_id` text,
	`parent_comment_github_id` text,
	`user_login` text,
	`user_avatar_url` text,
	`url` text,
	`github_created_at` text,
	`github_updated_at` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `comments_pull_request_id_idx` ON `comments` (`pull_request_id`);--> statement-breakpoint
CREATE TABLE `commits` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`hash` text NOT NULL,
	`message` text,
	`url` text,
	`author_login` text,
	`author_avatar_url` text,
	`lines_added` integer,
	`lines_removed` integer,
	`github_created_at` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `commits_pull_request_id_idx` ON `commits` (`pull_request_id`);--> statement-breakpoint
CREATE TABLE `modified_files` (
	`id` text PRIMARY KEY NOT NULL,
	`pull_request_id` text NOT NULL,
	`filename` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text,
	`additions` integer,
	`deletions` integer,
	`changes` integer,
	`diff_hunk` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `modified_files_pull_request_id_idx` ON `modified_files` (`pull_request_id`);--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`url` text NOT NULL,
	`repository_owner` text NOT NULL,
	`repository_name` text NOT NULL,
	`author_login` text,
	`author_avatar_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	`merged_at` text,
	`is_author` integer DEFAULT false NOT NULL,
	`is_assignee` integer DEFAULT false NOT NULL,
	`is_reviewer` integer DEFAULT false NOT NULL,
	`labels` text,
	`assignees` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`pull_request_id` text NOT NULL,
	`state` text NOT NULL,
	`body` text,
	`url` text,
	`author_login` text,
	`author_avatar_url` text,
	`github_created_at` text,
	`github_submitted_at` text,
	`synced_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `reviews_pull_request_id_idx` ON `reviews` (`pull_request_id`);