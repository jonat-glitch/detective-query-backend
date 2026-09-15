const mysql = require('mysql2/promise');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function check() {
  const conn = await mysql.createConnection(TIDB);
  const [rows] = await conn.query("SELECT session_id, end_time, NOW() as now_time, end_time > NOW() as is_future FROM game_sessions WHERE room_id = 7 AND status = 'Active'");
  console.log('Active session check:', rows);
  await conn.end();
}

check().catch(console.error);
