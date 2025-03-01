CREATE TABLE `leads` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`membership_level` varchar(50),
	`membership_active` boolean DEFAULT false,
	`form_identifier` varchar(100),
	`host_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`status_identifier` enum('Free Event','Event Interested','Membership- Silver','Membership- Gold','Membership- Platinum') DEFAULT 'Free Event',
	`user_id` int,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;