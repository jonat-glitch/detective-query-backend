/**
 * Full system audit for Detective Query
 * Checks: DB connectivity, all main tables, and critical backend routes
 */
const mysql = require('mysql2/promise');
const https = require('https');
const http = require('http');

const DB_CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

const BACKEND_URL = 'https://detective-query-backend.onrender.com';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 200) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

const results = [];
function check(label, passed, detail = '') {
  const status = passed ? '✅' : '❌';
  results.push({ label, passed, detail });
  console.log(`${status} ${label}${detail ? ' — ' + detail : ''}`);
}
function warn(label, detail = '') {
  results.push({ label, passed: 'warn', detail });
  console.log(`⚠️  ${label}${detail ? ' — ' + detail : ''}`);
}

async function run() {
  console.log('\n══════════════════════════════════════════════');
  console.log('   DETECTIVE QUERY — FULL SYSTEM AUDIT');
  console.log('══════════════════════════════════════════════\n');

  // ── 1. Database Connection ────────────────────
  console.log('📦 CHECKING DATABASE...\n');
  let conn;
  try {
    conn = await mysql.createConnection(DB_CONFIG);
    check('TiDB Cloud Connection', true, `${DB_CONFIG.host}:${DB_CONFIG.port}`);
  } catch (e) {
    check('TiDB Cloud Connection', false, e.message);
    console.log('\n⛔ Cannot continue — DB unreachable.\n');
    process.exit(1);
  }

  // ── 2. Core Tables ────────────────────────────
  const REQUIRED_TABLES = [
    'users', 'cases', 'difficulty', 'attempts', 'user_case_progress',
    'user_achievements', 'user_streaks', 'rooms', 'room_students',
    'refresh_tokens', 'notifications', 'registration_requests',
    'account_change_requests', 'case_notes', 'session_objectives',
    'achievements', 'game_sessions'
  ];

  console.log('\n📋 CHECKING REQUIRED TABLES...\n');
  const [tables] = await conn.query(`SHOW TABLES`);
  const existingTables = new Set(tables.map(r => Object.values(r)[0]));

  for (const t of REQUIRED_TABLES) {
    if (existingTables.has(t)) {
      const [[countRow]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      check(`Table: ${t}`, true, `${countRow.n} rows`);
    } else {
      check(`Table: ${t}`, false, 'TABLE MISSING');
    }
  }

  // ── 3. Critical Data Checks ───────────────────
  console.log('\n🔍 CHECKING CRITICAL DATA...\n');

  // At least one admin user
  const [[adminRow]] = await conn.query(`SELECT COUNT(*) AS n FROM users WHERE role_id = 3`);
  check('Admin user exists', adminRow.n > 0, `${adminRow.n} admin(s)`);

  // At least one active case
  const [[caseRow]] = await conn.query(`SELECT COUNT(*) AS n FROM cases WHERE is_active = 1`);
  check('Active cases exist', caseRow.n > 0, `${caseRow.n} active case(s)`);

  // At least one difficulty
  const [[diffRow]] = await conn.query(`SELECT COUNT(*) AS n FROM difficulty`);
  check('Difficulty levels exist', diffRow.n > 0, `${diffRow.n} difficulty level(s)`);

  // Orphan check: attempts with no matching user
  const [[orphanAttempts]] = await conn.query(`
    SELECT COUNT(*) AS n FROM attempts a 
    LEFT JOIN users u ON a.user_id = u.user_id 
    WHERE u.user_id IS NULL
  `);
  check('No orphan attempts', orphanAttempts.n === 0, orphanAttempts.n > 0 ? `${orphanAttempts.n} orphan(s) found` : 'Clean');

  // Orphan check: room_students with no matching user
  const [[orphanRS]] = await conn.query(`
    SELECT COUNT(*) AS n FROM room_students rs
    LEFT JOIN users u ON rs.student_id = u.user_id
    WHERE u.user_id IS NULL
  `);
  check('No orphan room_students', orphanRS.n === 0, orphanRS.n > 0 ? `${orphanRS.n} orphan(s) found` : 'Clean');

  // Orphan check: notifications with no user
  const [[orphanNotifs]] = await conn.query(`
    SELECT COUNT(*) AS n FROM notifications n
    LEFT JOIN users u ON n.user_id = u.user_id
    WHERE u.user_id IS NULL
  `);
  check('No orphan notifications', orphanNotifs.n === 0, orphanNotifs.n > 0 ? `${orphanNotifs.n} orphan(s) found` : 'Clean');

  // Expired refresh tokens
  const [[expiredTokens]] = await conn.query(`SELECT COUNT(*) AS n FROM refresh_tokens WHERE expires_at < NOW()`);
  if (expiredTokens.n > 0) {
    warn('Expired refresh tokens in DB', `${expiredTokens.n} expired token(s) — safe but could be cleaned`);
  } else {
    check('No expired refresh tokens', true, 'Clean');
  }

  // Cases with no difficulty assigned
  const [[casesNoDiff]] = await conn.query(`
    SELECT COUNT(*) AS n FROM cases c 
    LEFT JOIN difficulty d ON c.difficulty_id = d.difficulty_id
    WHERE d.difficulty_id IS NULL
  `);
  check('All cases have valid difficulty', casesNoDiff.n === 0, casesNoDiff.n > 0 ? `${casesNoDiff.n} case(s) missing difficulty` : 'OK');

  await conn.end();

  // ── 4. Backend Connectivity ────────────────────
  console.log('\n🌐 CHECKING BACKEND SERVER...\n');

  try {
    const res = await httpGet(`${BACKEND_URL}/`);
    check('Backend root endpoint reachable', res.status === 200, `HTTP ${res.status} — "${res.body.slice(0, 60)}"`);
  } catch (e) {
    check('Backend root endpoint reachable', false, e.message);
  }

  // Test public auth endpoint exists (POST only — just check for 4xx not 5xx)
  try {
    const res = await httpGet(`${BACKEND_URL}/api/login`);
    check('Auth /login route exists', res.status !== 500, `HTTP ${res.status}`);
  } catch (e) {
    warn('/login GET probe', e.message);
  }

  // ── 5. Summary ────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  const passed = results.filter(r => r.passed === true).length;
  const failed = results.filter(r => r.passed === false).length;
  const warnings = results.filter(r => r.passed === 'warn').length;
  console.log(`  AUDIT COMPLETE: ${passed} PASSED | ${failed} FAILED | ${warnings} WARNINGS`);
  console.log('══════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⛔ FAILED CHECKS:');
    results.filter(r => r.passed === false).forEach(r => console.log(`  ❌ ${r.label}: ${r.detail}`));
  }
  if (warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.filter(r => r.passed === 'warn').forEach(r => console.log(`  ⚠️  ${r.label}: ${r.detail}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Audit failed unexpectedly:', e.message);
  process.exit(1);
});
