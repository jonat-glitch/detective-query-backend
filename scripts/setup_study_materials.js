const { systemDB } = require('../db');
const fs = require('fs');
const path = require('path');

async function setup() {
  console.log('1. Setting up case_study_materials table in TiDB...');
  await systemDB.query(`
    CREATE TABLE IF NOT EXISTS case_study_materials (
      case_id INT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) DEFAULT 'application/pdf',
      file_size INT DEFAULT 0,
      file_data LONGBLOB NOT NULL,
      uploaded_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
    )
  `);
  console.log('case_study_materials table created or exists!');

  console.log('2. Setting up user_avatars table in TiDB...');
  await systemDB.query(`
    CREATE TABLE IF NOT EXISTS user_avatars (
      user_id INT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) DEFAULT 'image/png',
      file_size INT DEFAULT 0,
      file_data LONGBLOB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);
  console.log('user_avatars table created or exists!');

  // Migrate any existing files in uploads directory into TiDB
  const uploadsDir = path.join(__dirname, '../uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      // Study materials
      const matMatch = file.match(/^study-material-(\d+)\.pdf$/i);
      if (matMatch) {
        const caseId = Number(matMatch[1]);
        const filePath = path.join(uploadsDir, file);
        const buffer = fs.readFileSync(filePath);
        console.log(`Migrating PDF ${file} (Case #${caseId}, ${buffer.length} bytes)...`);
        await systemDB.query(`
          INSERT INTO case_study_materials (case_id, file_name, mime_type, file_size, file_data)
          VALUES (?, ?, 'application/pdf', ?, ?)
          ON DUPLICATE KEY UPDATE
            file_name = VALUES(file_name),
            mime_type = VALUES(mime_type),
            file_size = VALUES(file_size),
            file_data = VALUES(file_data),
            updated_at = CURRENT_TIMESTAMP
        `, [caseId, file, buffer.length, buffer]);
      }

      // Avatars
      const avMatch = file.match(/^avatar-(\d+)\.(png|jpg|jpeg)$/i);
      if (avMatch) {
        const userId = Number(avMatch[1]);
        const ext = avMatch[2].toLowerCase();
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const filePath = path.join(uploadsDir, file);
        const buffer = fs.readFileSync(filePath);
        const [userExists] = await systemDB.query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
        if (userExists.length === 0) {
          console.log(`Skipping avatar ${file} - User #${userId} does not exist in users table.`);
          continue;
        }
        console.log(`Migrating avatar ${file} (User #${userId}, ${buffer.length} bytes)...`);
        await systemDB.query(`
          INSERT INTO user_avatars (user_id, file_name, mime_type, file_size, file_data)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            file_name = VALUES(file_name),
            mime_type = VALUES(mime_type),
            file_size = VALUES(file_size),
            file_data = VALUES(file_data),
            updated_at = CURRENT_TIMESTAMP
        `, [userId, file, mime, buffer.length, buffer]);
      }
    }
  }

  const [matRows] = await systemDB.query('SELECT case_id, file_name, file_size, updated_at FROM case_study_materials');
  console.log('Current case_study_materials:', matRows);

  const [avRows] = await systemDB.query('SELECT user_id, file_name, file_size, updated_at FROM user_avatars');
  console.log('Current user_avatars:', avRows);

  console.log('Persistent uploads setup completed successfully!');
  process.exit(0);
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
