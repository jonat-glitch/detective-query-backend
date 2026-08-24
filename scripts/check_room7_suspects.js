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

  const [students] = await conn.query(`
    SELECT rs.*, u.full_name, u.email
    FROM room_students rs
    JOIN users u ON rs.student_id = u.user_id
    WHERE rs.room_id = 7
  `);
  console.log('ROOM 7 STUDENTS:', JSON.stringify(students, null, 2));

  // Let's test the queries on playgroundDB
  const connPlayground = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4AjTs4MyTKCrsiP.root',
    password: 'Xkoew4eyG3Wlu5ZS',
    database: 'detective_query_playground',
    ssl: { rejectUnauthorized: false }
  });

  const queries = [
      `SELECT person_id, name FROM persons`,
      `SELECT id AS person_id, name FROM persons`,
      `SELECT id AS person_id, name FROM person`,
      `SELECT person_id, name FROM person`,
      `SELECT id AS person_id, name FROM suspects`,
      `SELECT suspect_id AS person_id, name FROM suspects`
  ];

  for (const q of queries) {
      try {
          const [rows] = await connPlayground.query(q);
          console.log(`QUERY [${q}] SUCCESS, rows count =`, rows.length);
      } catch (e) {
          console.log(`QUERY [${q}] FAILED:`, e.message);
      }
  }

  await connPlayground.end();
  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
