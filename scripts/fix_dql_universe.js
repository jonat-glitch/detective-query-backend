const { systemDB, playgroundDB } = require('../db');

const UPDATED_SCHEMA_SQL = [
  'SET FOREIGN_KEY_CHECKS = 0',
  'DROP TABLE IF EXISTS evidence',
  'DROP TABLE IF EXISTS witnesses',
  'DROP TABLE IF EXISTS suspects',
  'DROP TABLE IF EXISTS officers',
  'DROP TABLE IF EXISTS locations',
  `CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    place_name VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1
  )`,
  `CREATE TABLE officers (
    officer_id INT AUTO_INCREMENT PRIMARY KEY,
    badge_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    rank_level VARCHAR(50)
  )`,
  `CREATE TABLE suspects (
    suspect_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    status VARCHAR(50) DEFAULT 'Under Investigation'
  )`,
  `CREATE TABLE witnesses (
    witness_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20)
  )`,
  `CREATE TABLE evidence (
    evidence_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    severity INT DEFAULT 1,
    location_id INT,
    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
  )`,
  `INSERT INTO locations VALUES 
    (1,'City Hall','Downtown',1),
    (2,'Central Warehouse','Industrial Zone',1),
    (3,'Riverside Park','Northside',1),
    (4,'Police HQ','Central',1),
    (5,'Abandoned Factory','Southside',0),
    (6,'Harbor Pier','Waterfront',1)`,
  `INSERT INTO officers VALUES 
    (1,'B-001','Officer Santos','Detective'),
    (2,'B-002','Officer Reyes','Sergeant'),
    (3,'B-003','Officer Lim','Junior Officer')`,
  `INSERT INTO suspects VALUES 
    (1,'Marcus Webb',32,'Under Investigation'),
    (2,'Lena Torres',28,'Under Investigation'),
    (3,'Victor Hale',45,'Cleared'),
    (4,'Diana Cruz',39,'Arrested'),
    (5,'Ethan Ford',23,'Under Investigation')`,
  `INSERT INTO witnesses VALUES 
    (1,'Carmen Sia','09171234567'),
    (2,'Roberto Ngo','09281234567'),
    (3,'Felicia Park','09391234567')`,
  `INSERT INTO evidence VALUES 
    (1,'Broken Knife',4,2,'2026-09-01 10:00:00'),
    (2,'Surveillance Tape',3,4,'2026-09-02 14:00:00'),
    (3,'Bloody Glove',5,1,'2026-09-03 08:30:00'),
    (4,'Receipt Paper',1,3,'2026-09-04 12:00:00'),
    (5,'Crowbar',3,5,'2026-09-05 09:15:00'),
    (6,'Security Footprint',4,2,'2026-09-06 11:00:00')`,
  'SET FOREIGN_KEY_CHECKS = 1'
];

const FULL_SETUP_TEXT = UPDATED_SCHEMA_SQL.slice(1, -1).join(';\n') + ';';

const SCHEMA_DEFINITION_ONLY = UPDATED_SCHEMA_SQL.slice(1, 11).join(';\n') + ';';
const SAMPLE_DATA_ONLY = UPDATED_SCHEMA_SQL.slice(11, 16).join(';\n') + ';';

async function updateAndVerify() {
  console.log('1️⃣ Updating playgroundDB tables...');
  for (const stmt of UPDATED_SCHEMA_SQL) {
    await playgroundDB.query(stmt);
  }
  console.log('✅ playgroundDB updated with 6 locations, 3 officers, 5 suspects, 3 witnesses, 6 evidence.');

  console.log('2️⃣ Updating systemDB.datasets where dataset_id = 1...');
  await systemDB.query(`
    UPDATE datasets
    SET dataset_name = 'Crime Investigation Universe',
        schema_definition = ?,
        sample_data = ?
    WHERE dataset_id = 1
  `, [SCHEMA_DEFINITION_ONLY, SAMPLE_DATA_ONLY]);
  console.log('✅ systemDB.datasets updated.');

  console.log('3️⃣ Updating cases.setup_sql for active DQL cases...');
  await systemDB.query(`
    UPDATE cases
    SET setup_sql = ?
    WHERE sql_type = 'DQL' AND is_active = 1
  `, [FULL_SETUP_TEXT]);
  console.log('✅ cases.setup_sql updated.');

  console.log('4️⃣ Ensuring case_objectives exist for Rank DQL cases...');
  const [rankDqlCases] = await systemDB.query(`
    SELECT case_id, title, objectives, correct_query, base_points
    FROM cases
    WHERE sql_type = 'DQL' AND mode = 'Rank' AND is_active = 1
    ORDER BY case_id
  `);

  for (const c of rankDqlCases) {
    // Check if case_objectives already has rows for this case
    const [existing] = await systemDB.query(`
      SELECT objective_id FROM case_objectives WHERE case_id = ?
    `, [c.case_id]);

    if (existing.length === 0) {
      // Parse objectives lines or create standard 1-objective match
      const lines = (c.objectives || '')
        .split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);

      if (lines.length > 0) {
        // Create 3 objectives: first 2 pattern/keyword or result, final one matching correct_query
        for (let i = 0; i < lines.length; i++) {
          const isFinal = (i === lines.length - 1);
          await systemDB.query(`
            INSERT INTO case_objectives 
              (case_id, objective_order, objective_text, points, validation_type, expected_query)
            VALUES (?, ?, ?, ?, 'result', ?)
          `, [
            c.case_id,
            i + 1,
            lines[i],
            Math.round((c.base_points || 100) / lines.length),
            c.correct_query // Result matches the case's expected result
          ]);
        }
      } else {
        await systemDB.query(`
          INSERT INTO case_objectives 
            (case_id, objective_order, objective_text, points, validation_type, expected_query)
          VALUES (?, 1, ?, ?, 'result', ?)
        `, [
          c.case_id,
          c.title,
          c.base_points || 100,
          c.correct_query
        ]);
      }
    }
  }
  console.log('✅ case_objectives ensured for Rank DQL cases.');

  console.log('\n5️⃣ Auditing ALL 30 active DQL cases...');
  const [allDql] = await systemDB.query(`
    SELECT case_id, title, mode, correct_query
    FROM cases
    WHERE sql_type = 'DQL' AND is_active = 1
    ORDER BY case_id
  `);

  let allOk = true;
  for (const c of allDql) {
    try {
      const [rows] = await playgroundDB.query(c.correct_query);
      if (rows.length === 0) {
        console.warn(`  ⚠️ Case ${c.case_id} [${c.mode}] "${c.title}" returned 0 rows!`);
        allOk = false;
      } else {
        console.log(`  ✅ Case ${c.case_id} [${c.mode}] "${c.title}" OK (${rows.length} rows returned)`);
      }
    } catch (e) {
      console.error(`  ❌ Case ${c.case_id} [${c.mode}] "${c.title}" FAILED: ${e.message}`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log('\n🎉 ALL 30 DQL CASES RETURN NON-ZERO EXPECTED ROWS AND SUCCEED!');
  } else {
    console.log('\n⚠️ Some cases had warnings/errors. Review above.');
  }

  process.exit(0);
}

updateAndVerify().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
