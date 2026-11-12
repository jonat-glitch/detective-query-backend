const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cfg = {
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: 'detective_query', ssl: { rejectUnauthorized: false }
};

const TABLES_TO_CHECK = [
  'notifications', 'student_invitations', 'case_study_materials',
  'otp_verifications', 'user_badges', 'case_notes', 'session_objectives'
];

async function run() {
  const conn = await mysql.createConnection(cfg);
  for (const tbl of TABLES_TO_CHECK) {
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'detective_query' AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`, [tbl]);
    console.log(`\n=== ${tbl} ===`);
    for (const c of cols) {
      const flags = [c.COLUMN_KEY === 'PRI' ? '🔑PK' : c.COLUMN_KEY === 'MUL' ? '🔗FK/IDX' : c.COLUMN_KEY === 'UNI' ? '🔒UNI' : ''].filter(Boolean);
      console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE}) ${flags.join(' ')}`);
    }
  }
  await conn.end();
}
run().catch(console.error);

