ALTER TABLE `businesses` RENAME COLUMN `logo` TO `logo_asset_id`;--> statement-breakpoint
ALTER TABLE `businesses` MODIFY COLUMN `logo_asset_id` int;--> statement-breakpoint
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_logo_asset_id_assets_id_fk` FOREIGN KEY (`logo_asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;