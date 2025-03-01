ALTER TABLE `events` MODIFY COLUMN `lead_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `host_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `event_description` varchar(255);