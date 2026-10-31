ALTER TABLE `responses` ADD `resolved` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `responses` ADD `auto_resolved` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `responses` ADD `resolved_at` integer;
--> statement-breakpoint
ALTER TABLE `responses` ADD `admin_note` text;
--> statement-breakpoint
UPDATE `responses`
SET
  `resolved` = CASE
    WHEN `comment` IS NULL OR trim(`comment`) = '' THEN 1
    ELSE 0
  END,
  `auto_resolved` = CASE
    WHEN `comment` IS NULL OR trim(`comment`) = '' THEN 1
    ELSE 0
  END,
  `resolved_at` = CASE
    WHEN `comment` IS NULL OR trim(`comment`) = '' THEN `created_at`
    ELSE NULL
  END;
--> statement-breakpoint
CREATE INDEX `responses_project_resolved_created_idx` ON `responses` (`project_id`,`resolved`,`created_at`);
