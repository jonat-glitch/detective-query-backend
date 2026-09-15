/**
 * update_dql_objectives.js
 * Rewrites all 15 DQL Practice case objectives to include:
 *   1. 🕵️ Investigation brief (narrative context + crime being solved)
 *   2. SQL steps (numbered, what to write)
 *   3. 🔍 Verdict Clue / Final Verdict (points toward the main suspect)
 *
 * Main suspects per crime:
 *   Warehouse Break-in     → George Ramos   (Janitor,  person_id=7)
 *   Lab Equipment Theft    → Ethan Cruz     (Student,  person_id=5)
 *   Library Data Leak      → Lara Flores    (Student, person_id=12)
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

const UPDATES = [
  // ============================================================
  // BEGINNER (difficulty_id = 1)  — General investigation setup
  // ============================================================
  {
    case_id: 30029,
    title: 'The Full Roster',
    objectives: `🕵️ INVESTIGATION BRIEF: Multiple crimes have rocked the campus — a Warehouse Break-in, a Lab Equipment Theft, and a Library Data Leak. You are Detective Reyes, newly assigned to the case. Your first move is to pull the complete roster of all persons of interest currently logged in the system.

1. Use SELECT * to retrieve all records from the persons table.
2. Order the results by person_id in ascending order.
3. Verify all 15 persons appear in the result.

🔍 OBSERVATION: Study each person's name, role, age, and criminal_record. The column criminal_record = 1 flags prior offenders — they are your prime suspects. Remember this roster; you will narrow it down in the next cases.`,
    correct_suspect_id: null,
  },
  {
    case_id: 30030,
    title: 'Criminal Record Scan',
    objectives: `🕵️ INVESTIGATION BRIEF: The detective database reveals that several individuals on campus have prior criminal records. Retrieve only those flagged offenders — they move to the top of your suspect list.

1. Filter the persons table using a WHERE clause.
2. Retrieve only persons where criminal_record = 1.
3. Order results by person_id ascending.

🔍 OBSERVATION: Five persons have criminal records: Carlos Mendoza (Guard), Ethan Cruz (Student), George Ramos (Janitor), Lara Flores (Student), and Oscar Villanueva (Staff). Cross-reference these names with locations and evidence in subsequent cases to pinpoint who committed each crime.`,
    correct_suspect_id: null,
  },
  {
    case_id: 30031,
    title: 'Young Suspect Filter',
    objectives: `🕵️ INVESTIGATION BRIEF: An anonymous tip states: "I saw a young student near the Library before things went missing." You need a list of all persons under 25 — students young enough to match the witness description.

1. Use WHERE to filter persons with age < 25.
2. Order results by age ascending.
3. Your result should include all columns from the persons table.

🔍 OBSERVATION: The filtered list includes Alex Carter (19), Hannah Lee (18), Lara Flores (20, criminal record!), Nina Ortiz (19), Ethan Cruz (22, criminal record!), and Kevin Lim (23). Both Lara Flores and Ethan Cruz are young AND have criminal records — flag them for closer scrutiny.`,
    correct_suspect_id: null,
  },
  {
    case_id: 30032,
    title: 'Security Guards On Duty',
    objectives: `🕵️ INVESTIGATION BRIEF: Security guards patrol restricted areas and are both key witnesses and persons of interest. Retrieve all guards currently assigned on campus.

1. SELECT only the name and age columns from persons.
2. Filter WHERE role = 'Guard'.
3. Order results alphabetically by name.

🔍 OBSERVATION: Two guards are on duty — Carlos Mendoza (age 34) and Mark Dela Cruz (age 38). Critically, Carlos Mendoza has a criminal record (criminal_record = 1). Guards have access to all restricted zones including the Warehouse. Carlos Mendoza remains a person of interest.`,
    correct_suspect_id: null,
  },
  {
    case_id: 30033,
    title: 'High Severity Evidence',
    objectives: `🕵️ INVESTIGATION BRIEF: Forensics has classified all evidence with a severity score of 4 or higher as critical to the investigation. These are the most damning clues — retrieve them immediately.

1. Use WHERE severity >= 4 to filter the evidence table.
2. Order results by severity DESC, then evidence_id ASC.
3. Retrieve all columns from the evidence table.

🔍 OBSERVATION: Critical evidence (severity 4–5) is concentrated at the Warehouse (place_id=5) and Lab (place_id=3). The severity-5 items are a Security Footage clip (person_id=7, Warehouse) and a USB Device (person_id=5, Lab). Check who person_id 7 and 5 are — they are your top suspects per crime scene.`,
    correct_suspect_id: null,
  },

  // ============================================================
  // INTERMEDIATE (difficulty_id = 2) — Warehouse Break-in focus
  // ============================================================
  {
    case_id: 30034,
    title: 'Evidence Per Location',
    objectives: `🕵️ INVESTIGATION BRIEF: To prioritize crime scenes, determine which locations have the highest concentration of evidence. The location with the most evidence is likely the primary crime scene.

1. JOIN evidence with places on place_id.
2. GROUP BY place_id and place_name.
3. COUNT evidence_id as evidence_count.
4. Order by evidence_count DESC, then place_name ASC for ties.

🔍 OBSERVATION: The Warehouse ranks highest in evidence count, confirming it as the primary scene of the Warehouse Break-in. This directs the investigation toward everyone who accessed the Warehouse — especially those with criminal records.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30035,
    title: 'Warehouse Visitors',
    objectives: `🕵️ INVESTIGATION BRIEF: The Warehouse Break-in occurred on April 10, 2026. Retrieve the complete list of all individuals who were logged at the Warehouse (place_id = 5). One of these people is the prime suspect.

1. JOIN persons with person_locations on person_id.
2. Filter WHERE place_id = 5 (Warehouse).
3. SELECT p.name, p.role, pl.visit_time.
4. Order by visit_time ascending.

🔍 OBSERVATION: Three individuals visited the Warehouse — George Ramos (Janitor, 09:50 AM), Carlos Mendoza (Guard, 10:15 AM), and Oscar Villanueva (Staff, 10:40 AM). The crime occurred at 10:30 AM. George Ramos arrived earliest and was already inside before the break-in. He is your prime suspect.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30036,
    title: 'Crime Scene Summary',
    objectives: `🕵️ INVESTIGATION BRIEF: Before making any accusations, compile a complete summary of all reported crimes, their locations, and the exact times they occurred. This gives you the full picture of what happened across campus.

1. JOIN crime_events with places on place_id.
2. SELECT ce.crime_name, pl.place_name, pl.location_type, ce.crime_time.
3. Order by ce.crime_id ascending.

🔍 OBSERVATION: Three crimes occurred — Warehouse Break-in (10:30 AM, April 10), Lab Equipment Theft (10:45 AM, April 10), and Library Data Leak (3:00 PM, April 9). The Warehouse and Lab are Restricted zones. Your primary investigation focuses on the Warehouse Break-in.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30037,
    title: 'Suspects With Evidence Count',
    objectives: `🕵️ INVESTIGATION BRIEF: Cross-reference all persons with criminal records against the evidence table. Count how many evidence items are linked to each suspect — the one with the most evidence at the crime scene is your strongest lead.

1. JOIN persons with evidence on person_id.
2. Filter WHERE criminal_record = 1.
3. GROUP BY person_id, name, role.
4. COUNT evidence_id AS total_evidence.
5. Order by total_evidence DESC, p.name ASC.

🔍 OBSERVATION: Carlos Mendoza, Ethan Cruz, and George Ramos each have 2 pieces of evidence. However, BOTH of George Ramos's evidence items are located at the Warehouse — the exact crime scene. This concentration of evidence at one location makes George Ramos the strongest Warehouse suspect.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30038,
    title: 'Older Staff With Clean Records',
    objectives: `🕵️ INVESTIGATION BRIEF: The investigation needs credible witnesses — experienced staff members over 30 years old with no criminal record. These individuals may have observed suspicious behavior around the Warehouse on the day of the break-in.

1. SELECT name, role, age from persons.
2. Filter WHERE criminal_record = 0 AND age > 30.
3. Order by age ASC.

🔍 OBSERVATION: Clean-record staff over 30 include Fiona Garcia (Nurse, 31), Mark Dela Cruz (Guard, 38), and Julia Santos (Teacher, 41). These individuals can serve as alibi witnesses. Mark Dela Cruz — a guard with no criminal record — is a key witness who may have observed George Ramos's movements near the Warehouse.`,
    correct_suspect_id: 7,
  },

  // ============================================================
  // EXPERT (difficulty_id = 3)  — Conclusive suspect identification
  // ============================================================
  {
    case_id: 30039,
    title: 'Before The Crime',
    objectives: `🕵️ INVESTIGATION BRIEF: Time is everything in criminal investigations. The Warehouse Break-in occurred at 10:30 AM. To identify the perpetrator, you must find out who was physically inside the Warehouse BEFORE the crime occurred — only they had opportunity.

1. JOIN persons with person_locations on person_id.
2. Filter WHERE place_id = 5.
3. Use a subquery to get the crime_time for "Warehouse Break-in" from crime_events.
4. Filter WHERE visit_time < that subquery result.
5. Order by visit_time ascending.

🔍 VERDICT CLUE: Only two people were at the Warehouse BEFORE the 10:30 AM break-in — George Ramos (09:50 AM) and Carlos Mendoza (10:15 AM). Oscar Villanueva arrived AFTER the crime (10:40 AM). George Ramos arrived 40 minutes earliest and had the most time and opportunity to commit the break-in.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30040,
    title: 'Maximum Evidence Severity',
    objectives: `🕵️ INVESTIGATION BRIEF: The forensics team has isolated the single most critical piece of evidence — the item with the highest severity rating. Find it, and you find the strongest link to the perpetrator.

1. JOIN evidence with persons (on person_id) and places (on place_id).
2. Use a subquery: WHERE e.severity = (SELECT MAX(severity) FROM evidence).
3. SELECT e.evidence_type, e.severity, p.name AS suspect_name, pl.place_name.
4. Order by e.evidence_id.

🔍 VERDICT CLUE: Two severity-5 items exist — Security Footage at the Warehouse (linked to George Ramos) and a USB Device at the Lab (linked to Ethan Cruz). For the Warehouse Break-in, the Security Footage directly capturing George Ramos is the most critical piece of evidence. This is near-conclusive proof.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30041,
    title: 'Restricted Zone Intruders',
    objectives: `🕵️ INVESTIGATION BRIEF: Both the Warehouse and Laboratory are classified as Restricted zones. Unauthorized access to these areas is itself suspicious. Find every individual who was logged entering any restricted zone — they are all persons of interest.

1. JOIN persons with person_locations, then with places.
2. Filter WHERE pl.location_type = 'Restricted'.
3. Use DISTINCT to avoid duplicates.
4. SELECT p.name, p.role, pl.place_name.
5. Order by p.name ASC.

🔍 VERDICT CLUE: Restricted zone intruders include Carlos Mendoza, Ethan Cruz, George Ramos, Ivan Torres, Kevin Lim, and Oscar Villanueva. George Ramos (Janitor) is the only person whose access to the Warehouse is documented alongside two pieces of physical evidence — a Security Footage clip and a Tool Found at the scene.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30042,
    title: 'Multi-Evidence Suspects',
    objectives: `🕵️ INVESTIGATION BRIEF: The case is nearly cracked. Find all persons with a criminal record who have MORE than one piece of evidence pointing at them. A suspect with multiple evidence items is difficult to dismiss.

1. JOIN persons with evidence on person_id.
2. Filter WHERE criminal_record = 1.
3. GROUP BY person_id, name, role.
4. Use HAVING COUNT(e.evidence_id) > 1.
5. SELECT name, role, COUNT as evidence_count.
6. Order by evidence_count DESC, name ASC.

🔍 VERDICT CLUE: Three suspects each have 2 pieces of evidence — Carlos Mendoza (Guard), Ethan Cruz (Student), and George Ramos (Janitor). The decisive factor: both of George Ramos's evidence pieces (Security Footage + Tool Found) are located at the Warehouse crime scene, whereas Carlos Mendoza's evidence is mixed across different roles and places.`,
    correct_suspect_id: 7,
  },
  {
    case_id: 30043,
    title: 'Active Crime Time Window',
    objectives: `🕵️ INVESTIGATION BRIEF: This is your final query — the smoking gun. Find every individual who was physically present at a crime location WITHIN ONE HOUR before the crime occurred. This is the definitive opportunity window. Cross-reference with criminal records and evidence count to reach your final verdict.

1. JOIN persons → person_locations → crime_events (match on place_id).
2. Filter WHERE visit_time >= (crime_time - INTERVAL 1 HOUR) AND visit_time <= crime_time.
3. SELECT p.name, p.role, ce.crime_name, pl.visit_time, ce.crime_time.
4. Use pl as alias for person_locations and ce for crime_events.
5. Order by ce.crime_name ASC, pl.visit_time ASC.

🔍 FINAL VERDICT: George Ramos (Janitor) was at the Warehouse at 09:50 AM — within the one-hour window before the 10:30 AM Warehouse Break-in. He has a criminal record, 2 pieces of evidence at the Warehouse (including Security Footage with severity 5), and the earliest documented presence at the scene. ➡️ The prime suspect for the Warehouse Break-in is GEORGE RAMOS.`,
    correct_suspect_id: 7,
  },
];

async function main() {
  const conn = await mysql.createConnection(TIDB);
  console.log('Connected to TiDB. Updating DQL case objectives...\n');

  let successCount = 0;
  for (const u of UPDATES) {
    try {
      const [result] = await conn.query(
        `UPDATE cases SET objectives = ?, correct_suspect_id = ? WHERE case_id = ?`,
        [u.objectives, u.correct_suspect_id, u.case_id]
      );
      if (result.affectedRows > 0) {
        console.log(`✅ Updated Case ${u.case_id}: ${u.title}`);
        successCount++;
      } else {
        console.log(`⚠️  No rows affected for Case ${u.case_id}: ${u.title}`);
      }
    } catch (err) {
      console.error(`❌ Error updating Case ${u.case_id}: ${u.title}`, err.message);
    }
  }

  console.log(`\nDone! Updated ${successCount}/${UPDATES.length} DQL cases.`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
