const express = require("express");
const router = express.Router();
const { systemDB } = require("../db");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { sendApprovalEmail, sendRejectionEmail } = require("../services/emailService");

// 🔒 All routes here are ADMIN ONLY
router.use(authenticateToken);
router.use(authorizeRole([3]));

// ─────────────────────────────────────────────
// 📋 Get All Users
// ─────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const [users] = await systemDB.query(`
      SELECT user_id, full_name, email, role_id, total_points, current_level
      FROM users
      ORDER BY role_id ASC, total_points DESC
    `);

    res.json(users);
  } catch (error) {
    console.error("Admin fetch users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─────────────────────────────────────────────
// 🔄 Update User Role
// ─────────────────────────────────────────────
router.put("/users/:id/role", async (req, res) => {
  try {
    const { role_id } = req.body;
    const userId = Number(req.params.id);

    await systemDB.query(
      "UPDATE users SET role_id = ? WHERE user_id = ?",
      [role_id, userId]
    );

    if (req.user.user_id === userId) {
      return res.status(440).json({
        message: "Your role has changed. Please login again."
      });
    }

    res.json({ message: "User role updated successfully" });

  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// ─────────────────────────────────────────────
// 🔘 Toggle Case Active
// ─────────────────────────────────────────────
router.put("/cases/:id/toggle", async (req, res) => {
  try {
    const caseId = req.params.id;

    await systemDB.query(`
      UPDATE cases
      SET is_active = NOT is_active
      WHERE case_id = ?
    `, [caseId]);

    res.json({ message: "Case status updated" });

  } catch (error) {
    console.error("Toggle case error:", error);
    res.status(500).json({ error: "Failed to update case" });
  }
});

// ─────────────────────────────────────────────
// 📥 GET All Registration Requests
// GET /api/admin/requests?status=pending|approved|rejected
// ─────────────────────────────────────────────
router.get("/requests", async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT request_id, first_name, last_name, full_name, email,
             role_id, sex, section, student_id, teacher_id,
             status, reject_reason, requested_at, reviewed_at
      FROM registration_requests
    `;
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY requested_at DESC';

    const [rows] = await systemDB.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Fetch requests error:", error);
    res.status(500).json({ error: "Failed to fetch registration requests" });
  }
});

// ─────────────────────────────────────────────
// ✅ APPROVE a Registration Request
// POST /api/admin/requests/:id/approve
// ─────────────────────────────────────────────
router.post("/requests/:id/approve", async (req, res) => {
  const requestId = Number(req.params.id);

  try {
    // Fetch the pending request
    const [rows] = await systemDB.query(
      `SELECT * FROM registration_requests WHERE request_id = ? AND status = 'pending'`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    const r = rows[0];
    const full_name = `${r.first_name} ${r.last_name}`;

    // Insert into users table
    const [result] = await systemDB.query(
      `INSERT INTO users
        (first_name, last_name, full_name, sex, section, email, password, role_id, student_id, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.first_name,
        r.last_name,
        full_name,
        r.sex || null,
        r.section || null,
        r.email,
        r.password_hash,
        r.role_id,
        r.student_id || null,
        r.teacher_id || null
      ]
    );

    const newUserId = result.insertId;

    // Auto-create room for teachers
    if (r.role_id == 2) {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await systemDB.query(
        `INSERT INTO rooms (teacher_id, room_name, room_code) VALUES (?, ?, ?)`,
        [newUserId, `${full_name}'s Room`, roomCode]
      );
    }

    // Mark request as approved
    await systemDB.query(
      `UPDATE registration_requests SET status = 'approved', reviewed_at = NOW() WHERE request_id = ?`,
      [requestId]
    );

    // Send approval email (non-blocking — don't fail the response if email fails)
    sendApprovalEmail({
      to: r.email,
      fullName: full_name,
      role: r.role_id
    }).catch(err => console.error('[EmailService] Failed to send approval email:', err));

    res.json({ message: `Request approved. User account created for ${full_name}.` });

  } catch (error) {
    console.error("Approve request error:", error);
    res.status(500).json({ error: "Failed to approve request" });
  }
});

// ─────────────────────────────────────────────
// ❌ REJECT a Registration Request
// POST /api/admin/requests/:id/reject
// Body: { reason?: string }
// ─────────────────────────────────────────────
router.post("/requests/:id/reject", async (req, res) => {
  const requestId = Number(req.params.id);
  const { reason } = req.body || {};

  try {
    const [rows] = await systemDB.query(
      `SELECT * FROM registration_requests WHERE request_id = ? AND status = 'pending'`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    const r = rows[0];
    const full_name = `${r.first_name} ${r.last_name}`;

    await systemDB.query(
      `UPDATE registration_requests
       SET status = 'rejected', reject_reason = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [reason || null, requestId]
    );

    // Send rejection email (non-blocking)
    sendRejectionEmail({
      to: r.email,
      fullName: full_name,
      reason: reason || null
    }).catch(err => console.error('[EmailService] Failed to send rejection email:', err));

    res.json({ message: `Request rejected for ${full_name}.` });

  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({ error: "Failed to reject request" });
  }
});

module.exports = router;