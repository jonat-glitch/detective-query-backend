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

  console.log('--- CASES COLUMNS ---');
  const [caseCols] = await conn.query('DESCRIBE cases');
  console.log(caseCols.map(c => c.Field));

  console.log('--- ROOM 7 SESSION ---');
  const [sessions] = await conn.query(`
    SELECT gs.*, c.*
    FROM game_sessions gs
    JOIN cases c ON gs.case_id = c.case_id
    WHERE gs.room_id = 7
  `);
  console.log(JSON.stringify(sessions, null, 2));

  console.log('--- DATASETS ---');
  try {
    const [datasets] = await conn.query('SELECT * FROM datasets');
    console.log(JSON.stringify(datasets, null, 2));
  } catch (e) {
    console.log('datasets error:', e.message);
  }

  // Playground DB check
  try {
    const connPlayground = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '4AjTs4MyTKCrsiP.root',
      password: 'Xkoew4eyG3Wlu5ZS',
      database: 'detective_query_playground',
      ssl: { rejectUnauthorized: false }
    });
    console.log('--- PLAYGROUND TABLES ---');
    const [tables] = await connPlayground.query('SHOW TABLES');
    console.log(tables.map(t => Object.values(t)[0]));

    for (const t of tables.map(t => Object.values(t)[0])) {
      const [rows] = await connPlayground.query(`SELECT * FROM \`${t}\` LIMIT 3`);
      console.log(`Table ${t}:`, rows);
    }
    await connPlayground.end();
  } catch (err) {
    console.error('Playground connection error:', err.message);
  }

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
