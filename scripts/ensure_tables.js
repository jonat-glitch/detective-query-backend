const { systemDB } = require('../db');

async function run() {
    console.log("Checking and creating tables on active systemDB...");

    await systemDB.query(`
        CREATE TABLE IF NOT EXISTS otp_verifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            otp_key VARCHAR(255) NOT NULL,
            otp_code VARCHAR(10) NOT NULL,
            expires_at BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_otp_key (otp_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ otp_verifications verified/created");

    await systemDB.query(`
        CREATE TABLE IF NOT EXISTS session_objectives (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_id INT,
            user_id INT,
            objective_text TEXT,
            is_completed TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ session_objectives verified/created");

    await systemDB.query(`
        CREATE TABLE IF NOT EXISTS user_avatars (
            user_id INT PRIMARY KEY,
            file_name VARCHAR(255),
            mime_type VARCHAR(100),
            file_data LONGBLOB,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ user_avatars verified/created");

    process.exit(0);
}

run().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
});
