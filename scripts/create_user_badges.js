const { systemDB } = require('../db');

(async () => {
  try {
    await systemDB.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        badge_id    VARCHAR(50)  NOT NULL,
        user_id     INT          NOT NULL,
        unlocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (badge_id, user_id),
        CONSTRAINT fk_ub_user FOREIGN KEY (user_id)
          REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    const [r] = await systemDB.query("SHOW TABLES LIKE 'user_badges'");
    console.log('✅ user_badges table:', r.length > 0 ? 'CREATED' : 'NOT FOUND');
  } catch (e) {
    console.error('❌ ERR:', e.message);
  }
  process.exit(0);
})();
