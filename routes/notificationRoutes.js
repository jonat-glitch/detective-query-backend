const express = require("express");
const router = express.Router();
const { systemDB } = require("../db");
const { authenticateToken } = require("../middleware/auth");

// ── Auto-ensure notification_type column exists in notifications table ─────────
systemDB.query(`ALTER TABLE notifications ADD COLUMN notification_type VARCHAR(50) DEFAULT 'announcement'`)
  .then(() => console.log("✅ notifications table updated with notification_type column"))
  .catch(() => { /* Column already exists, safe to ignore */ });

// ── GET all students ──────────────────────────────────────────────
router.get("/students/all", authenticateToken, async (req, res) => {
  try {
    const [rows] = await systemDB.query(
      `SELECT user_id, student_id,
              COALESCE(NULLIF(TRIM(CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,''))), ''), full_name, email) AS full_name,
              section
       FROM users WHERE role_id = 1 ORDER BY full_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// ── GET students by section ───────────────────────────────────────
router.get("/students/section/:section", authenticateToken, async (req, res) => {
  try {
    const { section } = req.params;
    const [rows] = await systemDB.query(
      `SELECT user_id, student_id,
              COALESCE(NULLIF(TRIM(CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,''))), ''), full_name, email) AS full_name,
              section
       FROM users WHERE role_id = 1 AND section = ? ORDER BY full_name ASC`,
      [section]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch section students" });
  }
});

// ── GET teacher's sent history ────────────────────────────────────
router.get("/notifications/sent", authenticateToken, async (req, res) => {
  const senderId = req.user.user_id;
  try {
    let rows;
    try {
      [rows] = await systemDB.query(
        `SELECT
            n.message,
            COALESCE(n.notification_type, 'announcement') AS notification_type,
            MIN(n.created_at) AS created_at,
            COUNT(n.notification_id) AS recipient_count,
            SUM(n.is_read) AS read_count
         FROM notifications n
         WHERE n.sender_id = ?
         GROUP BY n.message, n.notification_type, DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s')
         ORDER BY MIN(n.created_at) DESC
         LIMIT 50`,
        [senderId]
      );
    } catch (colErr) {
      [rows] = await systemDB.query(
        `SELECT
            n.message,
            'announcement' AS notification_type,
            MIN(n.created_at) AS created_at,
            COUNT(n.notification_id) AS recipient_count,
            SUM(n.is_read) AS read_count
         FROM notifications n
         WHERE n.sender_id = ?
         GROUP BY n.message, DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s')
         ORDER BY MIN(n.created_at) DESC
         LIMIT 50`,
        [senderId]
      );
    }
    res.json(rows);
  } catch (err) {
    console.error("Sent history error:", err);
    res.status(500).json({ error: "Failed to fetch sent notifications" });
  }
});

// ── GET unread count ──────────────────────────────────────────────
router.get("/notifications/unread-count/:user_id", authenticateToken, async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await systemDB.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: "Count failed" });
  }
});

// ── GET student inbox ─────────────────────────────────────────────
router.get("/notifications/:user_id", authenticateToken, async (req, res) => {
  const userId = req.params.user_id;
  try {
    let rows;
    try {
      [rows] = await systemDB.query(
        `SELECT
            n.notification_id,
            n.message,
            n.is_read,
            n.created_at,
            COALESCE(n.notification_type, 'announcement') AS notification_type,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.full_name, u.email, 'Instructor') AS sender_name
         FROM notifications n
         LEFT JOIN users u ON u.user_id = n.sender_id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC`,
        [userId]
      );
    } catch (colErr) {
      // Fallback query if notification_type column is missing from DB
      [rows] = await systemDB.query(
        `SELECT
            n.notification_id,
            n.message,
            n.is_read,
            n.created_at,
            'announcement' AS notification_type,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.full_name, u.email, 'Instructor') AS sender_name
         FROM notifications n
         LEFT JOIN users u ON u.user_id = n.sender_id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC`,
        [userId]
      );
    }
    res.json(rows);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// ── POST send notification (supports notification_type) ───────────
router.post("/notifications/send", authenticateToken, async (req, res) => {
  const { message, recipients, notification_type } = req.body;
  const sender_id = req.user.user_id;
  const type = notification_type || "announcement";

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: "No recipients specified" });
  }

  const conn = await systemDB.getConnection();
  try {
    await conn.beginTransaction();
    for (let userId of recipients) {
      try {
        await conn.query(
          `INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type)
           VALUES (?, ?, ?, 0, ?)`,
          [userId, sender_id, message, type]
        );
      } catch (colErr) {
        await conn.query(
          `INSERT INTO notifications (user_id, sender_id, message, is_read) VALUES (?, ?, ?, 0)`,
          [userId, sender_id, message]
        );
      }
    }
    await conn.commit();
    res.json({ success: true, sent_to: recipients.length });
  } catch (err) {
    await conn.rollback();
    console.error("Send notification error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ── PUT mark one notification as read ────────────────────────────
router.put("/notifications/read/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  try {
    await systemDB.query(
      `UPDATE notifications SET is_read = 1 WHERE notification_id = ?`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ── PUT mark ALL notifications as read for a user ─────────────────
router.put("/notifications/read-all/:user_id", authenticateToken, async (req, res) => {
  const userId = req.params.user_id;
  try {
    await systemDB.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Mark all read failed" });
  }
});

// ── DELETE a notification (student dismiss) ───────────────────────
router.delete("/notifications/:id", authenticateToken, async (req, res) => {
  const id = req.params.id;
  try {
    await systemDB.query(
      `DELETE FROM notifications WHERE notification_id = ?`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;