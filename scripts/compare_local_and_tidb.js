const mysql = require('mysql2/promise');

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: ''
};

const TIDB_CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  ssl: { rejectUnauthorized: false }
};

async function compareDatabases(dbName) {
  console.log(`\n======================================================`);
  console.log(`🔍 COMPARING DATABASE: ${dbName}`);
  console.log(`======================================================`);

  const localConn = await mysql.createConnection({ ...LOCAL_CONFIG, database: dbName });
  const tidbConn = await mysql.createConnection({ ...TIDB_CONFIG, database: dbName });

  const [localTablesRaw] = await localConn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const [tidbTablesRaw] = await tidbConn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');

  const localTables = localTablesRaw.map(r => Object.values(r)[0]).sort();
  const tidbTables = tidbTablesRaw.map(r => Object.values(r)[0]).sort();

  console.log(`\n📊 Table Counts:`);
  console.log(`- Localhost:  ${localTables.length} tables`);
  console.log(`- TiDB Cloud: ${tidbTables.length} tables`);

  const missingInTiDB = localTables.filter(t => !tidbTables.includes(t));
  const missingInLocal = tidbTables.filter(t => !localTables.includes(t));
  const commonTables = localTables.filter(t => tidbTables.includes(t));

  if (missingInTiDB.length > 0) {
    console.log(`⚠️  Tables in Localhost but MISSING in TiDB:`, missingInTiDB);
  }
  if (missingInLocal.length > 0) {
    console.log(`⚠️  Tables in TiDB but MISSING in Localhost:`, missingInLocal);
  }
  if (missingInTiDB.length === 0 && missingInLocal.length === 0) {
    console.log(`✅ Table sets match exactly! (${commonTables.length} common tables)`);
  }

  console.log(`\n🔬 Comparing column definitions for ${commonTables.length} common tables...`);
  let diffCount = 0;

  for (const table of commonTables) {
    const [localCols] = await localConn.query(`SHOW COLUMNS FROM \`${table}\``);
    const [tidbCols] = await tidbConn.query(`SHOW COLUMNS FROM \`${table}\``);

    const localColMap = new Map(localCols.map(c => [c.Field, c]));
    const tidbColMap = new Map(tidbCols.map(c => [c.Field, c]));

    const missingColsInTiDB = localCols.map(c => c.Field).filter(f => !tidbColMap.has(f));
    const missingColsInLocal = tidbCols.map(c => c.Field).filter(f => !localColMap.has(f));

    if (missingColsInTiDB.length > 0 || missingColsInLocal.length > 0) {
      diffCount++;
      console.log(`\n❌ DIFFERENCE in table [${table}]:`);
      if (missingColsInTiDB.length > 0) {
        console.log(`   Columns in Localhost but missing in TiDB:`, missingColsInTiDB);
      }
      if (missingColsInLocal.length > 0) {
        console.log(`   Columns in TiDB but missing in Localhost:`, missingColsInLocal);
      }
    }

    // Check type/key differences for common columns
    for (const [colName, lCol] of localColMap.entries()) {
      if (tidbColMap.has(colName)) {
        const tCol = tidbColMap.get(colName);
        // Normalize type strings (e.g. int vs int(11))
        const cleanType = (t) => t.toLowerCase().replace(/\(\d+\)/g, '').replace(/ unsigned/g, ' unsigned');
        const lType = cleanType(lCol.Type);
        const tType = cleanType(tCol.Type);

        if (lType !== tType && !(lType.includes('int') && tType.includes('int'))) {
          // Significant type difference
          console.log(`   ⚠️ Column type difference in [${table}.${colName}]: Local(${lCol.Type}) vs TiDB(${tCol.Type})`);
        }
      }
    }
  }

  if (diffCount === 0) {
    console.log(`\n✅ All common tables have matching columns!`);
  }

  // Row count comparison
  console.log(`\n📈 Row Counts Comparison:`);
  for (const table of commonTables) {
    const [lCount] = await localConn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    const [tCount] = await tidbConn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    const lc = lCount[0].cnt;
    const tc = tCount[0].cnt;
    const status = lc === tc ? '✅ Match' : `⚠️ Diff (Local: ${lc}, TiDB: ${tc})`;
    console.log(`  - ${table.padEnd(30)} ${status}`);
  }

  await localConn.end();
  await tidbConn.end();
}

async function run() {
  try {
    await compareDatabases('detective_query');
    await compareDatabases('detective_query_playground');
  } catch (err) {
    console.error('Error during comparison:', err);
  }
}

run();

