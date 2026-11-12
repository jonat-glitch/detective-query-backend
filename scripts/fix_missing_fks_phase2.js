/**
 * fix_missing_fks_phase2.js
 * Fix remaining 5 FK issues:
 *  1. session_objectives.objective_id — has 67 orphaned rows (objective_id values no longer in case_objectives)
 *  2. student_invitations — column type incompatibility (tinyint vs int)
 *  3. notifications.sender_id — column is NOT NULL, needs to be NULLable first
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cfg = {
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: 'detective_query', ssl: { rejectUnauthorized: false }
};

async function run() {
  const conn = await mysql.createConnection(cfg);
  console.log('✅ Connected\n');

  // ── 1. session_objectives.objective_id ───────────────────────────────────
  // 67 rows have objective_id values that no longer exist in case_objectives
  // → NULL them out first (objective_id is the logical link, session already has session_id)
  console.log('Fix 1: Nulling orphaned session_objectives.objective_id rows...');
  const [r1] = await conn.query(`
    UPDATE session_objectives
    SET objective_id = NULL
    WHERE objective_id IS NOT NULL
      AND objective_id NOT IN (SELECT objective_id FROM case_objectives)
  `);
  console.log(`  ✅ Cleared ${r1.affectedRows} orphaned rows`);

  // Now check if column is nullable
  const [[colInfo]] = await conn.query(`
    SELECT IS_NULLABLE, DATA_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='detective_query' AND TABLE_NAME='session_objectives' AND COLUMN_NAME='objective_id'
  `);
  console.log(`  objective_id is currently: IS_NULLABLE=${colInfo.IS_NULLABLE}, TYPE=${colInfo.DATA_TYPE}`);

  if (colInfo.IS_NULLABLE === 'NO') {
    console.log('  Altering column to be NULLABLE...');
    await conn.query(`ALTER TABLE session_objectives MODIFY COLUMN objective_id INT NULL`);
    console.log('  ✅ Column is now nullable');
  }

  try {
    await conn.query(`ALTER TABLE session_objectives
      ADD CONSTRAINT fk_so_objective
      FOREIGN KEY (objective_id) REFERENCES case_objectives(objective_id)
      ON DELETE SET NULL ON UPDATE CASCADE`);
    console.log('  ✅ FK fk_so_objective applied!\n');
  } catch (e) {
    console.log(`  ⚠️ ${e.message}\n`);
  }

  // ── 2. student_invitations — fix column types then add FKs ───────────────
  console.log('Fix 2: Checking student_invitations column types...');
  const [siCols] = await conn.query(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='detective_query' AND TABLE_NAME='student_invitations'
      AND COLUMN_NAME IN ('user_id','imported_by','section_id','course_id','semester_id')
  `);
  for (const col of siCols) {
    console.log(`  ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} NULLABLE=${col.IS_NULLABLE}`);
  }

  // Check parent table types
  const parentTypes = {};
  for (const [tbl, col] of [['users','user_id'],['sections','section_id'],['courses','course_id'],['semesters','semester_id']]) {
    const [[pt]] = await conn.query(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='detective_query' AND TABLE_NAME=? AND COLUMN_NAME=?`, [tbl, col]);
    parentTypes[`${tbl}.${col}`] = pt.COLUMN_TYPE;
    console.log(`  Parent ${tbl}.${col}: ${pt.COLUMN_TYPE}`);
  }

  // Align types — cast all to INT NULL (matching users.user_id=int, sections.section_id=int etc.)
  const typeFixStatements = [
    `ALTER TABLE student_invitations MODIFY COLUMN user_id INT NULL`,
    `ALTER TABLE student_invitations MODIFY COLUMN imported_by INT NULL`,
    `ALTER TABLE student_invitations MODIFY COLUMN section_id INT NULL`,
    `ALTER TABLE student_invitations MODIFY COLUMN course_id INT NULL`,
    `ALTER TABLE student_invitations MODIFY COLUMN semester_id INT NULL`,
  ];

  for (const stmt of typeFixStatements) {
    try {
      await conn.query(stmt);
      console.log(`  ✅ ${stmt}`);
    } catch(e) { console.log(`  ⚠️ ${e.message}`); }
  }

  // Now apply FKs
  const siFKs = [
    ['fk_si_imported_by', 'imported_by', 'users',     'user_id'],
    ['fk_si_user',        'user_id',     'users',     'user_id'],
    ['fk_si_section',     'section_id',  'sections',  'section_id'],
    ['fk_si_course',      'course_id',   'courses',   'course_id'],
    ['fk_si_semester',    'semester_id', 'semesters', 'semester_id'],
  ];
  for (const [name, col, refTbl, refCol] of siFKs) {
    try {
      await conn.query(`ALTER TABLE student_invitations
        ADD CONSTRAINT ${name}
        FOREIGN KEY (${col}) REFERENCES ${refTbl}(${refCol})
        ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log(`  ✅ Applied FK ${name}`);
    } catch(e) {
      if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
        console.log(`  ⚠️ Already exists: ${name}`);
      } else {
        console.log(`  ❌ ${name}: ${e.message}`);
      }
    }
  }

  // ── 3. notifications.sender_id — make nullable first ─────────────────────
  console.log('\nFix 3: Making notifications.sender_id NULLABLE...');
  const [[nCol]] = await conn.query(`
    SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='detective_query' AND TABLE_NAME='notifications' AND COLUMN_NAME='sender_id'
  `);
  console.log(`  sender_id current: ${nCol.COLUMN_TYPE} NULLABLE=${nCol.IS_NULLABLE}`);

  if (nCol.IS_NULLABLE === 'NO') {
    await conn.query(`ALTER TABLE notifications MODIFY COLUMN sender_id INT NULL`);
    console.log('  ✅ sender_id is now nullable');
  }

  try {
    await conn.query(`ALTER TABLE notifications
      ADD CONSTRAINT fk_notif_sender
      FOREIGN KEY (sender_id) REFERENCES users(user_id)
      ON DELETE SET NULL ON UPDATE CASCADE`);
    console.log('  ✅ FK fk_notif_sender applied!\n');
  } catch(e) {
    if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
      console.log('  ⚠️ Already exists\n');
    } else {
      console.log(`  ❌ ${e.message}\n`);
    }
  }

  // ── Final count ──────────────────────────────────────────────────────────
  const [fkeys] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA='detective_query' AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log(`\n✅ FINAL FK COUNT: ${fkeys.length} constraints\n`);

  await conn.end();
}

run().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });

