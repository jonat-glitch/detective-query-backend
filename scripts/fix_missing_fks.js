/**
 * fix_missing_fks.js
 * Step 1: Pre-flight check for orphaned data
 * Step 2: Apply all missing FK constraints
 * Step 3: Verify all FKs are now in place
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cfg = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function run() {
  const conn = await mysql.createConnection(cfg);
  console.log('✅ Connected to TiDB Cloud\n');

  // ═══════════════════════════════════════════════════════════
  // STEP 1: PRE-FLIGHT — Check for orphaned/invalid values
  // ═══════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════');
  console.log('STEP 1: PRE-FLIGHT DATA INTEGRITY CHECK');
  console.log('═══════════════════════════════════════════════\n');

  const checks = [
    // case_notes
    {
      label: 'case_notes.user_id → users.user_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM case_notes cn LEFT JOIN users u ON cn.user_id = u.user_id WHERE cn.user_id IS NOT NULL AND u.user_id IS NULL`
    },
    {
      label: 'case_notes.case_id → cases.case_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM case_notes cn LEFT JOIN cases c ON cn.case_id = c.case_id WHERE cn.case_id IS NOT NULL AND c.case_id IS NULL`
    },
    // session_objectives
    {
      label: 'session_objectives.user_id → users.user_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM session_objectives so LEFT JOIN users u ON so.user_id = u.user_id WHERE so.user_id IS NOT NULL AND u.user_id IS NULL`
    },
    {
      label: 'session_objectives.objective_id → case_objectives.objective_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM session_objectives so LEFT JOIN case_objectives co ON so.objective_id = co.objective_id WHERE so.objective_id IS NOT NULL AND co.objective_id IS NULL`
    },
    // student_invitations
    {
      label: 'student_invitations.user_id → users.user_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM student_invitations si LEFT JOIN users u ON si.user_id = u.user_id WHERE si.user_id IS NOT NULL AND u.user_id IS NULL`
    },
    {
      label: 'student_invitations.imported_by → users.user_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM student_invitations si LEFT JOIN users u ON si.imported_by = u.user_id WHERE si.imported_by IS NOT NULL AND u.user_id IS NULL`
    },
    {
      label: 'student_invitations.section_id → sections.section_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM student_invitations si LEFT JOIN sections s ON si.section_id = s.section_id WHERE si.section_id IS NOT NULL AND s.section_id IS NULL`
    },
    {
      label: 'student_invitations.course_id → courses.course_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM student_invitations si LEFT JOIN courses c ON si.course_id = c.course_id WHERE si.course_id IS NOT NULL AND c.course_id IS NULL`
    },
    {
      label: 'student_invitations.semester_id → semesters.semester_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM student_invitations si LEFT JOIN semesters s ON si.semester_id = s.semester_id WHERE si.semester_id IS NOT NULL AND s.semester_id IS NULL`
    },
    // notifications.sender_id
    {
      label: 'notifications.sender_id → users.user_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM notifications n LEFT JOIN users u ON n.sender_id = u.user_id WHERE n.sender_id IS NOT NULL AND u.user_id IS NULL`
    },
    // case_study_materials.uploaded_by
    {
      label: 'case_study_materials.uploaded_by → users.user_id (orphaned)',
      sql: `SELECT COUNT(*) AS cnt FROM case_study_materials csm LEFT JOIN users u ON csm.uploaded_by = u.user_id WHERE csm.uploaded_by IS NOT NULL AND u.user_id IS NULL`
    },
  ];

  let allClear = true;
  for (const chk of checks) {
    const [[row]] = await conn.query(chk.sql);
    const status = row.cnt === 0 ? '✅ CLEAN' : `❌ ${row.cnt} ORPHANED ROWS`;
    if (row.cnt > 0) allClear = false;
    console.log(`  ${status}  — ${chk.label}`);
  }

  if (!allClear) {
    console.log('\n❌ Orphaned data found. Cleaning up before applying FKs...');
    // NULL out orphaned sender_id values (safe — sender_id will be nullable)
    await conn.query(`UPDATE notifications SET sender_id = NULL WHERE sender_id IS NOT NULL AND sender_id NOT IN (SELECT user_id FROM users)`);
    await conn.query(`UPDATE case_study_materials SET uploaded_by = NULL WHERE uploaded_by IS NOT NULL AND uploaded_by NOT IN (SELECT user_id FROM users)`);
    console.log('  ✅ Nullable orphans cleared.\n');
  } else {
    console.log('\n✅ All pre-flight checks passed. No orphaned data.\n');
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: APPLY MISSING FK CONSTRAINTS
  // ═══════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════');
  console.log('STEP 2: APPLYING MISSING FK CONSTRAINTS');
  console.log('═══════════════════════════════════════════════\n');

  const alterStatements = [
    // ── case_notes ───────────────────────────────────────────
    {
      label: 'case_notes.user_id → users.user_id',
      sql: `ALTER TABLE case_notes
              ADD CONSTRAINT fk_cn_user
              FOREIGN KEY (user_id) REFERENCES users(user_id)
              ON DELETE CASCADE ON UPDATE CASCADE`
    },
    {
      label: 'case_notes.case_id → cases.case_id',
      sql: `ALTER TABLE case_notes
              ADD CONSTRAINT fk_cn_case
              FOREIGN KEY (case_id) REFERENCES cases(case_id)
              ON DELETE CASCADE ON UPDATE CASCADE`
    },
    // ── session_objectives ───────────────────────────────────
    {
      label: 'session_objectives.user_id → users.user_id',
      sql: `ALTER TABLE session_objectives
              ADD CONSTRAINT fk_so_user
              FOREIGN KEY (user_id) REFERENCES users(user_id)
              ON DELETE CASCADE ON UPDATE CASCADE`
    },
    {
      label: 'session_objectives.objective_id → case_objectives.objective_id',
      sql: `ALTER TABLE session_objectives
              ADD CONSTRAINT fk_so_objective
              FOREIGN KEY (objective_id) REFERENCES case_objectives(objective_id)
              ON DELETE CASCADE ON UPDATE CASCADE`
    },
    // ── student_invitations ──────────────────────────────────
    {
      label: 'student_invitations.imported_by → users.user_id (teacher who imported)',
      sql: `ALTER TABLE student_invitations
              ADD CONSTRAINT fk_si_imported_by
              FOREIGN KEY (imported_by) REFERENCES users(user_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
    {
      label: 'student_invitations.user_id → users.user_id (linked account after registration)',
      sql: `ALTER TABLE student_invitations
              ADD CONSTRAINT fk_si_user
              FOREIGN KEY (user_id) REFERENCES users(user_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
    {
      label: 'student_invitations.section_id → sections.section_id',
      sql: `ALTER TABLE student_invitations
              ADD CONSTRAINT fk_si_section
              FOREIGN KEY (section_id) REFERENCES sections(section_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
    {
      label: 'student_invitations.course_id → courses.course_id',
      sql: `ALTER TABLE student_invitations
              ADD CONSTRAINT fk_si_course
              FOREIGN KEY (course_id) REFERENCES courses(course_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
    {
      label: 'student_invitations.semester_id → semesters.semester_id',
      sql: `ALTER TABLE student_invitations
              ADD CONSTRAINT fk_si_semester
              FOREIGN KEY (semester_id) REFERENCES semesters(semester_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
    // ── notifications ────────────────────────────────────────
    {
      label: 'notifications.sender_id → users.user_id (nullable — system notifications)',
      sql: `ALTER TABLE notifications
              ADD CONSTRAINT fk_notif_sender
              FOREIGN KEY (sender_id) REFERENCES users(user_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
    // ── case_study_materials ─────────────────────────────────
    {
      label: 'case_study_materials.uploaded_by → users.user_id (nullable)',
      sql: `ALTER TABLE case_study_materials
              ADD CONSTRAINT fk_csm_uploader
              FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
              ON DELETE SET NULL ON UPDATE CASCADE`
    },
  ];

  for (const stmt of alterStatements) {
    try {
      await conn.query(stmt.sql);
      console.log(`  ✅ Applied: ${stmt.label}`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEY' || err.message.includes('Duplicate key') || err.message.includes('already exists')) {
        console.log(`  ⚠️  Already exists: ${stmt.label}`);
      } else {
        console.log(`  ❌ FAILED: ${stmt.label}`);
        console.log(`     Error: ${err.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: VERIFY — List all FKs now
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════');
  console.log('STEP 3: VERIFICATION — All FK Constraints Now');
  console.log('═══════════════════════════════════════════════\n');

  const [fkeys] = await conn.query(`
    SELECT
      TABLE_NAME       AS child_table,
      COLUMN_NAME      AS fk_column,
      CONSTRAINT_NAME  AS fk_name,
      REFERENCED_TABLE_NAME   AS parent_table,
      REFERENCED_COLUMN_NAME  AS ref_col
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'detective_query'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);

  console.log(`Total FK constraints: ${fkeys.length}\n`);
  for (const fk of fkeys) {
    console.log(`  ${fk.child_table}.${fk.fk_column}  →  ${fk.parent_table}.${fk.ref_col}  [${fk.fk_name}]`);
  }

  await conn.end();
  console.log('\n✅ All done!');
}

run().catch(err => { console.error('\n❌ Fatal Error:', err.message); process.exit(1); });
