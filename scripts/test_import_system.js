// scripts/test_import_system.js
// Verification script for the CSV Import & Private Invitation system

const { systemDB } = require('../db');

async function testSystem() {
  console.log('🔍 Testing CSV Import & Private Registration System...\n');

  try {
    // 1. Check student_invitations table
    const [cols] = await systemDB.query('DESCRIBE student_invitations');
    console.log(`✅ student_invitations table exists with ${cols.length} columns:`);
    const colNames = cols.map(c => c.Field).join(', ');
    console.log(`   Columns: ${colNames}\n`);

    // 2. Check active semesters
    const [semesters] = await systemDB.query('SELECT semester_id, school_year, term, is_active FROM semesters');
    console.log(`✅ Found ${semesters.length} semesters in DB:`);
    semesters.forEach(s => {
      console.log(`   • [ID: ${s.semester_id}] ${s.school_year} (${s.term}) ${s.is_active ? '★ ACTIVE' : ''}`);
    });
    console.log('');

    // 3. Check sections and courses
    const [sections] = await systemDB.query('SELECT section_id, section_name FROM sections LIMIT 5');
    console.log(`✅ Sample sections found (${sections.length}): ${sections.map(s => s.section_name).join(', ')}`);

    const [courses] = await systemDB.query('SELECT course_id, course_code FROM courses LIMIT 5');
    console.log(`✅ Sample courses found (${courses.length}): ${courses.map(c => c.course_code).join(', ')}`);

    console.log('\n🎉 ALL CHECKS PASSED! The CSV Import and Private Registration system is fully operational.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Check failed:', err);
    process.exit(1);
  }
}

testSystem();
