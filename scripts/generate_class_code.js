const { systemDB } = require('../db');
const crypto = require('crypto');

async function main() {
  try {
    const arg = process.argv[2];

    // If "list" command: show all current class codes and sections
    if (arg === 'list') {
      const [codes] = await systemDB.query(`
        SELECT cc.code_id, cc.code, cc.is_active, cc.expires_at, cc.is_archived,
               s.section_name, sem.school_year, sem.term
        FROM class_codes cc
        LEFT JOIN sections  s   ON s.section_id   = cc.section_id
        LEFT JOIN semesters sem ON sem.semester_id = cc.semester_id
        ORDER BY cc.created_at DESC
      `);
      console.log('\n=== CURRENT CLASS CODES ===');
      console.table(codes.map(c => ({
        ID: c.code_id,
        Code: c.code,
        Section: c.section_name,
        Semester: `${c.school_year} (${c.term})`,
        Active: c.is_active ? 'YES' : 'NO',
        Archived: c.is_archived ? 'YES' : 'NO',
        Expires: c.expires_at ? new Date(c.expires_at).toISOString().split('T')[0] : 'Never'
      })));

      const [secs] = await systemDB.query('SELECT section_id, section_name FROM sections WHERE is_archived = 0');
      console.log('Available Sections to generate for:', secs.map(s => s.section_name).join(', '));
      process.exit(0);
    }

    // 1. Get Active Semester
    const [sems] = await systemDB.query(
      'SELECT semester_id, school_year, term FROM semesters WHERE is_active = 1 LIMIT 1'
    );
    if (sems.length === 0) {
      console.error('❌ Error: No active semester found in the database. Please activate a semester in Admin Setup.');
      process.exit(1);
    }
    const sem = sems[0];

    // 2. Get Section
    const targetSection = (arg || '4F').toUpperCase().trim();
    const [secs] = await systemDB.query(
      'SELECT section_id, section_name FROM sections WHERE UPPER(section_name) = ? AND is_archived = 0',
      [targetSection]
    );

    if (secs.length === 0) {
      const [allSecs] = await systemDB.query('SELECT section_name FROM sections WHERE is_archived = 0');
      console.error(`❌ Section "${targetSection}" not found!`);
      console.log(`Available active sections: ${allSecs.map(s => s.section_name).join(', ')}`);
      console.log(`Usage: node scripts/generate_class_code.js <SECTION_NAME>`);
      console.log(`Example: node scripts/generate_class_code.js 4F`);
      process.exit(1);
    }
    const sec = secs[0];

    // 3. Format Code: <SECTION>-<TERM>-<HEX>
    const secPart = sec.section_name.replace(/[^A-Z0-9]/g, '');
    const termPart = String(sem.term).replace(/[^0-9]/g, '') || '1';
    const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${secPart}-${termPart}-${randPart}`;

    // 180 days validity
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 180);

    const [adminRows] = await systemDB.query('SELECT user_id FROM users WHERE role_id = 3 LIMIT 1');
    const adminId = adminRows[0]?.user_id || 12;

    // 4. Insert into class_codes
    const [result] = await systemDB.query(
      `INSERT INTO class_codes (code, section_id, semester_id, is_active, expires_at, created_by, is_archived)
       VALUES (?, ?, ?, 1, ?, ?, 0)`,
      [code, sec.section_id, sem.semester_id, expiryDate, adminId]
    );

    console.log('\n======================================================');
    console.log('🎉 CLASS CODE GENERATED AND SAVED TO DATABASE!');
    console.log('======================================================');
    console.log(`📋 Class Code:   ${code}`);
    console.log(`🏫 Section:      ${sec.section_name} (ID: ${sec.section_id})`);
    console.log(`📅 Semester:     ${sem.school_year} ${sem.term} Term (Active)`);
    console.log(`⏳ Expiration:   ${expiryDate.toISOString().split('T')[0]} (Valid 180 days)`);
    console.log(`🔑 DB Code ID:   ${result.insertId}`);
    console.log('======================================================');
    console.log(`👉 Students can now input "${code}" at the /register page.\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error generating class code:', err);
    process.exit(1);
  }
}

main();
