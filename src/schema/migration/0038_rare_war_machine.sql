ALTER TABLE `user` DROP FOREIGN KEY `user_business_id_businesses_id_fk`;
--> statement-breakpoint
ALTER TABLE `businesses` ADD `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `business_id`;