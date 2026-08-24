// test-admin-queries.js
const mysql = require('mysql2/promise');

async function testAdminQueries() {
  try {
    const conn = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '4AjTs4MyTKCrsiP.root',
      password: 'Xkoew4eyG3Wlu5ZS',
      database: 'detective_query',
      ssl: { rejectUnauthorized: false }
    });

    console.log('--- 1. Testing GET /admin/users ---');
    const [users] = await conn.query(`
      SELECT 
        u.user_id, 
        u.first_name,
        u.last_name,
        u.full_name, 
        u.email, 
        u.role_id, 
        u.sex,
        u.section,
        u.student_id,
        u.teacher_id,
        u.total_points, 
        u.current_level,
        u.created_at,
        (SELECT COUNT(*) FROM user_case_progress ucp WHERE ucp.user_id = u.user_id AND (ucp.status = 'solved' OR ucp.completed_at IS NOT NULL)) AS solved_cases,
        (SELECT COALESCE(current_streak, 0) FROM user_streaks us WHERE us.user_id = u.user_id LIMIT 1) AS streak
      FROM users u
      ORDER BY u.role_id ASC, u.total_points DESC, u.created_at DESC
    `);
    console.log('✅ Users count:', users.length);

    console.log('--- 2. Testing GET /admin/cases ---');
    const [cases] = await conn.query(`
      SELECT 
        c.case_id,
        c.title,
        c.description,
        c.base_points,
        c.is_active,
        c.difficulty_id,
        d.difficulty_name,
        (SELECT COUNT(*) FROM attempts a WHERE a.case_id = c.case_id AND a.is_correct = 1) AS solved_count
      FROM cases c
      LEFT JOIN difficulty d ON c.difficulty_id = d.difficulty_id
      ORDER BY c.difficulty_id ASC, c.case_id ASC
    `);
    console.log('✅ Cases count:', cases.length);

    console.log('--- 3. Testing GET /admin/rooms ---');
    const [rooms] = await conn.query(`
      SELECT 
        r.room_id,
        r.room_name,
        r.room_code,
        r.created_at,
        u.full_name AS teacher_name,
        u.email AS teacher_email,
        (SELECT COUNT(*) FROM room_students rs WHERE rs.room_id = r.room_id) AS student_count
      FROM rooms r
      LEFT JOIN users u ON r.teacher_id = u.user_id
      ORDER BY r.created_at DESC
    `);
    console.log('✅ Rooms count:', rooms.length);

    await conn.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

testAdminQueries();
