CREATE TABLE `user` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`email` varchar(100) NOT NULL,
	`password` varchar(65) NOT NULL,
	`reset_token` varchar(100),
	`email_token` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	`role` enum('admin','user','moderator','host') DEFAULT 'user',
	`profile_picture` varchar(255),
	`bio` varchar(255),
	`custom_id` varchar(255),
	`is_verified` boolean DEFAULT false,
	`is_banned` boolean DEFAULT false,
	`is_deleted` boolean DEFAULT false,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
