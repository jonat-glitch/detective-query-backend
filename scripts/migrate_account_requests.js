const mysql = require('mysql2/promise');

async function migrate() {
  try {
    const conn = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '4AjTs4MyTKCrsiP.root',
      password: 'Xkoew4eyG3Wlu5ZS',
      database: 'detective_query',
      ssl: { rejectUnauthorized: false }
    });

    console.log('Connected to TiDB Cloud.');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS account_change_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        request_type ENUM('change_section', 'change_password') NOT NULL,
        old_value VARCHAR(255) NULL,
        new_value VARCHAR(255) NOT NULL,
        reason TEXT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        reject_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ Table account_change_requests verified/created in TiDB Cloud.');

    const [tables] = await conn.query("SHOW TABLES LIKE 'account_change_requests'");
    console.log('Tables check:', tables);

    await conn.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Error:', error);
    process.exit(1);
  }
}

migrate();
