/**
 * inspect_playground_data.js
 * Shows all data in the DQL playground to understand who the main suspect is
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

// We need to run the DQL_SETUP on a temp DB and read the data
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

async function main() {
  const conn = await mysql.createConnection({ ...TIDB, database: undefined });
  const dbName = 'temp_inspect_db_12345';
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.query(`CREATE DATABASE \`${dbName}\``);
  await conn.query(`USE \`${dbName}\``);

  for (const stmt of DQL_SETUP.split(';').map(s => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }

  console.log('\n=== PERSONS ===');
  const [persons] = await conn.query('SELECT * FROM persons ORDER BY person_id');
  console.table(persons);

  console.log('\n=== EVIDENCE ===');
  const [evidence] = await conn.query('SELECT * FROM evidence ORDER BY evidence_id');
  console.table(evidence);

  console.log('\n=== PERSON_LOCATIONS ===');
  const [locs] = await conn.query('SELECT * FROM person_locations ORDER BY record_id');
  console.table(locs);

  console.log('\n=== CRIME_EVENTS ===');
  const [crimes] = await conn.query('SELECT * FROM crime_events');
  console.table(crimes);

  console.log('\n=== WHO HAS CRIMINAL RECORD? ===');
  const [criminals] = await conn.query('SELECT * FROM persons WHERE criminal_record = 1 ORDER BY person_id');
  console.table(criminals);

  console.log('\n=== EVIDENCE AT WAREHOUSE (place_id=5) by Person ===');
  const [warehouseEvidence] = await conn.query(`
    SELECT e.evidence_id, e.evidence_type, e.severity, p.name, p.role, p.criminal_record
    FROM evidence e JOIN persons p ON e.person_id = p.person_id
    WHERE e.place_id = 5 ORDER BY e.severity DESC
  `);
  console.table(warehouseEvidence);

  console.log('\n=== WHO WAS AT WAREHOUSE BEFORE CRIME TIME (10:30)? ===');
  const [warehouseVisitors] = await conn.query(`
    SELECT p.name, p.role, p.criminal_record, pl.visit_time
    FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id
    WHERE pl.place_id = 5 ORDER BY pl.visit_time
  `);
  console.table(warehouseVisitors);

  console.log('\n=== SUSPECTS WITH MOST EVIDENCE (criminal_record=1) ===');
  const [topSuspects] = await conn.query(`
    SELECT p.name, p.role, COUNT(e.evidence_id) AS evidence_count
    FROM persons p JOIN evidence e ON p.person_id = e.person_id
    WHERE p.criminal_record = 1
    GROUP BY p.person_id, p.name, p.role
    ORDER BY evidence_count DESC
  `);
  console.table(topSuspects);

  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
