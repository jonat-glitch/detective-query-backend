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
  const [rows] = await conn.query("SELECT objective_id, objective_order, objective_text, expected_query, validation_type, points FROM case_objectives WHERE case_id = 30029");
  console.log('Case 30029 objectives in TiDB:', rows);
  await conn.end();
}

run().catch(console.error);
