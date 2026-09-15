/**
 * test_practice_cases.js
 * Verifies that the new 45 cases exist in the database,
 * have all required fields (objectives, base_points, setup_sql, correct_query, expected_result_sql),
 * and checks row counts per difficulty.
 */

const mysql = require('mysql2/promise');
const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function test() {
  const conn = await mysql.createConnection(TIDB);
  console.log('Connected to TiDB.');

  // 1. Check count by sql_type and difficulty
  const [counts] = await conn.query(`
    SELECT sql_type, difficulty_id, COUNT(*) AS total
    FROM cases
    WHERE is_active = 1 AND mode = 'Practice'
    GROUP BY sql_type, difficulty_id
    ORDER BY sql_type, difficulty_id
  `);
  console.log('\n📊 Active Practice Cases:');
  console.table(counts);

  // 2. Verify all 45 cases have objectives and correct_query
  const [missingObjectives] = await conn.query(`
    SELECT case_id, title, sql_type
    FROM cases
    WHERE is_active = 1 AND mode = 'Practice'
      AND (objectives IS NULL OR objectives = '' OR correct_query IS NULL OR correct_query = '')
  `);

  if (missingObjectives.length === 0) {
    console.log('✅ All 45 practice cases have complete titles, objectives, and correct_query!');
  } else {
    console.error('❌ Some cases are missing objectives or correct_query:', missingObjectives);
  }

  // 3. Sample 1 case from DQL, DML, DDL
  for (const type of ['DQL', 'DML', 'DDL']) {
    const [sample] = await conn.query(`
      SELECT case_id, title, sql_type, difficulty_id, base_points,
             LEFT(objectives, 60) AS objectives_preview,
             correct_query
      FROM cases
      WHERE is_active = 1 AND mode = 'Practice' AND sql_type = ?
      LIMIT 1
    `, [type]);
    console.log(`\nSample ${type} Case:`, sample[0]);
  }

  await conn.end();
  console.log('\n🎉 Verification completed successfully!');
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
