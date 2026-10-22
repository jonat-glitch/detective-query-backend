const { systemDB } = require('../db');

async function main() {
  // Sample DDL cases
  const [ddlCases] = await systemDB.query(
    `SELECT c.case_id, c.title, c.description, c.setup_sql, c.expected_result_sql, c.correct_query 
     FROM cases c WHERE c.sql_type = 'DDL' AND c.mode = 'Practice' AND c.is_active = 1 LIMIT 3`
  );
  console.log('SAMPLE DDL CASES:', JSON.stringify(ddlCases, null, 2));

  const [ddlObjs] = await systemDB.query(
    `SELECT co.* FROM case_objectives co 
     JOIN cases c ON co.case_id = c.case_id 
     WHERE c.sql_type = 'DDL' AND c.mode = 'Practice' AND c.is_active = 1 LIMIT 10`
  );
  console.log('SAMPLE DDL OBJECTIVES:', JSON.stringify(ddlObjs, null, 2));

  // Sample DML cases
  const [dmlCases] = await systemDB.query(
    `SELECT c.case_id, c.title, c.description, c.setup_sql, c.correct_query 
     FROM cases c WHERE c.sql_type = 'DML' AND c.mode = 'Practice' AND c.is_active = 1 LIMIT 3`
  );
  console.log('SAMPLE DML CASES:', JSON.stringify(dmlCases, null, 2));

  const [dmlObjs] = await systemDB.query(
    `SELECT co.* FROM case_objectives co 
     JOIN cases c ON co.case_id = c.case_id 
     WHERE c.sql_type = 'DML' AND c.mode = 'Practice' AND c.is_active = 1 LIMIT 10`
  );
  console.log('SAMPLE DML OBJECTIVES:', JSON.stringify(dmlObjs, null, 2));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
