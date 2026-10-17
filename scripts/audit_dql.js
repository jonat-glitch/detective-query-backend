const { systemDB, playgroundDB } = require('../db');

async function auditDql() {
  const [cases] = await systemDB.query(`
    SELECT case_id, title, mode, sql_type, difficulty_id, dataset_id, correct_query, expected_result_sql, is_active
    FROM cases
    WHERE sql_type = 'DQL'
    ORDER BY is_active DESC, case_id ASC
  `);
  console.log(`Total DQL cases: ${cases.length}`);
  const activeCases = cases.filter(c => c.is_active === 1);
  console.log(`Active DQL cases: ${activeCases.length}`);

  const [playgroundTables] = await playgroundDB.query('SHOW TABLES');
  const tableNames = playgroundTables.map(t => Object.values(t)[0]);
  console.log('Playground tables:', tableNames);

  for (const c of cases) {
    console.log(`\n=== CASE ${c.case_id} [${c.mode}] "${c.title}" (is_active: ${c.is_active}) ===`);
    console.log(`Correct Query: ${c.correct_query}`);
    
    // Test if correct_query runs on playgroundDB
    if (c.correct_query) {
      try {
        const [rows] = await playgroundDB.query(c.correct_query);
        console.log(`  -> playgroundDB query OK, returned ${rows.length} rows`);
      } catch (e) {
        console.log(`  -> ❌ playgroundDB query FAILED: ${e.message}`);
      }
    } else {
      console.log('  -> ⚠️ No correct_query defined');
    }

    // Check case_objectives
    const [objs] = await systemDB.query(`
      SELECT objective_id, objective_order, objective_text, validation_type, required_keyword, expected_query
      FROM case_objectives
      WHERE case_id = ?
      ORDER BY objective_order
    `, [c.case_id]);

    for (const obj of objs) {
      console.log(`  Objective ${obj.objective_order} (${obj.validation_type}): ${obj.objective_text}`);
      if (obj.validation_type === 'result' && obj.expected_query) {
        try {
          const [expRows] = await playgroundDB.query(obj.expected_query);
          console.log(`    -> expected_query OK (${expRows.length} rows)`);
        } catch (e) {
          console.log(`    -> ❌ expected_query FAILED: ${e.message}`);
        }
      }
    }
  }

  process.exit(0);
}

auditDql().catch(console.error);
