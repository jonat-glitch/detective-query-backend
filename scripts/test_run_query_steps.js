const { systemDB, playgroundDB } = require('../db');

function rowsMatchSubset(studentRows, expectedRows) {
    if (!Array.isArray(studentRows) || !Array.isArray(expectedRows)) return false;
    if (expectedRows.length === 0 || studentRows.length !== expectedRows.length) return false;

    const normRow = (row) => {
        const out = {};
        Object.entries(row).forEach(([k, v]) => {
            out[k.toLowerCase()] = v === null ? null : String(v).trim().toLowerCase();
        });
        return out;
    };

    const normExpected = expectedRows.map(normRow);
    const normStudent  = studentRows.map(normRow);

    const expectedKeys = Object.keys(normExpected[0] || {}).sort();

    const project = (rows) => rows.map(row => {
        const proj = {};
        expectedKeys.forEach(k => { proj[k] = row[k] ?? null; });
        return JSON.stringify(proj);
    }).sort();

    return JSON.stringify(project(normStudent)) === JSON.stringify(project(normExpected));
}

async function testRunQuery() {
  const userId = 7;
  const room_id = 7;
  const sql_query = "SELECT name, role FROM persons";

  try {
    const [sessions] = await systemDB.query(
      `SELECT gs.*, c.dataset_id, c.sql_type, c.setup_sql, c.expected_result_sql, c.correct_query, c.correct_suspect_id, c.base_points
       FROM game_sessions gs
       JOIN cases c ON gs.case_id = c.case_id
       WHERE gs.room_id = ?
       AND gs.status = 'Active'
       LIMIT 1`,
      [room_id]
    );

    console.log("Sessions count:", sessions.length);
    if (!sessions.length) {
      console.log("No active game session!");
      return;
    }
    const session = sessions[0];
    console.log("Session:", session.session_id);

    const startTime = Date.now();
    let rows = [];
    const isDql = (session.sql_type || 'DQL') === 'DQL';
    let overallCorrect = false;

    const [result] = await playgroundDB.query(sql_query);
    rows = result;
    console.log("Rows fetched:", rows.length);

    const [objectives] = await systemDB.query(
      `SELECT * FROM case_objectives
       WHERE case_id = ?
       ORDER BY objective_order ASC`,
      [session.case_id]
    );

    const [prevCompleted] = await systemDB.query(
      `SELECT COUNT(*) AS cnt FROM session_objectives
       WHERE session_id = ? AND user_id = ? AND is_completed = 1`,
      [session.session_id, userId]
    );
    const prevCompletedCount = Number(prevCompleted[0].cnt) || 0;
    console.log("prevCompletedCount:", prevCompletedCount);

    for (const objective of objectives) {
      console.log("Checking objective:", objective.objective_id, objective.objective_order);
      let isMatch = false;

      if (objective.validation_type === "result" && objective.expected_query) {
        const [rowsExpected] = await playgroundDB.query(objective.expected_query);
        if (rowsMatchSubset(rows, rowsExpected)) {
          isMatch = true;
        }
      }
      console.log("  isMatch:", isMatch);

      if (isMatch) {
        const [previousObjectives] = await systemDB.query(
          `SELECT COUNT(*) AS remaining
            FROM case_objectives co
            LEFT JOIN session_objectives so
              ON co.objective_id = so.objective_id
              AND so.session_id = ?
              AND so.user_id = ?
              AND so.is_completed = 1
            WHERE co.case_id = ?
            AND co.objective_order < ?
            AND so.objective_id IS NULL`,
          [session.session_id, userId, session.case_id, objective.objective_order]
        );
        console.log("  previousObjectives remaining:", previousObjectives[0].remaining);

        if (previousObjectives[0].remaining > 0) {
          continue;
        }

        const [existing] = await systemDB.query(
          `SELECT 1 FROM session_objectives
            WHERE session_id = ?
            AND user_id = ?
            AND objective_id = ?
            AND is_completed = 1
            LIMIT 1`,
          [session.session_id, userId, objective.objective_id]
        );
        console.log("  existing count:", existing.length);

        if (existing.length === 0) {
          console.log("  Inserting session objective...");
        }
      }
    }

    const executionTime = Date.now() - startTime;

    const [progress] = await systemDB.query(
      `SELECT SUM(points_awarded) AS totalPoints, COUNT(*) AS completedCount
        FROM session_objectives
        WHERE session_id = ?
        AND user_id = ?
        AND is_completed = 1`,
      [session.session_id, userId]
    );
    console.log("progress:", progress);

    const objectivePoints = Number(progress[0].totalPoints) || 0;
    const newlyCompletedCount = (Number(progress[0].completedCount) || 0) - prevCompletedCount;

    console.log("Attempting to insert into attempts...");
    await systemDB.query(
      `INSERT INTO attempts (user_id, case_id, sql_query, is_correct, score_awarded, room_id, session_id, mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Rank')`,
      [userId, session.case_id, sql_query.substring(0, 1000), overallCorrect ? 1 : 0, overallCorrect ? session.base_points : 0, room_id, session.session_id]
    );
    console.log("Attempt inserted successfully!");

    console.log("ALL STEPS COMPLETED SUCCESS!");

  } catch (err) {
    console.error("🔥 ERROR DURING TEST:", err);
  } finally {
    process.exit(0);
  }
}

testRunQuery();
