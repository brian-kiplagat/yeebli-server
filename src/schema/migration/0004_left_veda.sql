ALTER TABLE `leads` ADD `event_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `event_url`;--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `event_date`;--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `start_time`;