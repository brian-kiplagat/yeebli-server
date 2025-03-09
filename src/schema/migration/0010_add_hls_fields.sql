ALTER TABLE `assets` 
ADD COLUMN `hls_url` text,
ADD COLUMN `processing_status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending'; 