CREATE TABLE `assets` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`asset_name` varchar(255) NOT NULL,
	`asset_type` enum('image','video','audio','document') DEFAULT 'image',
	`asset_url` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`user_id` int NOT NULL,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `events` DROP FOREIGN KEY `events_lead_id_leads_id_fk`;
--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `lead_id`;