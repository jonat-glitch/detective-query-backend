const mysql = require('mysql2/promise');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const conn = await mysql.createConnection(TIDB);
  const [rows] = await conn.query(
    `SELECT case_id, title, difficulty_id, objectives, correct_query, expected_result_sql, description
     FROM cases
     WHERE is_active = 1 AND mode = 'Practice' AND sql_type = 'DQL'
     ORDER BY difficulty_id, case_id`
  );

  rows.forEach(r => {
    console.log('=== Case ID:', r.case_id, '| Diff:', r.difficulty_id, '| Title:', r.title);
    console.log('Objectives:', r.objectives || 'NULL/EMPTY');
    console.log('correct_query:', r.correct_query || 'NULL');
    console.log();
  });

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
