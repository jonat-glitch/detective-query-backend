const { systemDB } = require('../db');
const router = require('../routes/submissionRoutes');

function findHandler(path, method = 'post') {
  const layer = router.stack.find(
    s => s.route && s.route.path === path && s.route.methods[method.toLowerCase()]
  );
  if (!layer) throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  // Return the last handler in stack (after authenticateToken)
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockReqRes(body = {}, params = {}, user = { user_id: 7, role_id: 1 }) {
  const req = { body, params, user };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(c) {
      statusCode = c;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    }
  };
  return {
    req,
    res,
    result: () => ({ status: statusCode, data: responseData })
  };
}

async function testFixes() {
  console.log('--- Testing 3 User Reported Fixes ---');
  
  const userId = 7;
  const roomId = 7;
  
  // Get active session
  const [sessions] = await systemDB.query(
    `SELECT gs.*, c.dataset_id, c.sql_type, c.setup_sql, c.expected_result_sql, c.correct_query, c.correct_suspect_id, c.base_points
     FROM game_sessions gs
     JOIN cases c ON gs.case_id = c.case_id
     WHERE gs.room_id = ? AND gs.status = 'Active'
     LIMIT 1`,
    [roomId]
  );
  
  if (sessions.length === 0) {
    console.error('No active session found for room', roomId);
    process.exit(1);
  }
  
  const session = sessions[0];
  // Ensure session time is active
  await systemDB.query('UPDATE game_sessions SET end_time = DATE_ADD(NOW(), INTERVAL 2 HOUR) WHERE session_id = ?', [session.session_id]);
  console.log(`Active session: #${session.session_id}, Case: #${session.case_id}, correct_suspect_id: ${session.correct_suspect_id}`);
  
  // Reset attempts and session_objectives for clean state
  await systemDB.query(
    `DELETE FROM session_objectives WHERE session_id = ? AND user_id = ?`,
    [session.session_id, userId]
  );
  await systemDB.query(
    `DELETE FROM attempts WHERE session_id = ? AND user_id = ?`,
    [session.session_id, userId]
  );
  
  // Start session marker
  await systemDB.query(
    `INSERT INTO attempts (user_id, case_id, sql_query, is_correct, score_awarded, room_id, session_id, mode)
     VALUES (?, ?, 'START_SESSION', 0, 0, ?, ?, 'Rank')`,
    [userId, session.case_id, roomId, session.session_id]
  );
  console.log('✅ Clean session initialized with START_SESSION marker.');

  // ============================================================
  // TEST 1: User tries to jump and complete Objective 2 directly
  // Case 30029 Obj 1: SELECT name, role FROM persons;
  // Case 30029 Obj 2: SELECT * FROM persons ORDER BY person_id ASC;
  // ============================================================
  console.log('\n--- TEST 1: Running Objective 2 Query Directly ---');
  const runQueryHandler = findHandler('/rank/run-query', 'post');
  const queryObj2 = 'SELECT * FROM persons ORDER BY person_id ASC;';
  
  const mock1 = mockReqRes({ room_id: roomId, sql_query: queryObj2 });
  await runQueryHandler(mock1.req, mock1.res);
  const out1 = mock1.result();

  console.log('Run query response:', {
    status: out1.status,
    objectivePoints: out1.data?.objectivePoints,
    newlyCompletedCount: out1.data?.newlyCompletedCount
  });

  const [objProgress] = await systemDB.query(
    `SELECT so.objective_id, co.objective_order, co.objective_text, so.is_completed, so.points_awarded
     FROM session_objectives so
     JOIN case_objectives co ON so.objective_id = co.objective_id
     WHERE so.session_id = ? AND so.user_id = ?`,
    [session.session_id, userId]
  );

  console.log('Completed objectives in DB:', objProgress.map(o => ({ order: o.objective_order, text: o.objective_text })));
  if (objProgress.length === 1 && objProgress[0].objective_order === 2) {
    console.log('🎉 SUCCESS: Only Objective 2 was completed! Objective 1 was NOT checked!');
  } else {
    console.error('❌ FAILURE: Unexpected objectives completed:', objProgress);
    process.exit(1);
  }

  // ============================================================
  // TEST 2: Final Verdict with incomplete objectives
  // Student completed only Objective 2 (not all 3 objectives),
  // but selects correct suspect 7 (George Ramos)
  // ============================================================
  console.log('\n--- TEST 2: Final Verdict With Incomplete Objectives & Correct Suspect ---');
  const submitFinalHandler = findHandler('/rank/submit-final', 'post');
  const mock2 = mockReqRes({ room_id: roomId, suspect_id: 7 });
  await submitFinalHandler(mock2.req, mock2.res);
  const out2 = mock2.result();

  console.log('Final verdict response:', out2.status, out2.data);
  if (out2.data?.correct === true && out2.data?.finalAnswerPoints === 30 && out2.data?.objectivePoints === 15) {
    console.log('🎉 SUCCESS: Verdict is CORRECT even though only 1 objective was completed!');
    console.log(`Earned ${out2.data.finalAnswerPoints} final pts + ${out2.data.objectivePoints} obj pts = ${out2.data.totalScore} total pts!`);
  } else {
    console.error('❌ FAILURE: Verdict was not graded correctly:', out2.data);
    process.exit(1);
  }

  // ============================================================
  // TEST 3: Re-entering Room After Final Submit
  // ============================================================
  console.log('\n--- TEST 3: Re-entering Room After Final Submit ---');
  const statusHandler = findHandler('/rank/status/:room_id', 'get');
  const mock3 = mockReqRes({}, { room_id: roomId });
  await statusHandler(mock3.req, mock3.res);
  const out3 = mock3.result();

  console.log('Status response on re-entry:', {
    hasStarted: out3.data?.hasStarted,
    hasSubmittedFinal: out3.data?.hasSubmittedFinal,
    alreadySolved: out3.data?.alreadySolved,
    isFinished: out3.data?.isFinished,
    finalAnswer: out3.data?.finalAnswer
  });

  if (out3.data?.hasSubmittedFinal === true && out3.data?.isFinished === true && String(out3.data?.finalAnswer) === '7') {
    console.log('🎉 SUCCESS: Backend correctly reports hasSubmittedFinal=true, isFinished=true, finalAnswer=7!');
  } else {
    console.error('❌ FAILURE: Status does not report finished state:', out3.data);
    process.exit(1);
  }

  // Verify that running query again is blocked
  const mock4 = mockReqRes({ room_id: roomId, sql_query: 'SELECT name FROM persons;' });
  await runQueryHandler(mock4.req, mock4.res);
  const out4 = mock4.result();

  console.log('Attempt to run query after submission:', out4.status, out4.data);
  if (out4.status === 400 && out4.data?.error?.includes('already submitted')) {
    console.log('🎉 SUCCESS: Query runner properly blocked post-submission!');
  } else {
    console.error('❌ FAILURE: Query runner was not blocked:', out4.data);
    process.exit(1);
  }

  // Verify that submitting final again is blocked
  const mock5 = mockReqRes({ room_id: roomId, suspect_id: 7 });
  await submitFinalHandler(mock5.req, mock5.res);
  const out5 = mock5.result();

  console.log('Attempt to submit final verdict again:', out5.status, out5.data);
  if (out5.status === 400 && out5.data?.error?.includes('already submitted')) {
    console.log('🎉 SUCCESS: Final verdict double-submission properly blocked!');
  } else {
    console.error('❌ FAILURE: Final verdict double-submission was not blocked:', out5.data);
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log('ALL 3 USER REPORTED ISSUES FULLY VERIFIED! ✅');
  console.log('=============================================');
  process.exit(0);
}

testFixes().catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
