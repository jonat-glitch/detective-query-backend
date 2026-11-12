const mysql = require('mysql2/promise');
require('dotenv').config();
async function r() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: 'detective_query', ssl: { rejectUnauthorized: false }
  });
  const [cols] = await c.query('DESCRIBE case_objectives');
  console.log('case_objectives columns:');
  cols.forEach(x => console.log(' ', x.Field, x.Key, x.Type));
  const [so] = await c.query('DESCRIBE session_objectives');
  console.log('\nsession_objectives columns:');
  so.forEach(x => console.log(' ', x.Field, x.Key, x.Type));
  await c.end();
}
r().catch(console.error);

