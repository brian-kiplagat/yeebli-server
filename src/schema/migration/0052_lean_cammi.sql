ALTER TABLE `payments` DROP INDEX `payments_stripe_payment_intent_id_unique`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `stripe_payment_intent_id`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `error_message`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `refund_status`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `refunded_amount`;