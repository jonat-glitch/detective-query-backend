/**
 * seed_detective_campaign.js
 *
 * Enriches all 90 cases across Practice and Rank modes with an immersive
 * 3-act detective narrative:
 *   Act I:   DDL — The Blueprint (Building Precinct Relational Infrastructure)
 *   Act II:  DML — Intelligence Ingestion (Logging Evidence, Suspects & Field Updates)
 *   Act III: DQL — The Grand Investigation (Option A: 3 Progressive Investigative Queries)
 */

const { systemDB, playgroundDB } = require('../db');

// ══════════════════════════════════════════════════════════════════════════════
// DQL OPTION A: 3 Progressive Queries Definition for Practice & Rank
// ══════════════════════════════════════════════════════════════════════════════

const dqlProgressiveSpecs = {
  // ── RANK DQL (Cases 60104–60118) ──
  60104: {
    title: 'The Infiltrator in Custody',
    narrative: '📁 CASE BRIEFING: Forensics recovered an encrypted radio transceiver from the City Hall perimeter fence. Dispatch reports that one of Marcus Webb’s operatives was apprehended attempting to flee the sector. Access the suspect registry to isolate the detained individual and retrieve their demographic file for immediate interrogation.',
    correct_query: "SELECT name, age FROM suspects WHERE status = 'Arrested'",
    objectives: [
      {
        order: 1,
        text: 'Initial Registry Sweep: Survey all suspects and check their current custody statuses.',
        query: 'SELECT name, status FROM suspects',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Detained Operative: Isolate only the suspect whose status is currently "Arrested".',
        query: "SELECT name, status FROM suspects WHERE status = 'Arrested'",
        points: 33
      },
      {
        order: 3,
        text: 'Official Interrogation Profile: Extract the suspect’s name and age for the lead detective dossier.',
        query: "SELECT name, age FROM suspects WHERE status = 'Arrested'",
        points: 34
      }
    ]
  },
  60105: {
    title: 'High-Priority Forensic Evidence',
    narrative: '📁 CASE BRIEFING: Evidence lockers at Central Precinct received multiple drop-offs from the municipal vault breach. Crime lab analysts flagged all biological and lethal materials. Filter the evidence registry for items carrying a severity rating of 4 or higher.',
    correct_query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
    objectives: [
      {
        order: 1,
        text: 'Evidence Catalog Survey: View all logged physical evidence items and their assigned severity scores.',
        query: 'SELECT item_name, severity FROM evidence',
        points: 33
      },
      {
        order: 2,
        text: 'Isolate Critical Items: Filter for all evidence tagged with high severity (severity >= 4).',
        query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
        points: 33
      },
      {
        order: 3,
        text: 'Lab Priority Triage: Confirm the full list of high-severity evidence items for expedited forensic analysis.',
        query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
        points: 34
      }
    ]
  },
  60106: {
    title: 'Active Crime Scene Perimeters',
    narrative: '📁 CASE BRIEFING: Multiple municipal sector alarms triggered during the synchronized power outage. Dispatch needs an accurate list of all active crime scenes so perimeter tactical units remain stationed at the right coordinates.',
    correct_query: 'SELECT place_name, district FROM locations WHERE is_active = 1',
    objectives: [
      {
        order: 1,
        text: 'Location Directory Audit: Inspect all registered city locations and their active status flags.',
        query: 'SELECT place_name, district, is_active FROM locations',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Active Perimeters: Restrict the query to only locations marked as currently active (is_active = 1).',
        query: 'SELECT place_name, district, is_active FROM locations WHERE is_active = 1',
        points: 33
      },
      {
        order: 3,
        text: 'Tactical Dispatch List: Display the place name and district of every active investigation zone.',
        query: 'SELECT place_name, district FROM locations WHERE is_active = 1',
        points: 34
      }
    ]
  },
  60107: {
    title: 'Civilian Witness Canvass',
    narrative: '📁 CASE BRIEFING: Field detectives canvassed bystanders near the downtown scene and recorded key statements. Assemble a clean telephone directory of all registered witnesses for the follow-up investigation team.',
    correct_query: 'SELECT full_name, contact_number FROM witnesses',
    objectives: [
      {
        order: 1,
        text: 'Witness Roster Inspection: Inspect the witness registry table to view all recorded entries.',
        query: 'SELECT * FROM witnesses',
        points: 33
      },
      {
        order: 2,
        text: 'Extract Contact Information: Select each witness’s full name and emergency contact number.',
        query: 'SELECT full_name, contact_number FROM witnesses',
        points: 33
      },
      {
        order: 3,
        text: 'Verify Complete Witness Registry: Confirm the comprehensive telephone contact directory for follow-up.',
        query: 'SELECT full_name, contact_number FROM witnesses',
        points: 34
      }
    ]
  },
  60108: {
    title: 'Lead Detective Roster',
    narrative: '📁 CASE BRIEFING: High-profile interrogations require certified investigative officers. Sergeant Reyes requested a roster of all active personnel holding the specific rank of "Detective" to lead the syndicate interrogation.',
    correct_query: "SELECT name, badge_number FROM officers WHERE rank_level = 'Detective'",
    objectives: [
      {
        order: 1,
        text: 'Precinct Duty Roster: View all officers along with their assigned rank levels.',
        query: 'SELECT name, badge_number, rank_level FROM officers',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Detective Rank: Filter the roster specifically for officers holding the rank of "Detective".',
        query: "SELECT name, badge_number, rank_level FROM officers WHERE rank_level = 'Detective'",
        points: 33
      },
      {
        order: 3,
        text: 'Assign Interrogation Lead: Extract the name and badge number of the qualifying lead detective.',
        query: "SELECT name, badge_number FROM officers WHERE rank_level = 'Detective'",
        points: 34
      }
    ]
  },
  60109: {
    title: 'Evidence Distribution Map',
    narrative: '📁 CASE BRIEFING: Syndicate operatives dispersed evidence across several municipal sectors. Join the evidence registry with crime scene locations to calculate how many forensic items were recovered at each scene.',
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
    objectives: [
      {
        order: 1,
        text: 'Relational Scene Link: Join evidence items with their corresponding crime scene place names.',
        query: 'SELECT e.item_name, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id',
        points: 66
      },
      {
        order: 2,
        text: 'Aggregate by Scene: Group the linked records by crime scene place name.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 67
      },
      {
        order: 3,
        text: 'Forensic Density Report: Show each place name and its total count using column alias evidence_count.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 67
      }
    ]
  },
  60110: {
    title: 'Youth Syndicate Operatives',
    narrative: '📁 CASE BRIEFING: Surveillance footage from the rooftop fire escape captured an agile operative scaling the ladder. Witness statements indicate the intruder was under 30. Filter the suspect registry to isolate young suspects sorted by age.',
    correct_query: 'SELECT name, age, status FROM suspects WHERE age < 30 ORDER BY age ASC',
    objectives: [
      {
        order: 1,
        text: 'Suspect Demographics Sweep: Review all suspect names and ages across the registry.',
        query: 'SELECT name, age, status FROM suspects',
        points: 66
      },
      {
        order: 2,
        text: 'Filter Youth Category: Narrow down the pool to individuals strictly younger than 30 years old.',
        query: 'SELECT name, age, status FROM suspects WHERE age < 30',
        points: 67
      },
      {
        order: 3,
        text: 'Age-Ascending Lineup: Display name, age, and status sorted from youngest to oldest (ORDER BY age ASC).',
        query: 'SELECT name, age, status FROM suspects WHERE age < 30 ORDER BY age ASC',
        points: 67
      }
    ]
  },
  60111: {
    title: 'Peak Lethality Analysis',
    narrative: '📁 CASE BRIEFING: Forensic leadership needs to understand the peak threat level encountered at each crime scene. Correlate evidence with locations and determine the maximum severity score discovered in each zone.',
    correct_query: 'SELECT l.place_name, MAX(e.severity) AS max_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY max_severity DESC',
    objectives: [
      {
        order: 1,
        text: 'Map Evidence Threat Levels: Join evidence to locations and display place names with item severities.',
        query: 'SELECT l.place_name, e.severity FROM evidence e JOIN locations l ON e.location_id = l.location_id',
        points: 66
      },
      {
        order: 2,
        text: 'Compute Peak Severity: Group by place name and compute MAX(severity) as max_severity.',
        query: 'SELECT l.place_name, MAX(e.severity) AS max_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 67
      },
      {
        order: 3,
        text: 'Rank Danger Zones: Order the grouped results by max_severity DESC to prioritize high-risk locations.',
        query: 'SELECT l.place_name, MAX(e.severity) AS max_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY max_severity DESC',
        points: 67
      }
    ]
  },
  60112: {
    title: 'Command Custody Breakdown',
    narrative: '📁 CASE BRIEFING: The Chief of Police requested an executive breakdown of the investigation caseload. Aggregate the suspect registry by status category to verify how many are Cleared, Arrested, or Under Investigation.',
    correct_query: 'SELECT status, COUNT(*) AS total FROM suspects GROUP BY status',
    objectives: [
      {
        order: 1,
        text: 'Identify Status Categories: Query all distinct investigation statuses currently assigned to suspects.',
        query: 'SELECT DISTINCT status FROM suspects',
        points: 66
      },
      {
        order: 2,
        text: 'Group Caseload: Group suspects by status category and count the occurrences.',
        query: 'SELECT status, COUNT(*) FROM suspects GROUP BY status',
        points: 67
      },
      {
        order: 3,
        text: 'Executive Summary Dossier: Display status and the tally formatted with column alias total.',
        query: 'SELECT status, COUNT(*) AS total FROM suspects GROUP BY status',
        points: 67
      }
    ]
  },
  60113: {
    title: 'Forensic Lab Queue Prioritization',
    narrative: '📁 CASE BRIEFING: Lab processing capacity is overwhelmed. Rank all recovered physical items from most critical to least critical so the ballistics and DNA teams can process the decisive clues first.',
    correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
    objectives: [
      {
        order: 1,
        text: 'Assemble Forensic Queue: LEFT JOIN evidence with locations to view item name, severity, and place name.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id',
        points: 66
      },
      {
        order: 2,
        text: 'Order by Criticality: Sort the entire evidence catalog by severity in descending order.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
        points: 67
      },
      {
        order: 3,
        text: 'Complete Lab Triage Dossier: Confirm full list of items sorted by severity DESC for lab dispatch.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
        points: 67
      }
    ]
  },
  60114: {
    title: 'Cold Scene Identification',
    narrative: '📁 CASE BRIEFING: Field patrol resources are stretched thin. Detectives need to identify which municipal locations have yielded zero physical evidence items so patrol officers can be redeployed elsewhere.',
    correct_query: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
    objectives: [
      {
        order: 1,
        text: 'Outer Join Assessment: LEFT JOIN locations with evidence to inspect which zones have evidence links.',
        query: 'SELECT l.place_name, e.evidence_id FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id',
        points: 100
      },
      {
        order: 2,
        text: 'Isolate Unlinked Zones: Filter for rows where evidence_id IS NULL to expose cold zones.',
        query: 'SELECT l.place_name, e.evidence_id FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
        points: 100
      },
      {
        order: 3,
        text: 'Redeployment Roster: Return the clean place name of the location with zero evidence logged.',
        query: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
        points: 100
      }
    ]
  },
  60115: {
    title: 'Hot Zone Detection',
    narrative: '📁 CASE BRIEFING: Syndicate operations require staging hubs. Detective Santos designated any location with MORE THAN ONE piece of recovered evidence as a primary "Hot Zone". Use HAVING to isolate these high-activity zones.',
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
    objectives: [
      {
        order: 1,
        text: 'Aggregate Scene Counts: Group evidence by location and calculate evidence counts per scene.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 100
      },
      {
        order: 2,
        text: 'Apply Group Filter: Use a HAVING clause to isolate scenes where COUNT(evidence_id) strictly exceeds 1.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
        points: 100
      },
      {
        order: 3,
        text: 'Confirm Syndicate Staging Hub: Conclusively expose the Hot Zone and its evidence total.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
        points: 100
      }
    ]
  },
  60116: {
    title: 'The Primary Heist Epicentre',
    narrative: '📁 CASE BRIEFING: Pinpoint the definitive ground zero of the syndicate’s operation by finding the single crime scene location with the highest evidence count. Restrict the output to the #1 top scene.',
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
    objectives: [
      {
        order: 1,
        text: 'Rank Crime Scenes by Evidence: Group evidence by location and order scenes descending by count.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC',
        points: 100
      },
      {
        order: 2,
        text: 'Isolate Top Scene: Restrict the query to only the top single location using LIMIT 1.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
        points: 100
      },
      {
        order: 3,
        text: 'Ground Zero Confirmation: Confirm Central Warehouse as the primary epicentre with 2 critical evidence items.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
        points: 100
      }
    ]
  },
  60117: {
    title: 'Consolidated DA Evidence Dossier',
    narrative: '📁 CASE BRIEFING: The District Attorney requires a unified audit sheet combining all identified suspect names with their statuses, merged together with all evidence items and their severity values into a single two-column report.',
    correct_query: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
    objectives: [
      {
        order: 1,
        text: 'Query Suspect Roster Block: Select suspect name as label and status as value from suspects.',
        query: 'SELECT name AS label, status AS value FROM suspects',
        points: 100
      },
      {
        order: 2,
        text: 'Query Evidence Block: Select item_name as label and CAST(severity AS CHAR) as value from evidence.',
        query: 'SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
        points: 100
      },
      {
        order: 3,
        text: 'Master UNION Report: Merge both blocks using UNION to produce the consolidated DA audit report.',
        query: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
        points: 100
      }
    ]
  },
  60118: {
    title: 'The Final Syndicate Takedown',
    narrative: '📁 CASE BRIEFING: The final breakthrough! Match all high-severity evidence items (severity >= 4) with locations that are currently ACTIVE (is_active = 1) to seal the indictment and close the City Hall Conspiracy.',
    correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
    objectives: [
      {
        order: 1,
        text: 'Cross-Match High Severity: Join evidence and locations filtering for severity >= 4.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4',
        points: 100
      },
      {
        order: 2,
        text: 'Filter Active Locations: Add condition requiring l.is_active = 1 to isolate active crime scene evidence.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
        points: 100
      },
      {
        order: 3,
        text: 'Conclusive Indictment Evidence: Display item_name, severity, and place_name confirming the indictment proof.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
        points: 100
      }
    ]
  },

  // ── PRACTICE DQL (Cases 60059–60073) ──
  60059: {
    title: 'The Riverside Suspects Sweep',
    narrative: '📁 CASE BRIEFING: A series of coordinated break-ins struck Riverside District. Detective Santos assigned you to scan the municipal registry and isolate all persons of interest marked as "Under Investigation".',
    correct_query: "SELECT name, age FROM suspects WHERE status = 'Under Investigation'",
    objectives: [
      {
        order: 1,
        text: 'Registry Sweep: Inspect all suspects and their recorded investigation status.',
        query: 'SELECT name, status FROM suspects',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Open Leads: Filter suspects whose status is "Under Investigation".',
        query: "SELECT name, status FROM suspects WHERE status = 'Under Investigation'",
        points: 33
      },
      {
        order: 3,
        text: 'Dossier Extraction: Extract the names and ages of all active persons of interest.',
        query: "SELECT name, age FROM suspects WHERE status = 'Under Investigation'",
        points: 34
      }
    ]
  },
  60060: {
    title: 'Lethal Weapons Identification',
    narrative: '📁 CASE BRIEFING: Forensics recovered dangerous instruments from the Riverside break-ins. Filter the evidence vault for high-severity items carrying a threat rating of 4 or greater.',
    correct_query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
    objectives: [
      {
        order: 1,
        text: 'Evidence Vault Survey: View all logged physical items and their severity ratings.',
        query: 'SELECT item_name, severity FROM evidence',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Dangerous Clues: Restrict the query to items with severity >= 4.',
        query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
        points: 33
      },
      {
        order: 3,
        text: 'Lab Priority Tagging: Extract item_name and severity for expedited lab analysis.',
        query: 'SELECT item_name, severity FROM evidence WHERE severity >= 4',
        points: 34
      }
    ]
  },
  60061: {
    title: 'Riverside Active Crime Zones',
    narrative: '📁 CASE BRIEFING: Multiple alarms were triggered across the district. Query the locations registry to isolate active crime scenes where patrols must maintain a tactical perimeter.',
    correct_query: 'SELECT place_name, district FROM locations WHERE is_active = 1',
    objectives: [
      {
        order: 1,
        text: 'District Location Audit: Inspect all registered locations and their active status.',
        query: 'SELECT place_name, district, is_active FROM locations',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Active Scenes: Restrict the query to locations where is_active = 1.',
        query: 'SELECT place_name, district, is_active FROM locations WHERE is_active = 1',
        points: 33
      },
      {
        order: 3,
        text: 'Patrol Dispatch Dossier: Display place_name and district for all active zones.',
        query: 'SELECT place_name, district FROM locations WHERE is_active = 1',
        points: 34
      }
    ]
  },
  60062: {
    title: 'Eyewitness Phone Directory',
    narrative: '📁 CASE BRIEFING: Civilians reported strange noises and suspicious vehicles near the Riverside scene. Assemble a clean telephone directory of all registered witnesses for detective follow-up.',
    correct_query: 'SELECT full_name, contact_number FROM witnesses',
    objectives: [
      {
        order: 1,
        text: 'Witness Roster Scan: Query the witnesses table to review all civilian accounts.',
        query: 'SELECT * FROM witnesses',
        points: 33
      },
      {
        order: 2,
        text: 'Extract Phone Numbers: Select each witness’s full name and contact number.',
        query: 'SELECT full_name, contact_number FROM witnesses',
        points: 33
      },
      {
        order: 3,
        text: 'Complete Contact Sheet: Confirm full witness directory for dispatch outreach.',
        query: 'SELECT full_name, contact_number FROM witnesses',
        points: 34
      }
    ]
  },
  60063: {
    title: 'Patrol Junior Officers Assignment',
    narrative: '📁 CASE BRIEFING: Perimeter security at Riverside Park needs reinforcements. Query the officer registry for all personnel holding the rank of "Junior Officer" to deploy them on patrol.',
    correct_query: "SELECT name, badge_number FROM officers WHERE rank_level = 'Junior Officer'",
    objectives: [
      {
        order: 1,
        text: 'Precinct Duty Roster: View all officers along with their assigned ranks.',
        query: 'SELECT name, badge_number, rank_level FROM officers',
        points: 33
      },
      {
        order: 2,
        text: 'Filter Junior Rank: Filter the roster for officers with rank_level = "Junior Officer".',
        query: "SELECT name, badge_number, rank_level FROM officers WHERE rank_level = 'Junior Officer'",
        points: 33
      },
      {
        order: 3,
        text: 'Deploy Patrol Units: Extract the name and badge number of the qualifying junior officer.',
        query: "SELECT name, badge_number FROM officers WHERE rank_level = 'Junior Officer'",
        points: 34
      }
    ]
  },
  60064: {
    title: 'Scene Evidence Density',
    narrative: '📁 CASE BRIEFING: Detectives need an overview of evidence distribution. Join evidence to locations and compute the total count of items discovered at each distinct crime scene.',
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
    objectives: [
      {
        order: 1,
        text: 'Relational Link: Join evidence items with their corresponding crime scene place names.',
        query: 'SELECT e.item_name, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id',
        points: 66
      },
      {
        order: 2,
        text: 'Group by Scene: Group records by place_name to aggregate item counts.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 67
      },
      {
        order: 3,
        text: 'Evidence Count Report: Show place_name and count using column alias evidence_count.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 67
      }
    ]
  },
  60065: {
    title: 'Veteran Suspects Profile',
    narrative: '📁 CASE BRIEFING: The syndicate appears to be led by experienced operators. Filter the suspect registry to isolate individuals older than 30, ordering them from oldest to youngest.',
    correct_query: 'SELECT name, age, status FROM suspects WHERE age > 30 ORDER BY age DESC',
    objectives: [
      {
        order: 1,
        text: 'Age Distribution Sweep: Query all suspect names, ages, and statuses.',
        query: 'SELECT name, age, status FROM suspects',
        points: 66
      },
      {
        order: 2,
        text: 'Filter Veteran Operators: Restrict to suspects strictly older than 30 years old.',
        query: 'SELECT name, age, status FROM suspects WHERE age > 30',
        points: 67
      },
      {
        order: 3,
        text: 'Order by Seniority: Order the results by age descending (ORDER BY age DESC).',
        query: 'SELECT name, age, status FROM suspects WHERE age > 30 ORDER BY age DESC',
        points: 67
      }
    ]
  },
  60066: {
    title: 'Average Scene Threat Rating',
    narrative: '📁 CASE BRIEFING: Analyze crime scene risk factors across the city. Join evidence and locations to calculate the average severity rating per scene, ordered from highest average threat descending.',
    correct_query: 'SELECT l.place_name, AVG(e.severity) AS avg_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY avg_severity DESC',
    objectives: [
      {
        order: 1,
        text: 'Map Item Severities: Join evidence to locations and display place_name and severity.',
        query: 'SELECT l.place_name, e.severity FROM evidence e JOIN locations l ON e.location_id = l.location_id',
        points: 66
      },
      {
        order: 2,
        text: 'Compute Scene Averages: Group by place_name and compute AVG(severity) as avg_severity.',
        query: 'SELECT l.place_name, AVG(e.severity) AS avg_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 67
      },
      {
        order: 3,
        text: 'Rank Scene Threats: Order the grouped results by avg_severity DESC.',
        query: 'SELECT l.place_name, AVG(e.severity) AS avg_severity FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY avg_severity DESC',
        points: 67
      }
    ]
  },
  60067: {
    title: 'Syndicate Status Audit',
    narrative: '📁 CASE BRIEFING: Provide a statistical overview of the suspect database for the district attorney. Group all suspects by investigation status and count how many fall under each category.',
    correct_query: 'SELECT status, COUNT(*) AS count FROM suspects GROUP BY status',
    objectives: [
      {
        order: 1,
        text: 'Identify Distinct Categories: View distinct status tags recorded in the suspects table.',
        query: 'SELECT DISTINCT status FROM suspects',
        points: 66
      },
      {
        order: 2,
        text: 'Aggregate by Status: Group suspects by status and calculate total occurrences.',
        query: 'SELECT status, COUNT(*) FROM suspects GROUP BY status',
        points: 67
      },
      {
        order: 3,
        text: 'Caseload Summary: Produce the final status summary using column alias count.',
        query: 'SELECT status, COUNT(*) AS count FROM suspects GROUP BY status',
        points: 67
      }
    ]
  },
  60068: {
    title: 'Critical Evidence Registry',
    narrative: '📁 CASE BRIEFING: Prepare the master evidence ledger for ballistic specialists. Include item names, severity, and location names, sorted from highest severity down to lowest.',
    correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
    objectives: [
      {
        order: 1,
        text: 'Assemble Forensic Catalog: LEFT JOIN evidence with locations to view item, severity, and place.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id',
        points: 66
      },
      {
        order: 2,
        text: 'Order by Threat Level: Sort all evidence items by severity descending.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
        points: 67
      },
      {
        order: 3,
        text: 'Master Ballistics Queue: Confirm the complete evidence queue sorted by severity DESC.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e LEFT JOIN locations l ON e.location_id = l.location_id ORDER BY e.severity DESC',
        points: 67
      }
    ]
  },
  60069: {
    title: 'Cold Scene Search',
    narrative: '📁 CASE BRIEFING: Detectives suspect some registered locations were false leads. Perform an outer join to identify municipal locations where no evidence has been tagged yet.',
    correct_query: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
    objectives: [
      {
        order: 1,
        text: 'Outer Join Assessment: LEFT JOIN locations with evidence to inspect evidence links.',
        query: 'SELECT l.place_name, e.evidence_id FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id',
        points: 100
      },
      {
        order: 2,
        text: 'Isolate Unlinked Scenes: Filter for rows where evidence_id IS NULL.',
        query: 'SELECT l.place_name, e.evidence_id FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
        points: 100
      },
      {
        order: 3,
        text: 'Identify Cold Scene: Return clean place name of the location with no evidence found.',
        query: 'SELECT l.place_name FROM locations l LEFT JOIN evidence e ON l.location_id = e.location_id WHERE e.evidence_id IS NULL',
        points: 100
      }
    ]
  },
  60070: {
    title: 'Multi-Evidence Hotspots',
    narrative: '📁 CASE BRIEFING: Locate crime scenes where multiple distinct physical clues were recovered. Group evidence by location and apply a HAVING condition for counts greater than 1.',
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
    objectives: [
      {
        order: 1,
        text: 'Aggregate Scene Evidence: Group evidence by location and compute evidence counts.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name',
        points: 100
      },
      {
        order: 2,
        text: 'Apply Group Threshold: Filter using HAVING to isolate locations with COUNT(evidence_id) > 1.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
        points: 100
      },
      {
        order: 3,
        text: 'Confirm Hotspot Location: Expose the hotspot location name and count of evidence items.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name HAVING COUNT(e.evidence_id) > 1',
        points: 100
      }
    ]
  },
  60071: {
    title: 'The Primary Warehouse Focal Point',
    narrative: '📁 CASE BRIEFING: Identify the single most significant location of the entire Riverside investigation by isolating the scene with the highest total evidence items (LIMIT 1).',
    correct_query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
    objectives: [
      {
        order: 1,
        text: 'Order Scenes by Activity: Group evidence by location and order by count descending.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC',
        points: 100
      },
      {
        order: 2,
        text: 'Isolate Top Crime Scene: Restrict the output to the single top location using LIMIT 1.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
        points: 100
      },
      {
        order: 3,
        text: 'Confirm Heist Headquarters: Reveal Central Warehouse as the primary heist headquarters.',
        query: 'SELECT l.place_name, COUNT(e.evidence_id) AS evidence_count FROM evidence e JOIN locations l ON e.location_id = l.location_id GROUP BY l.place_name ORDER BY evidence_count DESC LIMIT 1',
        points: 100
      }
    ]
  },
  60072: {
    title: 'Consolidated Investigation Master Record',
    narrative: '📁 CASE BRIEFING: Prepare the unified prosecution brief. Use a UNION query to combine all suspect names and statuses with all tagged evidence items and their severity ratings.',
    correct_query: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
    objectives: [
      {
        order: 1,
        text: 'Query Suspect Roster Block: Select suspect name as label and status as value from suspects.',
        query: 'SELECT name AS label, status AS value FROM suspects',
        points: 100
      },
      {
        order: 2,
        text: 'Query Evidence Block: Select item_name as label and CAST(severity AS CHAR) as value from evidence.',
        query: 'SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
        points: 100
      },
      {
        order: 3,
        text: 'Execute Master UNION: Merge both result sets into a single unified prosecution report.',
        query: 'SELECT name AS label, status AS value FROM suspects UNION SELECT item_name AS label, CAST(severity AS CHAR) AS value FROM evidence',
        points: 100
      }
    ]
  },
  60073: {
    title: 'Active Zone Lethal Evidence',
    narrative: '📁 CASE BRIEFING: Assemble the final evidence packet for the arrest warrant. Filter for all high-severity evidence items (severity >= 4) discovered specifically in active investigation zones (is_active = 1).',
    correct_query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
    objectives: [
      {
        order: 1,
        text: 'Cross-Match High Severity: Join evidence and locations filtering for severity >= 4.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4',
        points: 100
      },
      {
        order: 2,
        text: 'Filter Active Locations: Require location is_active = 1 to isolate active scene evidence.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
        points: 100
      },
      {
        order: 3,
        text: 'Warrant Conclusive Clues: Display item_name, severity, and place_name confirming the warrant grounds.',
        query: 'SELECT e.item_name, e.severity, l.place_name FROM evidence e JOIN locations l ON e.location_id = l.location_id WHERE e.severity >= 4 AND l.is_active = 1',
        points: 100
      }
    ]
  }
};

async function main() {
  console.log('🚀 Updating Detective Campaign & Option A Progressive Objectives...\n');

  // Step 1: Update DQL cases in cases table and case_objectives table
  console.log('1️⃣ Seeding Option A Progressive Objectives for all 30 DQL cases...');
  for (const [caseIdStr, spec] of Object.entries(dqlProgressiveSpecs)) {
    const caseId = parseInt(caseIdStr, 10);

    // Format objectives as clean readable numbered list for case.objectives column
    const objectivesText = spec.objectives
      .map(o => `${o.order}. ${o.text}`)
      .join('\n');

    // Update case record
    await systemDB.query(`
      UPDATE cases
      SET title = ?,
          description = ?,
          objectives = ?,
          correct_query = ?
      WHERE case_id = ?
    `, [spec.title, spec.narrative, objectivesText, spec.correct_query, caseId]);

    // Clear existing case_objectives
    await systemDB.query('DELETE FROM case_objectives WHERE case_id = ?', [caseId]);

    // Insert the 3 progressive objectives into case_objectives
    for (const obj of spec.objectives) {
      await systemDB.query(`
        INSERT INTO case_objectives
          (case_id, objective_order, objective_text, points, validation_type, expected_query)
        VALUES (?, ?, ?, ?, 'result', ?)
      `, [caseId, obj.order, obj.text, obj.points, obj.query]);
    }

    console.log(`  ✅ Case ${caseId} updated: "${spec.title}" (3 progressive objectives registered)`);
  }

  // Step 2: Validate that EVERY SINGLE progressive query runs and returns rows from playgroundDB
  console.log('\n2️⃣ Validating all progressive queries against playgroundDB...');
  let totalQueries = 0;
  let passedQueries = 0;

  for (const [caseIdStr, spec] of Object.entries(dqlProgressiveSpecs)) {
    const caseId = parseInt(caseIdStr, 10);
    for (const obj of spec.objectives) {
      totalQueries++;
      try {
        const [rows] = await playgroundDB.query(obj.query);
        if (rows.length === 0) {
          console.warn(`  ⚠️ Case ${caseId} Obj ${obj.order} returned 0 rows! Query: ${obj.query}`);
        } else {
          passedQueries++;
        }
      } catch (err) {
        console.error(`  ❌ Case ${caseId} Obj ${obj.order} FAILED: ${err.message}\n     Query: ${obj.query}`);
      }
    }
  }

  console.log(`\nValidation complete: ${passedQueries}/${totalQueries} progressive queries return non-zero rows.`);

  if (passedQueries === totalQueries) {
    console.log('🎉 100% of progressive queries are fully verified and operational!\n');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
