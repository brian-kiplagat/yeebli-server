ALTER TABLE `assets` MODIFY COLUMN `asset_type` enum('image','video','audio','document','profile_picture') DEFAULT 'image';--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `event_id` int;--> statement-breakpoint
ALTER TABLE `user` ADD `presigned_profile_picture` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `presigned_profile_picture_expires_at` timestamp;