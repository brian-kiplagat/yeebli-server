ALTER TABLE `businesses` DROP COLUMN `presigned_logo_url`;--> statement-breakpoint
ALTER TABLE `businesses` DROP COLUMN `presigned_logo_expires_at`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `presigned_profile_picture`;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `presigned_profile_picture_expires_at`;