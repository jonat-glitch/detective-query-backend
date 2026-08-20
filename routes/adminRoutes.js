const express = require("express");
const router = express.Router();
const { systemDB } = require("../db");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const {
  sendApprovalEmail,
  sendRejectionEmail,
  sendAccountChangeApprovedEmail,
  sendAccountChangeRejectedEmail
} = require("../services/emailService");

// 🔒 All routes here are ADMIN ONLY
router.use(authenticateToken);
router.use(authorizeRole([3]));

// ─────────────────────────────────────────────
// 📊 GET Platform Stats Overview
// GET /api/admin/stats
// ─────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [[studentCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM users WHERE role_id = 1");
    const [[teacherCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM users WHERE role_id = 2");
    const [[adminCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM users WHERE role_id = 3");
    const [[pendingReqCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM registration_requests WHERE status = 'pending'");
    const [[approvedReqCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM registration_requests WHERE status = 'approved'");
    const [[rejectedReqCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM registration_requests WHERE status = 'rejected'");
    const [[pendingChangeReqCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM account_change_requests WHERE status = 'pending'");
    const [[roomCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM rooms");
    const [[caseCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM cases");
    const [[solvedCount]] = await systemDB.query("SELECT COUNT(*) AS total FROM attempts WHERE is_correct = 1");
    const [[totalAttempts]] = await systemDB.query("SELECT COUNT(*) AS total FROM attempts");

    res.json({
      students: studentCount.total || 0,
      teachers: teacherCount.total || 0,
      admins: adminCount.total || 0,
      totalUsers: (studentCount.total || 0) + (teacherCount.total || 0) + (adminCount.total || 0),
      pendingRequests: pendingReqCount.total || 0,
      approvedRequests: approvedReqCount.total || 0,
      rejectedRequests: rejectedReqCount.total || 0,
      pendingChangeRequests: pendingChangeReqCount.total || 0,
      rooms: roomCount.total || 0,
      cases: caseCount.total || 0,
      solvedAttempts: solvedCount.total || 0,
      totalAttempts: totalAttempts.total || 0,
    });
  } catch (error) {
    console.error("Admin fetch stats error:", error);
    res.status(500).json({ error: "Failed to fetch platform stats" });
  }
});

// ─────────────────────────────────────────────
// 📋 GET All Users (Enhanced with details)
// GET /api/admin/users
// ─────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const [users] = await systemDB.query(`
      SELECT 
        u.user_id, 
        u.first_name,
        u.last_name,
        u.full_name, 
        u.email, 
        u.role_id, 
        u.sex,
        u.section,
        u.student_id,
        u.teacher_id,
        u.total_points, 
        u.current_level,
        u.created_at,
        (SELECT COUNT(*) FROM user_case_progress ucp WHERE ucp.user_id = u.user_id AND (ucp.status = 'solved' OR ucp.completed_at IS NOT NULL)) AS solved_cases,
        (SELECT COALESCE(current_streak, 0) FROM user_streaks us WHERE us.user_id = u.user_id LIMIT 1) AS streak
      FROM users u
      ORDER BY u.role_id ASC, u.total_points DESC, u.created_at DESC
    `);

    res.json(users);
  } catch (error) {
    console.error("Admin fetch users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─────────────────────────────────────────────
// 🔄 Update User Role
// PUT /api/admin/users/:id/role
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
// 🔑 Reset User Password
// PUT /api/admin/users/:id/reset-password
// Body: { password: string }
// ─────────────────────────────────────────────
router.put("/users/:id/reset-password", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await systemDB.query(
      "UPDATE users SET password = ? WHERE user_id = ?",
      [hashedPassword, userId]
    );

    // Invalidate refresh tokens for this user
    await systemDB.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ─────────────────────────────────────────────
// 🗑️ Delete User Account
// DELETE /api/admin/users/:id
// ─────────────────────────────────────────────
router.delete("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    // Prevent admin from deleting themselves
    if (req.user.user_id === userId) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }

    // Clean up related records
    await systemDB.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM user_streaks WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM user_case_progress WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM user_achievements WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM room_students WHERE student_id = ?", [userId]);
    await systemDB.query("DELETE FROM attempts WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM notifications WHERE recipient_id = ?", [userId]);

    // Finally delete user
    await systemDB.query("DELETE FROM users WHERE user_id = ?", [userId]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─────────────────────────────────────────────
// 🕵️ GET All Cases
// GET /api/admin/cases
// ─────────────────────────────────────────────
router.get("/cases", async (req, res) => {
  try {
    const [cases] = await systemDB.query(`
      SELECT 
        c.case_id,
        c.title,
        c.description,
        c.base_points,
        c.base_points AS points_reward,
        c.is_active,
        c.difficulty_id,
        d.difficulty_name,
        (SELECT COUNT(*) FROM attempts a WHERE a.case_id = c.case_id AND a.is_correct = 1) AS solved_count
      FROM cases c
      LEFT JOIN difficulty d ON c.difficulty_id = d.difficulty_id
      ORDER BY c.difficulty_id ASC, c.case_id ASC
    `);

    res.json(cases);
  } catch (error) {
    console.error("Admin fetch cases error:", error);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

// ─────────────────────────────────────────────
// 🔘 Toggle Case Active/Inactive
// PUT /api/admin/cases/:id/toggle
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
// 🏫 GET All Classrooms / Rooms Monitor
// GET /api/admin/rooms
// ─────────────────────────────────────────────
router.get("/rooms", async (req, res) => {
  try {
    const [rooms] = await systemDB.query(`
      SELECT 
        r.room_id,
        r.room_name,
        r.room_code,
        1 AS is_active,
        r.created_at,
        u.full_name AS teacher_name,
        u.email AS teacher_email,
        (SELECT COUNT(*) FROM room_students rs WHERE rs.room_id = r.room_id) AS student_count
      FROM rooms r
      LEFT JOIN users u ON r.teacher_id = u.user_id
      ORDER BY r.created_at DESC
    `);

    res.json(rooms);
  } catch (error) {
    console.error("Admin fetch rooms error:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// ─────────────────────────────────────────────
// 📢 System-Wide Broadcast Announcement
// POST /api/admin/broadcast
// Body: { message: string, target_role?: number, notification_type?: string }
// ─────────────────────────────────────────────
router.post("/broadcast", async (req, res) => {
  try {
    const { message, target_role, notification_type } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Broadcast message cannot be empty" });
    }

    let userQuery = "SELECT user_id FROM users";
    const queryParams = [];

    if (target_role && [1, 2, 3].includes(Number(target_role))) {
      userQuery += " WHERE role_id = ?";
      queryParams.push(Number(target_role));
    }

    const [recipients] = await systemDB.query(userQuery, queryParams);

    if (recipients.length === 0) {
      return res.json({ message: "No recipients found for this broadcast." });
    }

    const notifType = notification_type || "announcement";
    const senderId = req.user.user_id;

    // Bulk insert notifications
    const insertValues = recipients.map(u => [
      u.user_id,
      senderId,
      message.trim(),
      0,
      notifType
    ]);

    try {
      await systemDB.query(
        `INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type) VALUES ?`,
        [insertValues]
      );
    } catch (notifErr) {
      console.warn('[Broadcast] Notice insertion warning:', notifErr.message);
    }

    res.json({
      message: `Broadcast successfully sent to ${recipients.length} user(s).`,
      count: recipients.length
    });
  } catch (error) {
    console.error("Admin broadcast error:", error);
    res.status(500).json({ error: "Failed to send broadcast" });
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

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
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
    const [rows] = await systemDB.query(
      `SELECT * FROM registration_requests WHERE request_id = ? AND status = 'pending'`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pending request not found" });
    }

    const r = rows[0];
    const full_name = `${r.first_name} ${r.last_name}`;

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

    if (r.role_id == 2) {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await systemDB.query(
        `INSERT INTO rooms (teacher_id, room_name, room_code) VALUES (?, ?, ?)`,
        [newUserId, `${full_name}'s Room`, roomCode]
      );
    }

    await systemDB.query(
      `UPDATE registration_requests SET status = 'approved', reviewed_at = NOW() WHERE request_id = ?`,
      [requestId]
    );

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

// ─────────────────────────────────────────────
// 🗑️ DELETE a Registration Request (Purge)
// DELETE /api/admin/requests/:id
// ─────────────────────────────────────────────
router.delete("/requests/:id", async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    await systemDB.query("DELETE FROM registration_requests WHERE request_id = ?", [requestId]);
    res.json({ message: "Registration request deleted." });
  } catch (error) {
    console.error("Delete request error:", error);
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// ─────────────────────────────────────────────
// ✏️ Direct Edit User Section (Admin Direct Action)
// PUT /api/admin/users/:id/section
// Body: { section: string }
// ─────────────────────────────────────────────
router.put("/users/:id/section", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { section } = req.body;

    const [userRows] = await systemDB.query("SELECT full_name, email FROM users WHERE user_id = ?", [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const formattedSection = section ? String(section).trim().toUpperCase() : null;

    await systemDB.query(
      "UPDATE users SET section = ? WHERE user_id = ?",
      [formattedSection, userId]
    );

    // Notify user
    try {
      await systemDB.query(
        "INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type) VALUES (?, ?, ?, 0, ?)",
        [
          userId,
          req.user?.user_id || 1,
          `Your section was updated to ${formattedSection || 'Unassigned'} by Administrator.`,
          'announcement'
        ]
      );
    } catch (notifErr) {
      console.warn('[Notification] Notice insertion warning:', notifErr.message);
    }

    res.json({
      message: `Section updated to ${formattedSection || 'Unassigned'} for ${userRows[0].full_name}.`,
      success: true
    });
  } catch (error) {
    console.error("Admin update section error:", error);
    res.status(500).json({ error: "Failed to update section" });
  }
});

// ─────────────────────────────────────────────
// 📥 GET All Account Change Requests (Section & Password)
// GET /api/admin/change-requests?status=pending|approved|rejected
// ─────────────────────────────────────────────
router.get("/change-requests", async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT 
        acr.request_id,
        acr.user_id,
        acr.request_type,
        acr.old_value,
        CASE 
          WHEN acr.request_type = 'change_password' THEN '•••••• (Encrypted)'
          ELSE acr.new_value 
        END AS new_value,
        acr.reason,
        acr.status,
        acr.reject_reason,
        acr.created_at,
        acr.reviewed_at,
        u.first_name,
        u.last_name,
        u.full_name,
        u.email,
        u.role_id,
        u.student_id,
        u.teacher_id,
        u.section AS current_user_section
      FROM account_change_requests acr
      JOIN users u ON acr.user_id = u.user_id
    `;
    const params = [];

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query += ' WHERE acr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY acr.created_at DESC';

    const [rows] = await systemDB.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Fetch change requests error:", error);
    res.status(500).json({ error: "Failed to fetch change requests" });
  }
});

// ─────────────────────────────────────────────
// ✅ APPROVE an Account Change Request
// POST /api/admin/change-requests/:id/approve
// ─────────────────────────────────────────────
router.post("/change-requests/:id/approve", async (req, res) => {
  const requestId = Number(req.params.id);

  try {
    const [rows] = await systemDB.query(
      `SELECT acr.*, u.full_name, u.email, u.role_id 
       FROM account_change_requests acr
       JOIN users u ON acr.user_id = u.user_id
       WHERE acr.request_id = ? AND acr.status = 'pending'`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pending change request not found" });
    }

    const r = rows[0];

    if (r.request_type === 'change_section') {
      // Update section in database
      await systemDB.query(
        "UPDATE users SET section = ? WHERE user_id = ?",
        [r.new_value, r.user_id]
      );
    } else if (r.request_type === 'change_password') {
      // Update password hash in database
      await systemDB.query(
        "UPDATE users SET password = ? WHERE user_id = ?",
        [r.new_value, r.user_id]
      );
      // Invalidate existing sessions
      await systemDB.query("DELETE FROM refresh_tokens WHERE user_id = ?", [r.user_id]);
    }

    // Mark request approved
    await systemDB.query(
      `UPDATE account_change_requests 
       SET status = 'approved', reviewed_at = NOW() 
       WHERE request_id = ?`,
      [requestId]
    );

    // Notify user in-app (wrapped in try-catch so it never breaks the main flow)
    try {
      const actionDesc = r.request_type === 'change_section' ? `section change to ${r.new_value}` : 'password reset';
      await systemDB.query(
        "INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type) VALUES (?, ?, ?, 0, ?)",
        [
          r.user_id,
          req.user?.user_id || 1,
          `Your request for ${actionDesc} has been APPROVED by the administrator.`,
          'announcement'
        ]
      );
    } catch (notifErr) {
      console.warn('[Notification] Notice insertion warning:', notifErr.message);
    }

    // Send email notification via Brevo
    sendAccountChangeApprovedEmail({
      to: r.email,
      fullName: r.full_name,
      requestType: r.request_type,
      newValue: r.request_type === 'change_section' ? r.new_value : 'New Password'
    }).catch(err => console.error('[EmailService] Failed to send account change approval email:', err));

    res.json({
      message: `Request approved. ${r.request_type === 'change_section' ? `Section updated to ${r.new_value}` : 'Password reset'} for ${r.full_name}.`,
      success: true
    });

  } catch (error) {
    console.error("Approve change request error:", error);
    res.status(500).json({ error: error.message || "Failed to approve change request" });
  }
});

// ─────────────────────────────────────────────
// ❌ REJECT an Account Change Request
// POST /api/admin/change-requests/:id/reject
// Body: { reason?: string }
// ─────────────────────────────────────────────
router.post("/change-requests/:id/reject", async (req, res) => {
  const requestId = Number(req.params.id);
  const { reason } = req.body || {};

  try {
    const [rows] = await systemDB.query(
      `SELECT acr.*, u.full_name, u.email 
       FROM account_change_requests acr
       JOIN users u ON acr.user_id = u.user_id
       WHERE acr.request_id = ? AND acr.status = 'pending'`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pending change request not found" });
    }

    const r = rows[0];

    // Mark request rejected
    await systemDB.query(
      `UPDATE account_change_requests 
       SET status = 'rejected', reject_reason = ?, reviewed_at = NOW() 
       WHERE request_id = ?`,
      [reason || null, requestId]
    );

    // Notify user in-app
    try {
      const actionDesc = r.request_type === 'change_section' ? 'section change' : 'password reset';
      await systemDB.query(
        "INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type) VALUES (?, ?, ?, 0, ?)",
        [
          r.user_id,
          req.user?.user_id || 1,
          `Your request for ${actionDesc} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
          'warning'
        ]
      );
    } catch (notifErr) {
      console.warn('[Notification] Notice insertion warning:', notifErr.message);
    }

    // Send email notification via Brevo
    sendAccountChangeRejectedEmail({
      to: r.email,
      fullName: r.full_name,
      requestType: r.request_type,
      reason: reason || null
    }).catch(err => console.error('[EmailService] Failed to send account change rejection email:', err));

    res.json({
      message: `Request rejected for ${r.full_name}.`,
      success: true
    });

  } catch (error) {
    console.error("Reject change request error:", error);
    res.status(500).json({ error: error.message || "Failed to reject change request" });
  }
});

// ─────────────────────────────────────────────
// 🗑️ DELETE an Account Change Request
// DELETE /api/admin/change-requests/:id
// ─────────────────────────────────────────────
router.delete("/change-requests/:id", async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    await systemDB.query("DELETE FROM account_change_requests WHERE request_id = ?", [requestId]);
    res.json({ message: "Change request deleted." });
  } catch (error) {
    console.error("Delete change request error:", error);
    res.status(500).json({ error: "Failed to delete change request" });
  }
});

module.exports = router;