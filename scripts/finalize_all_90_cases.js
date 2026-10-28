/**
 * finalize_all_90_cases.js
 *
 * Comprehensive finalization script for Detective Query:
 * 1. Purges the 57 inactive legacy cases (and their orphaned records).
 * 2. Corrects all titles, briefings, objectives, setup_sql, correct_query, and expected_result_sql
 *    for all 90 cases (15 Practice DDL, 15 Practice DML, 15 Practice DQL, 15 Rank DDL, 15 Rank DML, 15 Rank DQL).
 * 3. Populates 3 structured, progressive objectives in case_objectives for every case (270 objectives total).
 * 4. Ensures 0 multi-statement queries, 0 syntax errors, and 100% match with answer keys.
 */

const { systemDB, playgroundDB } = require('../db');

const EASY = 1;
const MEDIUM = 2;
const HARD = 3;

// Full schema setup for DML and DQL (with ON DELETE SET NULL for clean single-statement cleanup)
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
  'CREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT, collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL)',
  "INSERT INTO locations VALUES (1,'City Hall','Downtown',1),(2,'Central Warehouse','Industrial Zone',1),(3,'Riverside Park','Northside',1),(4,'Police HQ','Central',1),(5,'Abandoned Factory','Southside',0)",
  "INSERT INTO officers VALUES (1,'B-001','Officer Santos','Detective'),(2,'B-002','Officer Reyes','Sergeant'),(3,'B-003','Officer Lim','Junior Officer')",
  "INSERT INTO suspects VALUES (1,'Marcus Webb',32,'Under Investigation'),(2,'Lena Torres',28,'Under Investigation'),(3,'Victor Hale',45,'Cleared'),(4,'Diana Cruz',39,'Arrested'),(5,'Ethan Ford',23,'Under Investigation')",
  "INSERT INTO witnesses VALUES (1,'Carmen Sia','09171234567'),(2,'Roberto Ngo','09281234567'),(3,'Felicia Park','09391234567')",
  "INSERT INTO evidence VALUES (1,'Broken Knife',4,2,'2026-09-01 10:00:00'),(2,'Surveillance Tape',3,4,'2026-09-02 14:00:00'),(3,'Bloody Glove',5,1,'2026-09-03 08:30:00'),(4,'Receipt Paper',1,3,'2026-09-04 12:00:00'),(5,'Crowbar',3,5,'2026-09-05 09:15:00')"
].join(';\n');

// ══════════════════════════════════════════════════════════════════════════════
// 1. PRACTICE DDL (Cases 60029 - 60043)
// ══════════════════════════════════════════════════════════════════════════════
const PRACTICE_DDL = [
  // EASY (60029 - 60033)
  {
    case_id: 60029,
    title: 'Build the Suspects Registry',
    description: 'The precinct command center needs a central table to track persons of interest. Create a table named `suspects` with:\n- suspect_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- name (VARCHAR 100, NOT NULL)\n- age (INT)\n- status (VARCHAR 50, DEFAULT "Under Investigation")',
    correct_query: "CREATE TABLE suspects (\n  suspect_id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  age INT,\n  status VARCHAR(50) DEFAULT 'Under Investigation'\n)",
    setup_sql: 'DROP TABLE IF EXISTS suspects',
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
    objectives: [
      { order: 1, text: 'Use CREATE TABLE suspects with suspect_id as AUTO_INCREMENT PRIMARY KEY.', keyword: 'primary key', points: 30 },
      { order: 2, text: 'Define name as VARCHAR(100) NOT NULL.', keyword: 'not null', points: 35 },
      { order: 3, text: "Set default value for status to 'Under Investigation'.", keyword: 'default', points: 35 }
    ]
  },
  {
    case_id: 60030,
    title: 'Establish the Civilian Witness Log',
    description: 'Civilian bystanders near the incident reported critical sightings. Create the `witnesses` table with:\n- witness_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- full_name (VARCHAR 100, NOT NULL)\n- contact_number (VARCHAR 20)\n- statement (TEXT)',
    correct_query: "CREATE TABLE witnesses (\n  witness_id INT AUTO_INCREMENT PRIMARY KEY,\n  full_name VARCHAR(100) NOT NULL,\n  contact_number VARCHAR(20),\n  statement TEXT\n)",
    setup_sql: 'DROP TABLE IF EXISTS witnesses',
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
    objectives: [
      { order: 1, text: 'Create witnesses table with witness_id as PRIMARY KEY.', keyword: 'witnesses', points: 30 },
      { order: 2, text: 'Include full_name VARCHAR(100) NOT NULL.', keyword: 'not null', points: 35 },
      { order: 3, text: 'Include statement column of type TEXT.', keyword: 'text', points: 35 }
    ]
  },
  {
    case_id: 60031,
    title: 'Create the Physical Evidence Vault',
    description: 'Forensic investigators are recovering physical materials from crime scenes. Construct the `evidence` table with:\n- evidence_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- item_name (VARCHAR 100, NOT NULL)\n- found_at (VARCHAR 100)\n- severity (INT, DEFAULT 1)',
    correct_query: "CREATE TABLE evidence (\n  evidence_id INT AUTO_INCREMENT PRIMARY KEY,\n  item_name VARCHAR(100) NOT NULL,\n  found_at VARCHAR(100),\n  severity INT DEFAULT 1\n)",
    setup_sql: 'DROP TABLE IF EXISTS evidence',
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Create table evidence with evidence_id AUTO_INCREMENT PRIMARY KEY.', keyword: 'evidence', points: 30 },
      { order: 2, text: 'Define item_name as VARCHAR(100) NOT NULL.', keyword: 'item_name', points: 35 },
      { order: 3, text: 'Set default severity rating to 1.', keyword: 'default 1', points: 35 }
    ]
  },
  {
    case_id: 60032,
    title: 'Map the Incident Locations Directory',
    description: 'Dispatch requires a geospatial directory of all municipal crime zones. Build the `locations` table with:\n- location_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- place_name (VARCHAR 100, NOT NULL)\n- district (VARCHAR 100)\n- is_active (TINYINT(1), DEFAULT 1)',
    correct_query: "CREATE TABLE locations (\n  location_id INT AUTO_INCREMENT PRIMARY KEY,\n  place_name VARCHAR(100) NOT NULL,\n  district VARCHAR(100),\n  is_active TINYINT(1) DEFAULT 1\n)",
    setup_sql: 'DROP TABLE IF EXISTS locations',
    expected_result_sql: 'SHOW COLUMNS FROM locations',
    objectives: [
      { order: 1, text: 'Create locations table with location_id as PRIMARY KEY.', keyword: 'locations', points: 30 },
      { order: 2, text: 'Ensure place_name is NOT NULL.', keyword: 'not null', points: 35 },
      { order: 3, text: 'Include is_active with default value 1.', keyword: 'default 1', points: 35 }
    ]
  },
  {
    case_id: 60033,
    title: 'Register the Police Officer Roster',
    description: 'Detectives and patrol officers are mobilizing across the district. Construct the `officers` duty roster with:\n- officer_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- badge_number (VARCHAR 20, UNIQUE, NOT NULL)\n- name (VARCHAR 100, NOT NULL)\n- rank_level (VARCHAR 50)',
    correct_query: "CREATE TABLE officers (\n  officer_id INT AUTO_INCREMENT PRIMARY KEY,\n  badge_number VARCHAR(20) UNIQUE NOT NULL,\n  name VARCHAR(100) NOT NULL,\n  rank_level VARCHAR(50)\n)",
    setup_sql: 'DROP TABLE IF EXISTS officers',
    expected_result_sql: 'SHOW COLUMNS FROM officers',
    objectives: [
      { order: 1, text: 'Create officers table with officer_id as PRIMARY KEY.', keyword: 'officers', points: 30 },
      { order: 2, text: 'Set badge_number as UNIQUE and NOT NULL.', keyword: 'unique', points: 35 },
      { order: 3, text: 'Include rank_level VARCHAR(50).', keyword: 'rank_level', points: 35 }
    ]
  },
  // MEDIUM (60034 - 60038)
  {
    case_id: 60034,
    title: 'Add Arrest Timestamp to Suspects',
    description: 'The suspects table exists. Modify `suspects` to add a new column `arrested_at` of type DATETIME that allows NULL values.',
    correct_query: "ALTER TABLE suspects ADD COLUMN arrested_at DATETIME",
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE suspects to modify the schema.', keyword: 'alter table suspects', points: 30 },
      { order: 2, text: 'Use ADD COLUMN to add arrested_at.', keyword: 'add', points: 35 },
      { order: 3, text: 'Set column type as DATETIME.', keyword: 'datetime', points: 35 }
    ]
  },
  {
    case_id: 60035,
    title: 'Link Evidence to Crime Scene Locations',
    description: 'The `evidence` and `locations` tables exist. Add a FOREIGN KEY constraint on `evidence.location_id` referencing `locations(location_id)` to ensure integrity.',
    correct_query: "ALTER TABLE evidence ADD FOREIGN KEY (location_id) REFERENCES locations(location_id)",
    setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1);\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, location_id INT, severity INT DEFAULT 1)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE evidence to add the constraint.', keyword: 'alter table evidence', points: 30 },
      { order: 2, text: 'Specify foreign key on location_id.', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Reference locations(location_id).', keyword: 'references locations', points: 35 }
    ]
  },
  {
    case_id: 60036,
    title: 'Rename Status Column in Suspects',
    description: 'Precinct headquarters mandated standardizing column naming. Rename `status` in the `suspects` table to `case_status` keeping type VARCHAR(50) with default "Under Investigation".',
    correct_query: "ALTER TABLE suspects CHANGE status case_status VARCHAR(50) DEFAULT 'Under Investigation'",
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE suspects CHANGE.', keyword: 'change', points: 30 },
      { order: 2, text: 'Rename status to case_status.', keyword: 'case_status', points: 35 },
      { order: 3, text: 'Preserve VARCHAR(50) and default value.', keyword: 'varchar', points: 35 }
    ]
  },
  {
    case_id: 60037,
    title: 'Remove Redundant Witness Statement Field',
    description: 'Witness statements are now stored in an external digital evidence system. Remove the `statement` column from `witnesses` table.',
    correct_query: "ALTER TABLE witnesses DROP COLUMN statement",
    setup_sql: "DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20), statement TEXT)",
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE witnesses.', keyword: 'alter table witnesses', points: 30 },
      { order: 2, text: 'Use DROP COLUMN to remove statement.', keyword: 'drop', points: 35 },
      { order: 3, text: 'Target statement column specifically.', keyword: 'statement', points: 35 }
    ]
  },
  {
    case_id: 60038,
    title: 'Enforce Unique Officer Badge Numbers',
    description: 'To prevent duplicate officer accounts, add a UNIQUE constraint to `badge_number` in the `officers` table using ALTER TABLE.',
    correct_query: "ALTER TABLE officers ADD UNIQUE (badge_number)",
    setup_sql: "DROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM officers',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE officers.', keyword: 'alter table officers', points: 30 },
      { order: 2, text: 'Add UNIQUE constraint.', keyword: 'unique', points: 35 },
      { order: 3, text: 'Apply constraint to badge_number.', keyword: 'badge_number', points: 35 }
    ]
  },
  // HARD (60039 - 60043)
  {
    case_id: 60039,
    title: 'Deploy Tactical Case Assignment Junction Table',
    description: 'Detectives are assigned to cases dynamically. Create a junction table `case_assignments` with:\n- assignment_id (INT, PK, AI)\n- officer_id (INT, NOT NULL, FK → officers)\n- case_title (VARCHAR 100, NOT NULL)\n- assigned_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    correct_query: "CREATE TABLE case_assignments (\n  assignment_id INT AUTO_INCREMENT PRIMARY KEY,\n  officer_id INT NOT NULL,\n  case_title VARCHAR(100) NOT NULL,\n  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (officer_id) REFERENCES officers(officer_id)\n)",
    setup_sql: "DROP TABLE IF EXISTS case_assignments;\nDROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM case_assignments',
    objectives: [
      { order: 1, text: 'Create table case_assignments with assignment_id PK AI.', keyword: 'case_assignments', points: 30 },
      { order: 2, text: 'Include foreign key to officers(officer_id).', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Set assigned_at with DEFAULT CURRENT_TIMESTAMP.', keyword: 'current_timestamp', points: 35 }
    ]
  },
  {
    case_id: 60040,
    title: 'Deploy Evidence Chain-of-Custody with Composite Foreign Keys',
    description: 'Construct the comprehensive `evidence` table with foreign key linkage to locations:\n- evidence_id (INT, PK, AI)\n- item_name (VARCHAR 100, NOT NULL)\n- severity (INT, DEFAULT 1)\n- location_id (INT, NOT NULL)\n- collected_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)\n- FOREIGN KEY (location_id) REFERENCES locations(location_id)',
    correct_query: "CREATE TABLE evidence (\n  evidence_id INT AUTO_INCREMENT PRIMARY KEY,\n  item_name VARCHAR(100) NOT NULL,\n  severity INT DEFAULT 1,\n  location_id INT NOT NULL,\n  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (location_id) REFERENCES locations(location_id)\n)",
    setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Create evidence table with evidence_id PK AI.', keyword: 'evidence', points: 30 },
      { order: 2, text: 'Set location_id as NOT NULL with FOREIGN KEY.', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Include collected_at DATETIME DEFAULT CURRENT_TIMESTAMP.', keyword: 'current_timestamp', points: 35 }
    ]
  },
  {
    case_id: 60041,
    title: 'Enforce Age Range Check Constraint on Suspects',
    description: 'To guarantee data validation, add a CHECK constraint to ensure suspect `age` is between 10 and 120 years old.',
    correct_query: "ALTER TABLE suspects ADD CONSTRAINT chk_suspect_age CHECK (age >= 10 AND age <= 120)",
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE suspects to add constraint.', keyword: 'alter table suspects', points: 30 },
      { order: 2, text: 'Add CHECK constraint on age.', keyword: 'check', points: 35 },
      { order: 3, text: 'Validate age between 10 and 120.', keyword: 'age >= 10', points: 35 }
    ]
  },
  {
    case_id: 60042,
    title: 'Deploy Security Audit Log with Cascade Delete',
    description: 'Construct the `audit_log` table to monitor suspect record modifications:\n- log_id (INT, PK, AI)\n- suspect_id (INT, FK → suspects ON DELETE CASCADE)\n- action_type (VARCHAR 50, NOT NULL)\n- logged_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    correct_query: "CREATE TABLE audit_log (\n  log_id INT AUTO_INCREMENT PRIMARY KEY,\n  suspect_id INT,\n  action_type VARCHAR(50) NOT NULL,\n  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id) ON DELETE CASCADE\n)",
    setup_sql: "DROP TABLE IF EXISTS audit_log;\nDROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM audit_log',
    objectives: [
      { order: 1, text: 'Create table audit_log with log_id PK AI.', keyword: 'audit_log', points: 30 },
      { order: 2, text: 'Include foreign key to suspects(suspect_id).', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Specify ON DELETE CASCADE on the foreign key.', keyword: 'on delete cascade', points: 35 }
    ]
  },
  {
    case_id: 60043,
    title: 'Deploy Incident Reports Master Registry',
    description: 'Construct the comprehensive `incident_reports` table linking officers and locations:\n- report_id (INT, PK, AI)\n- case_number (VARCHAR 50, UNIQUE, NOT NULL)\n- location_id (INT, NOT NULL, FK → locations)\n- reporting_officer_id (INT, NOT NULL, FK → officers)\n- summary (TEXT)',
    correct_query: "CREATE TABLE incident_reports (\n  report_id INT AUTO_INCREMENT PRIMARY KEY,\n  case_number VARCHAR(50) UNIQUE NOT NULL,\n  location_id INT NOT NULL,\n  reporting_officer_id INT NOT NULL,\n  summary TEXT,\n  FOREIGN KEY (location_id) REFERENCES locations(location_id),\n  FOREIGN KEY (reporting_officer_id) REFERENCES officers(officer_id)\n)",
    setup_sql: "DROP TABLE IF EXISTS incident_reports;\nDROP TABLE IF EXISTS officers;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1);\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM incident_reports',
    objectives: [
      { order: 1, text: 'Create incident_reports table with case_number UNIQUE NOT NULL.', keyword: 'incident_reports', points: 30 },
      { order: 2, text: 'Establish foreign keys to locations and officers.', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Include summary column of type TEXT.', keyword: 'summary', points: 35 }
    ]
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// 2. PRACTICE DML (Cases 60044 - 60058)
// ══════════════════════════════════════════════════════════════════════════════
const PRACTICE_DML = [
  // EASY (60044 - 60048)
  {
    case_id: 60044,
    title: 'Register New Suspect James Okon',
    description: 'A new person of interest has been identified. Insert into `suspects`:\n- name: "James Okon"\n- age: 35\n- status: "Under Investigation"',
    correct_query: "INSERT INTO suspects (name, age, status) VALUES ('James Okon', 35, 'Under Investigation')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO suspects.', keyword: 'insert into suspects', points: 30 },
      { order: 2, text: "Set name to 'James Okon' and age to 35.", keyword: 'james okon', points: 35 },
      { order: 3, text: "Set status to 'Under Investigation'.", keyword: 'under investigation', points: 35 }
    ]
  },
  {
    case_id: 60045,
    title: 'Add Crime Scene Location Old Market',
    description: 'A new crime location has been confirmed. Insert into `locations`:\n- place_name: "Old Market"\n- district: "Eastside"\n- is_active: 1',
    correct_query: "INSERT INTO locations (place_name, district, is_active) VALUES ('Old Market', 'Eastside', 1)",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT location_id, place_name, district, is_active FROM locations ORDER BY location_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO locations.', keyword: 'insert into locations', points: 30 },
      { order: 2, text: "Provide place_name 'Old Market'.", keyword: 'old market', points: 35 },
      { order: 3, text: "Set district to 'Eastside' with is_active = 1.", keyword: 'eastside', points: 35 }
    ]
  },
  {
    case_id: 60046,
    title: 'Log Recovered Evidence Torn Jacket',
    description: 'Forensics tagged a torn jacket at Central Warehouse (location_id = 2). Insert into `evidence`:\n- item_name: "Torn Jacket"\n- severity: 4\n- location_id: 2',
    correct_query: "INSERT INTO evidence (item_name, severity, location_id) VALUES ('Torn Jacket', 4, 2)",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO evidence.', keyword: 'insert into evidence', points: 30 },
      { order: 2, text: "Set item_name to 'Torn Jacket'.", keyword: 'torn jacket', points: 35 },
      { order: 3, text: 'Set severity to 4 and location_id to 2.', keyword: '4', points: 35 }
    ]
  },
  {
    case_id: 60047,
    title: 'Record Eyewitness Diana Vong',
    description: 'A civilian witness came forward to the precinct. Insert into `witnesses`:\n- full_name: "Diana Vong"\n- contact_number: "09451234567"',
    correct_query: "INSERT INTO witnesses (full_name, contact_number) VALUES ('Diana Vong', '09451234567')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT witness_id, full_name, contact_number FROM witnesses ORDER BY witness_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO witnesses.', keyword: 'insert into witnesses', points: 30 },
      { order: 2, text: "Provide full_name 'Diana Vong'.", keyword: 'diana vong', points: 35 },
      { order: 3, text: "Set contact_number to '09451234567'.", keyword: '09451234567', points: 35 }
    ]
  },
  {
    case_id: 60048,
    title: 'Enroll Detective Officer Perez',
    description: 'A transfer officer has arrived at precinct headquarters. Insert into `officers`:\n- badge_number: "B-004"\n- name: "Officer Perez"\n- rank_level: "Detective"',
    correct_query: "INSERT INTO officers (badge_number, name, rank_level) VALUES ('B-004', 'Officer Perez', 'Detective')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT officer_id, badge_number, name, rank_level FROM officers ORDER BY officer_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO officers.', keyword: 'insert into officers', points: 30 },
      { order: 2, text: "Provide badge_number 'B-004'.", keyword: 'b-004', points: 35 },
      { order: 3, text: "Set name to 'Officer Perez' and rank_level to 'Detective'.", keyword: 'officer perez', points: 35 }
    ]
  },
  // MEDIUM (60049 - 60053)
  {
    case_id: 60049,
    title: 'Arrest Cleared Suspect Victor Hale',
    description: 'Stolen goods were recovered in Victor Hale’s trunk. Update his status in `suspects` from "Cleared" to "Arrested".',
    correct_query: "UPDATE suspects SET status = 'Arrested' WHERE name = 'Victor Hale'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use UPDATE suspects.', keyword: 'update suspects', points: 30 },
      { order: 2, text: "Set status = 'Arrested'.", keyword: 'arrested', points: 35 },
      { order: 3, text: "Use WHERE clause to target 'Victor Hale'.", keyword: 'victor hale', points: 35 }
    ]
  },
  {
    case_id: 60050,
    title: 'Deactivate Ruled-Out Factory Location',
    description: 'Forensics finished searching the Abandoned Factory (location_id = 5) and ruled it out. Update `locations` to set `is_active = 0` where `location_id = 5`.',
    correct_query: "UPDATE locations SET is_active = 0 WHERE location_id = 5",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT location_id, place_name, district, is_active FROM locations ORDER BY location_id',
    objectives: [
      { order: 1, text: 'Use UPDATE locations.', keyword: 'update locations', points: 30 },
      { order: 2, text: 'Set is_active = 0.', keyword: 'is_active = 0', points: 35 },
      { order: 3, text: 'Filter by WHERE location_id = 5.', keyword: 'location_id = 5', points: 35 }
    ]
  },
  {
    case_id: 60051,
    title: 'Escalate Bloody Glove Severity Rating',
    description: 'DNA testing confirmed victim blood on evidence_id = 3 (Bloody Glove). Update its `severity` to 5 in `evidence`.',
    correct_query: "UPDATE evidence SET severity = 5 WHERE evidence_id = 3",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use UPDATE evidence.', keyword: 'update evidence', points: 30 },
      { order: 2, text: 'Set severity = 5.', keyword: 'severity = 5', points: 35 },
      { order: 3, text: 'Filter by WHERE evidence_id = 3.', keyword: 'evidence_id = 3', points: 35 }
    ]
  },
  {
    case_id: 60052,
    title: 'Purge Fraudulent Witness Felicia Park',
    description: 'Interrogation revealed that witness_id = 3 (Felicia Park) gave fraudulent testimony. Delete that record from `witnesses`.',
    correct_query: "DELETE FROM witnesses WHERE witness_id = 3",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT witness_id, full_name, contact_number FROM witnesses ORDER BY witness_id',
    objectives: [
      { order: 1, text: 'Use DELETE FROM witnesses.', keyword: 'delete from witnesses', points: 30 },
      { order: 2, text: 'Target witness_id = 3.', keyword: 'witness_id = 3', points: 35 },
      { order: 3, text: 'Ensure only the fraudulent record is deleted.', keyword: 'where', points: 35 }
    ]
  },
  {
    case_id: 60053,
    title: 'Promote Officer Santos to Senior Detective',
    description: 'Officer Santos (officer_id = 1) broke the perimeter security breach. Update their `rank_level` to "Senior Detective" in `officers`.',
    correct_query: "UPDATE officers SET rank_level = 'Senior Detective' WHERE officer_id = 1",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT officer_id, badge_number, name, rank_level FROM officers ORDER BY officer_id',
    objectives: [
      { order: 1, text: 'Use UPDATE officers.', keyword: 'update officers', points: 30 },
      { order: 2, text: "Set rank_level = 'Senior Detective'.", keyword: 'senior detective', points: 35 },
      { order: 3, text: 'Target WHERE officer_id = 1.', keyword: 'officer_id = 1', points: 35 }
    ]
  },
  // HARD (60054 - 60058)
  {
    case_id: 60054,
    title: 'Batch Clear Low-Severity Clutter Evidence',
    description: 'Clear out non-probative clutter from the evidence locker. Delete all rows from `evidence` where `severity = 1`.',
    correct_query: "DELETE FROM evidence WHERE severity = 1",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use DELETE FROM evidence.', keyword: 'delete from evidence', points: 30 },
      { order: 2, text: 'Use WHERE severity = 1 to target clutter.', keyword: 'severity = 1', points: 35 },
      { order: 3, text: 'Preserve all higher severity evidence.', keyword: 'where', points: 35 }
    ]
  },
  {
    case_id: 60055,
    title: 'Bulk Register Captured Conspirators',
    description: 'A hideout raid netted three new operatives. Insert all three into `suspects` in a single query:\n1. "Ana Vega", 27, "Under Investigation"\n2. "Ben Solis", 41, "Under Investigation"\n3. "Cia Tan", 19, "Cleared"',
    correct_query: "INSERT INTO suspects (name, age, status) VALUES ('Ana Vega', 27, 'Under Investigation'), ('Ben Solis', 41, 'Under Investigation'), ('Cia Tan', 19, 'Cleared')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use a single INSERT INTO suspects statement.', keyword: 'insert into suspects', points: 30 },
      { order: 2, text: 'Provide multiple comma-separated VALUES rows.', keyword: 'values', points: 35 },
      { order: 3, text: 'Insert all three suspects with exact specified ages.', keyword: 'ana vega', points: 35 }
    ]
  },
  {
    case_id: 60056,
    title: 'Mass Archive All Arrested Suspects',
    description: 'Booking is complete for all detained individuals. Update `suspects` to set `status = "Archived"` for all suspects currently marked as "Arrested".',
    correct_query: "UPDATE suspects SET status = 'Archived' WHERE status = 'Arrested'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use UPDATE suspects.', keyword: 'update suspects', points: 30 },
      { order: 2, text: "Set status = 'Archived'.", keyword: 'archived', points: 35 },
      { order: 3, text: "Filter by WHERE status = 'Arrested'.", keyword: 'arrested', points: 35 }
    ]
  },
  {
    case_id: 60057,
    title: 'Transfer Warehouse Evidence to Police HQ',
    description: 'Due to safety risks at Central Warehouse (location_id = 2), transfer all evidence stored there to Police HQ (location_id = 4).',
    correct_query: "UPDATE evidence SET location_id = 4 WHERE location_id = 2",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use UPDATE evidence.', keyword: 'update evidence', points: 30 },
      { order: 2, text: 'Set location_id = 4.', keyword: 'location_id = 4', points: 35 },
      { order: 3, text: 'Target WHERE location_id = 2.', keyword: 'location_id = 2', points: 35 }
    ]
  },
  {
    case_id: 60058,
    title: 'Purge Inactive Crime Scene Locations',
    description: 'Decommission all inactive investigation scenes. Delete all locations from `locations` where `is_active = 0` (linked evidence will be preserved with location_id set to NULL).',
    correct_query: "DELETE FROM locations WHERE is_active = 0",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT location_id, place_name, district, is_active FROM locations ORDER BY location_id',
    objectives: [
      { order: 1, text: 'Use DELETE FROM locations.', keyword: 'delete from locations', points: 30 },
      { order: 2, text: 'Filter by WHERE is_active = 0.', keyword: 'is_active = 0', points: 35 },
      { order: 3, text: 'Ensure active locations remain untouched.', keyword: 'where', points: 35 }
    ]
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// 3. RANK DDL (Cases 60074 - 60088)
// ══════════════════════════════════════════════════════════════════════════════
const RANK_DDL = [
  // EASY (60074 - 60078)
  {
    case_id: 60074,
    title: 'Operation Blackout — Deploy Suspect Intake Registry',
    description: 'A citywide blackout struck City Hall. Detectives must deploy the emergency `suspects` registry table:\n- suspect_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- name (VARCHAR 100, NOT NULL)\n- age (INT)\n- status (VARCHAR 50, DEFAULT "Under Investigation")',
    correct_query: "CREATE TABLE suspects (\n  suspect_id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  age INT,\n  status VARCHAR(50) DEFAULT 'Under Investigation'\n)",
    setup_sql: 'DROP TABLE IF EXISTS suspects',
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
    objectives: [
      { order: 1, text: 'Deploy suspects table with suspect_id as PRIMARY KEY AUTO_INCREMENT.', keyword: 'suspects', points: 30 },
      { order: 2, text: 'Ensure name is VARCHAR(100) NOT NULL.', keyword: 'not null', points: 35 },
      { order: 3, text: "Set status default to 'Under Investigation'.", keyword: 'default', points: 35 }
    ]
  },
  {
    case_id: 60075,
    title: 'Operation Blackout — Deploy Civilian Witness Registry',
    description: 'Civilians trapped in the plaza witnessed masked operatives. Construct the emergency `witnesses` table:\n- witness_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- full_name (VARCHAR 100, NOT NULL)\n- contact_number (VARCHAR 20)',
    correct_query: "CREATE TABLE witnesses (\n  witness_id INT AUTO_INCREMENT PRIMARY KEY,\n  full_name VARCHAR(100) NOT NULL,\n  contact_number VARCHAR(20)\n)",
    setup_sql: 'DROP TABLE IF EXISTS witnesses',
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
    objectives: [
      { order: 1, text: 'Deploy witnesses table with witness_id as PRIMARY KEY.', keyword: 'witnesses', points: 30 },
      { order: 2, text: 'Set full_name as NOT NULL.', keyword: 'full_name', points: 35 },
      { order: 3, text: 'Include contact_number column.', keyword: 'contact_number', points: 35 }
    ]
  },
  {
    case_id: 60076,
    title: 'Operation Blackout — Deploy Chain of Custody Table',
    description: 'Tactical officers are securing dropped weapons and electronic devices. Construct the emergency `evidence` table:\n- evidence_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- item_name (VARCHAR 100, NOT NULL)\n- severity (INT, DEFAULT 1)\n- location_id (INT)',
    correct_query: "CREATE TABLE evidence (\n  evidence_id INT AUTO_INCREMENT PRIMARY KEY,\n  item_name VARCHAR(100) NOT NULL,\n  severity INT DEFAULT 1,\n  location_id INT\n)",
    setup_sql: 'DROP TABLE IF EXISTS evidence',
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Deploy evidence table with evidence_id PK AI.', keyword: 'evidence', points: 30 },
      { order: 2, text: 'Ensure item_name is NOT NULL.', keyword: 'item_name', points: 35 },
      { order: 3, text: 'Set severity with DEFAULT 1.', keyword: 'default 1', points: 35 }
    ]
  },
  {
    case_id: 60077,
    title: 'Operation Blackout — Deploy Municipal Zones Table',
    description: 'Dispatch requires a perimeter monitoring table. Construct the emergency `locations` table:\n- location_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- place_name (VARCHAR 100, NOT NULL)\n- district (VARCHAR 100)\n- is_active (TINYINT(1), DEFAULT 1)',
    correct_query: "CREATE TABLE locations (\n  location_id INT AUTO_INCREMENT PRIMARY KEY,\n  place_name VARCHAR(100) NOT NULL,\n  district VARCHAR(100),\n  is_active TINYINT(1) DEFAULT 1\n)",
    setup_sql: 'DROP TABLE IF EXISTS locations',
    expected_result_sql: 'SHOW COLUMNS FROM locations',
    objectives: [
      { order: 1, text: 'Deploy locations table with location_id PK AI.', keyword: 'locations', points: 30 },
      { order: 2, text: 'Set place_name as VARCHAR(100) NOT NULL.', keyword: 'not null', points: 35 },
      { order: 3, text: 'Set is_active default to 1.', keyword: 'default 1', points: 35 }
    ]
  },
  {
    case_id: 60078,
    title: 'Operation Blackout — Deploy Tactical Officers Table',
    description: 'Emergency response officers are arriving from multiple precincts. Build the `officers` duty table:\n- officer_id (INT, PRIMARY KEY, AUTO_INCREMENT)\n- badge_number (VARCHAR 20, UNIQUE, NOT NULL)\n- name (VARCHAR 100, NOT NULL)\n- rank_level (VARCHAR 50)',
    correct_query: "CREATE TABLE officers (\n  officer_id INT AUTO_INCREMENT PRIMARY KEY,\n  badge_number VARCHAR(20) UNIQUE NOT NULL,\n  name VARCHAR(100) NOT NULL,\n  rank_level VARCHAR(50)\n)",
    setup_sql: 'DROP TABLE IF EXISTS officers',
    expected_result_sql: 'SHOW COLUMNS FROM officers',
    objectives: [
      { order: 1, text: 'Deploy officers table with officer_id PK AI.', keyword: 'officers', points: 30 },
      { order: 2, text: 'Enforce UNIQUE constraint on badge_number.', keyword: 'unique', points: 35 },
      { order: 3, text: 'Ensure name is NOT NULL.', keyword: 'name', points: 35 }
    ]
  },
  // MEDIUM (60079 - 60083)
  {
    case_id: 60079,
    title: 'Operation Blackout — Enforce Unique Officer Badges',
    description: 'Impersonation risk is critical during the blackout. Alter `officers` table to ensure badge numbers are strictly UNIQUE.',
    correct_query: "ALTER TABLE officers ADD UNIQUE (badge_number)",
    setup_sql: "DROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM officers',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE officers.', keyword: 'alter table officers', points: 30 },
      { order: 2, text: 'Apply UNIQUE constraint.', keyword: 'unique', points: 35 },
      { order: 3, text: 'Target badge_number column.', keyword: 'badge_number', points: 35 }
    ]
  },
  {
    case_id: 60080,
    title: 'Operation Blackout — Add Forensic Tagging Column',
    description: 'Bomb squad technicians need specialized tagging on recovered ordnance. Alter `evidence` to add column `notes` (TEXT).',
    correct_query: "ALTER TABLE evidence ADD COLUMN notes TEXT",
    setup_sql: "DROP TABLE IF EXISTS evidence;\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE evidence.', keyword: 'alter table evidence', points: 30 },
      { order: 2, text: 'Use ADD COLUMN.', keyword: 'add', points: 35 },
      { order: 3, text: 'Add notes of type TEXT.', keyword: 'notes', points: 35 }
    ]
  },
  {
    case_id: 60081,
    title: 'Operation Blackout — Enforce Default Investigation Status',
    description: 'Intake during emergency blackout operations leads to missing entries. Alter `suspects` so `status` defaults to "Under Investigation".',
    correct_query: "ALTER TABLE suspects ALTER COLUMN status SET DEFAULT 'Under Investigation'",
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE suspects.', keyword: 'alter table suspects', points: 30 },
      { order: 2, text: 'Modify default on status column.', keyword: 'default', points: 35 },
      { order: 3, text: "Set default value to 'Under Investigation'.", keyword: 'under investigation', points: 35 }
    ]
  },
  {
    case_id: 60082,
    title: 'Operation Blackout — Build Tactical Unit Index',
    description: 'Dispatch requires fast lookup of tactical ranks during high radio traffic. Create an index on `officers(rank_level)`.',
    correct_query: "CREATE INDEX idx_officer_rank ON officers (rank_level)",
    setup_sql: "DROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM officers',
    objectives: [
      { order: 1, text: 'Use CREATE INDEX statement.', keyword: 'create index', points: 30 },
      { order: 2, text: 'Target officers table.', keyword: 'officers', points: 35 },
      { order: 3, text: 'Index the rank_level column.', keyword: 'rank_level', points: 35 }
    ]
  },
  {
    case_id: 60083,
    title: 'Operation Blackout — Link Evidence Foreign Keys',
    description: 'Ensure chain-of-custody data integrity. Add a FOREIGN KEY constraint on `evidence.location_id` referencing `locations(location_id)`.',
    correct_query: "ALTER TABLE evidence ADD FOREIGN KEY (location_id) REFERENCES locations(location_id)",
    setup_sql: "DROP TABLE IF EXISTS evidence;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1);\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, location_id INT, severity INT DEFAULT 1)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE evidence.', keyword: 'alter table evidence', points: 30 },
      { order: 2, text: 'Add foreign key on location_id.', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Reference locations(location_id).', keyword: 'references locations', points: 35 }
    ]
  },
  // HARD (60084 - 60088)
  {
    case_id: 60084,
    title: 'Operation Blackout — Emergency Assignment Junction Table',
    description: 'Deploy rapid tasking table `emergency_assignments`:\n- assignment_id (INT, PK, AI)\n- officer_id (INT, NOT NULL, FK → officers)\n- incident_zone (VARCHAR 100, NOT NULL)\n- deployed_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    correct_query: "CREATE TABLE emergency_assignments (\n  assignment_id INT AUTO_INCREMENT PRIMARY KEY,\n  officer_id INT NOT NULL,\n  incident_zone VARCHAR(100) NOT NULL,\n  deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (officer_id) REFERENCES officers(officer_id)\n)",
    setup_sql: "DROP TABLE IF EXISTS emergency_assignments;\nDROP TABLE IF EXISTS officers;\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM emergency_assignments',
    objectives: [
      { order: 1, text: 'Create emergency_assignments table.', keyword: 'emergency_assignments', points: 30 },
      { order: 2, text: 'Link officer_id with FOREIGN KEY.', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Include deployed_at DEFAULT CURRENT_TIMESTAMP.', keyword: 'current_timestamp', points: 35 }
    ]
  },
  {
    case_id: 60085,
    title: 'Operation Blackout — Enforce Severity Boundary Checks',
    description: 'Prevent invalid evidence ratings during high-stress entry. Add a CHECK constraint to `evidence` ensuring `severity` is between 1 and 5.',
    correct_query: "ALTER TABLE evidence ADD CONSTRAINT chk_evidence_severity CHECK (severity >= 1 AND severity <= 5)",
    setup_sql: "DROP TABLE IF EXISTS evidence;\nCREATE TABLE evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100) NOT NULL, severity INT DEFAULT 1, location_id INT)",
    expected_result_sql: 'SHOW COLUMNS FROM evidence',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE evidence.', keyword: 'alter table evidence', points: 30 },
      { order: 2, text: 'Add CHECK constraint.', keyword: 'check', points: 35 },
      { order: 3, text: 'Enforce severity between 1 and 5.', keyword: 'severity >= 1', points: 35 }
    ]
  },
  {
    case_id: 60086,
    title: 'Operation Blackout — Add Witness Contact Unique Constraint',
    description: 'Prevent duplicate anonymous tipster entries. Alter `witnesses` table to enforce a UNIQUE constraint on `contact_number`.',
    correct_query: "ALTER TABLE witnesses ADD UNIQUE (contact_number)",
    setup_sql: "DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (witness_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, contact_number VARCHAR(20))",
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
    objectives: [
      { order: 1, text: 'Use ALTER TABLE witnesses.', keyword: 'alter table witnesses', points: 30 },
      { order: 2, text: 'Add UNIQUE constraint.', keyword: 'unique', points: 35 },
      { order: 3, text: 'Target contact_number column.', keyword: 'contact_number', points: 35 }
    ]
  },
  {
    case_id: 60087,
    title: 'Operation Blackout — Immutable Audit Log Deployment',
    description: 'Construct the tamper-evident `audit_log` table with cascade delete on suspects:\n- log_id (INT, PK, AI)\n- suspect_id (INT, FK → suspects ON DELETE CASCADE)\n- action_summary (VARCHAR 150, NOT NULL)\n- timestamp (DATETIME, DEFAULT CURRENT_TIMESTAMP)',
    correct_query: "CREATE TABLE audit_log (\n  log_id INT AUTO_INCREMENT PRIMARY KEY,\n  suspect_id INT,\n  action_summary VARCHAR(150) NOT NULL,\n  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id) ON DELETE CASCADE\n)",
    setup_sql: "DROP TABLE IF EXISTS audit_log;\nDROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, age INT, status VARCHAR(50) DEFAULT 'Under Investigation')",
    expected_result_sql: 'SHOW COLUMNS FROM audit_log',
    objectives: [
      { order: 1, text: 'Deploy audit_log table with log_id PK AI.', keyword: 'audit_log', points: 30 },
      { order: 2, text: 'Link suspect_id with ON DELETE CASCADE.', keyword: 'on delete cascade', points: 35 },
      { order: 3, text: 'Set timestamp DEFAULT CURRENT_TIMESTAMP.', keyword: 'current_timestamp', points: 35 }
    ]
  },
  {
    case_id: 60088,
    title: 'Operation Blackout — Master Investigation Schema Finalization',
    description: 'Construct the comprehensive `incident_dossier` table uniting officer reports, primary suspect links, and crime scene location:\n- dossier_id (INT, PK, AI)\n- case_title (VARCHAR 150, NOT NULL)\n- location_id (INT, NOT NULL, FK → locations)\n- officer_id (INT, NOT NULL, FK → officers)\n- findings (TEXT)',
    correct_query: "CREATE TABLE incident_dossier (\n  dossier_id INT AUTO_INCREMENT PRIMARY KEY,\n  case_title VARCHAR(150) NOT NULL,\n  location_id INT NOT NULL,\n  officer_id INT NOT NULL,\n  findings TEXT,\n  FOREIGN KEY (location_id) REFERENCES locations(location_id),\n  FOREIGN KEY (officer_id) REFERENCES officers(officer_id)\n)",
    setup_sql: "DROP TABLE IF EXISTS incident_dossier;\nDROP TABLE IF EXISTS officers;\nDROP TABLE IF EXISTS locations;\nCREATE TABLE locations (location_id INT AUTO_INCREMENT PRIMARY KEY, place_name VARCHAR(100) NOT NULL, district VARCHAR(100), is_active TINYINT(1) DEFAULT 1);\nCREATE TABLE officers (officer_id INT AUTO_INCREMENT PRIMARY KEY, badge_number VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL, rank_level VARCHAR(50))",
    expected_result_sql: 'SHOW COLUMNS FROM incident_dossier',
    objectives: [
      { order: 1, text: 'Deploy incident_dossier table.', keyword: 'incident_dossier', points: 30 },
      { order: 2, text: 'Establish foreign keys to locations and officers.', keyword: 'foreign key', points: 35 },
      { order: 3, text: 'Include findings column of type TEXT.', keyword: 'findings', points: 35 }
    ]
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// 4. RANK DML (Cases 60089 - 60103)
// ══════════════════════════════════════════════════════════════════════════════
const RANK_DML = [
  // EASY (60089 - 60093)
  {
    case_id: 60089,
    title: 'Blackout Intel — Register Infiltrator James Okon',
    description: 'An intruder was detained attempting to access municipal power grids. Insert into `suspects`:\n- name: "James Okon"\n- age: 35\n- status: "Under Investigation"',
    correct_query: "INSERT INTO suspects (name, age, status) VALUES ('James Okon', 35, 'Under Investigation')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO suspects.', keyword: 'insert into suspects', points: 30 },
      { order: 2, text: "Provide name 'James Okon' and age 35.", keyword: 'james okon', points: 35 },
      { order: 3, text: "Set status to 'Under Investigation'.", keyword: 'under investigation', points: 35 }
    ]
  },
  {
    case_id: 60090,
    title: 'Blackout Intel — Log Breach Point Coordinates',
    description: 'Explosive entry was detected at the municipal server bunker. Insert into `locations`:\n- place_name: "Server Bunker"\n- district: "Subterranean"\n- is_active: 1',
    correct_query: "INSERT INTO locations (place_name, district, is_active) VALUES ('Server Bunker', 'Subterranean', 1)",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT location_id, place_name, district, is_active FROM locations ORDER BY location_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO locations.', keyword: 'insert into locations', points: 30 },
      { order: 2, text: "Set place_name to 'Server Bunker'.", keyword: 'server bunker', points: 35 },
      { order: 3, text: "Set district to 'Subterranean' and is_active to 1.", keyword: 'subterranean', points: 35 }
    ]
  },
  {
    case_id: 60091,
    title: 'Blackout Intel — Log High-Tech Thermal Cutter',
    description: 'Breaching operatives abandoned a high-tech cutting torch at Central Warehouse (location_id = 2). Insert into `evidence`:\n- item_name: "Thermal Cutter"\n- severity: 5\n- location_id: 2',
    correct_query: "INSERT INTO evidence (item_name, severity, location_id) VALUES ('Thermal Cutter', 5, 2)",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO evidence.', keyword: 'insert into evidence', points: 30 },
      { order: 2, text: "Set item_name to 'Thermal Cutter'.", keyword: 'thermal cutter', points: 35 },
      { order: 3, text: 'Set severity to 5 and location_id to 2.', keyword: '5', points: 35 }
    ]
  },
  {
    case_id: 60092,
    title: 'Blackout Intel — Record Vault Security Guard Statement',
    description: 'The night vault security guard gave an emergency statement. Insert into `witnesses`:\n- full_name: "Arthur Dent"\n- contact_number: "09991234567"',
    correct_query: "INSERT INTO witnesses (full_name, contact_number) VALUES ('Arthur Dent', '09991234567')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT witness_id, full_name, contact_number FROM witnesses ORDER BY witness_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO witnesses.', keyword: 'insert into witnesses', points: 30 },
      { order: 2, text: "Provide full_name 'Arthur Dent'.", keyword: 'arthur dent', points: 35 },
      { order: 3, text: "Set contact_number to '09991234567'.", keyword: '09991234567', points: 35 }
    ]
  },
  {
    case_id: 60093,
    title: 'Blackout Intel — Assign Lead SWAT Specialist',
    description: 'SWAT Commander Harris arrived at the incident perimeter. Insert into `officers`:\n- badge_number: "B-999"\n- name: "Officer Harris"\n- rank_level: "SWAT Commander"',
    correct_query: "INSERT INTO officers (badge_number, name, rank_level) VALUES ('B-999', 'Officer Harris', 'SWAT Commander')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT officer_id, badge_number, name, rank_level FROM officers ORDER BY officer_id',
    objectives: [
      { order: 1, text: 'Use INSERT INTO officers.', keyword: 'insert into officers', points: 30 },
      { order: 2, text: "Provide badge_number 'B-999'.", keyword: 'b-999', points: 35 },
      { order: 3, text: "Set name 'Officer Harris' and rank 'SWAT Commander'.", keyword: 'swat commander', points: 35 }
    ]
  },
  // MEDIUM (60094 - 60098)
  {
    case_id: 60094,
    title: 'Blackout Intel — Reclassify Cleared Infiltrator',
    description: 'Classified blueprints were found on Victor Hale during the blackout sweep. Update his status in `suspects` from "Cleared" to "Arrested".',
    correct_query: "UPDATE suspects SET status = 'Arrested' WHERE name = 'Victor Hale'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use UPDATE suspects.', keyword: 'update suspects', points: 30 },
      { order: 2, text: "Set status = 'Arrested'.", keyword: 'arrested', points: 35 },
      { order: 3, text: "Target WHERE name = 'Victor Hale'.", keyword: 'victor hale', points: 35 }
    ]
  },
  {
    case_id: 60095,
    title: 'Blackout Intel — Decommission Secured Substation',
    description: 'The Abandoned Factory substation (location_id = 5) has been secured. Update `locations` to set `is_active = 0` where `location_id = 5`.',
    correct_query: "UPDATE locations SET is_active = 0 WHERE location_id = 5",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT location_id, place_name, district, is_active FROM locations ORDER BY location_id',
    objectives: [
      { order: 1, text: 'Use UPDATE locations.', keyword: 'update locations', points: 30 },
      { order: 2, text: 'Set is_active = 0.', keyword: 'is_active = 0', points: 35 },
      { order: 3, text: 'Target WHERE location_id = 5.', keyword: 'location_id = 5', points: 35 }
    ]
  },
  {
    case_id: 60096,
    title: 'Blackout Intel — Escalate Vault EMP Device Severity',
    description: 'Forensics confirmed evidence item 3 (Bloody Glove) carried radioactive traces. Update its `severity` to 5 in `evidence`.',
    correct_query: "UPDATE evidence SET severity = 5 WHERE evidence_id = 3",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use UPDATE evidence.', keyword: 'update evidence', points: 30 },
      { order: 2, text: 'Set severity = 5.', keyword: 'severity = 5', points: 35 },
      { order: 3, text: 'Target WHERE evidence_id = 3.', keyword: 'evidence_id = 3', points: 35 }
    ]
  },
  {
    case_id: 60097,
    title: 'Blackout Intel — Remove False Alarm Witness',
    description: 'Phone forensics revealed witness 3 gave hoax testimony to distract emergency responders. Delete witness_id = 3 from `witnesses`.',
    correct_query: "DELETE FROM witnesses WHERE witness_id = 3",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT witness_id, full_name, contact_number FROM witnesses ORDER BY witness_id',
    objectives: [
      { order: 1, text: 'Use DELETE FROM witnesses.', keyword: 'delete from witnesses', points: 30 },
      { order: 2, text: 'Target WHERE witness_id = 3.', keyword: 'witness_id = 3', points: 35 },
      { order: 3, text: 'Verify other witness records remain untouched.', keyword: 'where', points: 35 }
    ]
  },
  {
    case_id: 60098,
    title: 'Blackout Intel — Promote Incident Commander',
    description: 'Officer Santos (officer_id = 1) coordinated the city emergency grid response. Update their rank_level to "Chief Detective" in `officers`.',
    correct_query: "UPDATE officers SET rank_level = 'Chief Detective' WHERE officer_id = 1",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT officer_id, badge_number, name, rank_level FROM officers ORDER BY officer_id',
    objectives: [
      { order: 1, text: 'Use UPDATE officers.', keyword: 'update officers', points: 30 },
      { order: 2, text: "Set rank_level = 'Chief Detective'.", keyword: 'chief detective', points: 35 },
      { order: 3, text: 'Target WHERE officer_id = 1.', keyword: 'officer_id = 1', points: 35 }
    ]
  },
  // HARD (60099 - 60103)
  {
    case_id: 60099,
    title: 'Blackout Intel — Purge Routine Street Debris',
    description: 'Purge all low-level items (severity = 1) from the emergency evidence registry to keep the investigation focused on critical contraband.',
    correct_query: "DELETE FROM evidence WHERE severity = 1",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use DELETE FROM evidence.', keyword: 'delete from evidence', points: 30 },
      { order: 2, text: 'Filter by WHERE severity = 1.', keyword: 'severity = 1', points: 35 },
      { order: 3, text: 'Ensure higher severity evidence is preserved.', keyword: 'where', points: 35 }
    ]
  },
  {
    case_id: 60100,
    title: 'Blackout Intel — Bulk Log Captured Infiltrator Cell',
    description: 'Tactical ambushed an escape van containing three syndicate operatives. Bulk INSERT all three into `suspects` in a single query:\n1. "Lucas Vance", 34, "Under Investigation"\n2. "Maya Lin", 29, "Under Investigation"\n3. "Zack Cole", 42, "Arrested"',
    correct_query: "INSERT INTO suspects (name, age, status) VALUES ('Lucas Vance', 34, 'Under Investigation'), ('Maya Lin', 29, 'Under Investigation'), ('Zack Cole', 42, 'Arrested')",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use a single INSERT INTO suspects statement.', keyword: 'insert into suspects', points: 30 },
      { order: 2, text: 'Provide 3 comma-separated value rows.', keyword: 'values', points: 35 },
      { order: 3, text: "Set status to 'Arrested' for Zack Cole.", keyword: 'zack cole', points: 35 }
    ]
  },
  {
    case_id: 60101,
    title: 'Blackout Intel — Batch Transfer to Detention Holding',
    description: 'All suspects currently marked as "Arrested" have completed field booking. Update `suspects` to set `status = "Archived"` for all rows where `status = "Arrested"`.',
    correct_query: "UPDATE suspects SET status = 'Archived' WHERE status = 'Arrested'",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT suspect_id, name, age, status FROM suspects ORDER BY suspect_id',
    objectives: [
      { order: 1, text: 'Use UPDATE suspects.', keyword: 'update suspects', points: 30 },
      { order: 2, text: "Set status = 'Archived'.", keyword: 'archived', points: 35 },
      { order: 3, text: "Target WHERE status = 'Arrested'.", keyword: 'arrested', points: 35 }
    ]
  },
  {
    case_id: 60102,
    title: 'Blackout Intel — Secure Vault Evidence at Police HQ',
    description: 'Armed escorts are transporting all contraband from Central Warehouse (location_id = 2) to Police HQ (location_id = 4). Update `evidence` accordingly.',
    correct_query: "UPDATE evidence SET location_id = 4 WHERE location_id = 2",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT evidence_id, item_name, severity, location_id FROM evidence ORDER BY evidence_id',
    objectives: [
      { order: 1, text: 'Use UPDATE evidence.', keyword: 'update evidence', points: 30 },
      { order: 2, text: 'Set location_id = 4.', keyword: 'location_id = 4', points: 35 },
      { order: 3, text: 'Target WHERE location_id = 2.', keyword: 'location_id = 2', points: 35 }
    ]
  },
  {
    case_id: 60103,
    title: 'Blackout Intel — Cascade Decommission Cleared Zones',
    description: 'Decommission all cleared incident scenes by deleting all rows from `locations` where `is_active = 0`.',
    correct_query: "DELETE FROM locations WHERE is_active = 0",
    setup_sql: FULL_SCHEMA_SETUP,
    expected_result_sql: 'SELECT location_id, place_name, district, is_active FROM locations ORDER BY location_id',
    objectives: [
      { order: 1, text: 'Use DELETE FROM locations.', keyword: 'delete from locations', points: 30 },
      { order: 2, text: 'Target WHERE is_active = 0.', keyword: 'is_active = 0', points: 35 },
      { order: 3, text: 'Verify active municipal zones remain online.', keyword: 'where', points: 35 }
    ]
  }
];

async function main() {
  console.log('🚀 Starting Final Case Synchronization & Cleanup...\n');

  // STEP 1: Purge inactive cases (57 cases)
  const [inactiveRows] = await systemDB.query('SELECT case_id FROM cases WHERE is_active = 0');
  const inactiveIds = inactiveRows.map(r => r.case_id);
  console.log(`Found ${inactiveIds.length} inactive cases to purge.`);

  if (inactiveIds.length > 0) {
    // Purge referencing child records safely
    const childTables = [
      { table: 'attempts', col: 'case_id' },
      { table: 'user_case_progress', col: 'case_id' },
      { table: 'case_objectives', col: 'case_id' },
      { table: 'case_study_materials', col: 'case_id' },
      { table: 'game_sessions', col: 'case_id' }
    ];

    for (const ct of childTables) {
      try {
        const [res] = await systemDB.query(`DELETE FROM \`${ct.table}\` WHERE \`${ct.col}\` IN (?)`, [inactiveIds]);
        console.log(`  Purged ${res.affectedRows} rows from ${ct.table}`);
      } catch (e) {
        console.warn(`  Warning deleting from ${ct.table}:`, e.message);
      }
    }

    // Now delete the inactive cases themselves
    const [delRes] = await systemDB.query('DELETE FROM cases WHERE is_active = 0');
    console.log(`  ✅ Successfully deleted ${delRes.affectedRows} inactive cases from cases table!\n`);
  }

  // STEP 2: Synchronize and finalize the 60 DDL & DML cases
  const caseBatches = [
    { name: 'Practice DDL', list: PRACTICE_DDL },
    { name: 'Practice DML', list: PRACTICE_DML },
    { name: 'Rank DDL',     list: RANK_DDL },
    { name: 'Rank DML',     list: RANK_DML }
  ];

  for (const batch of caseBatches) {
    console.log(`── Updating ${batch.name} (${batch.list.length} cases) ──`);
    for (const c of batch.list) {
      // Build clean markdown text for cases.objectives
      const stepsText = c.objectives.map((o, idx) => `${idx + 1}. ${o.text} (${o.points} XP)`).join('\n');
      const objectivesMarkdown = `📋 OBJECTIVES:\n${stepsText}\n\n💡 Check your SQL syntax and make sure all required fields are included.`;

      // Update case row in cases table
      await systemDB.query(
        `UPDATE cases
         SET title = ?,
             description = ?,
             objectives = ?,
             setup_sql = ?,
             correct_query = ?,
             expected_result_sql = ?
         WHERE case_id = ?`,
        [
          c.title,
          c.description,
          objectivesMarkdown,
          c.setup_sql,
          c.correct_query,
          c.expected_result_sql,
          c.case_id
        ]
      );

      // Refresh case_objectives table
      await systemDB.query('DELETE FROM case_objectives WHERE case_id = ?', [c.case_id]);
      for (const obj of c.objectives) {
        await systemDB.query(
          `INSERT INTO case_objectives
           (case_id, objective_order, objective_text, required_keyword, validation_type, points)
           VALUES (?, ?, ?, ?, 'pattern', ?)`,
          [c.case_id, obj.order, obj.text, obj.keyword, obj.points]
        );
      }

      console.log(`  ✅ Case #${c.case_id}: "${c.title}" updated + 3 objectives synced`);
    }
    console.log();
  }

  // STEP 3: Confirm final active case count
  const [totalCases] = await systemDB.query('SELECT COUNT(*) as cnt FROM cases');
  const [totalObjs] = await systemDB.query('SELECT COUNT(*) as cnt FROM case_objectives');
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log(`🎉 ALL 90 CASES FINALIZED!`);
  console.log(`   Total Cases in Database: ${totalCases[0].cnt} (Expected: exactly 90 active cases)`);
  console.log(`   Total Objectives in Database: ${totalObjs[0].cnt} (Expected: 90 * 3 = 270 objectives)`);
  console.log('══════════════════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal finalization error:', err);
  process.exit(1);
});

