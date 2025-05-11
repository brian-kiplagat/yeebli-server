ALTER TABLE `leads` DROP FOREIGN KEY `leads_user_id_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `leads` DROP COLUMN `user_id`;