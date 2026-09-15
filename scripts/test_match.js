const mysql = require('mysql2/promise');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query_playground',
  ssl: { rejectUnauthorized: false }
};

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.toLowerCase(),
          v === null ? null : String(v).trim().toLowerCase()
        ])
      )
    )
  ).sort();
}

function rowsMatch(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  if (actual.length !== expected.length) return false;
  const a = normalizeRows(actual);
  const e = normalizeRows(expected);
  return JSON.stringify(a) === JSON.stringify(e);
}

async function testMatch() {
  const conn = await mysql.createConnection(TIDB);
  
  const studentQuery = "SELECT name, role FROM persons;";
  const expectedQuery = "SELECT name, role FROM persons;";

  const [studentRows] = await conn.query(studentQuery);
  const [expectedRows] = await conn.query(expectedQuery);

  console.log('studentRows count:', studentRows.length);
  console.log('expectedRows count:', expectedRows.length);
  console.log('rowsMatch:', rowsMatch(studentRows, expectedRows));

  await conn.end();
}

testMatch().catch(console.error);
