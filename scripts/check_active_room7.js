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

  const [activeSession] = await conn.query(`
    SELECT gs.*, c.title, c.sql_type, c.dataset_id, c.difficulty_id
    FROM game_sessions gs
    JOIN cases c ON gs.case_id = c.case_id
    WHERE gs.room_id = 7 AND (gs.status = 'Active' OR LOWER(gs.status) = 'active')
  `);
  console.log('ACTIVE SESSION ROOM 7:', JSON.stringify(activeSession, null, 2));

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
