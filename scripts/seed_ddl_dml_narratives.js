const { systemDB } = require('../db');

// Narrative updates for Practice DDL & DML, and Rank DDL & DML
const caseNarratives = [
  // ── PRACTICE DDL (Cases 60001–60015) ──
  {
    case_id: 60001,
    title: 'Act I — Construct the Suspect Registry',
    narrative: '📁 CASE BRIEFING: Riverside District has experienced a sudden outbreak of coordinated burglaries. Detective Santos has set up an incident command center at the precinct. Before field units can begin logging persons of interest, the central database needs a dedicated `suspects` registry table.'
  },
  {
    case_id: 60002,
    title: 'Act I — Construct the Witness Registry',
    narrative: '📁 CASE BRIEFING: Civilian bystanders near the Riverside commercial strip reported suspicious activity. To protect and catalog civilian testimonies, create the `witnesses` table with auto-incrementing identifiers and mandatory full names.'
  },
  {
    case_id: 60003,
    title: 'Act I — Construct the Evidence Custody Table',
    narrative: '📁 CASE BRIEFING: The forensic mobile unit has arrived at the perimeter. All physical materials gathered from the scenes must maintain a strict chain of custody. Build the `evidence` table with severity ratings and foreign key references to crime scenes.'
  },
  {
    case_id: 60004,
    title: 'Act I — Construct the Crime Scene Locations Table',
    narrative: '📁 CASE BRIEFING: Dispatch requires a geospatial directory of all municipal zones involved in the investigation. Build the `locations` table with place names, municipal districts, and active investigation status flags.'
  },
  {
    case_id: 60005,
    title: 'Act I — Construct the Police Officer Roster',
    narrative: '📁 CASE BRIEFING: Detectives, sergeants, and patrol officers are mobilizing across the precinct. Construct the `officers` duty table to record badge numbers, officer names, and rank levels.'
  },
  {
    case_id: 60006,
    title: 'Act I — Enforce Suspect Phone Constraints',
    narrative: '📁 CASE BRIEFING: Intelligence reports indicate syndicates use burner phones. Modify the `suspects` table to add a phone number field with unique constraints to prevent alias duplication.'
  },
  {
    case_id: 60007,
    title: 'Act I — Expand Evidence Storage Columns',
    narrative: '📁 CASE BRIEFING: Crime lab technicians require notes on storage conditions for volatile evidence. Add a `storage_locker` column to the `evidence` table.'
  },
  {
    case_id: 60008,
    title: 'Act I — Add Witness Statement Field',
    narrative: '📁 CASE BRIEFING: Preliminary witness statements are currently handwritten on field notepads. Alter the `witnesses` table to include a dedicated text column for recorded testimony.'
  },
  {
    case_id: 60009,
    title: 'Act I — Add Officer Department Division',
    narrative: '📁 CASE BRIEFING: Precinct command is assigning specialized units including Forensics, Tactical, and Homicide. Update the `officers` table to track department division assignments.'
  },
  {
    case_id: 60010,
    title: 'Act I — Index the Crime Scene Registry',
    narrative: '📁 CASE BRIEFING: High-speed queries during active tactical raids require optimized indexing. Create an index on `locations(district)` to accelerate perimeter dispatch lookups.'
  },
  {
    case_id: 60011,
    title: 'Act I — Secure the Evidence Foreign Key',
    narrative: '📁 CASE BRIEFING: Forensic integrity requires that no evidence item can exist without being linked to a valid crime scene. Add a foreign key constraint linking `evidence(location_id)` to `locations(location_id)`.'
  },
  {
    case_id: 60012,
    title: 'Act I — Enforce Minimum Evidence Severity Check',
    narrative: '📁 CASE BRIEFING: Prevent clerical errors during evidence logging. Add a CHECK constraint ensuring evidence severity ratings are between 1 and 5.'
  },
  {
    case_id: 60013,
    title: 'Act I — Build the Case Assignment Junction Table',
    narrative: '📁 CASE BRIEFING: Multi-agency investigations require linking investigating officers directly to specific suspects. Build the `case_assignments` junction table linking `officers` and `suspects`.'
  },
  {
    case_id: 60014,
    title: 'Act I — Set Default Suspect Investigation Status',
    narrative: '📁 CASE BRIEFING: Ensure all newly registered persons of interest automatically receive the default status "Under Investigation" upon intake.'
  },
  {
    case_id: 60015,
    title: 'Act I — Build the Audit Log Table',
    narrative: '📁 CASE BRIEFING: Internal Affairs mandates an immutable audit trail for all modifications made to the investigation database. Construct the `audit_log` table.'
  },

  // ── PRACTICE DML (Cases 60030–60044) ──
  {
    case_id: 60030,
    title: 'Act II — Intake Key Person of Interest',
    narrative: '📁 CASE BRIEFING: Surveillance footage outside the warehouse caught an unidentified individual matching previous syndicate descriptions. Ingest suspect "James Okon" into the `suspects` registry.'
  },
  {
    case_id: 60031,
    title: 'Act II — Register New Crime Scene Sector',
    narrative: '📁 CASE BRIEFING: Patrol units discovered forced entry at an Eastside market stall linked to the syndicate. Insert the "Old Market" crime scene into `locations`.'
  },
  {
    case_id: 60032,
    title: 'Act II — Log Critical Evidence: Torn Jacket',
    narrative: '📁 CASE BRIEFING: Detectives recovered a torn jacket caught on the perimeter razor wire at the Central Warehouse. Log this evidence item with severity 4.'
  },
  {
    case_id: 60033,
    title: 'Act II — Record Crucial Witness Testimony',
    narrative: '📁 CASE BRIEFING: A civilian witness came forward claiming to have seen the getaway van speed toward Northside. Add witness "Diana Vong" and her contact details to `witnesses`.'
  },
  {
    case_id: 60034,
    title: 'Act II — Assign Detective Perez to Incident',
    narrative: '📁 CASE BRIEFING: Reinforcements have been approved by Central Headquarters. Enroll Officer Perez (Badge B-004) as an active Detective in `officers`.'
  },
  {
    case_id: 60035,
    title: 'Act II — Arrest Cleared Suspect After Contraband Find',
    narrative: '📁 CASE BRIEFING: Stolen serial-numbered microchips were recovered in Victor Hale’s trunk. Update his status in `suspects` from "Cleared" to "Arrested".'
  },
  {
    case_id: 60036,
    title: 'Act II — Deactivate Ruled-Out Factory Location',
    narrative: '📁 CASE BRIEFING: Forensics completed a full sweep of the Abandoned Factory (location 5) and ruled out any syndicate connection. Update its status to inactive (is_active = 0).'
  },
  {
    case_id: 60037,
    title: 'Act II — Escalate Bloody Glove Severity Rating',
    narrative: '📁 CASE BRIEFING: DNA lab testing confirmed human blood matching the victim on evidence item 3 (Bloody Glove). Escalate its severity rating to 5 in `evidence`.'
  },
  {
    case_id: 60038,
    title: 'Act II — Purge Fraudulent Witness Statement',
    narrative: '📁 CASE BRIEFING: Interrogation revealed that witness 3 gave false fabricated information to mislead detectives. Purge witness record 3 from `witnesses`.'
  },
  {
    case_id: 60039,
    title: 'Act II — Promote Lead Investigator Officer Santos',
    narrative: '📁 CASE BRIEFING: In recognition of solving the perimeter security breach, update Officer Santos’s rank in `officers` to "Senior Detective".'
  },
  {
    case_id: 60040,
    title: 'Act II — Purge Low-Severity Evidence',
    narrative: '📁 CASE BRIEFING: Clear out routine clutter and non-probative items from the evidence locker. Delete all evidence with severity = 1.'
  },
  {
    case_id: 60041,
    title: 'Act II — Bulk Ingest Syndicate Associate Lineup',
    narrative: '📁 CASE BRIEFING: A tactical raid on a hideout produced three new conspirator files. Perform a bulk multi-row INSERT to add Ana Vega, Ben Solis, and Cia Tan into `suspects`.'
  },
  {
    case_id: 60042,
    title: 'Act II — Archive Processing of Arrested Suspects',
    narrative: '📁 CASE BRIEFING: Suspects currently marked as "Arrested" have completed booking and been transferred to holding cells. Update their status to "Archived".'
  },
  {
    case_id: 60043,
    title: 'Act II — Transfer Warehouse Evidence to HQ Vault',
    narrative: '📁 CASE BRIEFING: Due to security concerns at Central Warehouse, transfer all evidence located at scene 2 to Police HQ (location 4).'
  },
  {
    case_id: 60044,
    title: 'Act II — Cascade Cleanup of Inactive Crime Scenes',
    narrative: '📁 CASE BRIEFING: Decommission inactive investigation scenes by unlinking evidence foreign keys and removing all inactive locations from the directory.'
  },

  // ── RANK DDL (Cases 60074–60088) ──
  {
    case_id: 60074,
    title: 'Operation Blackout — Deploy Suspect Intake Registry',
    narrative: '📁 EMERGENCY DISPATCH: A total blackout has struck downtown City Hall. Alarms triggered across the municipal vault. Detectives must deploy the emergency `suspects` intake registry immediately.'
  },
  {
    case_id: 60075,
    title: 'Operation Blackout — Deploy Civilian Witness Registry',
    narrative: '📁 EMERGENCY DISPATCH: Civilians trapped in the plaza witnessed masked operatives escaping through the loading dock. Deploy the emergency `witnesses` directory table.'
  },
  {
    case_id: 60076,
    title: 'Operation Blackout — Deploy Chain of Custody Table',
    narrative: '📁 EMERGENCY DISPATCH: Tactical officers are securing weapons and electronics dropped by the fleeing intruders. Construct the emergency `evidence` table with severity and location links.'
  },
  {
    case_id: 60077,
    title: 'Operation Blackout — Deploy Municipal Zones Table',
    narrative: '📁 EMERGENCY DISPATCH: Dispatch needs a real-time perimeter tracking table. Construct the emergency `locations` table with place names and active status flags.'
  },
  {
    case_id: 60078,
    title: 'Operation Blackout — Deploy Tactical Officers Table',
    narrative: '📁 EMERGENCY DISPATCH: Emergency response officers are arriving on scene from multiple precincts. Build the `officers` duty table to record badges and tactical ranks.'
  },
  {
    case_id: 60079,
    title: 'Operation Blackout — Enforce Unique Officer Badges',
    narrative: '📁 EMERGENCY DISPATCH: Impersonation risk is critical. Alter the `officers` table to ensure badge numbers are strictly UNIQUE.'
  },
  {
    case_id: 60080,
    title: 'Operation Blackout — Add Forensic Tagging Column',
    narrative: '📁 EMERGENCY DISPATCH: Bomb squad and hazmat technicians need specialized tagging. Alter `evidence` to add a forensic notes column.'
  },
  {
    case_id: 60081,
    title: 'Operation Blackout — Enforce Default Investigation Status',
    narrative: '📁 EMERGENCY DISPATCH: Fast intake during an emergency leads to omissions. Alter `suspects` so `status` defaults to "Under Investigation".'
  },
  {
    case_id: 60082,
    title: 'Operation Blackout — Build Tactical Unit Index',
    narrative: '📁 EMERGENCY DISPATCH: Command center screens require sub-second query response times. Create an index on `locations(district)` to accelerate zone lookups.'
  },
  {
    case_id: 60083,
    title: 'Operation Blackout — Link Evidence Foreign Keys',
    narrative: '📁 EMERGENCY DISPATCH: Prevent orphaned evidence entries during rapid tactical logging. Add foreign key constraint linking `evidence.location_id` to `locations.location_id`.'
  },
  {
    case_id: 60084,
    title: 'Operation Blackout — Emergency Assignment Table',
    narrative: '📁 EMERGENCY DISPATCH: Deploy the emergency `case_assignments` junction table linking specialized detective teams to high-risk suspects.'
  },
  {
    case_id: 60085,
    title: 'Operation Blackout — Enforce Severity Boundary Checks',
    narrative: '📁 EMERGENCY DISPATCH: Prevent data entry errors during emergency intake. Enforce CHECK constraint on evidence severity between 1 and 5.'
  },
  {
    case_id: 60086,
    title: 'Operation Blackout — Add Witness Contact Unique Constraint',
    narrative: '📁 EMERGENCY DISPATCH: Ensure civilian witness records are not duplicated by adding constraints on contact telephone numbers.'
  },
  {
    case_id: 60087,
    title: 'Operation Blackout — Immutable Audit Log Deployment',
    narrative: '📁 EMERGENCY DISPATCH: Deploy the encrypted `audit_log` table to record all queries and database modifications during the blackout.'
  },
  {
    case_id: 60088,
    title: 'Operation Blackout — Master Investigation Schema Finalization',
    narrative: '📁 EMERGENCY DISPATCH: Verify and finalize the entire relational schema across suspects, officers, locations, evidence, and witnesses.'
  },

  // ── RANK DML (Cases 60089–60103) ──
  {
    case_id: 60089,
    title: 'Blackout Intel — Register Detained Infiltrator',
    narrative: '📁 FIELD LOG: Tactical perimeter team apprehended a suspect climbing the City Hall air duct. Insert "Marcus Vance" into `suspects`.'
  },
  {
    case_id: 60090,
    title: 'Blackout Intel — Log Breach Point Coordinates',
    narrative: '📁 FIELD LOG: Explosive entry detected at the municipal server bunker. Add the "Server Bunker" into `locations`.'
  },
  {
    case_id: 60091,
    title: 'Blackout Intel — Log High-Tech Thermal Cutter',
    narrative: '📁 FIELD LOG: Breaching team abandoned a specialized thermal cutter inside the vault. Ingest into `evidence` with severity 5.'
  },
  {
    case_id: 60092,
    title: 'Blackout Intel — Record Vault Security Guard Statement',
    narrative: '📁 FIELD LOG: Night security guard gave statement regarding the sudden power cutoff. Insert guard into `witnesses`.'
  },
  {
    case_id: 60093,
    title: 'Blackout Intel — Assign Lead SWAT Specialist',
    narrative: '📁 FIELD LOG: SWAT Commander Harris arrived at the incident perimeter. Register officer details in `officers`.'
  },
  {
    case_id: 60094,
    title: 'Blackout Intel — Reclassify Cleared Infiltrator',
    narrative: '📁 FIELD LOG: Hidden blueprint documents were discovered on suspect Victor Hale. Update his status to "Arrested".'
  },
  {
    case_id: 60095,
    title: 'Blackout Intel — Decommission Secured Substation',
    narrative: '📁 FIELD LOG: The Northside Substation (location 3) has been secured and restored. Mark location is_active = 0.'
  },
  {
    case_id: 60096,
    title: 'Blackout Intel — Escalate Vault EMP Device Severity',
    narrative: '📁 FIELD LOG: Electronic warfare specialists confirmed the recovered pulse device could disrupt city power grids. Set severity = 5.'
  },
  {
    case_id: 60097,
    title: 'Blackout Intel — Remove False Alarm Witness',
    narrative: '📁 FIELD LOG: Phone records confirmed witness 3 made a hoax call to divert police units. Delete record from `witnesses`.'
  },
  {
    case_id: 60098,
    title: 'Blackout Intel — Promote Incident Commander',
    narrative: '📁 FIELD LOG: Promote lead investigator Officer Santos to "Chief Detective" for tactical coordination during the blackout.'
  },
  {
    case_id: 60099,
    title: 'Blackout Intel — Purge Routine Street Debris',
    narrative: '📁 FIELD LOG: Clear out low-level items (severity = 1) from the emergency evidence registry.'
  },
  {
    case_id: 60100,
    title: 'Blackout Intel — Bulk Log Captured Infiltrator Cell',
    narrative: '📁 FIELD LOG: Tactical units ambushed a getaway van containing three operatives. Bulk INSERT all three into `suspects`.'
  },
  {
    case_id: 60101,
    title: 'Blackout Intel — Batch Transfer to Detention Holding',
    narrative: '📁 FIELD LOG: Transfer all suspects currently marked as "Arrested" into "Archived" status as they are moved to holding.'
  },
  {
    case_id: 60102,
    title: 'Blackout Intel — Secure Vault Evidence at Police HQ',
    narrative: '📁 FIELD LOG: Move all evidence recovered at Central Warehouse (location 2) to Police HQ (location 4) under armed escort.'
  },
  {
    case_id: 60103,
    title: 'Blackout Intel — Cascade Decommission Cleared Zones',
    narrative: '📁 FIELD LOG: Finalize tactical perimeter cleanup by unlinking evidence foreign keys and purging inactive locations.'
  }
];

async function updateNarratives() {
  console.log('🚀 Updating DDL and DML Detective Dossier Narratives...\n');
  for (const c of caseNarratives) {
    await systemDB.query(`
      UPDATE cases
      SET title = ?,
          description = ?
      WHERE case_id = ?
    `, [c.title, c.narrative, c.case_id]);
    console.log(`  ✅ Case ${c.case_id} updated: "${c.title}"`);
  }
  console.log(`\n🎉 Successfully updated ${caseNarratives.length} cases with connected detective storylines!`);
  process.exit(0);
}

updateNarratives().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
