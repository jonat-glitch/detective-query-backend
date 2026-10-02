// scripts/migrate_student_invitations.js
// Run: node scripts/migrate_student_invitations.js
// Creates the student_invitations table used by the CSV import onboarding system.

const { systemDB } = require('../db');

async function migrate() {
  console.log('🔧 Running migration: student_invitations table...');

  try {
    await systemDB.query(`
      CREATE TABLE IF NOT EXISTS student_invitations (
        invitation_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        -- From CSV / registrar
        email               VARCHAR(191) NOT NULL,
        first_name          VARCHAR(100),
        middle_name         VARCHAR(100),
        last_name           VARCHAR(100),
        extension_name      VARCHAR(50),
        student_number      VARCHAR(100),

        -- Academic assignment (pre-assigned at import time)
        section_id          INT UNSIGNED,
        course_id           INT UNSIGNED,
        year_level          TINYINT UNSIGNED,
        semester_id         INT UNSIGNED,

        -- Invite token for private setup link
        invite_token        VARCHAR(128) NOT NULL,
        token_expires_at    DATETIME NOT NULL,

        -- Status tracking
        status              ENUM('pending','completed','expired','cancelled') NOT NULL DEFAULT 'pending',

        -- Batch grouping (one import session = one batch_id)
        import_batch_id     VARCHAR(64),
        imported_by         INT UNSIGNED,

        -- Timestamps
        invited_at          DATETIME DEFAULT NOW(),
        completed_at        DATETIME,
        resent_at           DATETIME,

        -- Once completed, store resulting user_id
        user_id             INT UNSIGNED,

        UNIQUE KEY uq_email_batch (email, import_batch_id),
        KEY idx_invite_token (invite_token),
        KEY idx_batch (import_batch_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ student_invitations table created (or already exists).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
