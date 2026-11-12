/**
 * get_indexes_and_fkeys.js
 * Fetches index info and foreign key constraints from detective_query
 * to generate thesis-style Figure 81 and Figure 82 equivalents.
 */
const mysql = require('mysql2/promise');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cfg = {
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '4000', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'detective_query',
  ssl:      { rejectUnauthorized: false },
};

async function run() {
  const conn = await mysql.createConnection(cfg);
  console.log('✅ Connected\n');

  // ── Figure 81: Indexes ──────────────────────────────────────────────────
  console.log('=== FIGURE 81: INDEXES ===');
  console.log('TABLE\t|\tINDEX NAME\t|\tTYPE\t|\tPRIMARY\t|\tUNIQUE');

  const [indexes] = await conn.query(`
    SELECT
      TABLE_NAME       AS TableName,
      INDEX_NAME       AS IndexName,
      CASE NON_UNIQUE
        WHEN 0 THEN 'UNIQUE'
        ELSE 'NON-UNIQUE'
      END              AS uniqueness,
      CASE INDEX_NAME
        WHEN 'PRIMARY' THEN 'CLUSTERED'
        ELSE 'NONCLUSTERED'
      END              AS type_desc,
      CASE INDEX_NAME
        WHEN 'PRIMARY' THEN 1
        ELSE 0
      END              AS is_primary_key,
      CASE NON_UNIQUE
        WHEN 0 THEN 1
        ELSE 0
      END              AS is_unique
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'detective_query'
    GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
    ORDER BY TABLE_NAME, is_primary_key DESC, INDEX_NAME
  `);

  const rows = [];
  let rowNum = 1;
  for (const r of indexes) {
    rows.push({ num: rowNum++, ...r });
    console.log(`${r.TableName}\t| ${r.IndexName}\t| ${r.type_desc}\t| ${r.is_primary_key}\t| ${r.is_unique}`);
  }

  const primaryCount    = indexes.filter(r => r.is_primary_key === 1).length;
  const nonclusteredArr = indexes.filter(r => r.type_desc === 'NONCLUSTERED');
  console.log(`\nPrimary key (CLUSTERED) count: ${primaryCount}`);
  console.log(`Nonclustered count: ${nonclusteredArr.length}`);
  console.log('Nonclustered indexes:');
  for (const nc of nonclusteredArr) {
    console.log(`  - ${nc.IndexName} on ${nc.TableName} (unique=${nc.is_unique})`);
  }

  // ── Figure 82: Foreign Keys ─────────────────────────────────────────────
  console.log('\n=== FIGURE 82: FOREIGN KEYS ===');
  console.log('FK NAME\t|\tTABLE\t|\tCOLUMN\t|\tREF TABLE\t|\tREF COLUMN');

  const [fkeys] = await conn.query(`
    SELECT
      CONSTRAINT_NAME      AS ForeignKey,
      TABLE_NAME           AS \`Table\`,
      COLUMN_NAME          AS \`Column\`,
      REFERENCED_TABLE_NAME  AS ReferencesTable,
      REFERENCED_COLUMN_NAME AS ReferencesColumn
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA            = 'detective_query'
      AND REFERENCED_TABLE_NAME   IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);

  for (const fk of fkeys) {
    console.log(`${fk.ForeignKey}\t| ${fk.Table}\t| ${fk.Column}\t| ${fk.ReferencesTable}\t| ${fk.ReferencesColumn}`);
  }

  console.log(`\nTotal FK rows: ${fkeys.length}`);

  // Output as JSON for docx generation
  const output = { indexes, nonclusteredArr, primaryCount, fkeys };
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'db_index_fkey_data.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log('\n✅ Data saved to db_index_fkey_data.json');

  await conn.end();
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });

