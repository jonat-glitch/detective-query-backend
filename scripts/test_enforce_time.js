const { systemDB } = require('../db');

async function test() {
  const [sessions] = await systemDB.query("SELECT * FROM game_sessions WHERE session_id = 480097");
  const session = sessions[0];
  const userId = 7;
  const room_id = 7;

  const [rows] = await systemDB.query(
    `SELECT 
        attempt_date,
        TIMESTAMPDIFF(SECOND, attempt_date, NOW()) AS elapsed_seconds,
        TIMESTAMPDIFF(SECOND, NOW(), ?) AS room_remaining_seconds
     FROM attempts
     WHERE user_id = ?
     AND session_id = ?
     AND sql_query = 'START_SESSION'
     ORDER BY attempt_date DESC
     LIMIT 1`,
    [session.end_time || '2099-12-31', userId, session.session_id]
  );
  console.log("rows:", rows);

  if (rows.length === 0) {
    console.log("Allowed: false (must start session first)");
    return;
  }

  const { elapsed_seconds, room_remaining_seconds } = rows[0];
  const personalLimitSeconds = (session.personal_time_limit || 60) * 60;
  console.log("elapsed_seconds:", elapsed_seconds, "personalLimitSeconds:", personalLimitSeconds, "room_remaining_seconds:", room_remaining_seconds);

  if (elapsed_seconds > personalLimitSeconds || (session.end_time && room_remaining_seconds <= 0)) {
    console.log("Time is up!");
  } else {
    console.log("Allowed: true!");
  }
}

test().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
