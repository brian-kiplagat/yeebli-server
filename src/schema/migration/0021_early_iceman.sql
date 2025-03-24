DROP TABLE `subscription_plans`;--> statement-breakpoint
ALTER TABLE `user` DROP FOREIGN KEY `user_subscription_plan_id_subscription_plans_id_fk`;
--> statement-breakpoint
ALTER TABLE `events` ADD `other_dates` json;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `subscription_plan_id`;