CREATE TABLE `tag_ownership` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tag_id` int NOT NULL,
	`lead_id` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tag_ownership_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tags` DROP FOREIGN KEY `tags_lead_id_leads_id_fk`;
--> statement-breakpoint
ALTER TABLE `tag_ownership` ADD CONSTRAINT `tag_ownership_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tag_ownership` ADD CONSTRAINT `tag_ownership_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tags` DROP COLUMN `lead_id`;