/**
 * seed_practice_cases.js
 * Deactivates all old Practice cases (DQL 17,19,20,21 + DML 27 + DDL 28)
 * and inserts 45 new cases: 15 DQL + 15 DML + 15 DDL (5 per difficulty each).
 */

const mysql = require('mysql2/promise');
const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  ssl: { rejectUnauthorized: false }
};

// ─── Shared DQL sandbox setup (creates the investigation dataset in student's DB) ───
const DQL_SETUP = `DROP TABLE IF EXISTS crime_events;
DROP TABLE IF EXISTS person_locations;
DROP TABLE IF EXISTS evidence;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS persons;
CREATE TABLE persons (person_id INT PRIMARY KEY, name VARCHAR(100), role VARCHAR(50), age INT, criminal_record TINYINT(1));
INSERT INTO persons VALUES (1,'Alex Carter','Student',19,0),(2,'Bianca Reyes','Student',21,0),(3,'Carlos Mendoza','Guard',34,1),(4,'Diana Lopez','Teacher',29,0),(5,'Ethan Cruz','Student',22,1),(6,'Fiona Garcia','Nurse',31,0),(7,'George Ramos','Janitor',45,1),(8,'Hannah Lee','Student',18,0),(9,'Ivan Torres','Technician',28,0),(10,'Julia Santos','Teacher',41,0),(11,'Kevin Lim','Student',23,0),(12,'Lara Flores','Student',20,1),(13,'Mark Dela Cruz','Guard',38,0),(14,'Nina Ortiz','Student',19,0),(15,'Oscar Villanueva','Staff',33,1);
CREATE TABLE places (place_id INT PRIMARY KEY, place_name VARCHAR(100), location_type VARCHAR(50));
INSERT INTO places VALUES (1,'Library','Academic'),(2,'Cafeteria','Public'),(3,'Laboratory','Restricted'),(4,'Main Office','Administrative'),(5,'Warehouse','Restricted'),(6,'Clinic','Medical');
CREATE TABLE evidence (evidence_id INT PRIMARY KEY, evidence_type VARCHAR(100), person_id INT, place_id INT, severity INT);
INSERT INTO evidence VALUES (1,'Fingerprint',3,5,3),(2,'Broken Lock',5,3,4),(3,'Security Footage',7,5,5),(4,'Suspicious Email',12,1,2),(5,'Access Card Log',15,5,4),(6,'Tool Found',7,5,3),(7,'Witness Report',3,5,2),(8,'USB Device',5,3,5);
CREATE TABLE person_locations (record_id INT PRIMARY KEY, person_id INT, place_id INT, visit_time DATETIME);
INSERT INTO person_locations VALUES (1,3,5,'2026-04-10 10:15:00'),(2,5,3,'2026-04-10 10:30:00'),(3,7,5,'2026-04-10 09:50:00'),(4,12,1,'2026-04-09 14:00:00'),(5,2,2,'2026-04-09 12:15:00'),(6,11,3,'2026-04-10 11:00:00'),(7,1,1,'2026-04-08 08:00:00'),(8,15,5,'2026-04-10 10:40:00'),(9,9,3,'2026-04-10 09:00:00'),(10,4,4,'2026-04-10 13:00:00');
CREATE TABLE crime_events (crime_id INT PRIMARY KEY, crime_name VARCHAR(100), place_id INT, crime_time DATETIME);
INSERT INTO crime_events VALUES (1,'Warehouse Break-in',5,'2026-04-10 10:30:00'),(2,'Lab Equipment Theft',3,'2026-04-10 10:45:00'),(3,'Library Data Leak',1,'2026-04-09 15:00:00')`;

// ─── All 45 new cases ─────────────────────────────────────────────────────────
const NEW_CASES = [

  // ══════════════════════════════════════════════════════════════
  // DQL — BEGINNER (difficulty_id=1, base_points=100)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'The Full Roster',
    description: 'You have just been assigned to the Detective Query Unit. Your first task is to pull the complete list of all persons currently in the investigation database. Use a SELECT statement to retrieve every record from the persons table ordered by their ID.',
    objectives: '🕵️ INVESTIGATION BRIEF: Multiple crimes have rocked the campus — a Warehouse Break-in, a Lab Equipment Theft, and a Library Data Leak. You are Detective Reyes, newly assigned to the case. Your first move is to pull the complete roster of all persons of interest currently logged in the system.\n\n1. Use SELECT * to retrieve all records from the persons table.\n2. Order the results by person_id in ascending order.\n3. Verify all 15 persons appear in the result.\n\n🔍 OBSERVATION: Study each person\'s name, role, age, and criminal_record. The column criminal_record = 1 flags prior offenders — they are your prime suspects. Remember this roster; you will narrow it down in the next cases.',
    difficulty_id: 1, sql_type: 'DQL', mode: 'Practice', base_points: 100,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT * FROM persons ORDER BY person_id',
    expected_result_sql: 'SELECT * FROM persons ORDER BY person_id',
  },
  {
    title: 'Criminal Record Scan',
    description: 'Security has flagged several individuals for background checks. You need to isolate only those persons who have a criminal record (criminal_record = 1). These are your primary persons of interest.',
    objectives: '🕵️ INVESTIGATION BRIEF: The detective database reveals that several individuals on campus have prior criminal records. Retrieve only those flagged offenders — they move to the top of your suspect list.\n\n1. Filter the persons table using a WHERE clause.\n2. Retrieve only persons where criminal_record = 1.\n3. Order results by person_id ascending.\n\n🔍 OBSERVATION: Five persons have criminal records: Carlos Mendoza (Guard), Ethan Cruz (Student), George Ramos (Janitor), Lara Flores (Student), and Oscar Villanueva (Staff). Cross-reference these names with locations and evidence in subsequent cases to pinpoint who committed each crime.',
    difficulty_id: 1, sql_type: 'DQL', mode: 'Practice', base_points: 100,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT * FROM persons WHERE criminal_record = 1 ORDER BY person_id',
    expected_result_sql: 'SELECT * FROM persons WHERE criminal_record = 1 ORDER BY person_id',
  },
  {
    title: 'Young Suspect Filter',
    description: 'Investigators believe the perpetrator is young. Your job is to narrow down the suspect list to persons under 25 years old. Sort by age so the youngest appear first.',
    objectives: '🕵️ INVESTIGATION BRIEF: An anonymous tip states: "I saw a young student near the Library before things went missing." You need a list of all persons under 25 — students young enough to match the witness description.\n\n1. Use WHERE to filter persons with age < 25.\n2. Order results by age ascending.\n3. Your result should include all columns from the persons table.\n\n🔍 OBSERVATION: The filtered list includes Alex Carter (19), Hannah Lee (18), Lara Flores (20, criminal record!), Nina Ortiz (19), Ethan Cruz (22, criminal record!), and Kevin Lim (23). Both Lara Flores and Ethan Cruz are young AND have criminal records — flag them for closer scrutiny.',
    difficulty_id: 1, sql_type: 'DQL', mode: 'Practice', base_points: 100,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT * FROM persons WHERE age < 25 ORDER BY age ASC',
    expected_result_sql: 'SELECT * FROM persons WHERE age < 25 ORDER BY age ASC',
  },
  {
    title: 'Security Guards On Duty',
    description: 'All security personnel must be identified for a briefing. Retrieve the name and age of all persons whose role is Guard. Order them alphabetically by name.',
    objectives: '🕵️ INVESTIGATION BRIEF: Security guards patrol restricted areas and are both key witnesses and persons of interest. Retrieve all guards currently assigned on campus.\n\n1. SELECT only the name and age columns from persons.\n2. Filter WHERE role = \'Guard\'.\n3. Order results alphabetically by name.\n\n🔍 OBSERVATION: Two guards are on duty — Carlos Mendoza (age 34) and Mark Dela Cruz (age 38). Critically, Carlos Mendoza has a criminal record (criminal_record = 1). Guards have access to all restricted zones including the Warehouse. Carlos Mendoza remains a person of interest.',
    difficulty_id: 1, sql_type: 'DQL', mode: 'Practice', base_points: 100,
    setup_sql: DQL_SETUP,
    correct_query: "SELECT name, age FROM persons WHERE role = 'Guard' ORDER BY name",
    expected_result_sql: "SELECT name, age FROM persons WHERE role = 'Guard' ORDER BY name",
  },
  {
    title: 'High Severity Evidence',
    description: 'The forensics team needs to prioritize critical evidence. Retrieve all evidence items where severity is 4 or higher. Order by severity descending (highest first), then by evidence_id ascending for ties.',
    objectives: '🕵️ INVESTIGATION BRIEF: Forensics has classified all evidence with a severity score of 4 or higher as critical to the investigation. These are the most damning clues — retrieve them immediately.\n\n1. Use WHERE severity >= 4 to filter the evidence table.\n2. Order results by severity DESC, then evidence_id ASC.\n3. Retrieve all columns from the evidence table.\n\n🔍 OBSERVATION: Critical evidence (severity 4–5) is concentrated at the Warehouse (place_id=5) and Lab (place_id=3). The severity-5 items are a Security Footage clip (person_id=7, Warehouse) and a USB Device (person_id=5, Lab). Check who person_id 7 and 5 are — they are your top suspects per crime scene.',
    difficulty_id: 1, sql_type: 'DQL', mode: 'Practice', base_points: 100,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT * FROM evidence WHERE severity >= 4 ORDER BY severity DESC, evidence_id ASC',
    expected_result_sql: 'SELECT * FROM evidence WHERE severity >= 4 ORDER BY severity DESC, evidence_id ASC',
  },

  // ══════════════════════════════════════════════════════════════
  // DQL — INTERMEDIATE (difficulty_id=2, base_points=150)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Evidence Per Location',
    description: 'Detectives need a summary of how much evidence was recovered per location. Join the evidence and places tables to count how many evidence items were found at each place. Order by count descending so the most evidence-heavy locations appear first.',
    objectives: '🕵️ INVESTIGATION BRIEF: To prioritize crime scenes, determine which locations have the highest concentration of evidence. The location with the most evidence is likely the primary crime scene.\n\n1. JOIN evidence with places on place_id.\n2. GROUP BY place_id and place_name.\n3. COUNT evidence_id as evidence_count.\n4. Order by evidence_count DESC, then place_name ASC for ties.\n\n🔍 OBSERVATION: The Warehouse ranks highest in evidence count, confirming it as the primary scene of the Warehouse Break-in. This directs the investigation toward everyone who accessed the Warehouse — especially those with criminal records.',
    difficulty_id: 2, sql_type: 'DQL', mode: 'Practice', base_points: 150,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT pl.place_name, COUNT(e.evidence_id) AS evidence_count FROM places pl JOIN evidence e ON pl.place_id = e.place_id GROUP BY pl.place_id, pl.place_name ORDER BY evidence_count DESC, pl.place_name ASC',
    expected_result_sql: 'SELECT pl.place_name, COUNT(e.evidence_id) AS evidence_count FROM places pl JOIN evidence e ON pl.place_id = e.place_id GROUP BY pl.place_id, pl.place_name ORDER BY evidence_count DESC, pl.place_name ASC',
  },
  {
    title: 'Warehouse Visitors',
    description: 'The Warehouse (place_id = 5) is a key crime scene. Identify all persons who visited it by joining the person_locations and persons tables. Show their name, role, and visit time. Order by visit time ascending.',
    objectives: '🕵️ INVESTIGATION BRIEF: The Warehouse Break-in occurred on April 10, 2026. Retrieve the complete list of all individuals who were logged at the Warehouse (place_id = 5). One of these people is the prime suspect.\n\n1. JOIN persons with person_locations on person_id.\n2. Filter WHERE place_id = 5 (Warehouse).\n3. SELECT p.name, p.role, pl.visit_time.\n4. Order by visit_time ascending.\n\n🔍 OBSERVATION: Three individuals visited the Warehouse — George Ramos (Janitor, 09:50 AM), Carlos Mendoza (Guard, 10:15 AM), and Oscar Villanueva (Staff, 10:40 AM). The crime occurred at 10:30 AM. George Ramos arrived earliest and was already inside before the break-in. He is your prime suspect.',
    difficulty_id: 2, sql_type: 'DQL', mode: 'Practice', base_points: 150,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 ORDER BY pl.visit_time ASC',
    expected_result_sql: 'SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 ORDER BY pl.visit_time ASC',
  },
  {
    title: 'Crime Scene Summary',
    description: 'Build a complete crime scene report by joining crime_events and places. Show the crime name, location name, location type, and the time the crime occurred. Order results by crime_id.',
    objectives: '🕵️ INVESTIGATION BRIEF: Before making any accusations, compile a complete summary of all reported crimes, their locations, and the exact times they occurred. This gives you the full picture of what happened across campus.\n\n1. JOIN crime_events with places on place_id.\n2. SELECT ce.crime_name, pl.place_name, pl.location_type, ce.crime_time.\n3. Order by ce.crime_id ascending.\n\n🔍 OBSERVATION: Three crimes occurred — Warehouse Break-in (10:30 AM, April 10), Lab Equipment Theft (10:45 AM, April 10), and Library Data Leak (3:00 PM, April 9). The Warehouse and Lab are Restricted zones. Your primary investigation focuses on the Warehouse Break-in.',
    difficulty_id: 2, sql_type: 'DQL', mode: 'Practice', base_points: 150,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT ce.crime_name, pl.place_name, pl.location_type, ce.crime_time FROM crime_events ce JOIN places pl ON ce.place_id = pl.place_id ORDER BY ce.crime_id',
    expected_result_sql: 'SELECT ce.crime_name, pl.place_name, pl.location_type, ce.crime_time FROM crime_events ce JOIN places pl ON ce.place_id = pl.place_id ORDER BY ce.crime_id',
  },
  {
    title: 'Suspects With Evidence Count',
    description: 'Cross-reference persons who have criminal records with the evidence table. Count how many pieces of evidence are linked to each criminal. Order by total_evidence descending, then by name alphabetically.',
    objectives: '🕵️ INVESTIGATION BRIEF: Cross-reference all persons with criminal records against the evidence table. Count how many evidence items are linked to each suspect — the one with the most evidence at the crime scene is your strongest lead.\n\n1. JOIN persons with evidence on person_id.\n2. Filter WHERE criminal_record = 1.\n3. GROUP BY person_id, name, role.\n4. COUNT evidence_id AS total_evidence.\n5. Order by total_evidence DESC, p.name ASC.\n\n🔍 OBSERVATION: Carlos Mendoza, Ethan Cruz, and George Ramos each have 2 pieces of evidence. However, BOTH of George Ramos\'s evidence items are located at the Warehouse — the exact crime scene. This concentration of evidence at one location makes George Ramos the strongest Warehouse suspect.',
    difficulty_id: 2, sql_type: 'DQL', mode: 'Practice', base_points: 150,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS total_evidence FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role ORDER BY total_evidence DESC, p.name ASC',
    expected_result_sql: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS total_evidence FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role ORDER BY total_evidence DESC, p.name ASC',
  },
  {
    title: 'Older Staff With Clean Records',
    description: 'The investigation needs a list of trusted personnel — persons over 30 years old with no criminal record. These individuals may serve as reliable witnesses. Show only their name, role, and age, ordered by age.',
    objectives: '🕵️ INVESTIGATION BRIEF: The investigation needs credible witnesses — experienced staff members over 30 years old with no criminal record. These individuals may have observed suspicious behavior around the Warehouse on the day of the break-in.\n\n1. SELECT name, role, age from persons.\n2. Filter WHERE criminal_record = 0 AND age > 30.\n3. Order by age ASC.\n\n🔍 OBSERVATION: Clean-record staff over 30 include Fiona Garcia (Nurse, 31), Mark Dela Cruz (Guard, 38), and Julia Santos (Teacher, 41). These individuals can serve as alibi witnesses. Mark Dela Cruz — a guard with no criminal record — is a key witness who may have observed George Ramos\'s movements near the Warehouse.',
    difficulty_id: 2, sql_type: 'DQL', mode: 'Practice', base_points: 150,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT name, role, age FROM persons WHERE criminal_record = 0 AND age > 30 ORDER BY age ASC',
    expected_result_sql: 'SELECT name, role, age FROM persons WHERE criminal_record = 0 AND age > 30 ORDER BY age ASC',
  },

  // ══════════════════════════════════════════════════════════════
  // DQL — EXPERT (difficulty_id=3, base_points=250)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Before The Crime',
    description: 'The Warehouse Break-in occurred at a specific time stored in crime_events. Using a subquery, find every person who was at the Warehouse BEFORE the crime time. Show their name, role, and visit time, ordered by visit time.',
    objectives: '🕵️ INVESTIGATION BRIEF: Time is everything in criminal investigations. The Warehouse Break-in occurred at 10:30 AM. To identify the perpetrator, you must find out who was physically inside the Warehouse BEFORE the crime occurred — only they had opportunity.\n\n1. JOIN persons with person_locations on person_id.\n2. Filter WHERE place_id = 5.\n3. Use a subquery to get the crime_time for "Warehouse Break-in" from crime_events.\n4. Filter WHERE visit_time < that subquery result.\n5. Order by visit_time ascending.\n\n🔍 VERDICT CLUE: Only two people were at the Warehouse BEFORE the 10:30 AM break-in — George Ramos (09:50 AM) and Carlos Mendoza (10:15 AM). Oscar Villanueva arrived AFTER the crime (10:40 AM). George Ramos arrived 40 minutes earliest and had the most time and opportunity to commit the break-in.',
    difficulty_id: 3, sql_type: 'DQL', mode: 'Practice', base_points: 250,
    setup_sql: DQL_SETUP,
    correct_query: "SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 AND pl.visit_time < (SELECT crime_time FROM crime_events WHERE crime_name = 'Warehouse Break-in') ORDER BY pl.visit_time",
    expected_result_sql: "SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 AND pl.visit_time < (SELECT crime_time FROM crime_events WHERE crime_name = 'Warehouse Break-in') ORDER BY pl.visit_time",
  },
  {
    title: 'Maximum Evidence Severity',
    description: 'Forensics wants to review all evidence pieces at the highest severity level. Use a subquery to find the maximum severity, then join evidence with persons and places to show full details. Order by evidence_id.',
    objectives: '🕵️ INVESTIGATION BRIEF: The forensics team has isolated the single most critical piece of evidence — the item with the highest severity rating. Find it, and you find the strongest link to the perpetrator.\n\n1. JOIN evidence with persons (on person_id) and places (on place_id).\n2. Use a subquery: WHERE e.severity = (SELECT MAX(severity) FROM evidence).\n3. SELECT e.evidence_type, e.severity, p.name AS suspect_name, pl.place_name.\n4. Order by e.evidence_id.\n\n🔍 VERDICT CLUE: Two severity-5 items exist — Security Footage at the Warehouse (linked to George Ramos) and a USB Device at the Lab (linked to Ethan Cruz). For the Warehouse Break-in, the Security Footage directly capturing George Ramos is the most critical piece of evidence. This is near-conclusive proof.',
    difficulty_id: 3, sql_type: 'DQL', mode: 'Practice', base_points: 250,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT e.evidence_type, e.severity, p.name AS suspect_name, pl.place_name FROM evidence e JOIN persons p ON e.person_id = p.person_id JOIN places pl ON e.place_id = pl.place_id WHERE e.severity = (SELECT MAX(severity) FROM evidence) ORDER BY e.evidence_id',
    expected_result_sql: 'SELECT e.evidence_type, e.severity, p.name AS suspect_name, pl.place_name FROM evidence e JOIN persons p ON e.person_id = p.person_id JOIN places pl ON e.place_id = pl.place_id WHERE e.severity = (SELECT MAX(severity) FROM evidence) ORDER BY e.evidence_id',
  },
  {
    title: 'Restricted Zone Intruders',
    description: 'Security protocols restrict access to certain areas (location_type = "Restricted"). Identify all distinct persons who visited any Restricted location. Join person_locations with places and persons. Order results by name.',
    objectives: '🕵️ INVESTIGATION BRIEF: Both the Warehouse and Laboratory are classified as Restricted zones. Unauthorized access to these areas is itself suspicious. Find every individual who was logged entering any restricted zone — they are all persons of interest.\n\n1. JOIN persons with person_locations, then with places.\n2. Filter WHERE pl.location_type = \'Restricted\'.\n3. Use DISTINCT to avoid duplicates.\n4. SELECT p.name, p.role, pl.place_name.\n5. Order by p.name ASC.\n\n🔍 VERDICT CLUE: Restricted zone intruders include Carlos Mendoza, Ethan Cruz, George Ramos, Ivan Torres, Kevin Lim, and Oscar Villanueva. George Ramos (Janitor) is the only person whose access to the Warehouse is documented alongside two pieces of physical evidence — a Security Footage clip and a Tool Found at the scene.',
    difficulty_id: 3, sql_type: 'DQL', mode: 'Practice', base_points: 250,
    setup_sql: DQL_SETUP,
    correct_query: "SELECT DISTINCT p.name, p.role, pl.place_name FROM persons p JOIN person_locations loc ON p.person_id = loc.person_id JOIN places pl ON loc.place_id = pl.place_id WHERE pl.location_type = 'Restricted' ORDER BY p.name",
    expected_result_sql: "SELECT DISTINCT p.name, p.role, pl.place_name FROM persons p JOIN person_locations loc ON p.person_id = loc.person_id JOIN places pl ON loc.place_id = pl.place_id WHERE pl.location_type = 'Restricted' ORDER BY p.name",
  },
  {
    title: 'Multi-Evidence Suspects',
    description: 'Suspects with multiple pieces of evidence against them are high priority. Find all persons with a criminal record who have MORE THAN ONE piece of linked evidence. Show name, role, and count. Order by count descending, then name alphabetically.',
    objectives: '🕵️ INVESTIGATION BRIEF: The case is nearly cracked. Find all persons with a criminal record who have MORE than one piece of evidence pointing at them. A suspect with multiple evidence items is difficult to dismiss.\n\n1. JOIN persons with evidence on person_id.\n2. Filter WHERE criminal_record = 1.\n3. GROUP BY person_id, name, role.\n4. Use HAVING COUNT(e.evidence_id) > 1.\n5. SELECT name, role, COUNT as evidence_count.\n6. Order by evidence_count DESC, name ASC.\n\n🔍 VERDICT CLUE: Three suspects each have 2 pieces of evidence — Carlos Mendoza (Guard), Ethan Cruz (Student), and George Ramos (Janitor). The decisive factor: both of George Ramos\'s evidence pieces (Security Footage + Tool Found) are located at the Warehouse crime scene, whereas Carlos Mendoza\'s evidence is mixed across different roles and places.',
    difficulty_id: 3, sql_type: 'DQL', mode: 'Practice', base_points: 250,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS evidence_count FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role HAVING COUNT(e.evidence_id) > 1 ORDER BY evidence_count DESC, p.name ASC',
    expected_result_sql: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS evidence_count FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role HAVING COUNT(e.evidence_id) > 1 ORDER BY evidence_count DESC, p.name ASC',
  },
  {
    title: 'Active Crime Time Window',
    description: 'Cross-reference person location logs against crime event times. Find all persons who were at a crime scene location within 1 hour BEFORE a crime occurred. Show their name, role, crime name, their visit time, and the crime time. Order by crime_name then visit_time.',
    objectives: '🕵️ INVESTIGATION BRIEF: This is your final query — the smoking gun. Find every individual who was physically present at a crime location WITHIN ONE HOUR before the crime occurred. This is the definitive opportunity window. Cross-reference with criminal records and evidence count to reach your final verdict.\n\n1. JOIN persons → person_locations → crime_events (match on place_id).\n2. Filter WHERE visit_time >= (crime_time - INTERVAL 1 HOUR) AND visit_time <= crime_time.\n3. SELECT p.name, p.role, ce.crime_name, pl.visit_time, ce.crime_time.\n4. Use pl as alias for person_locations and ce for crime_events.\n5. Order by ce.crime_name ASC, pl.visit_time ASC.\n\n🔍 FINAL VERDICT: George Ramos (Janitor) was at the Warehouse at 09:50 AM — within the one-hour window before the 10:30 AM Warehouse Break-in. He has a criminal record, 2 pieces of evidence at the Warehouse (including Security Footage with severity 5), and the earliest documented presence at the scene. ➡️ The prime suspect for the Warehouse Break-in is GEORGE RAMOS.',
    difficulty_id: 3, sql_type: 'DQL', mode: 'Practice', base_points: 250,
    setup_sql: DQL_SETUP,
    correct_query: 'SELECT p.name, p.role, ce.crime_name, pl.visit_time, ce.crime_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id JOIN crime_events ce ON pl.place_id = ce.place_id WHERE pl.visit_time >= DATE_SUB(ce.crime_time, INTERVAL 1 HOUR) AND pl.visit_time <= ce.crime_time ORDER BY ce.crime_name ASC, pl.visit_time ASC',
    expected_result_sql: 'SELECT p.name, p.role, ce.crime_name, pl.visit_time, ce.crime_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id JOIN crime_events ce ON pl.place_id = ce.place_id WHERE pl.visit_time >= DATE_SUB(ce.crime_time, INTERVAL 1 HOUR) AND pl.visit_time <= ce.crime_time ORDER BY ce.crime_name ASC, pl.visit_time ASC',
  },

  // ══════════════════════════════════════════════════════════════
  // DML — BEGINNER (difficulty_id=1, base_points=100)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Register a New Witness',
    description: 'A new witness has come forward and must be added to the witness registry. The witnesses table already has two entries. Insert the new witness: name = "Carlos Mendoza", age = 34, location = "Warehouse".',
    objectives: '1. Use INSERT INTO witnesses (...) VALUES (...) to add a single row.\n2. Provide values for name, age, and location columns.\n3. The id column is AUTO_INCREMENT — do not include it.\n4. After insertion, the table should have 3 rows.',
    difficulty_id: 1, sql_type: 'DML', mode: 'Practice', base_points: 100,
    setup_sql: "DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), age INT, location VARCHAR(100));\nINSERT INTO witnesses VALUES (1,'Alex Carter',19,'Library'),(2,'Bianca Reyes',21,'Cafeteria')",
    correct_query: "INSERT INTO witnesses (name, age, location) VALUES ('Carlos Mendoza', 34, 'Warehouse')",
    expected_result_sql: 'SELECT * FROM witnesses ORDER BY id',
  },
  {
    title: 'Log a New Evidence Item',
    description: 'A new piece of evidence has been tagged and needs to be recorded. The evidence_log table is nearly empty. Insert one new entry: item_name = "Surveillance Tape", found_at = "Warehouse", severity = 4.',
    objectives: '1. Use INSERT INTO evidence_log (...) VALUES (...) for a single row.\n2. Provide item_name, found_at, and severity values.\n3. Do not include the auto-increment log_id.\n4. Verify the row was inserted by checking the final table.',
    difficulty_id: 1, sql_type: 'DML', mode: 'Practice', base_points: 100,
    setup_sql: "DROP TABLE IF EXISTS evidence_log;\nCREATE TABLE evidence_log (log_id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100), found_at VARCHAR(100), severity INT);\nINSERT INTO evidence_log VALUES (1,'Fingerprint Kit','Main Office',2),(2,'Broken Lock','Laboratory',4)",
    correct_query: "INSERT INTO evidence_log (item_name, found_at, severity) VALUES ('Surveillance Tape', 'Warehouse', 4)",
    expected_result_sql: 'SELECT * FROM evidence_log ORDER BY log_id',
  },
  {
    title: 'Update a Suspect Status',
    description: 'Suspect "Alex Carter" has been cleared after a thorough alibi check. Update their status from "Under Investigation" to "Cleared" in the suspects table.',
    objectives: '1. Use UPDATE suspects SET ... WHERE ... to change a single record.\n2. Set status = \'Cleared\' for the correct person.\n3. Use WHERE name = \'Alex Carter\' to target only that row.\n4. Do not accidentally update other rows.',
    difficulty_id: 1, sql_type: 'DML', mode: 'Practice', base_points: 100,
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), status VARCHAR(50));\nINSERT INTO suspects VALUES (1,'Alex Carter','Under Investigation'),(2,'Ethan Cruz','Under Investigation'),(3,'Lara Flores','Under Investigation')",
    correct_query: "UPDATE suspects SET status = 'Cleared' WHERE name = 'Alex Carter'",
    expected_result_sql: 'SELECT * FROM suspects ORDER BY suspect_id',
  },
  {
    title: 'Remove a False Report',
    description: 'An erroneous incident report titled "False Alarm - Cafeteria" was accidentally filed. It must be removed from the incident_reports table to keep records clean.',
    objectives: '1. Use DELETE FROM incident_reports WHERE ... to remove the row.\n2. Target only the row with title = \'False Alarm - Cafeteria\'.\n3. The table should have 2 rows remaining after deletion.\n4. Do not delete other records.',
    difficulty_id: 1, sql_type: 'DML', mode: 'Practice', base_points: 100,
    setup_sql: "DROP TABLE IF EXISTS incident_reports;\nCREATE TABLE incident_reports (report_id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(100), is_valid TINYINT);\nINSERT INTO incident_reports VALUES (1,'Warehouse Break-in Report',1),(2,'False Alarm - Cafeteria',0),(3,'Lab Equipment Theft Report',1)",
    correct_query: "DELETE FROM incident_reports WHERE title = 'False Alarm - Cafeteria'",
    expected_result_sql: 'SELECT * FROM incident_reports ORDER BY report_id',
  },
  {
    title: 'Fix a Missing Salary',
    description: 'A new staff member, Fiona Garcia, was added to the payroll without a salary entry (salary = 0). Update her salary to 45000 in the staff_payroll table.',
    objectives: '1. Use UPDATE staff_payroll SET salary = 45000 WHERE name = \'Fiona Garcia\'.\n2. Only update the one row for Fiona Garcia.\n3. Verify by checking the full table; other rows should be unchanged.',
    difficulty_id: 1, sql_type: 'DML', mode: 'Practice', base_points: 100,
    setup_sql: "DROP TABLE IF EXISTS staff_payroll;\nCREATE TABLE staff_payroll (emp_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), department VARCHAR(100), salary INT);\nINSERT INTO staff_payroll VALUES (1,'Diana Lopez','Faculty',55000),(2,'Fiona Garcia','Clinic',0),(3,'Mark Dela Cruz','Security',48000)",
    correct_query: "UPDATE staff_payroll SET salary = 45000 WHERE name = 'Fiona Garcia'",
    expected_result_sql: 'SELECT * FROM staff_payroll ORDER BY emp_id',
  },

  // ══════════════════════════════════════════════════════════════
  // DML — INTERMEDIATE (difficulty_id=2, base_points=150)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Batch Witness Import',
    description: 'Three new witnesses have been interviewed and must all be added to the witnesses table in a single INSERT statement. The table starts empty. Insert: Diana Lopez (29, Main Office), Ethan Cruz (22, Laboratory), Fiona Garcia (31, Clinic).',
    objectives: '1. Use a single INSERT with multiple value sets.\n2. Insert all three rows in one statement: Diana Lopez, Ethan Cruz, Fiona Garcia.\n3. Provide name, age, and place_seen for each.\n4. Results ordered by id should show rows in insertion order.',
    difficulty_id: 2, sql_type: 'DML', mode: 'Practice', base_points: 150,
    setup_sql: "DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), age INT, place_seen VARCHAR(100))",
    correct_query: "INSERT INTO witnesses (name, age, place_seen) VALUES ('Diana Lopez', 29, 'Main Office'), ('Ethan Cruz', 22, 'Laboratory'), ('Fiona Garcia', 31, 'Clinic')",
    expected_result_sql: 'SELECT * FROM witnesses ORDER BY id',
  },
  {
    title: 'IT Department Pay Raise',
    description: 'All employees in the IT department will receive a salary raise of 5000. Update the salary for ALL IT employees at once using a single UPDATE statement with a WHERE clause on department.',
    objectives: '1. Use UPDATE employees SET salary = salary + 5000 WHERE department = \'IT\'.\n2. Only IT employees should be updated.\n3. HR and Finance salaries must remain unchanged.\n4. Verify all four employees in the result.',
    difficulty_id: 2, sql_type: 'DML', mode: 'Practice', base_points: 150,
    setup_sql: "DROP TABLE IF EXISTS employees;\nCREATE TABLE employees (emp_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), department VARCHAR(100), salary INT);\nINSERT INTO employees VALUES (1,'Alice','HR',50000),(2,'Bob','IT',70000),(3,'Charlie','Finance',60000),(4,'Diana','IT',80000)",
    correct_query: "UPDATE employees SET salary = salary + 5000 WHERE department = 'IT'",
    expected_result_sql: 'SELECT * FROM employees ORDER BY emp_id',
  },
  {
    title: 'Purge Old Location Records',
    description: 'The investigation is focused on events from 2026-04-10 onwards. All location logs before that date are no longer needed and should be removed. Delete all rows where visit_date is earlier than 2026-04-10.',
    objectives: '1. Use DELETE FROM location_logs WHERE visit_date < \'2026-04-10\'.\n2. Only rows before the cutoff date should be deleted.\n3. Rows with visit_date >= \'2026-04-10\' must remain.\n4. Verify the remaining records.',
    difficulty_id: 2, sql_type: 'DML', mode: 'Practice', base_points: 150,
    setup_sql: "DROP TABLE IF EXISTS location_logs;\nCREATE TABLE location_logs (log_id INT AUTO_INCREMENT PRIMARY KEY, person_name VARCHAR(100), location VARCHAR(100), visit_date DATE);\nINSERT INTO location_logs VALUES (1,'Alex Carter','Library','2026-04-08'),(2,'Bianca Reyes','Cafeteria','2026-04-09'),(3,'Carlos Mendoza','Warehouse','2026-04-10'),(4,'George Ramos','Warehouse','2026-04-10'),(5,'Lara Flores','Library','2026-04-09')",
    correct_query: "DELETE FROM location_logs WHERE visit_date < '2026-04-10'",
    expected_result_sql: 'SELECT * FROM location_logs ORDER BY log_id',
  },
  {
    title: 'Escalate Critical Evidence',
    description: 'All "Security Footage" evidence items must be escalated to severity level 5 — the highest classification. Update every matching row in the evidence_items table regardless of their current severity.',
    objectives: '1. Use UPDATE evidence_items SET severity = 5 WHERE item_type = \'Security Footage\'.\n2. All rows with item_type = \'Security Footage\' must become severity 5.\n3. Other evidence types must remain unchanged.\n4. Verify the full table after update.',
    difficulty_id: 2, sql_type: 'DML', mode: 'Practice', base_points: 150,
    setup_sql: "DROP TABLE IF EXISTS evidence_items;\nCREATE TABLE evidence_items (item_id INT AUTO_INCREMENT PRIMARY KEY, item_type VARCHAR(100), severity INT);\nINSERT INTO evidence_items VALUES (1,'Fingerprint',3),(2,'Security Footage',3),(3,'Broken Lock',4),(4,'Security Footage',2),(5,'USB Device',5),(6,'Witness Report',2)",
    correct_query: "UPDATE evidence_items SET severity = 5 WHERE item_type = 'Security Footage'",
    expected_result_sql: 'SELECT * FROM evidence_items ORDER BY item_id',
  },
  {
    title: 'Reassign Transferred Employee',
    description: 'Employee "Charlie" has been transferred to the Security department due to his expertise. Update his department record in the employees table.',
    objectives: '1. Use UPDATE employees SET department = \'Security\' WHERE name = \'Charlie\'.\n2. Only Charlie\'s record should be updated.\n3. Alice, Bob, and Diana must remain in their original departments.\n4. Check all four rows in your final result.',
    difficulty_id: 2, sql_type: 'DML', mode: 'Practice', base_points: 150,
    setup_sql: "DROP TABLE IF EXISTS employees;\nCREATE TABLE employees (emp_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), department VARCHAR(100));\nINSERT INTO employees VALUES (1,'Alice','HR'),(2,'Bob','IT'),(3,'Charlie','Finance'),(4,'Diana','IT')",
    correct_query: "UPDATE employees SET department = 'Security' WHERE name = 'Charlie'",
    expected_result_sql: 'SELECT * FROM employees ORDER BY emp_id',
  },

  // ══════════════════════════════════════════════════════════════
  // DML — EXPERT (difficulty_id=3, base_points=250)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Archive Closed Cases',
    description: 'Cases marked as "Closed" must be transferred into the case_archive table. Use INSERT ... SELECT to copy all closed cases from case_reports into case_archive, setting archived_at to "2026-04-10" for each.',
    objectives: '1. Use INSERT INTO case_archive (original_id, title, archived_at) SELECT case_id, title, \'2026-04-10\' FROM case_reports WHERE status = \'Closed\'.\n2. Only closed cases should be archived.\n3. The case_reports table must remain unchanged.\n4. Verify the archive table has the correct rows.',
    difficulty_id: 3, sql_type: 'DML', mode: 'Practice', base_points: 250,
    setup_sql: "DROP TABLE IF EXISTS case_archive;\nDROP TABLE IF EXISTS case_reports;\nCREATE TABLE case_reports (case_id INT PRIMARY KEY, title VARCHAR(100), status VARCHAR(50));\nINSERT INTO case_reports VALUES (1,'Warehouse Break-in','Closed'),(2,'Lab Equipment Theft','Open'),(3,'Library Data Leak','Closed'),(4,'Cafeteria Vandalism','Open'),(5,'Clinic Intrusion','Closed');\nCREATE TABLE case_archive (archive_id INT AUTO_INCREMENT PRIMARY KEY, original_id INT, title VARCHAR(100), archived_at DATE)",
    correct_query: "INSERT INTO case_archive (original_id, title, archived_at) SELECT case_id, title, '2026-04-10' FROM case_reports WHERE status = 'Closed'",
    expected_result_sql: 'SELECT * FROM case_archive ORDER BY archive_id',
  },
  {
    title: 'Bulk Severity Upgrade',
    description: 'All evidence items currently rated below severity 3 need to be bumped up by 1 level to meet the minimum reporting standard. Use a single UPDATE to increment severity by 1 for all qualifying rows.',
    objectives: '1. Use UPDATE evidence_items SET severity = severity + 1 WHERE severity < 3.\n2. Only items with severity 1 or 2 should be incremented.\n3. Items with severity >= 3 must remain unchanged.\n4. Verify all rows after the update.',
    difficulty_id: 3, sql_type: 'DML', mode: 'Practice', base_points: 250,
    setup_sql: "DROP TABLE IF EXISTS evidence_items;\nCREATE TABLE evidence_items (item_id INT AUTO_INCREMENT PRIMARY KEY, item_type VARCHAR(100), severity INT);\nINSERT INTO evidence_items VALUES (1,'Suspicious Email',2),(2,'Witness Report',1),(3,'Broken Lock',4),(4,'Access Card Log',2),(5,'Security Footage',5),(6,'Tool Found',3)",
    correct_query: 'UPDATE evidence_items SET severity = severity + 1 WHERE severity < 3',
    expected_result_sql: 'SELECT * FROM evidence_items ORDER BY item_id',
  },
  {
    title: 'Delete Suspect Logs by Status',
    description: 'Suspects marked as "Cleared" have all their investigation logs purged. Delete all rows from suspect_logs where the corresponding suspect has a status of "Cleared". Use a subquery to look up the cleared suspect IDs from the suspects table.',
    objectives: '1. Use DELETE FROM suspect_logs WHERE suspect_id IN (SELECT ...).\n2. The subquery should SELECT suspect_id FROM suspects WHERE status = \'Cleared\'.\n3. Only logs linked to cleared suspects should be deleted.\n4. Logs for active suspects must remain.',
    difficulty_id: 3, sql_type: 'DML', mode: 'Practice', base_points: 250,
    setup_sql: "DROP TABLE IF EXISTS suspect_logs;\nDROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT PRIMARY KEY, name VARCHAR(100), status VARCHAR(50));\nINSERT INTO suspects VALUES (1,'Carlos Mendoza','Active'),(2,'Ethan Cruz','Cleared'),(3,'Lara Flores','Active'),(4,'Oscar Villanueva','Cleared');\nCREATE TABLE suspect_logs (log_id INT AUTO_INCREMENT PRIMARY KEY, suspect_id INT, action VARCHAR(100));\nINSERT INTO suspect_logs VALUES (1,1,'Fingerprinted'),(2,2,'Interviewed'),(3,3,'Under Surveillance'),(4,4,'Released'),(5,2,'Alibi Confirmed'),(6,4,'Cleared by Court')",
    correct_query: "DELETE FROM suspect_logs WHERE suspect_id IN (SELECT suspect_id FROM suspects WHERE status = 'Cleared')",
    expected_result_sql: 'SELECT * FROM suspect_logs ORDER BY log_id',
  },
  {
    title: 'Transfer Laboratory Evidence',
    description: 'All evidence items found at the Laboratory must be transferred into a restricted_evidence table for high-security storage. Use INSERT ... SELECT to move only Laboratory evidence from evidence_items, with a fixed transferred_date of "2026-04-10".',
    objectives: '1. Use INSERT INTO restricted_evidence (item_type, severity, transferred_date).\n2. SELECT item_type, severity, \'2026-04-10\' FROM evidence_items WHERE location = \'Laboratory\'.\n3. Only Laboratory items should appear in restricted_evidence.\n4. Verify the restricted_evidence table.',
    difficulty_id: 3, sql_type: 'DML', mode: 'Practice', base_points: 250,
    setup_sql: "DROP TABLE IF EXISTS restricted_evidence;\nDROP TABLE IF EXISTS evidence_items;\nCREATE TABLE evidence_items (item_id INT PRIMARY KEY, item_type VARCHAR(100), location VARCHAR(100), severity INT);\nINSERT INTO evidence_items VALUES (1,'Fingerprint','Warehouse',3),(2,'Broken Lock','Laboratory',4),(3,'Security Footage','Warehouse',5),(4,'USB Device','Laboratory',5),(5,'Access Card Log','Warehouse',4),(6,'Suspicious Email','Library',2);\nCREATE TABLE restricted_evidence (id INT AUTO_INCREMENT PRIMARY KEY, item_type VARCHAR(100), severity INT, transferred_date DATE)",
    correct_query: "INSERT INTO restricted_evidence (item_type, severity, transferred_date) SELECT item_type, severity, '2026-04-10' FROM evidence_items WHERE location = 'Laboratory'",
    expected_result_sql: 'SELECT * FROM restricted_evidence ORDER BY id',
  },
  {
    title: 'Flush Unlisted Watchlist Persons',
    description: 'The watchlist must be cleaned up. Any person not linked to any incident in the incidents table should be removed. Use DELETE with a NOT IN subquery referencing the incidents table.',
    objectives: '1. Use DELETE FROM watchlist WHERE person_id NOT IN (...).\n2. The subquery: SELECT DISTINCT person_id FROM incidents.\n3. Persons with at least one incident record must remain.\n4. Persons with no incident records should be deleted.',
    difficulty_id: 3, sql_type: 'DML', mode: 'Practice', base_points: 250,
    setup_sql: "DROP TABLE IF EXISTS incidents;\nDROP TABLE IF EXISTS watchlist;\nCREATE TABLE watchlist (person_id INT PRIMARY KEY, name VARCHAR(100));\nINSERT INTO watchlist VALUES (1,'Alex Carter'),(3,'Carlos Mendoza'),(5,'Ethan Cruz'),(7,'George Ramos'),(9,'Ivan Torres'),(12,'Lara Flores');\nCREATE TABLE incidents (incident_id INT AUTO_INCREMENT PRIMARY KEY, person_id INT, description VARCHAR(100));\nINSERT INTO incidents VALUES (1,3,'Found near crime scene'),(2,5,'Suspicious item detected'),(3,7,'Accessed restricted area'),(4,12,'Sent suspicious email')",
    correct_query: 'DELETE FROM watchlist WHERE person_id NOT IN (SELECT DISTINCT person_id FROM incidents)',
    expected_result_sql: 'SELECT * FROM watchlist ORDER BY person_id',
  },

  // ══════════════════════════════════════════════════════════════
  // DDL — BEGINNER (difficulty_id=1, base_points=100)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Create a Witness Registry',
    description: 'The investigation unit needs a new table to register witnesses. Create a table named "witnesses" with the following columns: id (INT, PRIMARY KEY, AUTO_INCREMENT), name (VARCHAR 100), age (INT), phone (VARCHAR 20).',
    objectives: '1. Use CREATE TABLE witnesses (...).\n2. id must be INT, AUTO_INCREMENT, and PRIMARY KEY.\n3. name is VARCHAR(100), age is INT, phone is VARCHAR(20).\n4. Run SHOW COLUMNS FROM witnesses to verify the structure.',
    difficulty_id: 1, sql_type: 'DDL', mode: 'Practice', base_points: 100,
    setup_sql: 'DROP TABLE IF EXISTS witnesses',
    correct_query: 'CREATE TABLE witnesses (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), age INT, phone VARCHAR(20))',
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
  },
  {
    title: 'Build an Evidence Vault',
    description: 'Forensics needs a dedicated table for storing tagged evidence items. Create a table named "evidence_vault" with columns: id (INT, PRIMARY KEY, AUTO_INCREMENT), item_name (VARCHAR 100), found_at (VARCHAR 100), severity (INT).',
    objectives: '1. CREATE TABLE evidence_vault with the exact column specifications.\n2. id is INT AUTO_INCREMENT PRIMARY KEY.\n3. item_name VARCHAR(100), found_at VARCHAR(100), severity INT.\n4. Verify with SHOW COLUMNS FROM evidence_vault.',
    difficulty_id: 1, sql_type: 'DDL', mode: 'Practice', base_points: 100,
    setup_sql: 'DROP TABLE IF EXISTS evidence_vault',
    correct_query: 'CREATE TABLE evidence_vault (id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100), found_at VARCHAR(100), severity INT)',
    expected_result_sql: 'SHOW COLUMNS FROM evidence_vault',
  },
  {
    title: 'Design a Crime Log',
    description: 'A crime_log table is needed to track reported incidents. Create it with: id (INT, PRIMARY KEY, AUTO_INCREMENT), crime_type (VARCHAR 100), location (VARCHAR 100), reported_date (DATE).',
    objectives: '1. CREATE TABLE crime_log with the specified columns.\n2. id is INT AUTO_INCREMENT PRIMARY KEY.\n3. crime_type and location are VARCHAR(100), reported_date is DATE.\n4. Verify structure using SHOW COLUMNS FROM crime_log.',
    difficulty_id: 1, sql_type: 'DDL', mode: 'Practice', base_points: 100,
    setup_sql: 'DROP TABLE IF EXISTS crime_log',
    correct_query: 'CREATE TABLE crime_log (id INT AUTO_INCREMENT PRIMARY KEY, crime_type VARCHAR(100), location VARCHAR(100), reported_date DATE)',
    expected_result_sql: 'SHOW COLUMNS FROM crime_log',
  },
  {
    title: 'Set Up Department Roster',
    description: 'HR needs a departments table to organize staff. Create a table named "departments" with: dept_id (INT, PRIMARY KEY, AUTO_INCREMENT), dept_name (VARCHAR 100), head_name (VARCHAR 100).',
    objectives: '1. CREATE TABLE departments with correct columns.\n2. dept_id is INT AUTO_INCREMENT PRIMARY KEY.\n3. dept_name and head_name are VARCHAR(100).\n4. Confirm the structure with SHOW COLUMNS FROM departments.',
    difficulty_id: 1, sql_type: 'DDL', mode: 'Practice', base_points: 100,
    setup_sql: 'DROP TABLE IF EXISTS departments',
    correct_query: 'CREATE TABLE departments (dept_id INT AUTO_INCREMENT PRIMARY KEY, dept_name VARCHAR(100), head_name VARCHAR(100))',
    expected_result_sql: 'SHOW COLUMNS FROM departments',
  },
  {
    title: 'Create Incident Reports Table',
    description: 'A new table for filing incident reports is required. Create "incident_reports" with: id (INT, PRIMARY KEY, AUTO_INCREMENT), title (VARCHAR 200), description (TEXT), filed_by (VARCHAR 100).',
    objectives: '1. CREATE TABLE incident_reports with all four specified columns.\n2. id is INT AUTO_INCREMENT PRIMARY KEY.\n3. title is VARCHAR(200), description is TEXT, filed_by is VARCHAR(100).\n4. Verify with SHOW COLUMNS FROM incident_reports.',
    difficulty_id: 1, sql_type: 'DDL', mode: 'Practice', base_points: 100,
    setup_sql: 'DROP TABLE IF EXISTS incident_reports',
    correct_query: 'CREATE TABLE incident_reports (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200), description TEXT, filed_by VARCHAR(100))',
    expected_result_sql: 'SHOW COLUMNS FROM incident_reports',
  },

  // ══════════════════════════════════════════════════════════════
  // DDL — INTERMEDIATE (difficulty_id=2, base_points=150)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Add Status Column to Suspects',
    description: 'The suspects table currently only tracks name and age. Extend it by adding a "status" column (VARCHAR 20) with a default value of "Active".',
    objectives: '1. Use ALTER TABLE suspects ADD COLUMN ...\n2. Add a column named status of type VARCHAR(20).\n3. The column must have DEFAULT \'Active\'.\n4. Verify the new column appears in SHOW COLUMNS FROM suspects.',
    difficulty_id: 2, sql_type: 'DDL', mode: 'Practice', base_points: 150,
    setup_sql: "DROP TABLE IF EXISTS suspects;\nCREATE TABLE suspects (suspect_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), age INT)",
    correct_query: "ALTER TABLE suspects ADD COLUMN status VARCHAR(20) DEFAULT 'Active'",
    expected_result_sql: 'SHOW COLUMNS FROM suspects',
  },
  {
    title: 'Link Evidence to a Location',
    description: 'The evidence_vault table needs to be linked to a location record. Add an integer column named "location_id" to evidence_vault to store a foreign location reference.',
    objectives: '1. Use ALTER TABLE evidence_vault ADD COLUMN location_id INT.\n2. The column type must be INT (nullable is fine).\n3. Verify it appears correctly in SHOW COLUMNS FROM evidence_vault.',
    difficulty_id: 2, sql_type: 'DDL', mode: 'Practice', base_points: 150,
    setup_sql: 'DROP TABLE IF EXISTS evidence_vault;\nCREATE TABLE evidence_vault (id INT AUTO_INCREMENT PRIMARY KEY, item_name VARCHAR(100), severity INT)',
    correct_query: 'ALTER TABLE evidence_vault ADD COLUMN location_id INT',
    expected_result_sql: 'SHOW COLUMNS FROM evidence_vault',
  },
  {
    title: 'Add a Required Contact Column',
    description: 'Each witness must now have a contact field recorded. Add a NOT NULL contact column (VARCHAR 100) to the witnesses table with a DEFAULT of "N/A" for existing rows.',
    objectives: '1. Use ALTER TABLE witnesses ADD COLUMN contact VARCHAR(100) NOT NULL DEFAULT \'N/A\'.\n2. The contact column must be NOT NULL with a default value.\n3. Verify structure via SHOW COLUMNS FROM witnesses.',
    difficulty_id: 2, sql_type: 'DDL', mode: 'Practice', base_points: 150,
    setup_sql: 'DROP TABLE IF EXISTS witnesses;\nCREATE TABLE witnesses (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), age INT)',
    correct_query: "ALTER TABLE witnesses ADD COLUMN contact VARCHAR(100) NOT NULL DEFAULT 'N/A'",
    expected_result_sql: 'SHOW COLUMNS FROM witnesses',
  },
  {
    title: 'Drop a Redundant Column',
    description: 'The crime_log table has a "notes" column that is never used and wastes space. Remove it from the table using an ALTER TABLE statement.',
    objectives: '1. Use ALTER TABLE crime_log DROP COLUMN notes.\n2. The resulting table should have: id, crime_type, location, reported_date.\n3. Verify the column is gone using SHOW COLUMNS FROM crime_log.',
    difficulty_id: 2, sql_type: 'DDL', mode: 'Practice', base_points: 150,
    setup_sql: 'DROP TABLE IF EXISTS crime_log;\nCREATE TABLE crime_log (id INT AUTO_INCREMENT PRIMARY KEY, crime_type VARCHAR(100), location VARCHAR(100), notes TEXT, reported_date DATE)',
    correct_query: 'ALTER TABLE crime_log DROP COLUMN notes',
    expected_result_sql: 'SHOW COLUMNS FROM crime_log',
  },
  {
    title: 'Add Priority Tracking',
    description: 'Incident reports need a priority level to help investigators triage cases. Add a column named "priority" (INT) to the incident_reports table with a DEFAULT value of 1.',
    objectives: '1. Use ALTER TABLE incident_reports ADD COLUMN priority INT DEFAULT 1.\n2. The priority column must be INT and default to 1.\n3. Verify via SHOW COLUMNS FROM incident_reports.',
    difficulty_id: 2, sql_type: 'DDL', mode: 'Practice', base_points: 150,
    setup_sql: 'DROP TABLE IF EXISTS incident_reports;\nCREATE TABLE incident_reports (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200), filed_by VARCHAR(100))',
    correct_query: 'ALTER TABLE incident_reports ADD COLUMN priority INT DEFAULT 1',
    expected_result_sql: 'SHOW COLUMNS FROM incident_reports',
  },

  // ══════════════════════════════════════════════════════════════
  // DDL — EXPERT (difficulty_id=3, base_points=250)
  // ══════════════════════════════════════════════════════════════
  {
    title: 'Constrained Evidence Table',
    description: 'Build a high-security evidence table with full constraints. Create "secure_evidence" with: evidence_id (INT, PK, AUTO_INCREMENT), item_code (VARCHAR 50, UNIQUE, NOT NULL), evidence_type (VARCHAR 100, NOT NULL), severity (INT, NOT NULL).',
    objectives: '1. CREATE TABLE secure_evidence with all specified columns.\n2. evidence_id: INT AUTO_INCREMENT PRIMARY KEY.\n3. item_code: VARCHAR(50) UNIQUE NOT NULL.\n4. evidence_type: VARCHAR(100) NOT NULL.\n5. severity: INT NOT NULL.\n6. Verify with SHOW COLUMNS FROM secure_evidence.',
    difficulty_id: 3, sql_type: 'DDL', mode: 'Practice', base_points: 250,
    setup_sql: 'DROP TABLE IF EXISTS secure_evidence',
    correct_query: 'CREATE TABLE secure_evidence (evidence_id INT AUTO_INCREMENT PRIMARY KEY, item_code VARCHAR(50) UNIQUE NOT NULL, evidence_type VARCHAR(100) NOT NULL, severity INT NOT NULL)',
    expected_result_sql: 'SHOW COLUMNS FROM secure_evidence',
  },
  {
    title: 'Audit Trail Table',
    description: 'Every system action must now be logged. Create an "audit_log" table with: log_id (INT, PK, AUTO_INCREMENT), action_type (VARCHAR 50, NOT NULL), performed_by (VARCHAR 100, NOT NULL), action_date (DATE, NOT NULL), details (TEXT).',
    objectives: '1. CREATE TABLE audit_log with all specified columns.\n2. log_id: INT AUTO_INCREMENT PRIMARY KEY.\n3. action_type VARCHAR(50) NOT NULL, performed_by VARCHAR(100) NOT NULL.\n4. action_date DATE NOT NULL.\n5. details TEXT (nullable).\n6. Confirm structure via SHOW COLUMNS FROM audit_log.',
    difficulty_id: 3, sql_type: 'DDL', mode: 'Practice', base_points: 250,
    setup_sql: 'DROP TABLE IF EXISTS audit_log',
    correct_query: 'CREATE TABLE audit_log (log_id INT AUTO_INCREMENT PRIMARY KEY, action_type VARCHAR(50) NOT NULL, performed_by VARCHAR(100) NOT NULL, action_date DATE NOT NULL, details TEXT)',
    expected_result_sql: 'SHOW COLUMNS FROM audit_log',
  },
  {
    title: 'Case Assignment Linking Table',
    description: 'Build a junction table that links suspects to investigation cases. Create "case_assignments" with: assignment_id (INT, PK, AUTO_INCREMENT), case_id (INT, NOT NULL), suspect_id (INT, NOT NULL), assigned_date (DATE), notes (VARCHAR 255).',
    objectives: '1. CREATE TABLE case_assignments with all five columns.\n2. assignment_id: INT AUTO_INCREMENT PRIMARY KEY.\n3. case_id: INT NOT NULL, suspect_id: INT NOT NULL.\n4. assigned_date: DATE (nullable), notes: VARCHAR(255) (nullable).\n5. Verify with SHOW COLUMNS FROM case_assignments.',
    difficulty_id: 3, sql_type: 'DDL', mode: 'Practice', base_points: 250,
    setup_sql: 'DROP TABLE IF EXISTS case_assignments',
    correct_query: 'CREATE TABLE case_assignments (assignment_id INT AUTO_INCREMENT PRIMARY KEY, case_id INT NOT NULL, suspect_id INT NOT NULL, assigned_date DATE, notes VARCHAR(255))',
    expected_result_sql: 'SHOW COLUMNS FROM case_assignments',
  },
  {
    title: 'Rebuild Persons Table',
    description: 'The old persons_temp table has poor design. The setup has created it for you. Now create an improved replacement named "persons_v2" with: person_id (INT, PK, AUTO_INCREMENT), full_name (VARCHAR 100, NOT NULL), role (VARCHAR 50, NOT NULL), has_record (TINYINT, DEFAULT 0), created_date (DATE).',
    objectives: '1. CREATE TABLE persons_v2 (not persons_temp) as the new structure.\n2. person_id: INT AUTO_INCREMENT PRIMARY KEY.\n3. full_name: VARCHAR(100) NOT NULL, role: VARCHAR(50) NOT NULL.\n4. has_record: TINYINT DEFAULT 0.\n5. created_date: DATE (nullable).\n6. Verify via SHOW COLUMNS FROM persons_v2.',
    difficulty_id: 3, sql_type: 'DDL', mode: 'Practice', base_points: 250,
    setup_sql: 'DROP TABLE IF EXISTS persons_v2;\nDROP TABLE IF EXISTS persons_temp;\nCREATE TABLE persons_temp (id INT, fullname VARCHAR(50))',
    correct_query: 'CREATE TABLE persons_v2 (person_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, role VARCHAR(50) NOT NULL, has_record TINYINT DEFAULT 0, created_date DATE)',
    expected_result_sql: 'SHOW COLUMNS FROM persons_v2',
  },
  {
    title: 'Full Person Registry Schema',
    description: 'Design the definitive person registry table with complete constraints for production use. Create "person_registry" with: registry_id (INT, PK, AUTO_INCREMENT), national_id (VARCHAR 20, UNIQUE, NOT NULL), full_name (VARCHAR 150, NOT NULL), role (VARCHAR 50, NOT NULL, DEFAULT "Unknown"), age (INT), criminal_record (TINYINT, DEFAULT 0), registered_date (DATE, NOT NULL).',
    objectives: '1. CREATE TABLE person_registry with all 7 columns.\n2. registry_id: INT AUTO_INCREMENT PRIMARY KEY.\n3. national_id: VARCHAR(20) UNIQUE NOT NULL.\n4. full_name: VARCHAR(150) NOT NULL.\n5. role: VARCHAR(50) NOT NULL DEFAULT \'Unknown\'.\n6. age: INT, criminal_record: TINYINT DEFAULT 0.\n7. registered_date: DATE NOT NULL.\n8. Verify with SHOW COLUMNS FROM person_registry.',
    difficulty_id: 3, sql_type: 'DDL', mode: 'Practice', base_points: 250,
    setup_sql: 'DROP TABLE IF EXISTS person_registry',
    correct_query: "CREATE TABLE person_registry (registry_id INT AUTO_INCREMENT PRIMARY KEY, national_id VARCHAR(20) UNIQUE NOT NULL, full_name VARCHAR(150) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'Unknown', age INT, criminal_record TINYINT DEFAULT 0, registered_date DATE NOT NULL)",
    expected_result_sql: 'SHOW COLUMNS FROM person_registry',
  },
];

async function run() {
  const conn = await mysql.createConnection({ ...TIDB, database: 'detective_query' });
  console.log('✅ Connected to TiDB detective_query');

  // ── Step 1: Deactivate all old Practice cases ────────────────────────────────
  console.log('\n⏳ Deactivating old Practice cases...');
  const [deactivateResult] = await conn.query(
    `UPDATE cases SET is_active = 0 WHERE mode = 'Practice' AND case_id IN (17, 19, 20, 21, 27, 28)`
  );
  console.log(`✅ Deactivated ${deactivateResult.affectedRows} old cases`);

  // ── Step 2: Insert 45 new cases ──────────────────────────────────────────────
  console.log('\n⏳ Inserting 45 new practice cases...');
  let inserted = 0;

  for (const c of NEW_CASES) {
    await conn.query(
      `INSERT INTO cases
         (title, description, objectives, difficulty_id, sql_type, mode, base_points,
          setup_sql, correct_query, expected_result_sql, is_active, unlock_xp_required, dataset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1)`,
      [
        c.title, c.description, c.objectives, c.difficulty_id, c.sql_type,
        c.mode, c.base_points, c.setup_sql || null, c.correct_query || null,
        c.expected_result_sql || null
      ]
    );
    inserted++;
    process.stdout.write(`  [${inserted}/45] ${c.sql_type} (${c.difficulty_id}) — ${c.title}\n`);
  }

  // ── Step 3: Verify ───────────────────────────────────────────────────────────
  console.log('\n📊 Final verification:');
  const [counts] = await conn.query(`
    SELECT sql_type, difficulty_id, COUNT(*) AS cnt
    FROM cases
    WHERE is_active = 1 AND mode = 'Practice'
    GROUP BY sql_type, difficulty_id
    ORDER BY sql_type, difficulty_id
  `);
  console.table(counts);

  await conn.end();
  console.log('\n🎉 Done! 45 new practice cases inserted successfully.');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
