CREATE TABLE `team_invitations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`team_id` int NOT NULL,
	`inviter_id` int NOT NULL,
	`invitee_email` varchar(255) NOT NULL,
	`status` enum('pending','accepted','rejected') DEFAULT 'pending',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_invitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`team_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('host','member') DEFAULT 'member',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `team_invitations` ADD CONSTRAINT `team_invitations_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_invitations` ADD CONSTRAINT `team_invitations_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;