ALTER TABLE `user` ADD `google_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `google_access_token` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `auth_provider` enum('local','google') DEFAULT 'local';