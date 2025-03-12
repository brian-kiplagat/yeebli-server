ALTER TABLE `assets` ADD `hls_url` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `processing_status` enum('pending','processing','completed','failed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `user` ADD `phone` varchar(100) NOT NULL;