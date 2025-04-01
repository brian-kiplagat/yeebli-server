CREATE TABLE `businesses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`address` varchar(255),
	`phone` varchar(255),
	`email` varchar(255),
	`description` text,
	`logo` varchar(255),
	`banner` varchar(255),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `businesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `business_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_business_id_businesses_id_fk` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE no action ON UPDATE no action;