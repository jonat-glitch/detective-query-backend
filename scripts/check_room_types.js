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

  const [rsCols] = await conn.query('DESCRIBE room_students');
  console.log('room_students schema:');
  console.log(rsCols);

  const [roomsCols] = await conn.query('DESCRIBE rooms');
  console.log('rooms schema:');
  console.log(roomsCols);

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
