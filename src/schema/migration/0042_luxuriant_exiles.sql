DROP TABLE `price_plans`;--> statement-breakpoint
ALTER TABLE `memberships` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `description` text;--> statement-breakpoint
ALTER TABLE `memberships` ADD `price` int NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `payment_type` enum('one_off','recurring') DEFAULT 'one_off';--> statement-breakpoint
ALTER TABLE `memberships` ADD `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `memberships` ADD `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;