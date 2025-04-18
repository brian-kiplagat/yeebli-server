CREATE TABLE `event_memberships` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`membership_id` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `events` DROP FOREIGN KEY `events_membership_id_memberships_id_fk`;
--> statement-breakpoint
ALTER TABLE `event_memberships` ADD CONSTRAINT `event_memberships_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_memberships` ADD CONSTRAINT `event_memberships_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `membership_id`;