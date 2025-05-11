CREATE TABLE `course_lessons` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`content` text,
	`video_asset_id` int,
	`duration` int,
	`order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_memberships` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`membership_id` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_modules` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_progress` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`status` enum('not_started','in_progress','completed') DEFAULT 'not_started',
	`progress_percentage` int DEFAULT 0,
	`last_position` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`course_name` varchar(255) NOT NULL,
	`course_description` text,
	`course_type` enum('self_paced','instructor_led') DEFAULT 'self_paced',
	`status` enum('draft','published','archived') DEFAULT 'draft',
	`cover_image_asset_id` int,
	`host_id` int NOT NULL,
	`instructions` text,
	`landing_page_url` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `course_lessons` ADD CONSTRAINT `course_lessons_module_id_course_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_lessons` ADD CONSTRAINT `course_lessons_video_asset_id_assets_id_fk` FOREIGN KEY (`video_asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_memberships` ADD CONSTRAINT `course_memberships_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_memberships` ADD CONSTRAINT `course_memberships_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_modules` ADD CONSTRAINT `course_modules_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_progress` ADD CONSTRAINT `course_progress_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_progress` ADD CONSTRAINT `course_progress_lesson_id_course_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `course_lessons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_cover_image_asset_id_assets_id_fk` FOREIGN KEY (`cover_image_asset_id`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_host_id_user_id_fk` FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;