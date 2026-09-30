-- ============================================================
-- Migration 002: Schema Normalization (Instructor Feedback)
-- Run ONCE against your detective_query database
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. COURSES  (3NF: removed from users table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `courses` (
  `course_id`   INT          NOT NULL AUTO_INCREMENT,
  `course_code` VARCHAR(20)  NOT NULL,
  `course_name` VARCHAR(100) NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `uq_course_code` (`course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 2. SECTIONS  (separate lookup table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sections` (
  `section_id`   INT         NOT NULL AUTO_INCREMENT,
  `section_name` VARCHAR(20) NOT NULL,
  `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`section_id`),
  UNIQUE KEY `uq_section_name` (`section_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 3. SEMESTERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `semesters` (
  `semester_id` INT         NOT NULL AUTO_INCREMENT,
  `school_year` VARCHAR(20) NOT NULL,
  `term`        ENUM('1st','2nd','Summer') NOT NULL,
  `is_active`   TINYINT(1)  NOT NULL DEFAULT 0,
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`semester_id`),
  UNIQUE KEY `uq_semester` (`school_year`, `term`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 4. STUDENT ENROLLMENTS  (bridging table: user ↔ course + year_level + section per semester)
-- year_level and section_id are SEPARATE columns here — NOT on users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `student_enrollments` (
  `enrollment_id` INT        NOT NULL AUTO_INCREMENT,
  `user_id`       INT        NOT NULL,
  `course_id`     INT        NOT NULL,
  `year_level`    TINYINT    NOT NULL COMMENT '1=1st year, 2=2nd year, etc.',
  `section_id`    INT        NOT NULL,
  `semester_id`   INT        NOT NULL,
  `created_at`    DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `uq_enrollment` (`user_id`, `semester_id`),
  KEY `idx_section_semester` (`section_id`, `semester_id`),
  CONSTRAINT `fk_enroll_user`     FOREIGN KEY (`user_id`)     REFERENCES `users`(`user_id`)         ON DELETE CASCADE,
  CONSTRAINT `fk_enroll_course`   FOREIGN KEY (`course_id`)   REFERENCES `courses`(`course_id`)     ON DELETE RESTRICT,
  CONSTRAINT `fk_enroll_section`  FOREIGN KEY (`section_id`)  REFERENCES `sections`(`section_id`)   ON DELETE RESTRICT,
  CONSTRAINT `fk_enroll_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`semester_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 5. TEACHER SECTION ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `teacher_section_assignments` (
  `assignment_id` INT          NOT NULL AUTO_INCREMENT,
  `teacher_id`    INT          NOT NULL,
  `section_id`    INT          NOT NULL,
  `course_id`     INT          NOT NULL,
  `year_level`    TINYINT      NOT NULL,
  `semester_id`   INT          NOT NULL,
  `subject_name`  VARCHAR(100) NOT NULL COMMENT 'e.g. Database Management Systems',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`assignment_id`),
  UNIQUE KEY `uq_teacher_section_sem` (`teacher_id`, `section_id`, `semester_id`),
  KEY `idx_teacher_semester` (`teacher_id`, `semester_id`),
  CONSTRAINT `fk_tsa_teacher`   FOREIGN KEY (`teacher_id`)  REFERENCES `users`(`user_id`)         ON DELETE CASCADE,
  CONSTRAINT `fk_tsa_section`   FOREIGN KEY (`section_id`)  REFERENCES `sections`(`section_id`)   ON DELETE RESTRICT,
  CONSTRAINT `fk_tsa_course`    FOREIGN KEY (`course_id`)   REFERENCES `courses`(`course_id`)     ON DELETE RESTRICT,
  CONSTRAINT `fk_tsa_semester`  FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`semester_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 6. ALLOWED STUDENT NUMBERS  (admin pre-loads before semester)
-- Registration is blocked if student number is not here
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `allowed_student_numbers` (
  `id`             INT         NOT NULL AUTO_INCREMENT,
  `student_number` VARCHAR(50) NOT NULL,
  `email_hint`     VARCHAR(255)    NULL COMMENT 'Expected email, optional',
  `section_id`     INT             NULL,
  `course_id`      INT             NULL,
  `year_level`     TINYINT         NULL,
  `semester_id`    INT             NULL,
  `is_used`        TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '1 = already registered',
  `created_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_number` (`student_number`),
  CONSTRAINT `fk_asn_section`   FOREIGN KEY (`section_id`)  REFERENCES `sections`(`section_id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_asn_course`    FOREIGN KEY (`course_id`)   REFERENCES `courses`(`course_id`)     ON DELETE SET NULL,
  CONSTRAINT `fk_asn_semester`  FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`semester_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 7. CLASS CODES  (teacher/admin generates per section+semester)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `class_codes` (
  `code_id`     INT         NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(20) NOT NULL,
  `section_id`  INT             NULL,
  `semester_id` INT             NULL,
  `is_active`   TINYINT(1)  NOT NULL DEFAULT 1,
  `expires_at`  DATETIME        NULL,
  `created_by`  INT             NULL COMMENT 'user_id of admin/teacher who created it',
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`code_id`),
  UNIQUE KEY `uq_class_code` (`code`),
  CONSTRAINT `fk_cc_section`   FOREIGN KEY (`section_id`)  REFERENCES `sections`(`section_id`)   ON DELETE SET NULL,
  CONSTRAINT `fk_cc_semester`  FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`semester_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cc_creator`   FOREIGN KEY (`created_by`)  REFERENCES `users`(`user_id`)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- 8. ADD MISSING COLUMNS TO users
-- (one statement per column for TiDB compatibility)
-- ─────────────────────────────────────────────
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `middle_name`    VARCHAR(100) NULL AFTER `first_name`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `extension_name` VARCHAR(20)  NULL AFTER `last_name`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `gender`         ENUM('Male','Female','Other','Prefer not to say') NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `civil_status`   ENUM('Single','Married','Widowed','Separated') NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `birthday`       DATE NULL;

-- ─────────────────────────────────────────────
-- 9. ADD MISSING COLUMNS TO registration_requests
-- ─────────────────────────────────────────────
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `middle_name`    VARCHAR(100) NULL AFTER `first_name`;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `extension_name` VARCHAR(20)  NULL AFTER `last_name`;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `gender`         ENUM('Male','Female','Other','Prefer not to say') NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `civil_status`   ENUM('Single','Married','Widowed','Separated') NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `birthday`       DATE NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `class_code`     VARCHAR(20)  NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `student_number` VARCHAR(50)  NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `section_id`     INT NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `course_id`      INT NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `year_level`     TINYINT NULL;
ALTER TABLE `registration_requests` ADD COLUMN IF NOT EXISTS `semester_id`    INT NULL;

-- ─────────────────────────────────────────────
-- 10. ADD MISSING COLUMNS TO rooms
-- ─────────────────────────────────────────────
ALTER TABLE `rooms` ADD COLUMN IF NOT EXISTS `section_id`  INT NULL;
ALTER TABLE `rooms` ADD COLUMN IF NOT EXISTS `semester_id` INT NULL;
ALTER TABLE `rooms` ADD COLUMN IF NOT EXISTS `course_id`   INT NULL;
ALTER TABLE `rooms` ADD COLUMN IF NOT EXISTS `year_level`  TINYINT NULL;

-- ─────────────────────────────────────────────
-- 11. SEED: Initial semester (current, set active)
-- Update school_year and term to match your current semester
-- ─────────────────────────────────────────────
INSERT IGNORE INTO `semesters` (`school_year`, `term`, `is_active`)
VALUES ('2025-2026', '1st', 1);
