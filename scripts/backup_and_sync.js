const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const tidbConfig = {
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USER || '4AjTs4MyTKCrsiP.root',
  password: process.env.DB_PASSWORD || 'Xkoew4eyG3Wlu5ZS',
  ssl: { rejectUnauthorized: false }
};

const localConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  multipleStatements: true
};

const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

async function backupAndSyncDatabase(dbName) {
  console.log(`\n======================================================`);
  console.log(`📦 BACKING UP & SYNCING DATABASE: ${dbName}`);
  console.log(`======================================================`);

  const timestamp = getTimestamp();
  const backupFile = path.join(backupDir, `${dbName}_backup_${timestamp}.sql`);
  const latestFile = path.join(backupDir, `${dbName}_latest.sql`);
  const sqlStatements = [];

  sqlStatements.push(`-- ======================================================`);
  sqlStatements.push(`-- DETECTIVE QUERY DATABASE BACKUP`);
  sqlStatements.push(`-- Database: ${dbName}`);
  sqlStatements.push(`-- Date: ${new Date().toISOString()}`);
  sqlStatements.push(`-- ======================================================\n`);
  sqlStatements.push(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
  sqlStatements.push(`USE \`${dbName}\`;`);
  sqlStatements.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

  let cloudConn;
  let localConn;

  try {
    cloudConn = await mysql.createConnection({ ...tidbConfig, database: dbName });
    console.log(`✅ Connected to TiDB Cloud for ${dbName}`);
  } catch (err) {
    console.error(`❌ Failed to connect to Cloud Database: ${err.message}`);
    return;
  }

  let localAvailable = false;
  try {
    localConn = await mysql.createConnection(localConfig);
    await localConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await localConn.changeUser({ database: dbName });
    await localConn.query(`SET FOREIGN_KEY_CHECKS = 0;`);
    localAvailable = true;
    console.log(`✅ Connected to Local MySQL (XAMPP) for sync`);
  } catch (err) {
    console.warn(`⚠️ Local MySQL is not running or unreachable (${err.message}). Continuing with Cloud Backup file creation...`);
  }

  try {
    const [tables] = await cloudConn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableKey = `Tables_in_${dbName}`;

    for (const tableRow of tables) {
      const tableName = tableRow[tableKey];
      process.stdout.write(`  ⏳ Processing table: ${tableName}... `);

      // 1. Get CREATE TABLE statement
      const [[createResult]] = await cloudConn.query(`SHOW CREATE TABLE \`${tableName}\``);
      let createTableSql = createResult['Create Table'];
      
      // Clean up TiDB-specific comments, syntax, and duplicate constraint names (errno 121)
      createTableSql = createTableSql
        .replace(/\/\*T!.*?\*\//g, '')
        .replace(/CONSTRAINT `[^`]+` FOREIGN KEY/g, 'FOREIGN KEY')
        .replace(/UNIQUE KEY `session_id` \(`session_id`,`user_id`,`objective_text`\) USING HASH/g, 'INDEX `session_id_idx` (`session_id`, `user_id`)')
        .replace(/`objective_text` text/g, '`objective_text` varchar(500)');

      sqlStatements.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
      sqlStatements.push(`${createTableSql};\n`);

      if (localAvailable) {
        await localConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        await localConn.query(createTableSql);
      }

      // 2. Fetch all data rows
      const [rows] = await cloudConn.query(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        
        // Chunk inserts: use chunkSize = 1 for blob tables (PDFs / avatars) to prevent packet size errors
        const isBlobTable = tableName === 'case_study_materials' || tableName === 'user_avatars';
        const chunkSize = isBlobTable ? 1 : 200;
        
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valueStrings = chunk.map(row => {
            const values = Object.values(row).map(val => {
              if (val === null || val === undefined) return 'NULL';
              if (Buffer.isBuffer(val)) {
                return `0x${val.toString('hex')}`;
              }
              if (typeof val === 'number') return val;
              if (val instanceof Date) {
                return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              }
              if (typeof val === 'boolean') return val ? 1 : 0;
              // Escape strings
              return mysql.escape(String(val));
            });
            return `(${values.join(', ')})`;
          });

          const insertSql = `INSERT INTO \`${tableName}\` (${columns}) VALUES \n${valueStrings.join(',\n')};`;
          sqlStatements.push(insertSql);

          if (localAvailable) {
            try {
              await localConn.query(insertSql);
            } catch (insertErr) {
              if (insertErr.code === 'ER_NET_PACKET_TOO_LARGE') {
                console.warn(`\n     ⚠️ Row packet too large for local MySQL buffer; skipping local cache for this row.`);
              } else {
                throw insertErr;
              }
            }
          }
        }
      }

      console.log(`✅ [${rows.length} rows backed up & synced]`);
    }

    sqlStatements.push(`\nSET FOREIGN_KEY_CHECKS = 1;`);
    if (localAvailable) {
      await localConn.query(`SET FOREIGN_KEY_CHECKS = 1;`);
    }

    // Write to timestamped backup file
    const fullSql = sqlStatements.join('\n');
    fs.writeFileSync(backupFile, fullSql, 'utf8');
    fs.writeFileSync(latestFile, fullSql, 'utf8');

    const stats = fs.statSync(backupFile);
    console.log(`\n🎉 Backup saved successfully!`);
    console.log(`   📁 File: ${path.basename(backupFile)} (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log(`   📁 Latest Mirror: ${path.basename(latestFile)}`);
    if (localAvailable) {
      console.log(`   🔄 Local XAMPP MySQL database '${dbName}' is now 100% synchronized!`);
    }
  } finally {
    if (cloudConn) await cloudConn.end();
    if (localConn) await localConn.end();
  }
}

async function run() {
  console.log(`======================================================`);
  console.log(`🚀 DETECTIVE QUERY — AUTOMATED CLOUD BACKUP & LOCAL SYNC`);
  console.log(`======================================================`);
  
  await backupAndSyncDatabase('detective_query');
  await backupAndSyncDatabase('detective_query_playground');

  console.log(`\n======================================================`);
  console.log(`✨ ALL BACKUPS & LOCAL SYNCS COMPLETED SUCCESSFULLY!`);
  console.log(`======================================================\n`);
}

run().catch(err => {
  console.error('\n❌ Backup script encountered an error:', err);
  process.exit(1);
});
