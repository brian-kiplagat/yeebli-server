CREATE TABLE `callbacks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`callback_type` enum('instant','scheduled') NOT NULL,
	`scheduled_time` timestamp,
	`status` enum('called','uncalled') DEFAULT 'uncalled',
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `callbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `callbacks` ADD CONSTRAINT `callbacks_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;