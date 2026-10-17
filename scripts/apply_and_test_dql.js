const mysql = require('mysql2/promise');
require('dotenv').config();

const { systemDB, playgroundDB } = require('../db');

const SCHEMA_SQL = [
  'SET FOREIGN_KEY_CHECKS = 0',
  'DROP TABLE IF EXISTS evidence',
  'DROP TABLE IF EXISTS witnesses',
  'DROP TABLE IF EXISTS suspects',
  'DROP TABLE IF EXISTS officers',
  'DROP TABLE IF EXISTS locations',
  'CREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1)',
  'CREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))',
  "CREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
  'CREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20))',
  'CREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT, collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (location_id) REFERENCES locations(location_id))',
  "INSERT INTO locations VALUES (1,'City Hall','Downtown',1),(2,'Central Warehouse','Industrial Zone',1),(3,'Riverside Park','Northside',1),(4,'Police HQ','Central',1),(5,'Abandoned Factory','Southside',0)",
  "INSERT INTO officers VALUES (1,'B-001','Officer Santos','Detective'),(2,'B-002','Officer Reyes','Sergeant'),(3,'B-003','Officer Lim','Junior Officer')",
  "INSERT INTO suspects VALUES (1,'Marcus Webb',32,'Under Investigation'),(2,'Lena Torres',28,'Under Investigation'),(3,'Victor Hale',45,'Cleared'),(4,'Diana Cruz',39,'Arrested'),(5,'Ethan Ford',23,'Under Investigation')",
  "INSERT INTO witnesses VALUES (1,'Carmen Sia','09171234567'),(2,'Roberto Ngo','09281234567'),(3,'Felicia Park','09391234567')",
  "INSERT INTO evidence VALUES (1,'Broken Knife',4,2,'2026-09-01 10:00:00'),(2,'Surveillance Tape',3,4,'2026-09-02 14:00:00'),(3,'Bloody Glove',5,1,'2026-09-03 08:30:00'),(4,'Receipt Paper',1,3,'2026-09-04 12:00:00'),(5,'Crowbar',3,5,'2026-09-05 09:15:00')",
  'SET FOREIGN_KEY_CHECKS = 1'
];

async function testAll() {
  console.log('--- Applying Schema and Data to playgroundDB ---');
  for (const sql of SCHEMA_SQL) {
    try {
      await playgroundDB.query(sql);
    } catch (e) {
      console.error('Error applying statement:', sql, e.message);
    }
  }
  console.log('--- Schema applied successfully ---');

  // Now test all active DQL cases
  const [cases] = await systemDB.query(`
    SELECT case_id, title, mode, sql_type, correct_query
    FROM cases
    WHERE sql_type = 'DQL' AND is_active = 1
    ORDER BY case_id
  `);
  console.log(`Auditing ${cases.length} active DQL cases...`);

  let failedCases = 0;
  let failedObjectives = 0;

  for (const c of cases) {
    let casePassed = true;
    try {
      const [rows] = await playgroundDB.query(c.correct_query);
      if (!rows || rows.length === 0) {
        console.warn(`⚠️ Case ${c.case_id} [${c.mode}] "${c.title}" returned 0 rows! Query: ${c.correct_query}`);
      }
    } catch (e) {
      casePassed = false;
      failedCases++;
      console.error(`❌ Case ${c.case_id} [${c.mode}] "${c.title}" FAILED: ${e.message}\n   Query: ${c.correct_query}`);
    }

    // Check objectives
    const [objs] = await systemDB.query(`
      SELECT objective_id, objective_order, objective_text, validation_type, required_keyword, expected_query
      FROM case_objectives
      WHERE case_id = ?
      ORDER BY objective_order
    `, [c.case_id]);

    for (const obj of objs) {
      if (obj.validation_type === 'result' && obj.expected_query) {
        try {
          const [expRows] = await playgroundDB.query(obj.expected_query);
          if (!expRows || expRows.length === 0) {
            console.warn(`  ⚠️ Case ${c.case_id} Obj ${obj.objective_order} returned 0 rows! Query: ${obj.expected_query}`);
          }
        } catch (e) {
          failedObjectives++;
          console.error(`  ❌ Case ${c.case_id} Obj ${obj.objective_order} FAILED: ${e.message}\n     Expected Query: ${obj.expected_query}`);
        }
      }
    }

    if (casePassed) {
      console.log(`✅ Case ${c.case_id} [${c.mode}] "${c.title}" passed.`);
    }
  }

  console.log(`\nAudit complete: ${cases.length - failedCases}/${cases.length} cases passed. Failed objectives: ${failedObjectives}`);
  process.exit(0);
}

testAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
