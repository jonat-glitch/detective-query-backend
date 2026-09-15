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

  const [fkRows] = await conn.query(`
    SELECT 
      TABLE_NAME, 
      COLUMN_NAME, 
      CONSTRAINT_NAME, 
      REFERENCED_TABLE_NAME, 
      REFERENCED_COLUMN_NAME 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE REFERENCED_TABLE_NAME = 'users' AND TABLE_SCHEMA = 'detective_query'
  `);
  console.log('FOREIGN KEYS POINTING TO USERS:');
  console.log(fkRows);

  const [colRows] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'detective_query' 
      AND (COLUMN_NAME LIKE '%user%' OR COLUMN_NAME LIKE '%student%' OR COLUMN_NAME LIKE '%teacher%' OR COLUMN_NAME LIKE '%created_by%')
  `);
  console.log('COLUMNS THAT MIGHT REFERENCE USER:');
  console.log(colRows);

  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
