const ALL_OBJECTIVES = [
  // ─── 30029: The Full Roster ───
  {
    case_id: 30029,
    title: 'The Full Roster',
    objectives: [
      {
        order: 1,
        text: 'Retrieve the names and roles of all persons from the persons table.',
        query: 'SELECT name, role FROM persons;',
        points: 15
      },
      {
        order: 2,
        text: 'Retrieve all records from the persons table ordered by person_id ascending.',
        query: 'SELECT * FROM persons ORDER BY person_id ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Identify staff and janitors who have prior criminal records (role IN ("Janitor", "Staff") AND criminal_record = 1). Note George Ramos and Oscar Villanueva as persons of interest.',
        query: "SELECT person_id, name, role, age FROM persons WHERE role IN ('Janitor', 'Staff') AND criminal_record = 1 ORDER BY person_id;",
        points: 20
      }
    ]
  },

  // ─── 30030: Criminal Record Scan ───
  {
    case_id: 30030,
    title: 'Criminal Record Scan',
    objectives: [
      {
        order: 1,
        text: 'Count how many persons have prior criminal records (criminal_record = 1).',
        query: 'SELECT COUNT(*) AS total_flagged FROM persons WHERE criminal_record = 1;',
        points: 15
      },
      {
        order: 2,
        text: 'Retrieve all columns of persons with prior criminal records ordered by person_id.',
        query: 'SELECT * FROM persons WHERE criminal_record = 1 ORDER BY person_id ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the only flagged Janitor on campus who holds master keys to the warehouse (role = "Janitor" AND criminal_record = 1). Pinpoints George Ramos!',
        query: "SELECT person_id, name, role, age FROM persons WHERE role = 'Janitor' AND criminal_record = 1;",
        points: 20
      }
    ]
  },

  // ─── 30031: Young Suspect Filter ───
  {
    case_id: 30031,
    title: 'Young Suspect Filter',
    objectives: [
      {
        order: 1,
        text: 'Retrieve the name, role, and age of all students under age 25.',
        query: "SELECT name, role, age FROM persons WHERE role = 'Student' AND age < 25;",
        points: 15
      },
      {
        order: 2,
        text: 'List all persons under age 25 ordered by age ascending.',
        query: 'SELECT * FROM persons WHERE age < 25 ORDER BY age ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint young students with a prior criminal record linked to campus thefts (role = "Student", age < 25, criminal_record = 1) ordered by name. Reveals Ethan Cruz and Lara Flores!',
        query: "SELECT person_id, name, role, age FROM persons WHERE role = 'Student' AND age < 25 AND criminal_record = 1 ORDER BY name;",
        points: 20
      }
    ]
  },

  // ─── 30032: Security Guards On Duty ───
  {
    case_id: 30032,
    title: 'Security Guards On Duty',
    objectives: [
      {
        order: 1,
        text: 'Retrieve all details of persons whose role is "Guard".',
        query: "SELECT * FROM persons WHERE role = 'Guard';",
        points: 15
      },
      {
        order: 2,
        text: 'SELECT only the name and age columns of all guards ordered alphabetically by name.',
        query: "SELECT name, age FROM persons WHERE role = 'Guard' ORDER BY name ASC;",
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the security guard who has a prior criminal record (role = "Guard" AND criminal_record = 1). This exposes Carlos Mendoza!',
        query: "SELECT person_id, name, role, age FROM persons WHERE role = 'Guard' AND criminal_record = 1;",
        points: 20
      }
    ]
  },

  // ─── 30033: High Severity Evidence ───
  {
    case_id: 30033,
    title: 'High Severity Evidence',
    objectives: [
      {
        order: 1,
        text: 'Retrieve evidence_id, evidence_type, and severity for all evidence items with severity >= 4.',
        query: 'SELECT evidence_id, evidence_type, severity FROM evidence WHERE severity >= 4;',
        points: 15
      },
      {
        order: 2,
        text: 'Retrieve all columns from the evidence table for severity >= 4 ordered by severity DESC, evidence_id ASC.',
        query: 'SELECT * FROM evidence WHERE severity >= 4 ORDER BY severity DESC, evidence_id ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the critical severity 5 evidence located at the Warehouse (place_id = 5) and reveal which suspect person_id it incriminates (George Ramos, person_id = 7)!',
        query: 'SELECT evidence_id, evidence_type, severity, person_id FROM evidence WHERE severity = 5 AND place_id = 5;',
        points: 20
      }
    ]
  },

  // ─── 30034: Evidence Per Location ───
  {
    case_id: 30034,
    title: 'Evidence Per Location',
    objectives: [
      {
        order: 1,
        text: 'Join evidence with places and list evidence_type alongside place_name.',
        query: 'SELECT e.evidence_type, pl.place_name FROM evidence e JOIN places pl ON e.place_id = pl.place_id;',
        points: 15
      },
      {
        order: 2,
        text: 'Count evidence items per place ordered by evidence_count DESC, place_name ASC.',
        query: 'SELECT pl.place_name, COUNT(e.evidence_id) AS evidence_count FROM places pl JOIN evidence e ON pl.place_id = e.place_id GROUP BY pl.place_id, pl.place_name ORDER BY evidence_count DESC, pl.place_name ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the single location with the highest evidence count having at least 3 evidence items. Confirms Warehouse is the primary crime scene!',
        query: 'SELECT pl.place_name, COUNT(e.evidence_id) AS evidence_count FROM places pl JOIN evidence e ON pl.place_id = e.place_id GROUP BY pl.place_id, pl.place_name HAVING COUNT(e.evidence_id) >= 3 ORDER BY evidence_count DESC;',
        points: 20
      }
    ]
  },

  // ─── 30035: Warehouse Visitors ───
  {
    case_id: 30035,
    title: 'Warehouse Visitors',
    objectives: [
      {
        order: 1,
        text: 'Retrieve all visit logs for the Warehouse (place_id = 5).',
        query: 'SELECT * FROM person_locations WHERE place_id = 5;',
        points: 15
      },
      {
        order: 2,
        text: 'Join persons with person_locations and retrieve p.name, p.role, and pl.visit_time at the Warehouse ordered by visit_time ASC.',
        query: 'SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 ORDER BY pl.visit_time ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the earliest visitor who entered the Warehouse before 10:00 AM. Pinpoints George Ramos (entered at 09:50:00) as the prime suspect inside during the break-in!',
        query: "SELECT p.person_id, p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 AND pl.visit_time < '2026-04-10 10:00:00';",
        points: 20
      }
    ]
  },

  // ─── 30036: Crime Scene Summary ───
  {
    case_id: 30036,
    title: 'Crime Scene Summary',
    objectives: [
      {
        order: 1,
        text: 'Retrieve all reported crimes from the crime_events table.',
        query: 'SELECT crime_id, crime_name, crime_time FROM crime_events;',
        points: 15
      },
      {
        order: 2,
        text: 'Join crime_events with places and select ce.crime_name, pl.place_name, pl.location_type, ce.crime_time ordered by crime_id.',
        query: 'SELECT ce.crime_name, pl.place_name, pl.location_type, ce.crime_time FROM crime_events ce JOIN places pl ON ce.place_id = pl.place_id ORDER BY ce.crime_id;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the exact crime event and location of the Warehouse Break-in. Confirms crime occurred at place_id 5 (Warehouse) at 10:30 AM!',
        query: "SELECT ce.crime_name, pl.place_name, ce.crime_time FROM crime_events ce JOIN places pl ON ce.place_id = pl.place_id WHERE ce.crime_name = 'Warehouse Break-in';",
        points: 20
      }
    ]
  },

  // ─── 30037: Suspects With Evidence Count ───
  {
    case_id: 30037,
    title: 'Suspects With Evidence Count',
    objectives: [
      {
        order: 1,
        text: 'List all evidence items associated with a person_id.',
        query: 'SELECT evidence_id, evidence_type, person_id FROM evidence WHERE person_id IS NOT NULL;',
        points: 15
      },
      {
        order: 2,
        text: 'Count total evidence for persons with criminal records ordered by total_evidence DESC, name ASC.',
        query: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS total_evidence FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role ORDER BY total_evidence DESC, p.name ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the suspect with criminal record whose evidence is located directly inside the Warehouse (place_id = 5). Conclusively reveals George Ramos!',
        query: 'SELECT p.person_id, p.name, p.role, COUNT(e.evidence_id) AS warehouse_evidence FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 AND e.place_id = 5 GROUP BY p.person_id, p.name, p.role;',
        points: 20
      }
    ]
  },

  // ─── 30038: Older Staff With Clean Records ───
  {
    case_id: 30038,
    title: 'Older Staff With Clean Records',
    objectives: [
      {
        order: 1,
        text: 'Retrieve the names and ages of all persons with clean records (criminal_record = 0).',
        query: 'SELECT name, role, age FROM persons WHERE criminal_record = 0;',
        points: 15
      },
      {
        order: 2,
        text: 'List staff and personnel older than 30 with clean records ordered by age ASC.',
        query: 'SELECT name, role, age FROM persons WHERE criminal_record = 0 AND age > 30 ORDER BY age ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the trustworthy clean-record Security Guard on duty who acts as key witness (role = "Guard" AND criminal_record = 0). Identifies Mark Dela Cruz!',
        query: "SELECT person_id, name, role, age FROM persons WHERE role = 'Guard' AND criminal_record = 0;",
        points: 20
      }
    ]
  },

  // ─── 30039: Before The Crime ───
  {
    case_id: 30039,
    title: 'Before The Crime',
    objectives: [
      {
        order: 1,
        text: 'Retrieve the exact timestamp when the Warehouse Break-in occurred.',
        query: "SELECT crime_name, crime_time FROM crime_events WHERE crime_name = 'Warehouse Break-in';",
        points: 15
      },
      {
        order: 2,
        text: 'Retrieve persons who visited the Warehouse (place_id = 5) before the Warehouse Break-in crime time ordered by visit_time.',
        query: "SELECT p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 AND pl.visit_time < (SELECT crime_time FROM crime_events WHERE crime_name = 'Warehouse Break-in') ORDER BY pl.visit_time ASC;",
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint which Warehouse visitor before the crime has a criminal record. Direct proof: George Ramos was present before the break-in with a prior record!',
        query: "SELECT p.person_id, p.name, p.role, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id WHERE pl.place_id = 5 AND p.criminal_record = 1 AND pl.visit_time < (SELECT crime_time FROM crime_events WHERE crime_name = 'Warehouse Break-in');",
        points: 20
      }
    ]
  },

  // ─── 30040: Maximum Evidence Severity ───
  {
    case_id: 30040,
    title: 'Maximum Evidence Severity',
    objectives: [
      {
        order: 1,
        text: 'Find the maximum severity score across all collected evidence.',
        query: 'SELECT MAX(severity) AS max_severity FROM evidence;',
        points: 15
      },
      {
        order: 2,
        text: 'Retrieve all evidence matching the maximum severity along with suspect name and place name ordered by evidence_id.',
        query: 'SELECT e.evidence_type, e.severity, p.name AS suspect_name, pl.place_name FROM evidence e JOIN persons p ON e.person_id = p.person_id JOIN places pl ON e.place_id = pl.place_id WHERE e.severity = (SELECT MAX(severity) FROM evidence) ORDER BY e.evidence_id ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the maximum severity (5) evidence specifically found at the Warehouse crime scene. Directly exposes George Ramos and the Security Footage!',
        query: 'SELECT e.evidence_type, e.severity, p.name AS suspect_name FROM evidence e JOIN persons p ON e.person_id = p.person_id WHERE e.severity = (SELECT MAX(severity) FROM evidence) AND e.place_id = 5;',
        points: 20
      }
    ]
  },

  // ─── 30041: Restricted Zone Intruders ───
  {
    case_id: 30041,
    title: 'Restricted Zone Intruders',
    objectives: [
      {
        order: 1,
        text: 'List all campus locations designated as Restricted zones.',
        query: "SELECT place_id, place_name, location_type FROM places WHERE location_type = 'Restricted';",
        points: 15
      },
      {
        order: 2,
        text: 'Find distinct persons who entered Restricted zones ordered by name.',
        query: "SELECT DISTINCT p.name, p.role, pl.place_name FROM persons p JOIN person_locations loc ON p.person_id = loc.person_id JOIN places pl ON loc.place_id = pl.place_id WHERE pl.location_type = 'Restricted' ORDER BY p.name ASC;",
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the non-security employee with a criminal record who entered the Restricted Warehouse. Pinpoints George Ramos (Janitor) trespassing in restricted storage!',
        query: "SELECT DISTINCT p.person_id, p.name, p.role, pl.place_name FROM persons p JOIN person_locations loc ON p.person_id = loc.person_id JOIN places pl ON loc.place_id = pl.place_id WHERE pl.location_type = 'Restricted' AND p.role != 'Guard' AND p.criminal_record = 1 AND pl.place_name = 'Warehouse';",
        points: 20
      }
    ]
  },

  // ─── 30042: Multi-Evidence Suspects ───
  {
    case_id: 30042,
    title: 'Multi-Evidence Suspects',
    objectives: [
      {
        order: 1,
        text: 'Group evidence by person_id and count evidence items per person.',
        query: 'SELECT person_id, COUNT(evidence_id) AS evidence_count FROM evidence GROUP BY person_id;',
        points: 15
      },
      {
        order: 2,
        text: 'Find persons with criminal records who have more than 1 evidence item linked to them ordered by evidence_count DESC, name ASC.',
        query: 'SELECT p.name, p.role, COUNT(e.evidence_id) AS evidence_count FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role HAVING COUNT(e.evidence_id) > 1 ORDER BY evidence_count DESC, p.name ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'Pinpoint the multi-evidence suspect whose multiple evidence items were both found at the Warehouse (place_id = 5). Undeniable proof: George Ramos has 2 items at the crime scene!',
        query: 'SELECT p.person_id, p.name, p.role, COUNT(e.evidence_id) AS warehouse_items FROM persons p JOIN evidence e ON p.person_id = e.person_id WHERE e.place_id = 5 AND p.criminal_record = 1 GROUP BY p.person_id, p.name, p.role HAVING COUNT(e.evidence_id) > 1;',
        points: 20
      }
    ]
  },

  // ─── 30043: Active Crime Time Window ───
  {
    case_id: 30043,
    title: 'Active Crime Time Window',
    objectives: [
      {
        order: 1,
        text: 'List all crime events with their place_id and crime_time.',
        query: 'SELECT crime_name, place_id, crime_time FROM crime_events;',
        points: 15
      },
      {
        order: 2,
        text: 'Identify all persons present at crime scenes within 1 hour before the crime occurred ordered by crime_name ASC, visit_time ASC.',
        query: 'SELECT p.name, p.role, ce.crime_name, pl.visit_time, ce.crime_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id JOIN crime_events ce ON pl.place_id = ce.place_id WHERE pl.visit_time >= DATE_SUB(ce.crime_time, INTERVAL 1 HOUR) AND pl.visit_time <= ce.crime_time ORDER BY ce.crime_name ASC, pl.visit_time ASC;',
        points: 15
      },
      {
        order: 3,
        text: 'FINAL VERDICT: Pinpoint the individual with a prior criminal record caught inside the Warehouse within 1 hour of the break-in. CONGRATULATIONS: You have proven GEORGE RAMOS is the perpetrator!',
        query: "SELECT p.person_id, p.name, p.role, ce.crime_name, pl.visit_time FROM persons p JOIN person_locations pl ON p.person_id = pl.person_id JOIN crime_events ce ON pl.place_id = ce.place_id WHERE p.criminal_record = 1 AND ce.crime_name = 'Warehouse Break-in' AND pl.visit_time >= DATE_SUB(ce.crime_time, INTERVAL 1 HOUR) AND pl.visit_time <= ce.crime_time;",
        points: 20
      }
    ]
  }
];

module.exports = { ALL_OBJECTIVES };
