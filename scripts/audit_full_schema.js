const mysql = require('mysql2/promise');

const TIDB_CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  ssl: { rejectUnauthorized: false }
};

async function run() {
  const conn = await mysql.createConnection({ ...TIDB_CONFIG, database: 'detective_query' });
  const pgConn = await mysql.createConnection({ ...TIDB_CONFIG, database: 'detective_query_playground' });

  // Get all persons, places, evidence, crime_events
  console.log('\n=== ALL PERSONS ===');
  const [persons] = await pgConn.query('SELECT * FROM persons ORDER BY person_id');
  console.log(JSON.stringify(persons, null, 2));

  console.log('\n=== ALL PLACES ===');
  const [places] = await pgConn.query('SELECT * FROM places ORDER BY place_id');
  console.log(JSON.stringify(places, null, 2));

  console.log('\n=== ALL EVIDENCE ===');
  const [evidence] = await pgConn.query('SELECT * FROM evidence ORDER BY evidence_id');
  console.log(JSON.stringify(evidence, null, 2));

  console.log('\n=== ALL PERSON_LOCATIONS ===');
  const [locs] = await pgConn.query('SELECT * FROM person_locations ORDER BY record_id');
  console.log(JSON.stringify(locs, null, 2));

  console.log('\n=== ALL CRIME_EVENTS ===');
  const [crimes] = await pgConn.query('SELECT * FROM crime_events ORDER BY crime_id');
  console.log(JSON.stringify(crimes, null, 2));

  console.log('\n=== DQ_EMPLOYEES ===');
  const [emps] = await pgConn.query('SELECT * FROM dq_employees ORDER BY employee_id');
  console.log(JSON.stringify(emps, null, 2));

  // Get existing Practice cases IDs we need to delete
  console.log('\n=== CURRENT PRACTICE DML/DDL CASES ===');
  const [practiceCases] = await conn.query(`
    SELECT case_id, title, sql_type, difficulty_id, mode FROM cases 
    WHERE mode = 'Practice' AND sql_type IN ('DML', 'DDL')
    ORDER BY sql_type, difficulty_id, case_id
  `);
  console.log(JSON.stringify(practiceCases, null, 2));

  console.log('\n=== CURRENT PRACTICE DQL CASES ===');
  const [dqlPractice] = await conn.query(`
    SELECT case_id, title, sql_type, difficulty_id, mode FROM cases 
    WHERE mode = 'Practice' AND sql_type = 'DQL'
    ORDER BY difficulty_id, case_id
  `);
  console.log(JSON.stringify(dqlPractice, null, 2));

  // Check user_case_progress for those cases
  console.log('\n=== USER_CASE_PROGRESS (has student completions?) ===');
  const [ucp] = await conn.query(`
    SELECT ucp.user_id, ucp.case_id, ucp.status, c.sql_type, c.mode
    FROM user_case_progress ucp
    JOIN cases c ON ucp.case_id = c.case_id
    WHERE c.mode = 'Practice'
    ORDER BY ucp.case_id
  `);
  console.log(JSON.stringify(ucp, null, 2));

  await pgConn.end();
  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error('ERR:', e.message); process.exit(1); });
