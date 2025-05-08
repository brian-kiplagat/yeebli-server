RENAME TABLE `tag_ownership` TO `tag_assignment`;--> statement-breakpoint
ALTER TABLE `tag_assignment` DROP FOREIGN KEY `tag_ownership_tag_id_tags_id_fk`;
--> statement-breakpoint
ALTER TABLE `tag_assignment` DROP FOREIGN KEY `tag_ownership_lead_id_leads_id_fk`;
--> statement-breakpoint
ALTER TABLE `tag_assignment` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `tag_assignment` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `tag_assignment` ADD CONSTRAINT `tag_assignment_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tag_assignment` ADD CONSTRAINT `tag_assignment_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;