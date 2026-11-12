const { systemDB: db, playgroundDB } = require('../db');

const tables = [
  'users','roles','cases','case_objectives','rooms','room_students',
  'game_sessions','attempts','user_case_progress','session_objectives',
  'notifications','refresh_tokens','semesters','courses','sections',
  'class_codes','student_enrollments','teacher_section_assignments',
  'allowed_student_numbers','datasets','difficulty','case_study_materials',
  'case_notes','achievements','user_achievements','user_badges',
  'user_avatars','user_streaks','account_change_requests',
  'registration_requests','student_invitations','otp_verifications'
];

async function run() {
  const results = {};
  for (const t of tables) {
    try {
      const [rows] = await db.query('SHOW FULL COLUMNS FROM `' + t + '`');
      results[t] = rows.map(r => ({
        Field: r.Field,
        Type: r.Type,
        Null: r.Null,
        Key: r.Key,
        Default: r.Default,
        Extra: r.Extra,
        Comment: r.Comment
      }));
    } catch(e) {
      results[t] = { error: e.message };
    }
  }
  // Also get foreign keys from system DB
  try {
    const [fkRows] = await db.query(`
      SELECT 
        TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    results['__foreign_keys__'] = fkRows;
  } catch(e) {
    results['__foreign_keys__'] = { error: e.message };
  }

  // Playground DB tables
  const pgTables = ['suspects','evidence','locations','officers','witnesses'];
  for (const t of pgTables) {
    try {
      const [rows] = await playgroundDB.query('SHOW FULL COLUMNS FROM `' + t + '`');
      results['playground__' + t] = rows.map(r => ({
        Field: r.Field, Type: r.Type, Null: r.Null,
        Key: r.Key, Default: r.Default, Extra: r.Extra, Comment: r.Comment
      }));
    } catch(e) {
      results['playground__' + t] = { error: e.message };
    }
  }

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
