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

  const [reqCols] = await conn.query('DESCRIBE registration_requests');
  console.log('registration_requests schema:');
  console.log(reqCols);

  const [userRows] = await conn.query('SELECT user_id, full_name, email, student_id, teacher_id FROM users WHERE student_id LIKE "%TAL2023%" OR full_name LIKE "%Jaycee%" LIMIT 5');
  console.log('User matching Jaycee:');
  console.log(userRows);

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
