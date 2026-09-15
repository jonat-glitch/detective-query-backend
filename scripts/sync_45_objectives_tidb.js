const mysql = require('mysql2/promise');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

// Import ALL_OBJECTIVES from test_45_objectives.js
const { ALL_OBJECTIVES } = require('./test_45_objectives_data.js');

async function syncObjectives() {
  const conn = await mysql.createConnection(TIDB);
  console.log('Connected to TiDB database...');

  for (const c of ALL_OBJECTIVES) {
    // 1. Clear existing case_objectives for this case
    await conn.query('DELETE FROM case_objectives WHERE case_id = ?', [c.case_id]);

    // 2. Insert the 3 progressive objectives
    for (const obj of c.objectives) {
      await conn.query(
        `INSERT INTO case_objectives 
         (case_id, objective_order, objective_text, expected_query, validation_type, points)
         VALUES (?, ?, ?, ?, 'result', ?)`,
        [c.case_id, obj.order, obj.text, obj.query, obj.points]
      );
    }

    // 3. Build a formatted narrative string for cases.objectives
    const stepsText = c.objectives.map(o => `${o.order}. ${o.text} (${o.points} XP)`).join('\n');
    const fullNarrative = `🎯 INVESTIGATION OBJECTIVES:\n${stepsText}\n\n🔍 VERDICT INTEL: Complete all 3 objectives above to uncover the decisive evidence and pinpoint the prime suspect!`;

    await conn.query(
      'UPDATE cases SET objectives = ? WHERE case_id = ?',
      [fullNarrative, c.case_id]
    );

    console.log(`✅ Case ${c.case_id} (${c.title}): 3 objectives synced to case_objectives and cases.objectives!`);
  }

  console.log('\n🎉 All 15 cases (45 objectives total) successfully updated in TiDB Cloud!');
  await conn.end();
}

syncObjectives().catch(console.error);
