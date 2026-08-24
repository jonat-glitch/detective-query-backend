// scripts/migrate-to-tidb.js
const mysql = require('mysql2/promise');

const localConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  port: 3306,
};

const tidbConfig = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  ssl: { rejectUnauthorized: false },
};

function sanitizeCreateTable(sql) {
  // Fix TEXT column unique key in session_objectives without prefix length
  return sql
    .replace(/UNIQUE KEY `session_id` \(`session_id`,`user_id`,`objective_text`\) USING HASH/g, 'INDEX `session_id_idx` (`session_id`, `user_id`)')
    .replace(/`objective_text` text/g, '`objective_text` varchar(500)');
}

async function migrateDatabase(dbName) {
  console.log(`\n📦 Starting migration for: ${dbName}...`);
  
  const localConn = await mysql.createConnection({ ...localConfig, database: dbName });
  const tidbConn = await mysql.createConnection({ ...tidbConfig, database: dbName, multipleStatements: true });

  const [tables] = await localConn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const tableKey = `Tables_in_${dbName}`;

  await tidbConn.query('SET FOREIGN_KEY_CHECKS = 0;');

  for (const row of tables) {
    const tableName = row[tableKey];
    console.log(`  🔄 Migrating table: ${tableName}...`);

    const [createTableResult] = await localConn.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createTableSql = createTableResult[0]['Create Table'];
    createTableSql = sanitizeCreateTable(createTableSql);

    await tidbConn.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    await tidbConn.query(createTableSql);

    // Get insertable columns
    const [cols] = await localConn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND (EXTRA NOT LIKE '%GENERATED%' OR EXTRA IS NULL)`,
      [dbName, tableName]
    );
    const insertCols = cols.map(c => c.COLUMN_NAME);

    if (insertCols.length > 0) {
      const selectColList = insertCols.map(c => `\`${c}\``).join(', ');
      const [rows] = await localConn.query(`SELECT ${selectColList} FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const placeholders = chunk.map(() => `(${insertCols.map(() => '?').join(', ')})`).join(', ');
          const values = chunk.flatMap(r => insertCols.map(k => r[k]));
          
          const insertSql = `INSERT INTO \`${tableName}\` (${selectColList}) VALUES ${placeholders}`;
          await tidbConn.query(insertSql, values);
        }
        console.log(`    ✅ Inserted ${rows.length} rows into ${tableName}`);
      } else {
        console.log(`    ℹ️ 0 rows in ${tableName}`);
      }
    }
  }

  await tidbConn.query('SET FOREIGN_KEY_CHECKS = 1;');
  console.log(`🎉 Finished migration for: ${dbName}!`);

  await localConn.end();
  await tidbConn.end();
}

async function run() {
  try {
    const adminConn = await mysql.createConnection(tidbConfig);
    await adminConn.query('CREATE DATABASE IF NOT EXISTS detective_query;');
    await adminConn.query('CREATE DATABASE IF NOT EXISTS detective_query_playground;');
    await adminConn.end();

    await migrateDatabase('detective_query');
    await migrateDatabase('detective_query_playground');
    console.log('\n🏆 ALL DATABASES MIGRATED TO CLOUD SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Migration error:', err);
  }
}

run();
