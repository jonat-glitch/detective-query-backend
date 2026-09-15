const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const http = require('http');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function test() {
  const conn = await mysql.createConnection(TIDB);
  
  // Find a student approved in room 7
  const [students] = await conn.query("SELECT student_id FROM room_students WHERE room_id = 7 AND status = 'Approved' LIMIT 1");
  console.log('Student in room 7:', students);
  if (students.length === 0) {
    console.log('No approved student found in room 7');
    await conn.end();
    return;
  }
  const userId = students[0].student_id;

  // Check active session
  const [sessions] = await conn.query("SELECT * FROM game_sessions WHERE room_id = 7 AND status = 'Active' LIMIT 1");
  console.log('Active session:', sessions[0]?.session_id);
  const sessionId = sessions[0].session_id;

  // Make sure START_SESSION attempt exists so enforceSessionTime passes
  const [startAttempt] = await conn.query("SELECT * FROM attempts WHERE user_id = ? AND session_id = ? AND sql_query = 'START_SESSION'", [userId, sessionId]);
  if (startAttempt.length === 0) {
    await conn.query("INSERT INTO attempts (user_id, case_id, sql_query, is_correct, score_awarded, room_id, session_id, mode) VALUES (?, 30029, 'START_SESSION', 1, 0, 7, ?, 'Rank')", [userId, sessionId]);
    console.log('Created START_SESSION attempt for user', userId);
  }

  // Create token
  const token = jwt.sign({ user_id: userId, role: 1 }, 'your_secret_key');

  // Now call /api/rank/run-query on local server
  const postData = JSON.stringify({
    room_id: 7,
    sql_query: 'SELECT name, role FROM persons;'
  });

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/rank/run-query',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', async () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', body);

      // Check session_objectives in TiDB
      const [so] = await conn.query("SELECT * FROM session_objectives WHERE session_id = ? AND user_id = ?", [sessionId, userId]);
      console.log('session_objectives in TiDB after call:', so);
      await conn.end();
    });
  });

  req.on('error', e => {
    console.error('Request error:', e);
    conn.end();
  });

  req.write(postData);
  req.end();
}

test().catch(console.error);
