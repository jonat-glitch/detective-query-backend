const { systemDB, playgroundDB } = require('../db');

async function inspect() {
  try {
    const [columns] = await systemDB.query('DESCRIBE datasets');
    console.log('datasets columns:', columns.map(c => c.Field));
    const [datasets] = await systemDB.query('SELECT * FROM datasets');
    console.log('Datasets in systemDB:', datasets.map(d => ({ dataset_id: d.dataset_id, dataset_name: d.dataset_name, name: d.name, title: d.title })));

    const [caseCols] = await systemDB.query('DESCRIBE cases');
    console.log('cases columns:', caseCols.map(c => c.Field));

    const [dqlCases] = await systemDB.query(`
      SELECT case_id, title, sql_type, dataset_id, mode, setup_sql 
      FROM cases 
      WHERE sql_type = 'DQL' 
      ORDER BY case_id
    `);
    console.log(`Found ${dqlCases.length} DQL cases.`);
    const datasetCounts = {};
    for (const c of dqlCases) {
      datasetCounts[c.dataset_id] = (datasetCounts[c.dataset_id] || 0) + 1;
    }
    console.log('Dataset distribution among DQL cases:', datasetCounts);

    // Let's print out the first 5 DQL cases and their details
    console.log('First 10 DQL cases:', dqlCases.slice(0, 10));
    console.log('Last 10 DQL cases:', dqlCases.slice(-10));

    // Also inspect what tables exist in datasets schemas
    for (const ds of datasets) {
      const [fullDs] = await systemDB.query('SELECT schema_definition, sample_data FROM datasets WHERE dataset_id = ?', [ds.dataset_id]);
      console.log(`\n--- Dataset ${ds.dataset_id}: ${ds.name} ---`);
      const schema = fullDs[0].schema_definition || '';
      console.log('Schema lines:', schema.split('\n').filter(l => l.toUpperCase().includes('CREATE TABLE')).map(l => l.trim()));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

inspect();
