ALTER TABLE `courses` RENAME COLUMN `cover_image_asset_id` TO `trailer_asset_id`;--> statement-breakpoint
ALTER TABLE `courses` DROP FOREIGN KEY `courses_cover_image_asset_id_assets_id_fk`;
--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_trailer_asset_id_assets_id_fk` FOREIGN KEY (`trailer_asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;