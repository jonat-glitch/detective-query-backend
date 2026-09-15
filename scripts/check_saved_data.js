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

  const [tables] = await conn.query('SHOW TABLES');
  console.log('TABLES IN DB:');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log(tableNames);

  for (const t of ['users', 'attempts', 'rank_attempts', 'user_case_progress', 'room_students', 'account_change_requests']) {
    if (tableNames.includes(t)) {
      const [count] = await conn.query(`SELECT COUNT(*) AS total FROM \`${t}\``);
      console.log(`Table [${t}]: ${count[0].total} records`);
    }
  }

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
