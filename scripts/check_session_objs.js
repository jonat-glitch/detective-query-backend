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
  const [rows] = await conn.query("SELECT * FROM session_objectives WHERE session_id = 360097");
  console.log('session_objectives for session 360097:', rows);
  await conn.end();
}

run().catch(console.error);
