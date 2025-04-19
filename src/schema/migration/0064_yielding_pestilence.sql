ALTER TABLE `bookings` DROP FOREIGN KEY `bookings_date_id_membership_dates_id_fk`;
--> statement-breakpoint
ALTER TABLE `bookings` DROP COLUMN `date_id`;