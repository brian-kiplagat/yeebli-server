CREATE TABLE `subscription_plans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`stripe_price_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`billing_interval` enum('month','year') NOT NULL,
	`features` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_account_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_account_status` enum('pending','active','rejected','restricted') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `user` ADD `subscription_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `subscription_status` enum('trialing','active','past_due','canceled','incomplete','incomplete_expired','paused','unpaid');--> statement-breakpoint
ALTER TABLE `user` ADD `subscription_plan_id` int;--> statement-breakpoint
ALTER TABLE `user` ADD `trial_ends_at` timestamp;--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_oauth_state` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_subscription_plan_id_subscription_plans_id_fk` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;