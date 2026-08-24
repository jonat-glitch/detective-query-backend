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

  const [cases] = await conn.query(`
    SELECT case_id, title, sql_type, dataset_id, difficulty_id, correct_suspect_id, mode
    FROM cases
  `);
  console.log('ALL CASES:', JSON.stringify(cases, null, 2));

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
