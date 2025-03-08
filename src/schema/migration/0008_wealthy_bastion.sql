ALTER TABLE `events` MODIFY COLUMN `event_description` text;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `password` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `reset_token` varchar(255);--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `email_token` varchar(255);