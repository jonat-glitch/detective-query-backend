/**
 * check_schema_issues.js
 * Verifies all the ERD issues the user flagged:
 * - Leaf tables (no outgoing FK)
 * - Isolated tables (no FK at all)
 * - Dual PK tables
 * - FK column names that differ from referenced PK names
 * - Tables where the same parent table connects twice (multi-FK)
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cfg = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function run() {
  const conn = await mysql.createConnection(cfg);
  console.log('✅ Connected\n');

  // 1. All foreign keys
  const [fkeys] = await conn.query(`
    SELECT
      kcu.TABLE_NAME        AS child_table,
      kcu.COLUMN_NAME       AS fk_column,
      kcu.CONSTRAINT_NAME   AS fk_name,
      kcu.REFERENCED_TABLE_NAME  AS parent_table,
      kcu.REFERENCED_COLUMN_NAME AS referenced_pk_col
    FROM information_schema.KEY_COLUMN_USAGE kcu
    WHERE kcu.TABLE_SCHEMA = 'detective_query'
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY child_table, fk_name
  `);

  // 2. All PRIMARY KEY columns
  const [pkeys] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'detective_query'
      AND CONSTRAINT_NAME = 'PRIMARY'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  // 3. All tables
  const [tables] = await conn.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'detective_query' AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  const allTables = tables.map(t => t.TABLE_NAME);

  // ── Analysis ─────────────────────────────────────────────────────────────

  // Tables that HAVE outgoing FKs (child tables)
  const tablesWithOutgoingFK = new Set(fkeys.map(f => f.child_table));
  // Tables that are REFERENCED by FKs (parent tables)
  const tablesBeingReferenced = new Set(fkeys.map(f => f.parent_table));

  console.log('=== 1. COMPLETELY ISOLATED TABLES (no FK in, no FK out) ===');
  for (const t of allTables) {
    const hasOutgoing = tablesWithOutgoingFK.has(t);
    const isReferenced = tablesBeingReferenced.has(t);
    if (!hasOutgoing && !isReferenced) {
      console.log(`  ❌ ISOLATED: ${t}`);
    }
  }

  console.log('\n=== 2. LEAF TABLES (have outgoing FKs but nothing references them) ===');
  for (const t of allTables) {
    const hasOutgoing = tablesWithOutgoingFK.has(t);
    const isReferenced = tablesBeingReferenced.has(t);
    if (hasOutgoing && !isReferenced) {
      console.log(`  📌 LEAF: ${t}`);
    }
  }

  console.log('\n=== 3. TABLES WITH DUAL / COMPOSITE PRIMARY KEYS ===');
  const pkCount = {};
  for (const pk of pkeys) {
    pkCount[pk.TABLE_NAME] = (pkCount[pk.TABLE_NAME] || 0) + 1;
  }
  for (const [tbl, cnt] of Object.entries(pkCount)) {
    if (cnt > 1) {
      const cols = pkeys.filter(p => p.TABLE_NAME === tbl).map(p => p.COLUMN_NAME);
      console.log(`  ⚠️  ${tbl}: ${cnt} PK columns → [${cols.join(', ')}]`);
    }
  }

  console.log('\n=== 4. FK COLUMN NAME ≠ REFERENCED PK COLUMN NAME ===');
  for (const fk of fkeys) {
    if (fk.fk_column !== fk.referenced_pk_col) {
      console.log(`  ⚠️  ${fk.child_table}.${fk.fk_column} → ${fk.parent_table}.${fk.referenced_pk_col}  (names differ!)`);
    }
  }

  console.log('\n=== 5. TABLES WHERE SAME PARENT IS CONNECTED TWICE (multi-FK to same parent) ===');
  const parentChildMap = {};
  for (const fk of fkeys) {
    const key = `${fk.child_table} → ${fk.parent_table}`;
    if (!parentChildMap[key]) parentChildMap[key] = [];
    parentChildMap[key].push(fk.fk_column);
  }
  for (const [pair, cols] of Object.entries(parentChildMap)) {
    if (cols.length > 1) {
      console.log(`  🔗 DOUBLE CONNECTION: ${pair}  via columns: [${cols.join(', ')}]`);
    }
  }

  console.log('\n=== 6. FULL FK LIST (child.fk_col → parent.ref_col) ===');
  for (const fk of fkeys) {
    console.log(`  ${fk.child_table}.${fk.fk_column}  →  ${fk.parent_table}.${fk.referenced_pk_col}  (FK name: ${fk.fk_name})`);
  }

  await conn.end();
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });

