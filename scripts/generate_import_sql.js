/**
 * generate_import_sql.js
 * Generates a clean, phpMyAdmin-compatible SQL file by splitting
 * blob-heavy tables (case_study_materials, user_avatars) into a
 * separate file so the main import stays small and fast.
 *
 * Run from: detective_query_backend directory
 *   node scripts/generate_import_sql.js
 */

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const tidbConfig = {
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '4000', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
};

const OUTPUT_DIR = path.join(__dirname, '..', '..'); // 4th Year Project folder
const DB_NAME    = 'detective_query';

// Tables whose rows contain large BLOBs — split into separate file
const BLOB_TABLES = new Set(['case_study_materials', 'user_avatars']);

function header(dbName) {
  return [
    `-- ============================================================`,
    `-- DETECTIVE QUERY — CLEAN IMPORT FILE`,
    `-- Database : ${dbName}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Import order: 1) this file  2) ${dbName}_blobs.sql (optional)`,
    `-- ============================================================`,
    ``,
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`,
    `USE \`${dbName}\`;`,
    ``,
    `SET NAMES utf8mb4;`,
    `SET FOREIGN_KEY_CHECKS = 0;`,
    ``,
  ].join('\n');
}

function footer() {
  return `\nSET FOREIGN_KEY_CHECKS = 1;\n`;
}

async function run() {
  console.log('\n🚀 Connecting to TiDB Cloud …');
  const conn = await mysql.createConnection({ ...tidbConfig, database: DB_NAME });
  console.log('✅ Connected\n');

  const mainParts  = [header(DB_NAME)];
  const blobParts  = [
    `-- ============================================================`,
    `-- BLOB / BINARY DATA (PDFs + Avatars)`,
    `-- Import AFTER the main file!`,
    `-- ============================================================`,
    ``,
    `USE \`${DB_NAME}\`;`,
    `SET FOREIGN_KEY_CHECKS = 0;`,
    ``,
  ].join('\n');

  let blobSql = blobParts;

  const [tables] = await conn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const tableKey = `Tables_in_${DB_NAME}`;

  for (const tableRow of tables) {
    const tableName = tableRow[tableKey];
    const isBlob    = BLOB_TABLES.has(tableName);

    process.stdout.write(`  ⏳ ${tableName} … `);

    // --- CREATE TABLE ---
    const [[createResult]] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createSql = createResult['Create Table'];

    // Strip TiDB-specific extras for compatibility
    createSql = createSql
      .replace(/\/\*T!.*?\*\//g, '')
      .replace(/CONSTRAINT `[^`]+` FOREIGN KEY/g, 'FOREIGN KEY')
      .replace(
        /UNIQUE KEY `session_id` \(`session_id`,`user_id`,`objective_text`\) USING HASH/g,
        'INDEX `session_id_idx` (`session_id`, `user_id`)'
      )
      .replace(/`objective_text` text/g, '`objective_text` varchar(500)');

    const createBlock = `DROP TABLE IF EXISTS \`${tableName}\`;\n${createSql};\n`;

    if (isBlob) {
      // Schema goes in main file, data in blob file
      mainParts.push(createBlock);
    } else {
      mainParts.push(createBlock);
    }

    // --- ROWS ---
    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);

    if (rows.length > 0) {
      const columns   = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
      const chunkSize = isBlob ? 1 : 100;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk        = rows.slice(i, i + chunkSize);
        const valueStrings = chunk.map(row => {
          const values = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (Buffer.isBuffer(val))              return `0x${val.toString('hex')}`;
            if (typeof val === 'number')           return val;
            if (val instanceof Date)               return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'boolean')          return val ? 1 : 0;
            return mysql.escape(String(val));
          });
          return `(${values.join(', ')})`;
        });

        const insertSql = `INSERT INTO \`${tableName}\` (${columns}) VALUES \n${valueStrings.join(',\n')};`;

        if (isBlob) {
          blobSql += insertSql + '\n\n';
        } else {
          mainParts.push(insertSql);
        }
      }
    }

    console.log(`✅ [${rows.length} rows]`);
  }

  mainParts.push(footer());
  blobSql += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;

  // Write files
  const mainFile = path.join(OUTPUT_DIR, `${DB_NAME}_import.sql`);
  const blobFile = path.join(OUTPUT_DIR, `${DB_NAME}_blobs.sql`);

  fs.writeFileSync(mainFile, mainParts.join('\n'), 'utf8');
  fs.writeFileSync(blobFile, blobSql,              'utf8');

  const mainSize = (fs.statSync(mainFile).size / 1024).toFixed(1);
  const blobSize = (fs.statSync(blobFile).size / 1024).toFixed(1);

  console.log(`\n🎉 Done!`);
  console.log(`   📄 Main file : detective_query_import.sql  (${mainSize} KB)`);
  console.log(`   📦 Blob file : detective_query_blobs.sql   (${blobSize} KB)`);
  console.log(`\n📋 Import instructions:`);
  console.log(`   1. In phpMyAdmin → Import → choose detective_query_import.sql`);
  console.log(`   2. (Optional) Import detective_query_blobs.sql for PDFs & avatars`);
  console.log(`      – If blobs file is still too large, increase max_allowed_packet`);
  console.log(`        in XAMPP php.ini (upload_max_filesize / post_max_size)`);
  console.log(`        and MySQL my.ini (max_allowed_packet = 64M)\n`);

  await conn.end();
}

run().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});

