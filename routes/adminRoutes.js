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
// 📋 GET All Users (Enhanced with academic alignment & demographics)
// GET /api/admin/users
// ─────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const [users] = await systemDB.query(`
      SELECT 
        u.user_id, 
        u.first_name,
        u.middle_name,
        u.last_name,
        u.extension_name,
        u.full_name, 
        u.email, 
        u.role_id, 
        u.avatar,
        u.sex,
        u.gender,
        u.civil_status,
        u.birthday,
        u.section AS raw_section,
        COALESCE(s.section_name, u.section) AS section,
        u.student_id,
        u.teacher_id,
        u.total_points, 
        u.current_level,
        u.created_at,
        -- Academic Enrollment details (for students)
        se.enrollment_id,
        se.course_id,
        c.course_code,
        c.course_name,
        se.section_id,
        s.section_name,
        se.year_level,
        se.semester_id,
        sem.school_year,
        sem.term AS semester_term,
        sem.is_active AS semester_is_active,
        -- Solved Cases & Streak
        (SELECT COUNT(*) FROM user_case_progress ucp WHERE ucp.user_id = u.user_id AND (ucp.status = 'Completed' OR ucp.status = 'solved' OR ucp.completed_at IS NOT NULL)) AS solved_cases,
        (SELECT COALESCE(current_streak, 0) FROM user_streaks us WHERE us.user_id = u.user_id LIMIT 1) AS streak,
        -- Teacher Assignment count (for teachers)
        (SELECT COUNT(*) FROM teacher_section_assignments tsa WHERE tsa.teacher_id = u.user_id AND tsa.is_archived = 0) AS teacher_assignments_count
      FROM users u
      LEFT JOIN (
        SELECT se1.*
        FROM student_enrollments se1
        JOIN (
          SELECT user_id, MAX(enrollment_id) AS max_id
          FROM student_enrollments
          GROUP BY user_id
        ) latest ON se1.enrollment_id = latest.max_id
      ) se ON se.user_id = u.user_id
      LEFT JOIN courses c ON c.course_id = se.course_id
      LEFT JOIN sections s ON s.section_id = se.section_id
      LEFT JOIN semesters sem ON sem.semester_id = se.semester_id
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

    // Invalidate refresh tokens so user is forced to get fresh token with new role
    await systemDB.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

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

    // Fetch user details first (for email-based cleanups)
    const [[targetUser]] = await systemDB.query(
      "SELECT user_id, email, student_id, teacher_id FROM users WHERE user_id = ?",
      [userId]
    );

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1. Clean up user tokens & change requests
    await systemDB.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM account_change_requests WHERE user_id = ?", [userId]);

    // 2. Clean up gameplay progress, notes, and achievements
    await systemDB.query("DELETE FROM user_streaks WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM user_case_progress WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM user_achievements WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM case_notes WHERE user_id = ?", [userId]);
    await systemDB.query("DELETE FROM attempts WHERE user_id = ?", [userId]);
    // BUG-15 FIX: Wrap in try-catch in case table doesn't exist yet
    try { await systemDB.query("DELETE FROM session_objectives WHERE user_id = ?", [userId]); } catch (_) {}
    await systemDB.query("DELETE FROM room_students WHERE student_id = ?", [userId]);

    // 3. Clean up notifications (both received and sent)
    await systemDB.query("DELETE FROM notifications WHERE user_id = ? OR sender_id = ?", [userId, userId]);

    // 4. Clean up any registration requests tied to this user's email
    if (targetUser.email) {
      await systemDB.query("DELETE FROM registration_requests WHERE email = ?", [targetUser.email.toLowerCase().trim()]);
    }

    // 5. If user is a teacher, clean up their rooms and game sessions
    const [teacherRooms] = await systemDB.query("SELECT room_id FROM rooms WHERE teacher_id = ?", [userId]);
    if (teacherRooms.length > 0) {
      const roomIds = teacherRooms.map(r => r.room_id);
      await systemDB.query("DELETE FROM room_students WHERE room_id IN (?)", [roomIds]);
      await systemDB.query("DELETE FROM game_sessions WHERE room_id IN (?)", [roomIds]);
      await systemDB.query("DELETE FROM rooms WHERE teacher_id = ?", [userId]);
    }

    // 6. Finally delete user
    await systemDB.query("DELETE FROM users WHERE user_id = ?", [userId]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: error.message || "Failed to delete user" });
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
        c.objectives,
        c.base_points,
        c.base_points AS points_reward,
        c.is_active,
        c.difficulty_id,
        c.sql_type,
        c.mode,
        c.correct_query,
        c.unlock_xp_required,
        d.difficulty_name,
        (SELECT COUNT(*) FROM attempts a WHERE a.case_id = c.case_id) AS total_attempts,
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
// ⚡ Bulk Update Cases Status
// PUT /api/admin/cases/bulk-status
// ─────────────────────────────────────────────
router.put("/cases/bulk-status", async (req, res) => {
  try {
    const { is_active, case_ids } = req.body;
    const targetStatus = is_active ? 1 : 0;

    if (Array.isArray(case_ids) && case_ids.length > 0) {
      await systemDB.query(
        `UPDATE cases SET is_active = ? WHERE case_id IN (${case_ids.map(() => '?').join(',')})`,
        [targetStatus, ...case_ids]
      );
    } else {
      await systemDB.query(`UPDATE cases SET is_active = ?`, [targetStatus]);
    }

    res.json({ message: `Successfully ${is_active ? 'enabled' : 'disabled'} cases` });
  } catch (error) {
    console.error("Bulk update cases error:", error);
    res.status(500).json({ error: "Failed to bulk update cases" });
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
        COALESCE(r.is_archived, 0) AS is_archived,
        r.created_at,
        u.full_name  AS teacher_name,
        u.email      AS teacher_email,
        s.section_name,
        c.course_code,
        sem.school_year, sem.term,
        (SELECT COUNT(*) 
           FROM room_students rs 
           WHERE rs.room_id = r.room_id AND rs.status = 'Approved') AS student_count,
        (SELECT COUNT(*) 
           FROM game_sessions gs 
           WHERE gs.room_id = r.room_id 
             AND gs.status = 'Active' 
             AND (gs.end_time > NOW() OR gs.is_paused = 1)) AS has_active_session
      FROM rooms r
      LEFT JOIN users u   ON r.teacher_id   = u.user_id
      LEFT JOIN sections s   ON s.section_id   = r.section_id
      LEFT JOIN courses c    ON c.course_id    = r.course_id
      LEFT JOIN semesters sem ON sem.semester_id = r.semester_id
      ORDER BY has_active_session DESC, r.created_at DESC
    `);

    res.json(rooms);
  } catch (error) {
    console.error("Admin fetch rooms error:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});


// ─────────────────────────────────────────────
// 🔒 ADMIN: Force-Archive a Room
// POST /api/admin/rooms/:room_id/archive
// ─────────────────────────────────────────────
router.post("/rooms/:room_id/archive", async (req, res) => {
  try {
    const { room_id } = req.params;
    const [room] = await systemDB.query(`SELECT room_id FROM rooms WHERE room_id = ?`, [room_id]);
    if (room.length === 0) return res.status(404).json({ error: "Room not found" });

    // End any active game sessions
    await systemDB.query(
      `UPDATE game_sessions SET status = 'Ended', end_time = NOW()
       WHERE room_id = ? AND status IN ('Active', 'Paused')`,
      [room_id]
    );
    // Archive room
    await systemDB.query(
      `UPDATE rooms SET is_archived = 1, archived_at = NOW() WHERE room_id = ?`,
      [room_id]
    );

    res.json({ message: "Room force-archived by admin" });
  } catch (error) {
    console.error("Admin archive room error:", error);
    res.status(500).json({ error: "Failed to archive room" });
  }
});

// ─────────────────────────────────────────────
// 🔒 ADMIN: Force-End Active Game in a Room
// POST /api/admin/rooms/:room_id/end-game
// ─────────────────────────────────────────────
router.post("/rooms/:room_id/end-game", async (req, res) => {
  try {
    const { room_id } = req.params;
    await systemDB.query(
      `UPDATE game_sessions SET status = 'Ended', end_time = NOW()
       WHERE room_id = ? AND status = 'Active'`,
      [room_id]
    );
    res.json({ message: "Active game ended by admin" });
  } catch (error) {
    console.error("Admin end-game error:", error);
    res.status(500).json({ error: "Failed to end game" });
  }
});

// ─────────────────────────────────────────────
// 🔒 ADMIN: Permanently Delete a Room
// DELETE /api/admin/rooms/:room_id
// ─────────────────────────────────────────────
router.delete("/rooms/:room_id", async (req, res) => {
  try {
    const { room_id } = req.params;
    const [room] = await systemDB.query(`SELECT room_id FROM rooms WHERE room_id = ?`, [room_id]);
    if (room.length === 0) return res.status(404).json({ error: "Room not found" });

    const [sessions] = await systemDB.query(
      `SELECT session_id FROM game_sessions WHERE room_id = ?`, [room_id]
    );
    const sessionIds = sessions.map(s => s.session_id);
    if (sessionIds.length > 0) {
      await systemDB.query(`DELETE FROM session_objectives WHERE session_id IN (?)`, [sessionIds]);
    }
    await systemDB.query(`DELETE FROM attempts WHERE room_id = ?`, [room_id]);
    await systemDB.query(`DELETE FROM game_sessions WHERE room_id = ?`, [room_id]);
    await systemDB.query(`DELETE FROM room_students WHERE room_id = ?`, [room_id]);
    await systemDB.query(`DELETE FROM rooms WHERE room_id = ?`, [room_id]);

    res.json({ message: "Room permanently deleted by admin" });
  } catch (error) {
    console.error("Admin delete room error:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
});

// ─────────────────────────────────────────────
// 🔒 ADMIN: Get Students in a Room
// GET /api/admin/rooms/:room_id/students
// ─────────────────────────────────────────────
router.get("/rooms/:room_id/students", async (req, res) => {
  try {
    const { room_id } = req.params;
    const [students] = await systemDB.query(
      `SELECT DISTINCT u.user_id, u.full_name, u.email, u.student_id, u.avatar, rs.status
       FROM room_students rs
       JOIN users u ON rs.student_id = u.user_id
       WHERE rs.room_id = ?
       ORDER BY u.full_name ASC`,
      [room_id]
    );
    res.json(students);
  } catch (error) {
    console.error("Admin get room students error:", error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// ─────────────────────────────────────────────
// 🔒 ADMIN: Get Room Leaderboard
// GET /api/admin/rooms/:room_id/leaderboard
// ─────────────────────────────────────────────
router.get("/rooms/:room_id/leaderboard", async (req, res) => {
  try {
    const { room_id } = req.params;
    const [rows] = await systemDB.query(
      `SELECT
         u.user_id, u.full_name, u.student_id, u.avatar,
         COALESCE(SUM(a.score_awarded), 0)            AS total_score,
         COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) AS correct_answers,
         COUNT(a.attempt_id)                          AS total_attempts,
         MAX(a.attempt_date)                          AS last_attempt
       FROM room_students rs
       JOIN users u ON rs.student_id = u.user_id
       LEFT JOIN attempts a ON a.user_id = u.user_id AND a.room_id = ?
       WHERE rs.room_id = ? AND rs.status = 'Approved'
       GROUP BY u.user_id, u.full_name, u.student_id
       ORDER BY total_score DESC, correct_answers DESC`,
      [room_id, room_id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Admin leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ─────────────────────────────────────────────
// 🔒 ADMIN: Get Room Session Logs
// GET /api/admin/rooms/:room_id/sessions
// ─────────────────────────────────────────────
router.get("/rooms/:room_id/sessions", async (req, res) => {
  try {
    const { room_id } = req.params;
    const [sessions] = await systemDB.query(
      `SELECT
         gs.session_id, gs.status, gs.created_at, gs.end_time,
         c.title AS case_title,
         (SELECT COUNT(DISTINCT a.user_id) FROM attempts a WHERE a.room_id = gs.room_id AND a.session_id = gs.session_id) AS participants,
         (SELECT COUNT(*) FROM attempts a WHERE a.room_id = gs.room_id AND a.session_id = gs.session_id AND a.is_correct = 1) AS correct_total
       FROM game_sessions gs
       LEFT JOIN cases c ON gs.case_id = c.case_id
       WHERE gs.room_id = ?
       ORDER BY gs.created_at DESC
       LIMIT 20`,
      [room_id]
    );
    res.json(sessions);
  } catch (error) {
    console.error("Admin session logs error:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});


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
    const full_name = [
      r.first_name,
      r.middle_name  ? r.middle_name  : null,
      r.last_name,
      r.extension_name ? r.extension_name : null
    ].filter(Boolean).join(' ');

    const [result] = await systemDB.query(
      `INSERT INTO users
        (first_name, middle_name, last_name, extension_name, full_name,
         sex, gender, civil_status, birthday,
         email, password, role_id, student_id, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.first_name,
        r.middle_name     || null,
        r.last_name,
        r.extension_name  || null,
        full_name,
        r.sex             || null,
        r.gender          || null,
        r.civil_status    || null,
        r.birthday        || null,
        r.email,
        r.password_hash,
        r.role_id,
        r.student_id      || null,
        r.teacher_id      || null
      ]
    );

    const newUserId = result.insertId;

    // ── If student: create enrollment + auto-join room ──
    if (r.role_id == 1 && r.section_id && r.semester_id) {
      // 1. Create student enrollment record
      try {
        await systemDB.query(
          `INSERT IGNORE INTO student_enrollments
           (user_id, course_id, year_level, section_id, semester_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            newUserId,
            r.course_id  || null,
            r.year_level || null,
            r.section_id,
            r.semester_id
          ]
        );
      } catch (enrollErr) {
        console.warn('[Approve] student_enrollments insert warning:', enrollErr.message);
      }

      // 2. Auto-join matching rooms (section)
      try {
        const [matchingRooms] = await systemDB.query(
          `SELECT room_id FROM rooms WHERE section_id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
          [r.section_id]
        );
        for (const mr of matchingRooms) {
          await systemDB.query(
            `INSERT INTO room_students (room_id, student_id, status)
             VALUES (?, ?, 'Approved')
             ON DUPLICATE KEY UPDATE status = 'Approved'`,
            [mr.room_id, newUserId]
          );
        }
      } catch (roomErr) {
        console.warn('[Approve] room auto-join warning:', roomErr.message);
      }

      // 3. Mark student number as used
      if (r.student_number) {
        try {
          await systemDB.query(
            `UPDATE allowed_student_numbers SET is_used = 1 WHERE student_number = ?`,
            [r.student_number]
          );
        } catch (asnErr) {
          console.warn('[Approve] allowed_student_numbers mark-used warning:', asnErr.message);
        }
      }
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

    // If section exists in sections table, also update/link in student_enrollments
    if (formattedSection) {
      const [secRows] = await systemDB.query("SELECT section_id FROM sections WHERE section_name = ? AND is_archived = 0 LIMIT 1", [formattedSection]);
      if (secRows.length > 0) {
        const sectionId = secRows[0].section_id;
        const [[activeSem]] = await systemDB.query("SELECT semester_id FROM semesters WHERE is_active = 1 LIMIT 1");
        if (activeSem) {
          const [existing] = await systemDB.query("SELECT enrollment_id FROM student_enrollments WHERE user_id = ? AND semester_id = ? LIMIT 1", [userId, activeSem.semester_id]);
          if (existing.length > 0) {
            await systemDB.query("UPDATE student_enrollments SET section_id = ? WHERE enrollment_id = ?", [sectionId, existing[0].enrollment_id]);
          } else {
            await systemDB.query("INSERT INTO student_enrollments (user_id, section_id, semester_id, created_at) VALUES (?, ?, ?, NOW())", [userId, sectionId, activeSem.semester_id]);
          }
        }
      }
    }

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
// 🎓 Comprehensive Academic Alignment Update
// PUT /api/admin/users/:id/academic
// Body: { course_id, section_id, year_level, semester_id, student_id, teacher_id }
// ─────────────────────────────────────────────
router.put("/users/:id/academic", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { course_id, section_id, year_level, semester_id, student_id, teacher_id } = req.body;

    const [userRows] = await systemDB.query("SELECT role_id, full_name, email FROM users WHERE user_id = ?", [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRows[0];

    // If teacher, update teacher_id
    if (user.role_id === 2) {
      const formattedTeacherId = teacher_id ? String(teacher_id).trim() : null;
      await systemDB.query("UPDATE users SET teacher_id = ? WHERE user_id = ?", [formattedTeacherId, userId]);
      return res.json({ message: `Teacher ID updated for ${user.full_name}`, success: true });
    }

    // For students:
    const formattedStudentId = student_id ? String(student_id).trim() : null;

    // Get section name to keep legacy users.section in sync
    let sectionName = null;
    if (section_id) {
      const [[sec]] = await systemDB.query("SELECT section_name FROM sections WHERE section_id = ?", [section_id]);
      if (sec) sectionName = sec.section_name;
    }

    // Determine target semester (use passed semester_id or active semester)
    let targetSemesterId = semester_id ? Number(semester_id) : null;
    if (!targetSemesterId) {
      const [[activeSem]] = await systemDB.query("SELECT semester_id FROM semesters WHERE is_active = 1 LIMIT 1");
      if (activeSem) targetSemesterId = activeSem.semester_id;
    }

    // Update users table for fast lookup / backward compatibility
    await systemDB.query(
      "UPDATE users SET student_id = ?, section = COALESCE(?, section) WHERE user_id = ?",
      [formattedStudentId, sectionName, userId]
    );

    // Upsert into student_enrollments if semester and any academic fields exist
    if (targetSemesterId && (section_id || course_id || year_level)) {
      const [existing] = await systemDB.query(
        "SELECT enrollment_id FROM student_enrollments WHERE user_id = ? AND semester_id = ? LIMIT 1",
        [userId, targetSemesterId]
      );

      if (existing.length > 0) {
        await systemDB.query(
          `UPDATE student_enrollments 
           SET course_id = ?, section_id = ?, year_level = ?
           WHERE enrollment_id = ?`,
          [
            course_id ? Number(course_id) : null,
            section_id ? Number(section_id) : null,
            year_level ? Number(year_level) : null,
            existing[0].enrollment_id
          ]
        );
      } else {
        await systemDB.query(
          `INSERT INTO student_enrollments (user_id, course_id, section_id, year_level, semester_id, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            userId,
            course_id ? Number(course_id) : null,
            section_id ? Number(section_id) : null,
            year_level ? Number(year_level) : null,
            targetSemesterId
          ]
        );
      }
    }

    // Notify user of update
    try {
      await systemDB.query(
        "INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type) VALUES (?, ?, ?, 0, ?)",
        [
          userId,
          req.user?.user_id || 1,
          `Your academic profile has been aligned by Administrator.`,
          'announcement'
        ]
      );
    } catch (_) {}

    res.json({ message: `Academic profile updated successfully for ${user.full_name}`, success: true });
  } catch (error) {
    console.error("Admin update academic error:", error);
    res.status(500).json({ error: error.message || "Failed to update academic profile" });
  }
});

// ─────────────────────────────────────────────
// 👤 Edit User Personal Profile (Demographics)
// PUT /api/admin/users/:id/profile
// ─────────────────────────────────────────────
router.put("/users/:id/profile", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { first_name, middle_name, last_name, extension_name, email, gender, sex, civil_status, birthday } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    if (birthday) {
      const birthDate = new Date(birthday);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (isNaN(birthDate.getTime()) || birthDate > today || birthDate.getFullYear() < 1900) {
        return res.status(400).json({ error: "Please enter a valid birthday (cannot be in the future)." });
      }
    }

    // Check email uniqueness
    const [existingEmail] = await systemDB.query(
      "SELECT user_id FROM users WHERE email = ? AND user_id != ?",
      [email.trim().toLowerCase(), userId]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "Email is already in use by another account" });
    }

    const fullName = [first_name.trim(), middle_name?.trim(), last_name.trim(), extension_name?.trim()].filter(Boolean).join(" ");

    await systemDB.query(
      `UPDATE users SET 
        first_name = ?,
        middle_name = ?,
        last_name = ?,
        extension_name = ?,
        full_name = ?,
        email = ?,
        gender = ?,
        sex = ?,
        civil_status = ?,
        birthday = ?
       WHERE user_id = ?`,
      [
        first_name.trim(),
        middle_name ? middle_name.trim() : null,
        last_name.trim(),
        extension_name ? extension_name.trim() : null,
        fullName,
        email.trim().toLowerCase(),
        gender || null,
        sex || null,
        civil_status || null,
        birthday || null,
        userId
      ]
    );

    res.json({ message: "User profile updated successfully", success: true });
  } catch (error) {
    console.error("Admin update profile error:", error);
    res.status(500).json({ error: error.message || "Failed to update user profile" });
  }
});

// ─────────────────────────────────────────────
// 🧑‍🏫 GET Teacher Assigned Classes
// GET /api/admin/users/:id/teacher-assignments
// ─────────────────────────────────────────────
router.get("/users/:id/teacher-assignments", async (req, res) => {
  try {
    const teacherId = Number(req.params.id);
    const [assignments] = await systemDB.query(
      `SELECT 
        tsa.assignment_id,
        tsa.teacher_id,
        tsa.section_id,
        s.section_name,
        tsa.course_id,
        c.course_code,
        c.course_name,
        tsa.year_level,
        tsa.semester_id,
        sem.school_year,
        sem.term,
        tsa.subject_name,
        tsa.created_at,
        tsa.is_archived
       FROM teacher_section_assignments tsa
       LEFT JOIN sections s ON s.section_id = tsa.section_id
       LEFT JOIN courses c ON c.course_id = tsa.course_id
       LEFT JOIN semesters sem ON sem.semester_id = tsa.semester_id
       WHERE tsa.teacher_id = ?
       ORDER BY tsa.is_archived ASC, tsa.created_at DESC`,
      [teacherId]
    );
    res.json(assignments);
  } catch (error) {
    console.error("Admin fetch teacher assignments error:", error);
    res.status(500).json({ error: "Failed to fetch teacher assignments" });
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
        u.avatar,
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
    } else if (r.request_type === 'change_email') {
      const [existing] = await systemDB.query(
        "SELECT user_id FROM users WHERE email = ? AND user_id != ?",
        [r.new_value, r.user_id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: "This email address is already in use by another account" });
      }
      // Update email in database
      await systemDB.query(
        "UPDATE users SET email = ? WHERE user_id = ?",
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
      const actionDesc = r.request_type === 'change_section' ? `section change to ${r.new_value}` : r.request_type === 'change_email' ? `email change to ${r.new_value}` : 'password reset';
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

    // Send email notification via Brevo to the new email address
    const targetEmail = r.request_type === 'change_email' ? r.new_value : r.email;
    sendAccountChangeApprovedEmail({
      to: targetEmail,
      fullName: r.full_name,
      requestType: r.request_type,
      newValue: r.request_type === 'change_section' ? r.new_value : r.request_type === 'change_email' ? r.new_value : 'New Password'
    }).catch(err => console.error('[EmailService] Failed to send account change approval email:', err));

    res.json({
      message: `Request approved. ${r.request_type === 'change_section' ? `Section updated to ${r.new_value}` : r.request_type === 'change_email' ? `Email updated to ${r.new_value}` : 'Password reset'} for ${r.full_name}.`,
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
      const actionDesc = r.request_type === 'change_section' ? 'section change' : r.request_type === 'change_email' ? 'email change' : 'password reset';
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