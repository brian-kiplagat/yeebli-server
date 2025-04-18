RENAME TABLE `event_dates` TO `membership_dates`;
ALTER TABLE `membership_dates` RENAME COLUMN `event_id` TO `membership_id`;


ALTER TABLE `membership_dates` DROP PRIMARY KEY;
ALTER TABLE `membership_dates` ADD PRIMARY KEY(`id`);
ALTER TABLE `events` DROP COLUMN `dates`;

ALTER TABLE `bookings` DROP FOREIGN KEY `bookings_date_id_event_dates_id_fk`;

ALTER TABLE `membership_dates` DROP FOREIGN KEY `event_dates_event_id_events_id_fk`;
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_date_id_membership_dates_id_fk` FOREIGN KEY (`date_id`) REFERENCES `membership_dates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_dates` ADD CONSTRAINT `membership_dates_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
