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
  await conn.query("DELETE FROM attempts WHERE session_id = 360097 AND sql_query = 'TIME_EXPIRED'");
  await conn.query("UPDATE attempts SET attempt_date = NOW() WHERE session_id = 360097 AND sql_query = 'START_SESSION'");
  await conn.query("UPDATE game_sessions SET end_time = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE session_id = 360097");
  console.log('Reset START_SESSION and extended session 360097 successfully!');
  await conn.end();
}

run().catch(console.error);
