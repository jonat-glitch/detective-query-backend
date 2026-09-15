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

  const [notifCols] = await conn.query('DESCRIBE notifications');
  console.log('notifications columns:', notifCols.map(c => c.Field));

  const [changeReqCols] = await conn.query('DESCRIBE account_change_requests');
  console.log('account_change_requests columns:', changeReqCols.map(c => c.Field));

  const [sessionObjCols] = await conn.query('DESCRIBE session_objectives');
  console.log('session_objectives columns:', sessionObjCols.map(c => c.Field));

  const [caseNotesCols] = await conn.query('DESCRIBE case_notes');
  console.log('case_notes columns:', caseNotesCols.map(c => c.Field));

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
