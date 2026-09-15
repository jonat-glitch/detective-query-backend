const mysql = require('mysql2/promise');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function run() {
  const conn = await mysql.createConnection(TIDB);
  const [rows] = await conn.query(
    `SELECT attempt_date, NOW() as now_time, TIMESTAMPDIFF(SECOND, attempt_date, NOW()) as elapsed 
     FROM attempts 
     WHERE session_id = 360097 AND user_id = 7 AND sql_query = 'START_SESSION'`
  );
  console.log('TIMESTAMPDIFF check:', rows);
  await conn.end();
}

run().catch(console.error);
