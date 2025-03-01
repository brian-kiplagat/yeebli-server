CREATE TABLE `events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`event_name` varchar(255) NOT NULL,
	`event_date` varchar(10) NOT NULL,
	`start_time` varchar(5) NOT NULL,
	`end_time` varchar(5) NOT NULL,
	`video_url` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lead_id` int,
	`host_id` int,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `status_identifier` enum('Manual','Form','Interested','Member','Inactive Member') DEFAULT 'Manual';--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;