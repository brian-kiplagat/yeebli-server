CREATE TABLE `memberships` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `membership_level`;--> statement-breakpoint
ALTER TABLE `leads` DROP FOREIGN KEY `leads_lead_status_membership_level_id_fk`;
--> statement-breakpoint
ALTER TABLE `events` ADD `event_type` enum('live_venue','prerecorded','live_video_call') DEFAULT 'prerecorded';--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_lead_status_memberships_id_fk` FOREIGN KEY (`lead_status`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;