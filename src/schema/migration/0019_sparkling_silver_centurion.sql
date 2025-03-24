CREATE TABLE `subscription` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`user_id` int NOT NULL,
	`object` text NOT NULL,
	`amount_subtotal` int NOT NULL,
	`amount_total` int NOT NULL,
	`session_id` text NOT NULL,
	`cancel_url` text NOT NULL,
	`success_url` text NOT NULL,
	`created` int NOT NULL,
	`currency` text NOT NULL,
	`mode` text NOT NULL,
	`payment_status` text NOT NULL,
	`status` text NOT NULL,
	`subscription_id` text,
	CONSTRAINT `subscription_id` PRIMARY KEY(`id`)
);
