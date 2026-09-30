-- ============================================================
-- Migration 003: Bug Fixes (System Audit)
-- Run ONCE against your detective_query database
-- ============================================================

-- ─────────────────────────────────────────────
-- BUG-04/05: Add is_archived + archived_at to all academic tables
-- ─────────────────────────────────────────────

-- courses
ALTER TABLE `courses`
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `archived_at` DATETIME NULL;

-- sections
ALTER TABLE `sections`
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `archived_at` DATETIME NULL;

-- semesters
ALTER TABLE `semesters`
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `archived_at` DATETIME NULL;

-- allowed_student_numbers
ALTER TABLE `allowed_student_numbers`
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `archived_at` DATETIME NULL;

-- class_codes
ALTER TABLE `class_codes`
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `archived_at` DATETIME NULL;

-- teacher_section_assignments
ALTER TABLE `teacher_section_assignments`
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `archived_at` DATETIME NULL;

-- ─────────────────────────────────────────────
-- BUG-02: Fix student_enrollments NOT NULL columns — make nullable
-- so auto-enrollment works even when course_id / year_level is unknown
-- ─────────────────────────────────────────────

ALTER TABLE `student_enrollments`
  MODIFY COLUMN `course_id`  INT NULL,
  MODIFY COLUMN `year_level` TINYINT NULL;

-- ─────────────────────────────────────────────
-- BUG-03: Fix courses unique key to allow same code with different names
-- Drop old unique-on-code-only key, add composite unique key
-- ─────────────────────────────────────────────

ALTER TABLE `courses` DROP INDEX IF EXISTS `uq_course_code`;
ALTER TABLE `courses` ADD UNIQUE INDEX IF NOT EXISTS `uq_course_code_name` (`course_code`, `course_name`);

-- ─────────────────────────────────────────────
-- BUG-15: Create session_objectives table if missing
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `session_objectives` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `user_id`    INT NOT NULL,
  `session_id` INT NULL,
  `case_id`    INT NULL,
  `objective`  TEXT NULL,
  `is_met`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- BUG-16: Create user_avatars table if missing
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `user_avatars` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `user_id`   INT NOT NULL,
  `file_name` VARCHAR(255) NULL,
  `mime_type` VARCHAR(100) NULL,
  `file_data` LONGBLOB NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_avatar` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- BUG-12: Add index on section transfer (not a bug fix, but safety)
-- Allow re-enrollment by changing UNIQUE key to include section_id
-- (one enrollment per user per semester per section)
-- ─────────────────────────────────────────────

-- First drop the old constraint if it exists, then recreate it with section_id included
ALTER TABLE `student_enrollments` DROP INDEX IF EXISTS `uq_enrollment`;
ALTER TABLE `student_enrollments` ADD UNIQUE INDEX IF NOT EXISTS `uq_enrollment_section` (`user_id`, `semester_id`, `section_id`);

-- ─────────────────────────────────────────────
-- Verification: Show newly added columns
-- ─────────────────────────────────────────────
-- SELECT 'Migration 003 complete' AS status;
