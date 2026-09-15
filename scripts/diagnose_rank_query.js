const { systemDB, playgroundDB } = require('../db');

async function diagnose() {
  try {
    console.log("=== Checking Room 7 ===");
    const [roomRows] = await systemDB.query("SELECT * FROM rooms WHERE room_id = 7");
    console.log("Room:", roomRows);

    console.log("\n=== Checking Game Sessions for Room 7 ===");
    const [sessions] = await systemDB.query(
      `SELECT gs.*, c.dataset_id, c.sql_type, c.setup_sql, c.expected_result_sql, c.correct_query, c.correct_suspect_id, c.base_points
       FROM game_sessions gs
       JOIN cases c ON gs.case_id = c.case_id
       WHERE gs.room_id = 7
       ORDER BY gs.session_id DESC LIMIT 3`
    );
    console.log("Sessions:", sessions);

    if (sessions.length === 0) {
      console.log("No sessions found for room 7");
      process.exit(0);
    }

    const session = sessions[0];
    console.log("\nActive Session Case ID:", session.case_id, "SQL Type:", session.sql_type, "Dataset ID:", session.dataset_id);

    console.log("\n=== Checking Objectives for Case", session.case_id, "===");
    const [objectives] = await systemDB.query("SELECT * FROM case_objectives WHERE case_id = ?", [session.case_id]);
    console.log("Objectives:", objectives);

    console.log("\n=== Testing query against playgroundDB ===");
    try {
      const [rows] = await playgroundDB.query("SELECT name, role FROM persons");
      console.log("Playground query SUCCESS, row count:", rows.length);
    } catch (e) {
      console.error("Playground query FAILED:", e.message);
    }

    console.log("\n=== Testing Objectives Expected Queries ===");
    for (const obj of objectives) {
      console.log(`Obj #${obj.objective_id} type=${obj.validation_type} keyword=${obj.required_keyword} expected_query=${obj.expected_query}`);
      if (obj.expected_query) {
        try {
          const [expRows] = await playgroundDB.query(obj.expected_query);
          console.log(`  -> Expected query success, rows:`, expRows.length);
        } catch (e) {
          console.error(`  -> Expected query FAILED:`, e.message);
        }
      }
    }

    console.log("\n=== Checking Attempts for Room 7 ===");
    const [attempts] = await systemDB.query("SELECT * FROM attempts WHERE room_id = 7 ORDER BY attempt_id DESC LIMIT 5");
    console.log("Recent attempts:", attempts);

  } catch (err) {
    console.error("Diagnosis error:", err);
  } finally {
    process.exit(0);
  }
}

diagnose();
