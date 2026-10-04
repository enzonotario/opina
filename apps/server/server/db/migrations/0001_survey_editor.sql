ALTER TABLE `surveys` ADD `name` text DEFAULT 'Survey' NOT NULL;
--> statement-breakpoint
ALTER TABLE `surveys` ADD `thanks` text;
--> statement-breakpoint
ALTER TABLE `surveys` ADD `appearance` text DEFAULT '{}' NOT NULL;
