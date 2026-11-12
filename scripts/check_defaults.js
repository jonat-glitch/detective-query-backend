const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function getDefaults() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'detective_query',
    ssl: { rejectUnauthorized: false }
  });

  const [defaults] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, DATA_TYPE, COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'detective_query'
      AND COLUMN_DEFAULT IS NOT NULL
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);

  console.log('Sample Column Defaults:');
  for (const d of defaults) {
    console.log(`${d.TABLE_NAME}.${d.COLUMN_NAME} => ${d.COLUMN_DEFAULT} (${d.COLUMN_TYPE})`);
  }
  await conn.end();
}

getDefaults().catch(console.error);

