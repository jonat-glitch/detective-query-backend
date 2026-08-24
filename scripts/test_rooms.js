const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4AjTs4MyTKCrsiP.root',
    password: 'Xkoew4eyG3Wlu5ZS',
    database: 'detective_query',
    ssl: { rejectUnauthorized: false }
  });

  const [rows] = await conn.query(`
    SELECT
      r.room_id,
      r.room_name,
      r.room_code,
      u.full_name AS teacher_name,
      CASE
        WHEN MAX(gs.status) = 'Active' AND MAX(gs.end_time) <= NOW() THEN 'ended'
        WHEN MAX(gs.status) IS NOT NULL THEN LOWER(MAX(gs.status))
        ELSE 'scheduled'
      END AS status,
      MAX(gs.difficulty_id) AS difficulty,
      CASE
          WHEN MAX(gs.status) = 'Active' AND MAX(gs.end_time) > NOW() THEN
              GREATEST(
                  MAX(gs.personal_time_limit) -
                  TIMESTAMPDIFF(MINUTE, MAX(gs.start_time), NOW()),
                  0
              )
          ELSE NULL
      END AS room_duration,
      COUNT(rs.student_id) AS student_count
    FROM rooms r
    JOIN users u ON r.teacher_id = u.user_id
    LEFT JOIN (
        SELECT * FROM game_sessions WHERE status = 'Active' OR status = 'active'
    ) gs ON gs.room_id = r.room_id
    LEFT JOIN room_students rs ON rs.room_id = r.room_id AND rs.status = 'Approved'
    GROUP BY r.room_id, r.room_name, r.room_code, u.full_name
  `);

  console.log('FIXED QUERY RESULT (' + rows.length + ' rooms):');
  rows.forEach(r => console.log(' -', r.room_name, '|', r.teacher_name, '| status:', r.status));
  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
