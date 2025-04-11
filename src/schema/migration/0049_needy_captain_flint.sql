ALTER TABLE `events` RENAME COLUMN `lead_level` TO `membership_id`;--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `membership_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `role` enum('master','owner','host') DEFAULT 'host';--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;