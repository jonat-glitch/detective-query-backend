/**
 * seed_new_cases.js
 *
 * Relational case seed for Detective Query.
 * - Deactivates ALL existing active cases (archives them safely)
 * - Inserts 90 new cases: 15 DDL + 15 DML + 15 DQL per mode (Practice & Rank)
 * - All share the same Crime Investigation story universe:
 *     Tables: suspects, witnesses, evidence, locations, officers
 *
 * Flow:  DDL (CREATE schema) → DML (populate data) → DQL (query & analyze)
 */

const { systemDB } = require('../db');

const EASY   = 1;
const MEDIUM = 2;
const HARD   = 3;
const DATASET_ID = 1;

// ─── Shared full schema setup (used by DML and DQL cases) ─────────────────────
const FULL_SCHEMA_SETUP = [
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
  "INSERT INTO evidence VALUES (1,'Broken Knife',4,2,'2026-09-01 10:00:00'),(2,'Surveillance Tape',3,4,'2026-09-02 14:00:00'),(3,'Bloody Glove',5,1,'2026-09-03 08:30:00'),(4,'Receipt Paper',1,3,'2026-09-04 12:00:00'),(5,'Crowbar',3,5,'2026-09-05 09:15:00')"
].join(';\n');

// ══════════════════════════════════════════════════════════════════════════════
//  PRACTICE DDL  (15 cases — CREATE the investigation schema)
// ══════════════════════════════════════════════════════════════════════════════
const practiceDDLCases = [
  // ── EASY ──
  {
    title: 'Build the Suspects Registry',
    description: 'The detective unit needs a suspects table. Create a table named `suspects` with:\n- suspect_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- name (VARCHAR 100, NOT NULL)\n- age (INT)\n- status (VARCHAR 50, DEFAULT "Under Investigation")',
    objectives: '1. Create the suspects table with all required columns.\n2. suspect_id is AUTO_INCREMENT PRIMARY KEY.\n3. name must be NOT NULL.\n4. status has a DEFAULT value.',
    difficulty_id: EASY, base_points: 100, module_order: 1,
    correct_query: "CREATE TABLE suspects (\n  suspect_id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  age INT,\n  status VARCHAR(50) DEFAULT 'Under Investigation'\n)",
    setup_sql: 'DROP TABLE IF EXISTS suspects',
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
  },
  {
    title: 'Establish the Witness Log',
    description: 'Create a table named `witnesses` with:\n- witness_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- full_name (VARCHAR 100, NOT NULL)\n- contact_number (VARCHAR 20)\n- statement (TEXT)',
    objectives: '1. Create the witnesses table.\n2. full_name must be NOT NULL.\n3. statement should be of type TEXT.',
    difficulty_id: EASY, base_points: 100, module_order: 1,
    correct_query: 'CREATE TABLE witnesses (\n  witness_id INT AUTO_INCREMENT PRIMARY KEY,\n  full_name VARCHAR(100) NOT NULL,\n  contact_number VARCHAR(20),\n  statement TEXT\n)',
    setup_sql: 'DROP TABLE IF EXISTS witnesses',
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
  },
  {
    title: 'Create the Evidence Vault',
    description: 'Forensics needs a table to catalog all physical evidence. Create a table named `evidence` with:\n- evidence_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- item_name (VARCHAR 100, NOT NULL)\n- found_at (VARCHAR 100)\n- severity (INT, DEFAULT 1)',
    objectives: '1. Create the evidence table.\n2. evidence_id must be AUTO_INCREMENT.\n3. item_name must be NOT NULL.\n4. severity defaults to 1.',
    difficulty_id: EASY, base_points: 100, module_order: 1,
    correct_query: 'CREATE TABLE evidence (\n  evidence_id INT AUTO_INCREMENT PRIMARY KEY,\n  item_name VARCHAR(100) NOT NULL,\n  found_at VARCHAR(100),\n  severity INT DEFAULT 1\n)',
    setup_sql: 'DROP TABLE IF EXISTS evidence',
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
  },
  {
    title: 'Map the Crime Locations',
    description: 'All crime scenes must be cataloged. Create a table named `locations` with:\n- location_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- place_name (VARCHAR 100, NOT NULL)\n- district (VARCHAR 100)\n- is_active (TINYINT(1), DEFAULT 1)',
    objectives: '1. Create the locations table.\n2. location_id is PRIMARY KEY AUTO_INCREMENT.\n3. place_name must be NOT NULL.',
    difficulty_id: EASY, base_points: 100, module_order: 1,
    correct_query: 'CREATE TABLE locations (\n  location_id INT AUTO_INCREMENT PRIMARY KEY,\n  place_name VARCHAR(100) NOT NULL,\n  district VARCHAR(100),\n  is_active TINYINT(1) DEFAULT 1\n)',
    setup_sql: 'DROP TABLE IF EXISTS locations',
    expected_result_sql: 'SHOW COLUMNS FROM locations',
  },
  {
    title: 'Register the Officer Roster',
    description: 'Create a table named `officers` with:\n- officer_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- badge_number (VARCHAR 20, UNIQUE, NOT NULL)\n- name (VARCHAR 100, NOT NULL)\n- rank_level (VARCHAR 50)',
    objectives: '1. Create the officers table.\n2. badge_number must be UNIQUE and NOT NULL.\n3. officer_id is AUTO_INCREMENT.',
    difficulty_id: EASY, base_points: 100, module_order: 1,
    correct_query: 'CREATE TABLE officers (\n  officer_id INT AUTO_INCREMENT PRIMARY KEY,\n  badge_number VARCHAR(20) UNIQUE NOT NULL,\n  name VARCHAR(100) NOT NULL,\n  rank_level VARCHAR(50)\n)',
    setup_sql: 'DROP TABLE IF EXISTS officers',
    expected_result_sql: 'SHOW COLUMNS FROM officers',
  },
  // ── MEDIUM ──
  {
    title: 'Add Arrest Date to Suspects',
    description: 'The suspects table exists with: suspect_id, name, age, status.\nAdd a new column: `arrested_at` (DATETIME, allows NULL) using ALTER TABLE.',
    objectives: '1. Use ALTER TABLE to add the column.\n2. Column must accept NULL values.\n3. Do not recreate the whole table.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 1,
    correct_query: 'ALTER TABLE suspects ADD COLUMN arrested_at DATETIME',
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
  },
  {
    title: 'Tag Evidence with Location',
    description: 'Both `evidence` and `locations` tables exist. Add column `location_id` (INT) to the evidence table as a FOREIGN KEY referencing locations(location_id).',
    objectives: '1. Add location_id column to evidence.\n2. Add a FOREIGN KEY constraint to locations(location_id).\n3. Use ALTER TABLE.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 1,
    correct_query: 'ALTER TABLE evidence ADD COLUMN location_id INT, ADD FOREIGN KEY (location_id) REFERENCES locations(location_id)',
    setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1);\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, found_at VARCHAR(100), severity INT DEFAULT 1)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
  },
  {
    title: 'Rename the Status Column',
    description: 'Rename the `status` column in `suspects` to `case_status` (keep VARCHAR 50).',
    objectives: '1. Use ALTER TABLE CHANGE or RENAME COLUMN.\n2. Keep VARCHAR(50) data type.\n3. Keep the same DEFAULT.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 1,
    correct_query: "ALTER TABLE suspects CHANGE status case_status VARCHAR(50) DEFAULT 'Under Investigation'",
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
  },
  {
    title: 'Drop the Redundant Column',
    description: 'The `statement` column in `witnesses` is being moved to a separate system. Remove it with ALTER TABLE.',
    objectives: '1. Use ALTER TABLE DROP COLUMN.\n2. Do not drop any other column.\n3. Table should have 3 remaining columns.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 1,
    correct_query: 'ALTER TABLE witnesses DROP COLUMN statement',
    setup_sql: 'DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20), statement TEXT)',
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
  },
  {
    title: 'Add a Unique Badge Constraint',
    description: 'The officers table was created without enforcing uniqueness on `badge_number`. Add a UNIQUE constraint using ALTER TABLE.',
    objectives: '1. Use ALTER TABLE ADD UNIQUE.\n2. The constraint must be on badge_number.\n3. Do not recreate the table.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 1,
    correct_query: 'ALTER TABLE officers ADD UNIQUE (badge_number)',
    setup_sql: 'DROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))',
    expected_result_sql: 'SHOW COLUMNS FROM officers',
  },
  // ── HARD ──
  {
    title: 'Design the Case Assignment Table',
    description: 'Create a junction table `case_assignments` linking officers to suspects:\n- assignment_id (INT, PK, AI)\n- officer_id (INT, NOT NULL, FK → officers)\n- suspect_id (INT, NOT NULL, FK → suspects)\n- assigned_date (DATE, NOT NULL)',
    objectives: '1. Create case_assignments with all columns.\n2. FK for officer_id → officers(officer_id).\n3. FK for suspect_id → suspects(suspect_id).\n4. assigned_date must be NOT NULL.',
    difficulty_id: HARD, base_points: 300, module_order: 1,
    correct_query: "CREATE TABLE case_assignments (\n  assignment_id INT AUTO_INCREMENT PRIMARY KEY,\n  officer_id INT NOT NULL,\n  suspect_id INT NOT NULL,\n  assigned_date DATE NOT NULL,\n  FOREIGN KEY (officer_id) REFERENCES officers(officer_id),\n  FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id)\n)",
    setup_sql: "DROP TABLE IF EXISTS case_assignments;\nDROP TABLE IF EXISTS suspects;\nDROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50));\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM case_assignments',
  },
  {
    title: 'Build the Constrained Evidence Table',
    description: 'Create a strictly constrained `evidence` table with:\n- evidence_id (INT, PK, AI)\n- item_name (VARCHAR 100, NOT NULL, UNIQUE)\n- severity (INT, CHECK 1–5)\n- location_id (INT, FK → locations)\n- collected_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    objectives: '1. item_name must be NOT NULL and UNIQUE.\n2. severity must have a CHECK constraint (1-5).\n3. FK from location_id → locations(location_id).\n4. collected_at defaults to CURRENT_TIMESTAMP.',
    difficulty_id: HARD, base_points: 300, module_order: 1,
    correct_query: 'CREATE TABLE evidence (\n  evidence_id INT AUTO_INCREMENT PRIMARY KEY,\n  item_name VARCHAR(100) NOT NULL UNIQUE,\n  severity INT CHECK (severity >= 1 AND severity <= 5),\n  location_id INT,\n  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (location_id) REFERENCES locations(location_id)\n)',
    setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
  },
  {
    title: 'Rebuild the Suspects Table with Full Constraints',
    description: 'Drop and recreate `suspects` with:\n- suspect_id (INT, PK, AI)\n- name (VARCHAR 100, NOT NULL)\n- age (INT, CHECK >= 0)\n- status (ENUM "Under Investigation","Cleared","Arrested", DEFAULT "Under Investigation")\n- created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    objectives: '1. Drop existing suspects table first.\n2. Recreate with ENUM status column.\n3. Add CHECK on age >= 0.\n4. created_at uses CURRENT_TIMESTAMP.',
    difficulty_id: HARD, base_points: 300, module_order: 1,
    correct_query: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (\n  suspect_id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  age INT CHECK (age >= 0),\n  status ENUM('Under Investigation','Cleared','Arrested') DEFAULT 'Under Investigation',\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n)",
    setup_sql: 'DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))',
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
  },
  {
    title: 'Create an Audit Trail Table',
    description: 'Create `audit_log` to log all changes to suspects:\n- log_id (INT, PK, AI)\n- suspect_id (INT, FK → suspects ON DELETE CASCADE)\n- action (ENUM "INSERT","UPDATE","DELETE", NOT NULL)\n- changed_by (VARCHAR 100)\n- changed_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    objectives: '1. Create audit_log with FK to suspects.\n2. ON DELETE CASCADE must be set on the FK.\n3. action must be an ENUM with exactly 3 values.',
    difficulty_id: HARD, base_points: 300, module_order: 1,
    correct_query: "CREATE TABLE audit_log (\n  log_id INT AUTO_INCREMENT PRIMARY KEY,\n  suspect_id INT,\n  action ENUM('INSERT','UPDATE','DELETE') NOT NULL,\n  changed_by VARCHAR(100),\n  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id) ON DELETE CASCADE\n)",
    setup_sql: "DROP TABLE IF EXISTS audit_log;\nDROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM audit_log',
  },
  {
    title: 'Full Investigation Schema Setup',
    description: 'Create ALL FIVE investigation tables in the correct dependency order:\n1. locations (location_id PK AI, place_name VARCHAR 100 NOT NULL, district VARCHAR 100)\n2. officers (officer_id PK AI, badge_number VARCHAR 20 UNIQUE NOT NULL, name VARCHAR 100 NOT NULL, rank_level VARCHAR 50)\n3. suspects (suspect_id PK AI, name VARCHAR 100 NOT NULL, age INT, status VARCHAR 50 DEFAULT "Under Investigation")\n4. witnesses (witness_id PK AI, full_name VARCHAR 100 NOT NULL, contact_number VARCHAR 20)\n5. evidence (evidence_id PK AI, item_name VARCHAR 100 NOT NULL, severity INT DEFAULT 1, location_id INT FK→locations, collected_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    objectives: '1. Create all 5 tables in correct dependency order.\n2. evidence.location_id must reference locations(location_id).\n3. All NOT NULL and DEFAULT constraints must be present.',
    difficulty_id: HARD, base_points: 300, module_order: 1,
    correct_query: "CREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100));\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50));\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation');\nCREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20));\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT, collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (location_id) REFERENCES locations(location_id))",
    setup_sql: 'DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS witnesses;\nDROP TABLE IF EXISTS suspects;\nDROP TABLE IF EXISTS officers;\nDROP TABLE IF EXISTS locations',
    expected_result_sql: 'SHOW TABLES',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  PRACTICE DML  (15 cases — INSERT / UPDATE / DELETE)
// ══════════════════════════════════════════════════════════════════════════════
const practiceDMLCases = [
  // ── EASY ──
  {
    title: 'Register a New Suspect',
    description: 'A new person of interest has been identified. Insert into `suspects`:\n- name: "James Okon"\n- age: 35\n- status: "Under Investigation"',
    objectives: '1. INSERT one row into suspects.\n2. Set name, age, and status correctly.\n3. Do not set suspect_id manually.',
    difficulty_id: EASY, base_points: 100, module_order: 2,
    correct_query: "INSERT INTO suspects (name, age, status) VALUES ('James Okon', 35, 'Under Investigation')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id',
  },
  {
    title: 'Add a New Crime Scene Location',
    description: 'A new location has been flagged. Insert into `locations`:\n- place_name: "Old Market"\n- district: "Eastside"\n- is_active: 1',
    objectives: '1. INSERT into locations.\n2. Set all three provided values.\n3. Do not set location_id manually.',
    difficulty_id: EASY, base_points: 100, module_order: 2,
    correct_query: "INSERT INTO locations (place_name, district, is_active) VALUES ('Old Market', 'Eastside', 1)",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM locations ORDER BY location_id',
  },
  {
    title: 'Log a Critical Evidence Item',
    description: 'A new piece of evidence has been tagged. Insert into `evidence`:\n- item_name: "Torn Jacket"\n- severity: 4\n- location_id: 2 (Central Warehouse)',
    objectives: '1. INSERT into evidence.\n2. Set item_name, severity, and location_id.\n3. collected_at can be left as DEFAULT.',
    difficulty_id: EASY, base_points: 100, module_order: 2,
    correct_query: "INSERT INTO evidence (item_name, severity, location_id) VALUES ('Torn Jacket', 4, 2)",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id',
  },
  {
    title: 'Record a New Witness',
    description: 'A witness came forward. Add them to `witnesses`:\n- full_name: "Diana Vong"\n- contact_number: "09451234567"',
    objectives: '1. INSERT into witnesses.\n2. Set full_name and contact_number.\n3. Do not set witness_id manually.',
    difficulty_id: EASY, base_points: 100, module_order: 2,
    correct_query: "INSERT INTO witnesses (full_name, contact_number) VALUES ('Diana Vong', '09451234567')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM witnesses ORDER BY witness_id',
  },
  {
    title: 'Enroll a New Officer',
    description: 'A new officer has been assigned. Insert into `officers`:\n- badge_number: "B-004"\n- name: "Officer Perez"\n- rank_level: "Detective"',
    objectives: '1. INSERT into officers.\n2. Set badge_number, name, and rank_level.\n3. Do not create duplicates.',
    difficulty_id: EASY, base_points: 100, module_order: 2,
    correct_query: "INSERT INTO officers (badge_number, name, rank_level) VALUES ('B-004', 'Officer Perez', 'Detective')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM officers ORDER BY officer_id',
  },
  // ── MEDIUM ──
  {
    title: 'Arrest a Cleared Suspect',
    description: 'New evidence emerged against Victor Hale who was previously "Cleared". Update his status in `suspects` to "Arrested".',
    objectives: '1. UPDATE suspects.\n2. Change only Victor Hale\'s status.\n3. Use WHERE clause to target the correct row.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 2,
    correct_query: "UPDATE suspects SET status = 'Arrested' WHERE name = 'Victor Hale'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id',
  },
  {
    title: 'Deactivate an Old Crime Scene',
    description: 'The Abandoned Factory (location_id = 5) has been ruled out as a crime scene. Update `locations` to set its is_active to 0.',
    objectives: '1. UPDATE locations.\n2. Target location_id = 5.\n3. Only change is_active.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 2,
    correct_query: 'UPDATE locations SET is_active = 0 WHERE location_id = 5',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM locations ORDER BY location_id',
  },
  {
    title: 'Escalate Evidence Severity',
    description: 'The Bloody Glove (evidence_id = 3) is more critical than originally rated. Update its severity to 5 in `evidence`.',
    objectives: '1. UPDATE evidence.\n2. Target evidence_id = 3.\n3. Set severity = 5.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 2,
    correct_query: 'UPDATE evidence SET severity = 5 WHERE evidence_id = 3',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id',
  },
  {
    title: 'Remove a False Witness Report',
    description: 'Witness record with witness_id = 3 was a fraudulent entry. Delete that witness from `witnesses`.',
    objectives: '1. DELETE from witnesses.\n2. Target witness_id = 3 only.\n3. Do not delete other witnesses.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 2,
    correct_query: 'DELETE FROM witnesses WHERE witness_id = 3',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM witnesses ORDER BY witness_id',
  },
  {
    title: 'Promote an Officer',
    description: 'Officer Santos (officer_id = 1) has been promoted. Update their rank_level to "Senior Detective" in `officers`.',
    objectives: '1. UPDATE officers.\n2. Target officer_id = 1.\n3. Set rank_level to "Senior Detective".',
    difficulty_id: MEDIUM, base_points: 200, module_order: 2,
    correct_query: "UPDATE officers SET rank_level = 'Senior Detective' WHERE officer_id = 1",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM officers ORDER BY officer_id',
  },
  // ── HARD ──
  {
    title: 'Batch Clear All Low-Severity Evidence',
    description: 'All evidence with severity = 1 is non-critical and should be removed. Delete ALL such rows from `evidence`.',
    objectives: '1. DELETE from evidence.\n2. Use WHERE severity = 1.\n3. Multiple rows may be deleted.',
    difficulty_id: HARD, base_points: 300, module_order: 2,
    correct_query: 'DELETE FROM evidence WHERE severity = 1',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id',
  },
  {
    title: 'Bulk Insert Multiple Suspects',
    description: 'Three new persons of interest have been identified. Insert ALL THREE into `suspects` in ONE INSERT statement:\n1. "Ana Vega", 27, "Under Investigation"\n2. "Ben Solis", 41, "Under Investigation"\n3. "Cia Tan", 19, "Cleared"',
    objectives: '1. Use a single INSERT with multiple value rows.\n2. Insert all 3 rows exactly as specified.\n3. Do not use separate INSERT statements.',
    difficulty_id: HARD, base_points: 300, module_order: 2,
    correct_query: "INSERT INTO suspects (name, age, status) VALUES ('Ana Vega', 27, 'Under Investigation'), ('Ben Solis', 41, 'Under Investigation'), ('Cia Tan', 19, 'Cleared')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id',
  },
  {
    title: 'Archive Arrested Suspects',
    description: 'Update all suspects with status = "Arrested" to status = "Archived". This will affect multiple rows.',
    objectives: '1. UPDATE suspects.\n2. Target all rows where status = "Arrested".\n3. Set status = "Archived".',
    difficulty_id: HARD, base_points: 300, module_order: 2,
    correct_query: "UPDATE suspects SET status = 'Archived' WHERE status = 'Arrested'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id',
  },
  {
    title: 'Transfer All Warehouse Evidence to HQ',
    description: 'All evidence found at the Central Warehouse (location_id = 2) must be transferred to Police HQ (location_id = 4). Update `evidence`.',
    objectives: '1. UPDATE evidence.\n2. Use WHERE location_id = 2.\n3. Set location_id = 4.',
    difficulty_id: HARD, base_points: 300, module_order: 2,
    correct_query: 'UPDATE evidence SET location_id = 4 WHERE location_id = 2',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id',
  },
  {
    title: 'Clear Inactive Locations',
    description: 'Remove all inactive locations (is_active = 0). First set evidence.location_id = NULL for evidence linked to those locations (to avoid FK constraint errors), then delete the inactive locations.',
    objectives: '1. UPDATE evidence: set location_id = NULL where linked to inactive location.\n2. DELETE from locations where is_active = 0.',
    difficulty_id: HARD, base_points: 300, module_order: 2,
    correct_query: "UPDATE evidence SET location_id = NULL WHERE location_id IN (SELECT location_id FROM locations WHERE is_active = 0);\nDELETE FROM locations WHERE is_active = 0",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT * FROM locations ORDER BY location_id',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  PRACTICE DQL  (15 cases — SELECT / JOIN)
// ══════════════════════════════════════════════════════════════════════════════
const practiceDQLCases = [
  // ── EASY ──
  {
    title: 'List All Active Suspects',
    description: 'Show name and age of all suspects with status = "Under Investigation".',
    objectives: '1. SELECT from suspects.\n2. Filter status = "Under Investigation".\n3. Show name and age.',
    difficulty_id: EASY, base_points: 100, module_order: 3,
    correct_query: "SELECT name, age FROM suspects WHERE status = 'Under Investigation'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: "SELECT name, age FROM suspects WHERE status = 'Under Investigation'",
  },
  {
    title: 'Find High-Severity Evidence',
    description: 'Show all evidence items where severity >= 4. Display item_name and severity.',
    objectives: '1. SELECT from evidence.\n2. Filter severity >= 4.\n3. Show item_name and severity.',
    difficulty_id: EASY, base_points: 100, module_order: 3,
    correct_query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
  },
  {
    title: 'View Active Crime Scene Locations',
    description: 'List all active crime scene locations (is_active = 1). Show place_name and district.',
    objectives: '1. SELECT from locations.\n2. Filter is_active = 1.\n3. Show place_name and district.',
    difficulty_id: EASY, base_points: 100, module_order: 3,
    correct_query: 'SELECT place_name, district FROM locations WHERE is_active = 1',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT place_name, district FROM locations WHERE is_active = 1',
  },
  {
    title: 'Show All Witnesses',
    description: 'Generate a full witness contact list. Show full_name and contact_number for all witnesses.',
    objectives: '1. SELECT from witnesses.\n2. Show full_name and contact_number.\n3. No filter needed.',
    difficulty_id: EASY, base_points: 100, module_order: 3,
    correct_query: 'SELECT full_name, contact_number FROM witnesses',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT full_name, contact_number FROM witnesses',
  },
  {
    title: 'Find Junior Officers',
    description: 'Show all officers with rank_level = "Junior Officer". Display name and badge_number.',
    objectives: '1. SELECT from officers.\n2. Filter rank_level = "Junior Officer".\n3. Show name and badge_number.',
    difficulty_id: EASY, base_points: 100, module_order: 3,
    correct_query: "SELECT name, badge_number FROM officers WHERE rank_level = 'Junior Officer'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: "SELECT name, badge_number FROM officers WHERE rank_level = 'Junior Officer'",
  },
  // ── MEDIUM ──
  {
    title: 'Evidence Per Crime Scene',
    description: 'Show each crime scene and how many evidence items were found there. Show place_name and count.',
    objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. Show place_name and COUNT of evidence.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 3,
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
  },
  {
    title: 'Suspects Older Than 30',
    description: 'Filter suspects to show only those older than 30. Show name, age, status. Order by age DESC.',
    objectives: '1. SELECT from suspects.\n2. Filter age > 30.\n3. ORDER BY age DESC.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 3,
    correct_query: 'SELECT name, age, status FROM suspects WHERE age > 30 ORDER BY age DESC',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT name, age, status FROM suspects WHERE age > 30 ORDER BY age DESC',
  },
  {
    title: 'Average Evidence Severity by Location',
    description: 'Show place_name and average severity per crime scene, ordered by average severity DESC.',
    objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. Use AVG(severity) and ORDER BY DESC.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 3,
    correct_query: 'SELECT l.place_name, AVG(e.severity) AS avg_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY avg_severity DESC',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT l.place_name, AVG(e.severity) AS avg_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY avg_severity DESC',
  },
  {
    title: 'Count Suspects by Status',
    description: 'Show a summary of how many suspects fall under each investigation status.',
    objectives: '1. SELECT from suspects.\n2. GROUP BY status.\n3. Show status and count.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 3,
    correct_query: 'SELECT status, COUNT(*) AS count FROM suspects GROUP BY status',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT status, COUNT(*) AS count FROM suspects GROUP BY status',
  },
  {
    title: 'Most Critical Evidence First',
    description: 'Show a full list of evidence sorted by severity (highest first). Display item_name, severity, and place_name via JOIN.',
    objectives: '1. LEFT JOIN evidence and locations.\n2. ORDER BY evidence.severity DESC.\n3. Show item_name, severity, place_name.',
    difficulty_id: MEDIUM, base_points: 200, module_order: 3,
    correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
  },
  // ── HARD ──
  {
    title: 'Locations With No Evidence',
    description: 'Identify crime scene locations where no evidence has been logged yet. Use LEFT JOIN and filter for NULL.',
    objectives: '1. LEFT JOIN locations and evidence.\n2. Filter WHERE evidence_id IS NULL.\n3. Show place_name.',
    difficulty_id: HARD, base_points: 300, module_order: 3,
    correct_query: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
  },
  {
    title: 'Locations With More Than One Evidence',
    description: 'Find all crime scene locations with MORE THAN ONE piece of evidence. Use HAVING.',
    objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. Use HAVING COUNT > 1.\n4. Show place_name and evidence_count.',
    difficulty_id: HARD, base_points: 300, module_order: 3,
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
  },
  {
    title: 'Maximum Evidence at Any Single Location',
    description: 'Find the crime scene location with the MOST evidence items. Show only the top location (LIMIT 1).',
    objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. ORDER BY count DESC.\n4. LIMIT 1.',
    difficulty_id: HARD, base_points: 300, module_order: 3,
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
  },
  {
    title: 'Full Suspect-Evidence UNION Report',
    description: 'Produce a combined report using UNION: list each suspect name + status AND each evidence item_name + severity. Format as two columns: label and value.',
    objectives: '1. SELECT name as label, status as value FROM suspects.\n2. UNION with SELECT item_name as label, CAST(severity AS CHAR) as value FROM evidence.\n3. Use UNION.',
    difficulty_id: HARD, base_points: 300, module_order: 3,
    correct_query: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
  },
  {
    title: 'High-Severity Evidence in Active Locations',
    description: 'Show all high-severity evidence (severity >= 4) found only at ACTIVE locations (is_active = 1). Show item_name, severity, and place_name.',
    objectives: '1. JOIN evidence and locations.\n2. Filter severity >= 4 AND locations.is_active = 1.\n3. Show item_name, severity, place_name.',
    difficulty_id: HARD, base_points: 300, module_order: 3,
    correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  RANK DDL  (15 cases — same schema, competitive scenario)
// ══════════════════════════════════════════════════════════════════════════════
const rankDDLCases = [
  // EASY
  { title: 'Create the Suspects Table', description: 'Create a table named `suspects` with:\n- suspect_id (INT, PK, AI)\n- name (VARCHAR 100, NOT NULL)\n- age (INT)\n- status (VARCHAR 50, DEFAULT "Under Investigation")', objectives: '1. Create suspects table.\n2. suspect_id is AUTO_INCREMENT PK.\n3. name is NOT NULL.\n4. status has DEFAULT.', difficulty_id: EASY, base_points: 100, module_order: 1, correct_query: "CREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')", setup_sql: 'DROP TABLE IF EXISTS suspects', expected_result_sql: 'SHOW COLUMNS FROM suspects' },
  { title: 'Set Up the Witness Table', description: 'Create `witnesses` with:\n- witness_id (INT, PK, AI)\n- full_name (VARCHAR 100, NOT NULL)\n- contact_number (VARCHAR 20)', objectives: '1. Create witnesses.\n2. witness_id is AUTO_INCREMENT PK.\n3. full_name is NOT NULL.', difficulty_id: EASY, base_points: 100, module_order: 1, correct_query: 'CREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20))', setup_sql: 'DROP TABLE IF EXISTS witnesses', expected_result_sql: 'SHOW COLUMNS FROM witnesses' },
  { title: 'Build the Evidence Table', description: 'Create `evidence` with:\n- evidence_id (INT, PK, AI)\n- item_name (VARCHAR 100, NOT NULL)\n- severity (INT, DEFAULT 1)\n- location_id (INT)', objectives: '1. Create evidence.\n2. item_name is NOT NULL.\n3. severity defaults to 1.', difficulty_id: EASY, base_points: 100, module_order: 1, correct_query: 'CREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT)', setup_sql: 'DROP TABLE IF EXISTS evidence', expected_result_sql: 'SHOW COLUMNS FROM evidence' },
  { title: 'Create the Locations Table', description: 'Create `locations` with:\n- location_id (INT, PK, AI)\n- place_name (VARCHAR 100, NOT NULL)\n- district (VARCHAR 100)\n- is_active (TINYINT 1, DEFAULT 1)', objectives: '1. Create locations.\n2. place_name is NOT NULL.\n3. is_active defaults to 1.', difficulty_id: EASY, base_points: 100, module_order: 1, correct_query: 'CREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1)', setup_sql: 'DROP TABLE IF EXISTS locations', expected_result_sql: 'SHOW COLUMNS FROM locations' },
  { title: 'Register the Officers Table', description: 'Create `officers` with:\n- officer_id (INT, PK, AI)\n- badge_number (VARCHAR 20, UNIQUE, NOT NULL)\n- name (VARCHAR 100, NOT NULL)\n- rank_level (VARCHAR 50)', objectives: '1. Create officers.\n2. badge_number is UNIQUE and NOT NULL.\n3. name is NOT NULL.', difficulty_id: EASY, base_points: 100, module_order: 1, correct_query: 'CREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))', setup_sql: 'DROP TABLE IF EXISTS officers', expected_result_sql: 'SHOW COLUMNS FROM officers' },
  // MEDIUM
  { title: 'Add Arrested-At Column', description: 'The suspects table exists. Add column `arrested_at` (DATETIME, allows NULL) using ALTER TABLE.', objectives: '1. ALTER TABLE suspects.\n2. Add arrested_at DATETIME.\n3. Must allow NULL.', difficulty_id: MEDIUM, base_points: 200, module_order: 1, correct_query: 'ALTER TABLE suspects ADD COLUMN arrested_at DATETIME', setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')", expected_result_sql: 'SHOW COLUMNS FROM suspects' },
  { title: 'Link Evidence to Locations via FK', description: 'Both tables exist. Add FOREIGN KEY on evidence.location_id → locations(location_id).', objectives: '1. ALTER TABLE evidence.\n2. Add FOREIGN KEY referencing locations(location_id).', difficulty_id: MEDIUM, base_points: 200, module_order: 1, correct_query: 'ALTER TABLE evidence ADD FOREIGN KEY (location_id) REFERENCES locations(location_id)', setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1);\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT)", expected_result_sql: 'SHOW COLUMNS FROM evidence' },
  { title: 'Rename Suspect Status Column', description: 'Rename `status` in `suspects` to `case_status` keeping VARCHAR(50).', objectives: '1. Use ALTER TABLE CHANGE.\n2. Keep VARCHAR(50) type.\n3. Keep the same DEFAULT.', difficulty_id: MEDIUM, base_points: 200, module_order: 1, correct_query: "ALTER TABLE suspects CHANGE status case_status VARCHAR(50) DEFAULT 'Under Investigation'", setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')", expected_result_sql: 'SHOW COLUMNS FROM suspects' },
  { title: 'Drop contact_number from Witnesses', description: 'The contact_number column in `witnesses` will be moved to a separate system. Remove it.', objectives: '1. ALTER TABLE witnesses DROP COLUMN contact_number.\n2. Table should have 2 remaining columns.', difficulty_id: MEDIUM, base_points: 200, module_order: 1, correct_query: 'ALTER TABLE witnesses DROP COLUMN contact_number', setup_sql: 'DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20))', expected_result_sql: 'SHOW COLUMNS FROM witnesses' },
  { title: 'Add UNIQUE Constraint on Badge Number', description: 'The officers table was created without UNIQUE on badge_number. Add it using ALTER TABLE.', objectives: '1. ALTER TABLE officers ADD UNIQUE (badge_number).\n2. Do not recreate the table.', difficulty_id: MEDIUM, base_points: 200, module_order: 1, correct_query: 'ALTER TABLE officers ADD UNIQUE (badge_number)', setup_sql: 'DROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))', expected_result_sql: 'SHOW COLUMNS FROM officers' },
  // HARD
  { title: 'Create Case Assignments Junction Table', description: 'Create `case_assignments` with:\n- assignment_id (INT, PK, AI)\n- officer_id (INT, NOT NULL, FK→officers)\n- suspect_id (INT, NOT NULL, FK→suspects)\n- assigned_date (DATE, NOT NULL)', objectives: '1. Both FKs must be set.\n2. assigned_date NOT NULL.\n3. Create in correct dependency order.', difficulty_id: HARD, base_points: 300, module_order: 1, correct_query: "CREATE TABLE case_assignments (assignment_id INT AUTO_INCREMENT PRIMARY KEY, officer_id INT NOT NULL, suspect_id INT NOT NULL, assigned_date DATE NOT NULL, FOREIGN KEY (officer_id) REFERENCES officers(officer_id), FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id))", setup_sql: "DROP TABLE IF EXISTS case_assignments;\nDROP TABLE IF EXISTS suspects;\nDROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50));\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')", expected_result_sql: 'SHOW COLUMNS FROM case_assignments' },
  { title: 'Constrained Evidence Table', description: 'Create `evidence` with:\n- evidence_id (INT, PK, AI)\n- item_name (VARCHAR 100, NOT NULL, UNIQUE)\n- severity (INT, CHECK 1-5)\n- location_id (INT, FK→locations)\n- collected_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)', objectives: '1. item_name must be UNIQUE.\n2. severity CHECK constraint (1-5).\n3. FK to locations.', difficulty_id: HARD, base_points: 300, module_order: 1, correct_query: 'CREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL UNIQUE, severity INT CHECK (severity >= 1 AND severity <= 5), location_id INT, collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (location_id) REFERENCES locations(location_id))', setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1)", expected_result_sql: 'SHOW COLUMNS FROM evidence' },
  { title: 'Rebuild Suspects with ENUM Status', description: 'Drop and recreate `suspects` with ENUM status, CHECK on age, and created_at timestamp.', objectives: '1. Drop existing table.\n2. Use ENUM for status.\n3. CHECK age >= 0.\n4. created_at uses CURRENT_TIMESTAMP.', difficulty_id: HARD, base_points: 300, module_order: 1, correct_query: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT CHECK (age >= 0), status ENUM('Under Investigation','Cleared','Arrested') DEFAULT 'Under Investigation', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)", setup_sql: 'DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))', expected_result_sql: 'SHOW COLUMNS FROM suspects' },
  { title: 'Build the Audit Log Table', description: 'Create `audit_log` with:\n- log_id (INT, PK, AI)\n- suspect_id (INT, FK→suspects ON DELETE CASCADE)\n- action (ENUM "INSERT","UPDATE","DELETE", NOT NULL)\n- changed_by (VARCHAR 100)\n- changed_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)', objectives: '1. FK with ON DELETE CASCADE.\n2. action is ENUM with 3 values.\n3. changed_at uses CURRENT_TIMESTAMP.', difficulty_id: HARD, base_points: 300, module_order: 1, correct_query: "CREATE TABLE audit_log (log_id INT AUTO_INCREMENT PRIMARY KEY, suspect_id INT, action ENUM('INSERT','UPDATE','DELETE') NOT NULL, changed_by VARCHAR(100), changed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id) ON DELETE CASCADE)", setup_sql: "DROP TABLE IF EXISTS audit_log;\nDROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')", expected_result_sql: 'SHOW COLUMNS FROM audit_log' },
  { title: 'Full Investigation Schema in One Shot', description: 'Create ALL 5 tables in correct dependency order:\n1. locations\n2. officers\n3. suspects\n4. witnesses\n5. evidence (FK→locations)', objectives: '1. All 5 tables created.\n2. evidence.location_id FK to locations.\n3. Correct creation order.', difficulty_id: HARD, base_points: 300, module_order: 1, correct_query: "CREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100));\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50));\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation');\nCREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20));\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT, collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (location_id) REFERENCES locations(location_id))", setup_sql: 'DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS witnesses;\nDROP TABLE IF EXISTS suspects;\nDROP TABLE IF EXISTS officers;\nDROP TABLE IF EXISTS locations', expected_result_sql: 'SHOW TABLES' },
];

// ══════════════════════════════════════════════════════════════════════════════
//  RANK DML  (15 cases)
// ══════════════════════════════════════════════════════════════════════════════
const rankDMLCases = [
  // EASY
  { title: 'Insert a New Suspect', description: 'Insert into suspects: name="Carlos Dizon", age=29, status="Under Investigation"', objectives: '1. INSERT into suspects.\n2. Set all 3 values.', difficulty_id: EASY, base_points: 100, module_order: 2, correct_query: "INSERT INTO suspects (name, age, status) VALUES ('Carlos Dizon', 29, 'Under Investigation')", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id' },
  { title: 'Log a New Crime Scene', description: 'Insert into locations: place_name="Railway Station", district="Westside", is_active=1', objectives: '1. INSERT into locations.\n2. Set all values correctly.', difficulty_id: EASY, base_points: 100, module_order: 2, correct_query: "INSERT INTO locations (place_name, district, is_active) VALUES ('Railway Station', 'Westside', 1)", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM locations ORDER BY location_id' },
  { title: 'Record Critical Evidence', description: 'Insert into evidence: item_name="Rusty Pipe", severity=5, location_id=1', objectives: '1. INSERT into evidence.\n2. Set item_name, severity, location_id.', difficulty_id: EASY, base_points: 100, module_order: 2, correct_query: "INSERT INTO evidence (item_name, severity, location_id) VALUES ('Rusty Pipe', 5, 1)", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id' },
  { title: 'Add a New Witness', description: 'Insert into witnesses: full_name="Rita Santos", contact_number="09551234567"', objectives: '1. INSERT into witnesses.\n2. Set full_name and contact_number.', difficulty_id: EASY, base_points: 100, module_order: 2, correct_query: "INSERT INTO witnesses (full_name, contact_number) VALUES ('Rita Santos', '09551234567')", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM witnesses ORDER BY witness_id' },
  { title: 'Assign a New Officer', description: 'Insert into officers: badge_number="B-004", name="Officer Gomez", rank_level="Sergeant"', objectives: '1. INSERT into officers.\n2. Set all values.', difficulty_id: EASY, base_points: 100, module_order: 2, correct_query: "INSERT INTO officers (badge_number, name, rank_level) VALUES ('B-004', 'Officer Gomez', 'Sergeant')", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM officers ORDER BY officer_id' },
  // MEDIUM
  { title: 'Arrest Victor Hale', description: 'Victor Hale\'s status needs to change to "Arrested". UPDATE suspects accordingly.', objectives: '1. UPDATE suspects.\n2. WHERE name = "Victor Hale".\n3. SET status = "Arrested".', difficulty_id: MEDIUM, base_points: 200, module_order: 2, correct_query: "UPDATE suspects SET status = 'Arrested' WHERE name = 'Victor Hale'", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id' },
  { title: 'Deactivate Riverside Park', description: 'Riverside Park (location_id=3) is no longer active. Set is_active=0.', objectives: '1. UPDATE locations.\n2. WHERE location_id=3.\n3. SET is_active=0.', difficulty_id: MEDIUM, base_points: 200, module_order: 2, correct_query: 'UPDATE locations SET is_active = 0 WHERE location_id = 3', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM locations ORDER BY location_id' },
  { title: 'Downgrade Low Evidence Severity', description: 'The Receipt Paper (evidence_id=4) is not credible. Downgrade its severity to 0.', objectives: '1. UPDATE evidence.\n2. WHERE evidence_id=4.\n3. SET severity=0.', difficulty_id: MEDIUM, base_points: 200, module_order: 2, correct_query: 'UPDATE evidence SET severity = 0 WHERE evidence_id = 4', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id' },
  { title: 'Remove a Fraudulent Witness', description: 'witness_id=2 was found to be fraudulent. Delete that row from witnesses.', objectives: '1. DELETE from witnesses.\n2. WHERE witness_id=2.\n3. Only that row.', difficulty_id: MEDIUM, base_points: 200, module_order: 2, correct_query: 'DELETE FROM witnesses WHERE witness_id = 2', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM witnesses ORDER BY witness_id' },
  { title: 'Demote a Junior Officer', description: 'Officer Lim (officer_id=3) has been demoted. Change rank_level to "Trainee".', objectives: '1. UPDATE officers.\n2. WHERE officer_id=3.\n3. SET rank_level="Trainee".', difficulty_id: MEDIUM, base_points: 200, module_order: 2, correct_query: "UPDATE officers SET rank_level = 'Trainee' WHERE officer_id = 3", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM officers ORDER BY officer_id' },
  // HARD
  { title: 'Purge All Severity-1 Evidence', description: 'Delete all evidence with severity = 1 from the evidence table.', objectives: '1. DELETE from evidence.\n2. WHERE severity=1.\n3. Multiple rows may be affected.', difficulty_id: HARD, base_points: 300, module_order: 2, correct_query: 'DELETE FROM evidence WHERE severity = 1', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id' },
  { title: 'Bulk Suspect Registration', description: 'Insert 3 suspects in one statement:\n1. "Ana Vega", 27, "Under Investigation"\n2. "Ben Solis", 41, "Under Investigation"\n3. "Cia Tan", 19, "Cleared"', objectives: '1. Single INSERT statement.\n2. All 3 rows inserted.', difficulty_id: HARD, base_points: 300, module_order: 2, correct_query: "INSERT INTO suspects (name, age, status) VALUES ('Ana Vega', 27, 'Under Investigation'), ('Ben Solis', 41, 'Under Investigation'), ('Cia Tan', 19, 'Cleared')", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id' },
  { title: 'Mass-Archive Arrested Suspects', description: 'Update all suspects with status="Arrested" to status="Archived".', objectives: '1. UPDATE suspects.\n2. WHERE status="Arrested".\n3. Affects multiple rows.', difficulty_id: HARD, base_points: 300, module_order: 2, correct_query: "UPDATE suspects SET status = 'Archived' WHERE status = 'Arrested'", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id' },
  { title: 'Move Park Evidence to HQ', description: 'Move all evidence from Riverside Park (location_id=3) to Police HQ (location_id=4).', objectives: '1. UPDATE evidence.\n2. WHERE location_id=3.\n3. SET location_id=4.', difficulty_id: HARD, base_points: 300, module_order: 2, correct_query: 'UPDATE evidence SET location_id = 4 WHERE location_id = 3', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM evidence ORDER BY evidence_id' },
  { title: 'Clean Up Inactive Locations', description: 'Remove all inactive locations. First set evidence.location_id=NULL for evidence linked to inactive locations, then delete them.', objectives: '1. UPDATE evidence SET location_id=NULL for inactive locations.\n2. DELETE inactive locations.', difficulty_id: HARD, base_points: 300, module_order: 2, correct_query: "UPDATE evidence SET location_id = NULL WHERE location_id IN (SELECT location_id FROM locations WHERE is_active = 0);\nDELETE FROM locations WHERE is_active = 0", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT * FROM locations ORDER BY location_id' },
];

// ══════════════════════════════════════════════════════════════════════════════
//  RANK DQL  (15 cases)
// ══════════════════════════════════════════════════════════════════════════════
const rankDQLCases = [
  // EASY
  { title: 'List Arrested Suspects', description: 'Show name and age of all suspects with status="Arrested".', objectives: '1. SELECT from suspects.\n2. Filter status="Arrested".\n3. Show name and age.', difficulty_id: EASY, base_points: 100, module_order: 3, correct_query: "SELECT name, age FROM suspects WHERE status = 'Arrested'", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: "SELECT name, age FROM suspects WHERE status = 'Arrested'" },
  { title: 'High-Priority Evidence', description: 'List item_name and severity for all evidence where severity >= 4.', objectives: '1. SELECT from evidence.\n2. Filter severity>=4.\n3. Show item_name and severity.', difficulty_id: EASY, base_points: 100, module_order: 3, correct_query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT item_name, severity FROM evidence WHERE severity >= 4' },
  { title: 'Active Crime Scenes', description: 'Show place_name and district for all active locations (is_active=1).', objectives: '1. SELECT from locations.\n2. Filter is_active=1.\n3. Show place_name and district.', difficulty_id: EASY, base_points: 100, module_order: 3, correct_query: 'SELECT place_name, district FROM locations WHERE is_active = 1', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT place_name, district FROM locations WHERE is_active = 1' },
  { title: 'Full Witness Directory', description: 'Show full_name and contact_number for all witnesses.', objectives: '1. SELECT from witnesses.\n2. Show full_name and contact_number.\n3. No filter needed.', difficulty_id: EASY, base_points: 100, module_order: 3, correct_query: 'SELECT full_name, contact_number FROM witnesses', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT full_name, contact_number FROM witnesses' },
  { title: 'Find Detective-Rank Officers', description: 'Show name and badge_number for all officers with rank_level="Detective".', objectives: '1. SELECT from officers.\n2. Filter rank_level="Detective".\n3. Show name and badge_number.', difficulty_id: EASY, base_points: 100, module_order: 3, correct_query: "SELECT name, badge_number FROM officers WHERE rank_level = 'Detective'", setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: "SELECT name, badge_number FROM officers WHERE rank_level = 'Detective'" },
  // MEDIUM
  { title: 'Evidence Count Per Scene', description: 'Show each crime scene and count of evidence. Show place_name and evidence_count.', objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. Show place_name and count.', difficulty_id: MEDIUM, base_points: 200, module_order: 3, correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name' },
  { title: 'Young Suspects Under 30', description: 'Show name, age, status of all suspects younger than 30. ORDER BY age ASC.', objectives: '1. SELECT from suspects.\n2. Filter age < 30.\n3. ORDER BY age ASC.', difficulty_id: MEDIUM, base_points: 200, module_order: 3, correct_query: 'SELECT name, age, status FROM suspects WHERE age < 30 ORDER BY age ASC', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT name, age, status FROM suspects WHERE age < 30 ORDER BY age ASC' },
  { title: 'Max Severity Per Location', description: 'Show place_name and max severity per location, ordered by max severity DESC.', objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. Use MAX(severity) ORDER BY DESC.', difficulty_id: MEDIUM, base_points: 200, module_order: 3, correct_query: 'SELECT l.place_name, MAX(e.severity) AS max_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY max_severity DESC', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT l.place_name, MAX(e.severity) AS max_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY max_severity DESC' },
  { title: 'Suspect Status Summary', description: 'Show how many suspects are in each status group.', objectives: '1. SELECT from suspects.\n2. GROUP BY status.\n3. Show status and COUNT.', difficulty_id: MEDIUM, base_points: 200, module_order: 3, correct_query: 'SELECT status, COUNT(*) AS total FROM suspects GROUP BY status', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT status, COUNT(*) AS total FROM suspects GROUP BY status' },
  { title: 'Evidence Ranked by Severity', description: 'Show item_name, severity, place_name for all evidence joined to locations, sorted by severity DESC.', objectives: '1. LEFT JOIN evidence and locations.\n2. Show item_name, severity, place_name.\n3. ORDER BY severity DESC.', difficulty_id: MEDIUM, base_points: 200, module_order: 3, correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC' },
  // HARD
  { title: 'Locations With No Evidence', description: 'Find locations where no evidence has been logged. Use LEFT JOIN + IS NULL.', objectives: '1. LEFT JOIN locations and evidence.\n2. Filter WHERE evidence_id IS NULL.\n3. Show place_name.', difficulty_id: HARD, base_points: 300, module_order: 3, correct_query: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL' },
  { title: 'Hot Zones: Scenes With 2+ Evidence', description: 'Show locations with more than 1 evidence item using HAVING.', objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. HAVING COUNT > 1.', difficulty_id: HARD, base_points: 300, module_order: 3, correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1' },
  { title: 'Top Crime Scene', description: 'Show the single location with the most evidence. Use ORDER BY + LIMIT 1.', objectives: '1. JOIN evidence and locations.\n2. GROUP BY location.\n3. ORDER BY count DESC LIMIT 1.', difficulty_id: HARD, base_points: 300, module_order: 3, correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1' },
  { title: 'Full Investigation UNION Report', description: 'UNION suspects (name as label, status as value) and evidence (item_name as label, severity as value).', objectives: '1. SELECT name, status from suspects.\n2. UNION with SELECT item_name, CAST(severity AS CHAR) from evidence.\n3. Use UNION.', difficulty_id: HARD, base_points: 300, module_order: 3, correct_query: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence' },
  { title: 'Critical Evidence in Active Zones', description: 'Show high-severity evidence (severity>=4) found at ACTIVE locations. Show item_name, severity, place_name.', objectives: '1. JOIN evidence and locations.\n2. Filter severity>=4 AND is_active=1.\n3. Show item_name, severity, place_name.', difficulty_id: HARD, base_points: 300, module_order: 3, correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1', setup_sql: FULL_SCHEMA_SETUP, expected_result_sql: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1' },
];

// ══════════════════════════════════════════════════════════════════════════════
//  SEEDER
// ══════════════════════════════════════════════════════════════════════════════
async function seedCases(cases, mode, sqlType) {
  let count = 0;
  for (const c of cases) {
    const [result] = await systemDB.query(
      `INSERT INTO cases
        (title, description, objectives, dataset_id, difficulty_id, correct_query, base_points,
         is_active, unlock_xp_required, mode, sql_type, setup_sql, expected_result_sql, module_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)`,
      [
        c.title, c.description, c.objectives,
        DATASET_ID, c.difficulty_id, c.correct_query, c.base_points,
        mode, sqlType, c.setup_sql || null, c.expected_result_sql || null, c.module_order,
      ]
    );
    count++;
    console.log(`  [${mode} ${sqlType} D${c.difficulty_id}] "${c.title}" → #${result.insertId}`);
  }
  return count;
}

async function main() {
  console.log('\n🔄 Detective Query — Case Migration\n');

  // Step 1: Archive all existing active cases
  const [archived] = await systemDB.query('UPDATE cases SET is_active = 0 WHERE is_active = 1');
  console.log(`📦 Archived ${archived.affectedRows} old active cases.\n`);

  // Step 2: Insert all new cases
  console.log('─── PRACTICE DDL ───');
  const pDDL = await seedCases(practiceDDLCases, 'Practice', 'DDL');

  console.log('\n─── PRACTICE DML ───');
  const pDML = await seedCases(practiceDMLCases, 'Practice', 'DML');

  console.log('\n─── PRACTICE DQL ───');
  const pDQL = await seedCases(practiceDQLCases, 'Practice', 'DQL');

  console.log('\n─── RANK DDL ───');
  const rDDL = await seedCases(rankDDLCases, 'Rank', 'DDL');

  console.log('\n─── RANK DML ───');
  const rDML = await seedCases(rankDMLCases, 'Rank', 'DML');

  console.log('\n─── RANK DQL ───');
  const rDQL = await seedCases(rankDQLCases, 'Rank', 'DQL');

  const total = pDDL + pDML + pDQL + rDDL + rDML + rDQL;
  console.log(`\n✅ Done! Total inserted: ${total} cases`);
  console.log(`   Practice → DDL:${pDDL} DML:${pDML} DQL:${pDQL}`);
  console.log(`   Rank     → DDL:${rDDL} DML:${rDML} DQL:${rDQL}`);

  process.exit(0);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
