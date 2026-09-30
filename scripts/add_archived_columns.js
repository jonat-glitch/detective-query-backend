const { systemDB } = require('../db');

async function migrate() {
  const tables = [
    'courses',
    'sections',
    'semesters',
    'allowed_student_numbers',
    'class_codes',
    'teacher_section_assignments'
  ];

  for (const t of tables) {
    try {
      await systemDB.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0`);
      console.log(`[Success] Added is_archived to ${t}`);
    } catch (e) {
      console.error(`[Error] on ${t}:`, e.message);
    }
  }

  process.exit(0);
}

migrate();
