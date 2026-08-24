const { systemDB, playgroundDB } = require('../db');
const submissionService = require('../services/submissionService');

async function testSuspects() {
  const room_id = 7;
  const userId = 20; // Let's check which users are approved in room 7

  const [members] = await systemDB.query(
    `SELECT * FROM room_students WHERE room_id = ?`,
    [room_id]
  );
  console.log('Room 7 members:', members);

  // Check active session
  const [sessions] = await systemDB.query(
    `SELECT gs.session_id, c.dataset_id
     FROM game_sessions gs
     JOIN cases c ON gs.case_id = c.case_id
     WHERE gs.room_id = ?
     AND gs.status = 'Active'
     LIMIT 1`,
    [room_id]
  );
  console.log('Active session:', sessions);

  if (sessions.length > 0) {
    const session = sessions[0];
    try {
      await submissionService.resetPlayground(session.dataset_id);
      console.log('Playground reset success for dataset:', session.dataset_id);
    } catch (err) {
      console.warn('Playground reset warning:', err.message);
    }

    let suspects = [];
    const queries = [
        `SELECT person_id, name FROM persons`,
        `SELECT id AS person_id, name FROM persons`,
        `SELECT id AS person_id, name FROM person`,
        `SELECT person_id, name FROM person`,
        `SELECT id AS person_id, name FROM suspects`,
        `SELECT suspect_id AS person_id, name FROM suspects`
    ];

    for (const q of queries) {
        try {
            const [rows] = await playgroundDB.query(q);
            if (rows && rows.length > 0) {
                console.log('Found suspects with query:', q);
                suspects = rows;
                break;
            }
        } catch (e) {
            console.log('Query failed:', q, e.message);
        }
    }
    console.log('Suspects count:', suspects.length);
    console.log('Suspects list:', suspects);
  }

  process.exit(0);
}

testSuspects().catch(e => { console.error('ERR:', e); process.exit(1); });
