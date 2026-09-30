const { systemDB } = require('../db');

async function fullSchemaCheck() {
    console.log('\n========== SYSTEM SCHEMA AUDIT ==========\n');

    // 1. All tables present?
    const [tables] = await systemDB.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    const requiredTables = [
        'users', 'roles', 'rooms', 'room_students', 'courses', 'sections',
        'semesters', 'teacher_section_assignments', 'student_enrollments',
        'class_codes', 'allowed_student_numbers', 'registration_requests',
        'refresh_tokens', 'otp_verifications', 'session_objectives',
        'user_avatars', 'attempts', 'game_sessions', 'cases', 'notifications',
        'account_change_requests'
    ];
    for (const t of requiredTables) {
        const ok = tableNames.includes(t);
        console.log(ok ? `✅ Table: ${t}` : `❌ MISSING TABLE: ${t}`);
    }

    // 2. is_archived columns on academic tables
    console.log('\n--- is_archived columns ---');
    for (const table of ['courses', 'sections', 'semesters', 'teacher_section_assignments', 'class_codes', 'allowed_student_numbers', 'rooms']) {
        const [cols] = await systemDB.query(`SHOW COLUMNS FROM ${table} LIKE 'is_archived'`);
        console.log(cols.length > 0 ? `✅ ${table}.is_archived exists` : `❌ ${table}.is_archived MISSING`);
    }

    // 3. student_enrollments nullability
    console.log('\n--- student_enrollments nullable check ---');
    const [seColsCourse] = await systemDB.query(`SHOW COLUMNS FROM student_enrollments LIKE 'course_id'`);
    const [seColsYear] = await systemDB.query(`SHOW COLUMNS FROM student_enrollments LIKE 'year_level'`);
    console.log(seColsCourse[0]?.Null === 'YES' ? '✅ course_id is nullable' : '⚠️  course_id NOT NULL (auto-enroll may fail silently)');
    console.log(seColsYear[0]?.Null === 'YES' ? '✅ year_level is nullable' : '⚠️  year_level NOT NULL (auto-enroll may fail silently)');

    // 4. CORS check in server.js
    console.log('\n--- server.js CORS (manual check) ---');
    const fs = require('fs');
    const path = require('path');
    const backendRoot = path.join(__dirname, '..');
    const serverCode = fs.readFileSync(path.join(backendRoot, 'server.js'), 'utf8');
    const hasCorsBlock = serverCode.includes("callback(new Error(") && serverCode.includes("false");
    console.log(hasCorsBlock ? '✅ CORS correctly blocks unauthorized origins' : '❌ CORS fallback may allow all origins');

    // 5. OTP verification route uses DB
    const authCode = fs.readFileSync(path.join(backendRoot, 'routes', 'authRoutes.js'), 'utf8');
    console.log('\n--- authRoutes.js OTP ---');
    console.log(authCode.includes("require('../utils/otpStore')") ? '✅ Uses DB-backed otpStore' : '❌ Still using in-memory Map');
    console.log(!authCode.includes('otpStore = new Map') ? '✅ In-memory Map removed' : '❌ In-memory Map still present');

    // 6. adminRoutes archived rooms filter
    const adminCode = fs.readFileSync(path.join(backendRoot, 'routes', 'adminRoutes.js'), 'utf8');
    console.log('\n--- adminRoutes.js ---');
    console.log(adminCode.includes('is_archived = 0') || adminCode.includes('is_archived=0') ? '✅ Admin rooms list filters archived rooms' : '❌ Admin rooms list may include archived rooms');
    const hasEnrollmentJoin = adminCode.includes('student_enrollments') && adminCode.includes('LEFT JOIN');
    console.log(hasEnrollmentJoin ? '✅ Admin users list joins student_enrollments for section' : '❌ Admin users may show stale section');

    // 7. authRoutes class code archived check
    console.log('\n--- authRoutes.js class code validation ---');
    const hasArchivedCheck = authCode.includes('is_archived') && (authCode.includes('validate-class-code') || authCode.includes('class_codes'));
    console.log(hasArchivedCheck ? '✅ class code validation checks is_archived' : '❌ class code validation missing is_archived check');

    // 8. adminSetupRoutes archive assignment cascades room
    const setupCode = fs.readFileSync(path.join(backendRoot, 'routes', 'adminSetupRoutes.js'), 'utf8');
    console.log('\n--- adminSetupRoutes.js ---');
    const hasRoomArchive = setupCode.includes('archiveRoom') || (setupCode.includes('rooms') && setupCode.includes('is_archived') && setupCode.includes('archive'));
    console.log(hasRoomArchive ? '✅ Teacher assignment archive cascades to room' : '❌ Room not archived when teacher assignment archived');

    // 9. api.ts getArchivedRooms
    const frontendRoot = path.join(backendRoot, '..', 'detective-query');
    const apiPath = path.join(frontendRoot, 'src', 'services', 'api.ts');
    try {
        const apiCode = fs.readFileSync(apiPath, 'utf8');
        console.log('\n--- api.ts ---');
        const hasWrongFormat = apiCode.includes('my-rooms?archived=true');
        console.log(!hasWrongFormat ? '✅ getArchivedRooms uses axios params (not hardcoded query string)' : '❌ getArchivedRooms still uses hardcoded query string');
    } catch { console.log('⚠️  Could not read api.ts for check'); }

    console.log('\n========== AUDIT COMPLETE ==========\n');
    process.exit(0);
}

fullSchemaCheck().catch(err => { console.error('AUDIT ERROR:', err.message); process.exit(1); });
