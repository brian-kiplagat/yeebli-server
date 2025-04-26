CREATE TABLE `podcast_episodes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`podcast_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`audio_asset_id` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`user_id` int NOT NULL,
	CONSTRAINT `podcast_episodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `podcasts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`cover_image_asset_id` int NOT NULL,
	`podcast_type` enum('prerecorded','link') DEFAULT 'prerecorded',
	`episode_type` enum('single','multiple') DEFAULT 'multiple',
	`host_id` int NOT NULL,
	`status` enum('draft','published','archived') DEFAULT 'draft',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`link_url` text,
	CONSTRAINT `podcasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `podcast_episodes` ADD CONSTRAINT `podcast_episodes_podcast_id_podcasts_id_fk` FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `podcast_episodes` ADD CONSTRAINT `podcast_episodes_audio_asset_id_assets_id_fk` FOREIGN KEY (`audio_asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `podcast_episodes` ADD CONSTRAINT `podcast_episodes_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `podcasts` ADD CONSTRAINT `podcasts_cover_image_asset_id_assets_id_fk` FOREIGN KEY (`cover_image_asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `podcasts` ADD CONSTRAINT `podcasts_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;