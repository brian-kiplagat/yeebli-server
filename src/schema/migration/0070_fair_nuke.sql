CREATE TABLE `podcast_memberships` (
	`id` int NOT NULL,
	`podcast_id` int NOT NULL,
	`membership_id` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `podcast_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `podcast_memberships` ADD CONSTRAINT `podcast_memberships_podcast_id_podcasts_id_fk` FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `podcast_memberships` ADD CONSTRAINT `podcast_memberships_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;