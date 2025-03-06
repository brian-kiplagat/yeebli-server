ALTER TABLE `events` RENAME COLUMN `video_url` TO `asset_id`;--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `asset_id` int;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_asset_id_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;