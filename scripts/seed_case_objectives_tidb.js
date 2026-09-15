const mysql = require('mysql2/promise');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

const CASE_OBJECTIVES = [
  {
    case_id: 30029,
    objectives: [
      {
        order: 1,
        text: 'Retrieve the complete roster of all persons ordered by person_id.',
        query: 'SELECT * FROM persons ORDER BY person_id',
        points: 50
      }
    ]
  },
  {
    case_id: 30030,
    objectives: [
      {
        order: 1,
        text: 'Retrieve all persons with prior criminal records (criminal_record = 1) ordered by person_id.',
        query: 'SELECT * FROM persons WHERE criminal_record = 1 ORDER BY person_id',
        points: 50
      }
    ]
  },
  {
    case_id: 30031,
    objectives: [
      {
        order: 1,
        text: 'Filter all persons under age 25 ordered by age ascending.',
        query: 'SELECT * FROM persons WHERE age < 25 ORDER BY age ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30032,
    objectives: [
      {
        order: 1,
        text: 'List name and age of all Security Guards (role = "Guard") ordered by name.',
        query: "SELECT name, age FROM persons WHERE role = 'Guard' ORDER BY name",
        points: 50
      }
    ]
  },
  {
    case_id: 30033,
    objectives: [
      {
        order: 1,
        text: 'Filter critical evidence with severity >= 4 ordered by severity DESC, evidence_id ASC.',
        query: 'SELECT * FROM evidence WHERE severity >= 4 ORDER BY severity DESC, evidence_id ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30034,
    objectives: [
      {
        order: 1,
        text: 'Count evidence items per place ordered by evidence count descending.',
        query: 'SELECT pl.place_name, COUNT(e.evidence_id) AS evidence_count FROM places pl JOIN evidence e ON pl.place_id = e.place_id GROUP BY pl.place_id, pl.place_name ORDER BY evidence_count DESC, pl.place_name ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30035,
    objectives: [
      {
        order: 1,
        text: 'Retrieve visitor logs at the Warehouse (place_id = 5) ordered by visit_time.',
        query: 'SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 ORDER BY pl.visit_time ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30036,
    objectives: [
      {
        order: 1,
        text: 'Summarize crime events with place name, location type, and crime time ordered by crime_id.',
        query: 'SELECT ce.crime_name, pl.place_name, pl.location_type, ce.crime_time FROM crime_events ce JOIN places pl ON ce.place_id = pl.place_id ORDER BY ce.crime_id',
        points: 50
      }
    ]
  },
  {
    case_id: 30037,
    objectives: [
      {
        order: 1,
        text: 'Count total evidence for persons with criminal records ordered by total evidence descending.',
        query: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS total_evidence FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role ORDER BY total_evidence DESC, p.name ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30038,
    objectives: [
      {
        order: 1,
        text: 'List staff older than 30 with clean records (criminal_record = 0) ordered by age ascending.',
        query: 'SELECT name, role, age FROM persons WHERE criminal_record = 0 AND age > 30 ORDER BY age ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30039,
    objectives: [
      {
        order: 1,
        text: 'Find persons who visited the Warehouse before the Warehouse Break-in crime time.',
        query: "SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 AND pl.visit_time < (SELECT crime_time FROM crime_events WHERE crime_name = 'Warehouse Break-in') ORDER BY pl.visit_time",
        points: 50
      }
    ]
  },
  {
    case_id: 30040,
    objectives: [
      {
        order: 1,
        text: 'Find evidence with maximum severity including suspect name and place name.',
        query: 'SELECT e.evidence_type, e.severity, p.name AS suspect_name, pl.place_name FROM evidence e JOIN persons p ON e.person_id = p.person_id JOIN places pl ON e.place_id = pl.place_id WHERE e.severity = (SELECT MAX(severity) FROM evidence) ORDER BY e.evidence_id',
        points: 50
      }
    ]
  },
  {
    case_id: 30041,
    objectives: [
      {
        order: 1,
        text: 'Find distinct persons who entered Restricted zones ordered by name.',
        query: "SELECT DISTINCT p.name, p.role, pl.place_name FROM persons p JOIN person_locations loc ON p.person_id = loc.person_id JOIN places pl ON loc.place_id = pl.place_id WHERE pl.location_type = 'Restricted' ORDER BY p.name",
        points: 50
      }
    ]
  },
  {
    case_id: 30042,
    objectives: [
      {
        order: 1,
        text: 'Find persons with criminal records linked to multiple evidence items (HAVING COUNT > 1).',
        query: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS evidence_count FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role HAVING COUNT(e.evidence_id) > 1 ORDER BY evidence_count DESC, p.name ASC',
        points: 50
      }
    ]
  },
  {
    case_id: 30043,
    objectives: [
      {
        order: 1,
        text: 'Identify persons present at crime scenes within 1 hour before the crime occurred.',
        query: 'SELECT p.name, p.role, ce.crime_name, pl.visit_time, ce.crime_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id JOIN crime_events ce ON pl.place_id = ce.place_id WHERE pl.visit_time >= DATE_SUB(ce.crime_time, INTERVAL 1 HOUR) AND pl.visit_time <= ce.crime_time ORDER BY ce.crime_name ASC, pl.visit_time ASC',
        points: 50
      }
    ]
  }
];

async function run() {
  const conn = await mysql.createConnection(TIDB);
  console.log('Connected to TiDB!');

  for (const item of CASE_OBJECTIVES) {
    // Delete existing objectives for case
    await conn.query('DELETE FROM case_objectives WHERE case_id = ?', [item.case_id]);

    for (const obj of item.objectives) {
      await conn.query(
        `INSERT INTO case_objectives 
         (case_id, objective_order, objective_text, expected_query, validation_type, points)
         VALUES (?, ?, ?, ?, 'result', ?)`,
        [item.case_id, obj.order, obj.text, obj.query, obj.points]
      );
    }
    console.log(`✅ Case ${item.case_id}: Added ${item.objectives.length} objective(s) to case_objectives`);
  }

  console.log('\nAll DQL case objectives inserted into case_objectives table successfully!');
  await conn.end();
}

run().catch(console.error);
