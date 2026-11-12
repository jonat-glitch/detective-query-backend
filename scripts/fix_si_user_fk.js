const mysql = require('mysql2/promise');
require('dotenv').config();
async function r() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: 'detective_query', ssl: { rejectUnauthorized: false }
  });
  // Check which user_ids are orphaned
  const [orphans] = await c.query(`
    SELECT si.invitation_id, si.user_id, si.email, si.status
    FROM student_invitations si
    LEFT JOIN users u ON si.user_id = u.user_id
    WHERE si.user_id IS NOT NULL AND u.user_id IS NULL
  `);
  console.log('Orphaned student_invitations.user_id rows:', orphans);

  // NULL them out (these are pre-registration placeholders)
  const [res] = await c.query(`
    UPDATE student_invitations
    SET user_id = NULL
    WHERE user_id IS NOT NULL
      AND user_id NOT IN (SELECT user_id FROM users)
  `);
  console.log('Cleared:', res.affectedRows, 'rows');

  // Now apply the FK
  try {
    await c.query(`ALTER TABLE student_invitations
      ADD CONSTRAINT fk_si_user
      FOREIGN KEY (user_id) REFERENCES users(user_id)
      ON DELETE SET NULL ON UPDATE CASCADE`);
    console.log('✅ fk_si_user applied!');
  } catch(e) { console.log('❌', e.message); }

  // Final count
  const [fks] = await c.query(`SELECT COUNT(*) AS cnt FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='detective_query' AND REFERENCED_TABLE_NAME IS NOT NULL`);
  console.log('Total FKs:', fks[0].cnt);
  await c.end();
}
r().catch(console.error);

