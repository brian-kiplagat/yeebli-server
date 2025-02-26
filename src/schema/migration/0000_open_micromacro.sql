ALTER TABLE `user` ADD `role` enum('admin','user','moderator','host') DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `user` ADD `profile_picture` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `bio` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `custom_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `is_verified` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `is_banned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `is_deleted` boolean DEFAULT false;