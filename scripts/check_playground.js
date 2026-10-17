const { playgroundDB } = require('../db');

async function check() {
  const [tables] = await playgroundDB.query('SHOW TABLES');
  console.log('Tables in playgroundDB:', tables.map(t => Object.values(t)[0]));
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    try {
      const [cnt] = await playgroundDB.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      console.log(`- ${tableName}: ${cnt[0].count} rows`);
    } catch (e) {
      console.log(`- ${tableName}: ERROR ${e.message}`);
    }
  }
  process.exit(0);
}

check().catch(console.error);
