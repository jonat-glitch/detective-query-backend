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

  console.log('\n=== DML CASE SAMPLE (full row) ===');
  const [dml] = await conn.query(
    `SELECT case_id, title, difficulty_id, correct_suspect_id, objectives
     FROM cases WHERE is_active = 1 AND mode = 'Practice' AND sql_type = 'DML'
     ORDER BY difficulty_id, case_id LIMIT 5`
  );
  dml.forEach(r => {
    console.log('--- Case', r.case_id, r.title, '| correct_suspect_id:', r.correct_suspect_id);
    console.log('Objectives:', r.objectives);
    console.log();
  });

  console.log('\n=== DQL CASE: correct_suspect_id ===');
  const [dql] = await conn.query(
    `SELECT case_id, title, difficulty_id, correct_suspect_id, objectives
     FROM cases WHERE is_active = 1 AND mode = 'Practice' AND sql_type = 'DQL'
     ORDER BY difficulty_id, case_id`
  );
  dql.forEach(r => {
    console.log('Case', r.case_id, r.title, '| correct_suspect_id:', r.correct_suspect_id);
  });

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
