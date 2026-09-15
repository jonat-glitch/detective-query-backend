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
  await conn.query("UPDATE game_sessions SET end_time = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE room_id = 7 AND status = 'Active'");
  console.log('Successfully extended room 7 session by 24 hours!');
  await conn.end();
}

run().catch(console.error);
