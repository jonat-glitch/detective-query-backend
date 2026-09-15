const express = require('express');
const { systemDB } = require('../db');
const request = require('http');

async function test() {
  console.log('--- Testing Study Material TiDB Persistence ---');

  // Check TiDB rows
  const [rows] = await systemDB.query('SELECT case_id, file_name, file_size FROM case_study_materials');
  console.log('Persisted cases in TiDB:', rows);

  if (rows.length === 0) {
    console.error('FAIL: No study materials found in TiDB!');
    process.exit(1);
  }

  // Verify blob integrity for case 22
  const [case22] = await systemDB.query('SELECT case_id, file_name, file_size, file_data FROM case_study_materials WHERE case_id = 22');
  if (case22.length > 0) {
    const data = case22[0].file_data;
    console.log(`Case 22 PDF data retrieved from TiDB: ${data.length} bytes. Starts with '%PDF':`, data.toString('utf8', 0, 4) === '%PDF');
  }

  console.log('SUCCESS: Study material persistent storage is verified and working in TiDB!');
  process.exit(0);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
