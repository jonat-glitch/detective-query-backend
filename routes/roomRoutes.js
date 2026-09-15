const express = require('express');
const router = express.Router();
const { systemDB, playgroundDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const submissionService = require('../services/submissionService');
const path = require('path');
const fs = require('fs');

// ── Idempotent migration: ensure pause & archive columns exist ────────────────
(async () => {
  try {
    await systemDB.query(`ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS is_paused TINYINT(1) NOT NULL DEFAULT 0`);
    await systemDB.query(`ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS paused_at DATETIME NULL`);
    await systemDB.query(`ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS paused_seconds INT NOT NULL DEFAULT 0`);
    await systemDB.query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0`);
    await systemDB.query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL`);
  } catch (e) {
    // Columns may already exist on some DB flavours — safe to ignore
  }
})();

router.post('/create-room',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const teacherId = req.user.user_id;
            let { room_name, room_code } = req.body;

            if (!room_name || !room_name.trim()) {
                return res.status(400).json({ error: "Room name is required" });
            }
            room_name = room_name.trim();

            if (room_code && room_code.trim()) {
                room_code = room_code.trim().toUpperCase();
                if (!/^[A-Z0-9]{3,10}$/.test(room_code)) {
                    return res.status(400).json({ error: "Room code must be 3-10 alphanumeric characters (letters and numbers only)." });
                }

                // Check if code is already in use
                const [existing] = await systemDB.query(
                    `SELECT room_id FROM rooms WHERE room_code = ?`,
                    [room_code]
                );
                if (existing.length > 0) {
                    return res.status(400).json({ error: "This room code is already in use. Please choose another code or generate a random one." });
                }
            } else {
                // Generate a unique random code
                let code = '';
                let isUnique = false;
                let attempts = 0;
                while (!isUnique && attempts < 10) {
                    code = Math.random().toString(36).substring(2, 8).toUpperCase();
                    const [dup] = await systemDB.query(`SELECT 1 FROM rooms WHERE room_code = ?`, [code]);
                    if (dup.length === 0) isUnique = true;
                    attempts++;
                }
                room_code = code;
            }

            const [result] = await systemDB.query(
                `INSERT INTO rooms (teacher_id, room_name, room_code, is_archived)
                 VALUES (?, ?, ?, 0)`,
                [teacherId, room_name, room_code]
            );

            res.json({
                message: "Room created",
                room_id: result.insertId,
                room_code: room_code
            });

        } catch (error) {
            console.error('Create room error:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: "This room code is already in use. Please choose another code." });
            }
            res.status(500).json({ error: "Failed to create room" });
        }
    }
);

router.post('/broadcast/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const { message } = req.body;
            const teacherId = req.user.user_id;

            if (!message || !message.trim()) {
                return res.status(400).json({ error: "Message cannot be empty" });
            }

            const [students] = await systemDB.query(
                `SELECT student_id FROM room_students WHERE room_id = ? AND status = 'Approved'`,
                [room_id]
            );

            if (students.length === 0) {
                return res.status(400).json({ error: "No approved students in this room to receive broadcast." });
            }

            const recipientIds = students.map(s => s.student_id);

            for (const uid of recipientIds) {
                await systemDB.query(
                    `INSERT INTO notifications (user_id, sender_id, message, is_read) VALUES (?, ?, ?, 0)`,
                    [uid, teacherId, `📢 [ROOM ANNOUNCEMENT]: ${message}`]
                );
            }

            res.json({ message: "Broadcast sent successfully", count: recipientIds.length });
        } catch (err) {
            console.error("Broadcast error:", err);
            res.status(500).json({ error: "Failed to broadcast message" });
        }
    }
);

router.post('/join-room',
    authenticateToken,
    authorizeRole([1]),
    async (req, res) => {
        try {
            const studentId = req.user.user_id;
            const { room_code, room_id } = req.body;

            if (!room_code || !room_code.trim()) {
                return res.status(400).json({ error: "Room code is required" });
            }

            const cleanCode = room_code.trim().toUpperCase();

            let room;
            if (room_id) {
                // When student joins from a specific room card, strictly validate the code against that room
                const [targetRooms] = await systemDB.query(
                    `SELECT * FROM rooms WHERE room_id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
                    [room_id]
                );

                if (targetRooms.length === 0) {
                    return res.status(404).json({ error: "Room not found or no longer available" });
                }

                const targetRoom = targetRooms[0];
                if ((targetRoom.room_code || '').trim().toUpperCase() !== cleanCode) {
                    return res.status(400).json({
                        error: `Invalid code for "${targetRoom.room_name}". The code you entered does not match this room.`
                    });
                }
                room = targetRoom;
            } else {
                // Fallback if no specific room_id was provided
                const [rooms] = await systemDB.query(
                    `SELECT * FROM rooms WHERE UPPER(TRIM(room_code)) = ? AND (is_archived = 0 OR is_archived IS NULL)`,
                    [cleanCode]
                );

                if (rooms.length === 0) {
                    return res.status(404).json({ error: "Invalid room code" });
                }

                room = rooms[0];
            }

            const [existing] = await systemDB.query(
                `SELECT * FROM room_students
                 WHERE room_id = ? AND student_id = ?`,
                [room.room_id, studentId]
            );

            if (existing.length > 0) {
                const status = existing[0].status;
              
                if (status === 'Approved') {
                  return res.json({
                    message: "Already approved",
                    status: "Approved",
                    room_id: room.room_id
                  });
                }
              
                if (status === 'Pending') {
                  return res.status(403).json({
                    error: "Waiting for teacher approval"
                  });
                }

                if (status === 'Rejected') {
                  return res.status(403).json({
                    error: "You were rejected from this room"
                  });
                }
            }

            await systemDB.query(
                `INSERT INTO room_students (room_id, student_id, status)
                 VALUES (?, ?, 'Pending')`,
                [room.room_id, studentId]
            );

            res.json({
                message: "Join request sent",
                status: "Pending",
                room_id: room.room_id
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Join request failed" });
        }
    }
);


router.get('/my-rooms',
    authenticateToken,
    async (req, res) => {
        try {
            const userId = req.user.user_id;
            const roleId = req.user.role_id;
            const isArchived = req.query.archived === 'true' ? 1 : 0;

            if (roleId === 2) {
                // Teacher's created rooms
                const [rooms] = await systemDB.query(
                    `SELECT room_id, room_name, room_code, is_archived, archived_at,
                            (SELECT COUNT(*) FROM room_students rs WHERE rs.room_id = rooms.room_id AND rs.status = 'Approved') AS student_count
                     FROM rooms
                     WHERE teacher_id = ? AND (is_archived = ? OR (? = 0 AND is_archived IS NULL))
                     ORDER BY room_id DESC`,
                    [userId, isArchived, isArchived]
                );
                return res.json(rooms);
            } else {
                // Student's joined & approved rooms
                const [rooms] = await systemDB.query(
                    `SELECT r.room_id, r.room_name, r.room_code
                     FROM room_students rs
                     JOIN rooms r ON r.room_id = rs.room_id
                     WHERE rs.student_id = ? AND rs.status = 'Approved'
                       AND (r.is_archived = 0 OR r.is_archived IS NULL)
                     ORDER BY r.room_id DESC`,
                    [userId]
                );
                return res.json(rooms);
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch rooms" });
        }
    }
);

router.get('/available', authenticateToken, authorizeRole([1]), async (req, res) => {
      try {
        // Auto-end expired sessions first
        await systemDB.query(`
          UPDATE game_sessions
          SET status = 'Ended'
          WHERE (status = 'Active' OR LOWER(status) = 'active') AND end_time <= NOW()
        `);

        const [rooms] = await systemDB.query(`
          SELECT
            r.room_id,
            r.room_name,
            u.full_name AS teacher_name,

            CASE
              WHEN MAX(gs.status) = 'Active' AND MAX(gs.end_time) <= NOW() THEN 'ended'
              WHEN MAX(gs.status) IS NOT NULL THEN LOWER(MAX(gs.status))
              ELSE 'scheduled'
            END AS status,

            MAX(gs.difficulty_id) AS difficulty,

            -- ✅ REAL TIME LEFT (in minutes)
            CASE
                WHEN MAX(gs.status) = 'Active' AND MAX(gs.end_time) > NOW() THEN
                    GREATEST(
                        TIMESTAMPDIFF(MINUTE, NOW(), MAX(gs.end_time)),
                        0
                    )
                ELSE NULL
            END AS room_duration,

            COUNT(rs.student_id) AS student_count

        FROM rooms r

        JOIN users u
            ON r.teacher_id = u.user_id

        LEFT JOIN (
            SELECT * FROM game_sessions
            WHERE status = 'Active' OR status = 'active'
        ) gs
            ON gs.room_id = r.room_id

        LEFT JOIN room_students rs
            ON rs.room_id = r.room_id
            AND rs.status = 'Approved'

        WHERE (r.is_archived = 0 OR r.is_archived IS NULL)

        GROUP BY r.room_id, r.room_name, u.full_name;
        `);

        res.json({ rooms });

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch rooms" });
      }
    }
);


router.get('/requests/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            // 🔒 Verify teacher owns this room
            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms
                 WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );

            if (room.length === 0) {
                return res.status(403).json({ error: "Not your room" });
            }

            const [results] = await systemDB.query(
                `SELECT rs.room_students_id, u.full_name, rs.status
                 FROM room_students rs
                 JOIN users u ON rs.student_id = u.user_id
                 WHERE rs.room_id = ? AND rs.status = 'Pending'`,
                [room_id]
            );

            res.json(results);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch requests" });
        }
    }
);

router.post('/approve/:id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const teacherId = req.user.user_id;

            // 🔍 Get request + verify ownership
            const [request] = await systemDB.query(
                `SELECT rs.room_id
                 FROM room_students rs
                 JOIN rooms r ON rs.room_id = r.room_id
                 WHERE rs.room_students_id = ?
                 AND r.teacher_id = ?`,
                [id, teacherId]
            );

            if (request.length === 0) {
                return res.status(403).json({ error: "Not allowed" });
            }

            await systemDB.query(
                `UPDATE room_students
                 SET status = 'Approved'
                 WHERE room_students_id = ?`,
                [id]
            );

            res.json({ message: "Student approved" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Approval failed" });
        }
    }
);

router.post('/reject/:id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const teacherId = req.user.user_id;

            // 🔍 Get request + verify ownership
            const [request] = await systemDB.query(
                `SELECT rs.room_id
                 FROM room_students rs
                 JOIN rooms r ON rs.room_id = r.room_id
                 WHERE rs.room_students_id = ?
                 AND r.teacher_id = ?`,
                [id, teacherId]
            );

            if (request.length === 0) {
                return res.status(403).json({ error: "Not allowed" });
            }

            await systemDB.query(
                `UPDATE room_students
                 SET status = 'Rejected'
                 WHERE room_students_id = ?`,
                [id]
            );

            res.json({ message: "Rejected" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Rejection failed" });
        }
    }
);

router.get('/:room_id/status',
    authenticateToken,
    authorizeRole([1]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const studentId = req.user.user_id;

            const [result] = await systemDB.query(
                `SELECT status FROM room_students
                 WHERE room_id = ? AND student_id = ?`,
                [room_id, studentId]
            );

            if (result.length === 0) {
                return res.json({ status: "Not Joined" });
            }

            res.json({ status: result[0].status });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch join status" });
        }
    }
);

router.post('/activate',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id, case_id, difficulty_id, duration_minutes, personal_time_limit } = req.body;
            const teacherId = req.user.user_id;

            // ✅ Verify ownership
            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms
                 WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );

            if (room.length === 0) {
                return res.status(403).json({ error: "Not your room" });
            }

            await systemDB.query(
                `UPDATE game_sessions
                 SET status = 'Ended'
                 WHERE room_id = ?
                 AND status = 'Active'`,
                [room_id]
            );

            const [result] = await systemDB.query(
                `INSERT INTO game_sessions
                 (room_id, case_id, difficulty_id, start_time, end_time, status, personal_time_limit)
                 VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE), 'Active', ?)`,
                 [room_id, case_id, difficulty_id, duration_minutes, personal_time_limit]
            );

            // 🔥 Reset playground when game starts
            const [caseData] = await systemDB.query(
                `SELECT dataset_id FROM cases WHERE case_id = ?`,
                [case_id]
            );

            if (caseData.length > 0 && caseData[0].dataset_id) {
                const submissionService = require('../services/submissionService');
                await submissionService.resetPlayground(caseData[0].dataset_id);
            }

            res.json({
                message: "Game activated",
                session_id: result.insertId
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to activate game" });
        }
    }
);

// ── END GAME ──────────────────────────────────────────────────────────────────
router.post('/end-game/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            // Verify ownership
            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );
            if (room.length === 0) {
                return res.status(403).json({ error: "Not your room" });
            }

            // End all active sessions for this room
            await systemDB.query(
                `UPDATE game_sessions
                 SET status = 'Ended', end_time = NOW()
                 WHERE room_id = ? AND status = 'Active'`,
                [room_id]
            );

            res.json({ message: "Game ended successfully" });
        } catch (error) {
            console.error("End game error:", error);
            res.status(500).json({ error: "Failed to end game" });
        }
    }
);

// ── PAUSE GAME ────────────────────────────────────────────────────────────────
router.post('/pause/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });

            await systemDB.query(
                `UPDATE game_sessions
                 SET is_paused = 1, paused_at = NOW()
                 WHERE room_id = ? AND status = 'Active' AND is_paused = 0`,
                [room_id]
            );

            res.json({ message: 'Game paused' });
        } catch (error) {
            console.error('Pause game error:', error);
            res.status(500).json({ error: 'Failed to pause game' });
        }
    }
);

// ── RESUME GAME ───────────────────────────────────────────────────────────────
router.post('/resume/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });

            // Extend end_time by the elapsed pause duration so students don't lose time
            await systemDB.query(
                `UPDATE game_sessions
                 SET end_time = DATE_ADD(end_time, INTERVAL TIMESTAMPDIFF(SECOND, paused_at, NOW()) SECOND),
                     paused_seconds = paused_seconds + TIMESTAMPDIFF(SECOND, paused_at, NOW()),
                     is_paused = 0,
                     paused_at = NULL
                 WHERE room_id = ? AND status = 'Active' AND is_paused = 1`,
                [room_id]
            );

            // Return updated end_time so teacher can sync its local timer
            const [sessions] = await systemDB.query(
                `SELECT end_time FROM game_sessions WHERE room_id = ? AND status = 'Active' LIMIT 1`,
                [room_id]
            );

            res.json({
                message: 'Game resumed',
                end_time: sessions[0]?.end_time || null
            });
        } catch (error) {
            console.error('Resume game error:', error);
            res.status(500).json({ error: 'Failed to resume game' });
        }
    }
);

// ── ARCHIVE ROOM ─────────────────────────────────────────────────────────────
router.post('/archive/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });

            // End any active game session in this room
            await systemDB.query(
                `UPDATE game_sessions SET status = 'Ended', end_time = NOW()
                 WHERE room_id = ? AND status IN ('Active', 'Paused')`,
                [room_id]
            );

            // Mark room as archived
            await systemDB.query(
                `UPDATE rooms SET is_archived = 1, archived_at = NOW() WHERE room_id = ?`,
                [room_id]
            );

            res.json({ message: 'Room archived successfully' });
        } catch (error) {
            console.error('Archive room error:', error);
            res.status(500).json({ error: 'Failed to archive room' });
        }
    }
);

// ── RESTORE ROOM ─────────────────────────────────────────────────────────────
router.post('/restore/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });

            await systemDB.query(
                `UPDATE rooms SET is_archived = 0, archived_at = NULL WHERE room_id = ?`,
                [room_id]
            );

            res.json({ message: 'Room restored successfully' });
        } catch (error) {
            console.error('Restore room error:', error);
            res.status(500).json({ error: 'Failed to restore room' });
        }
    }
);

// ── PERMANENTLY DELETE ROOM ──────────────────────────────────────────────────
router.delete('/permanent/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ? AND is_archived = 1`,
                [room_id, teacherId]
            );
            if (room.length === 0) {
                return res.status(400).json({ error: 'Room must be archived first before permanent deletion' });
            }

            // Clean up child records in dependency order
            const [sessions] = await systemDB.query(
                `SELECT session_id FROM game_sessions WHERE room_id = ?`,
                [room_id]
            );
            const sessionIds = sessions.map(s => s.session_id);

            if (sessionIds.length > 0) {
                await systemDB.query(
                    `DELETE FROM session_objectives WHERE session_id IN (?)`,
                    [sessionIds]
                );
            }

            await systemDB.query(`DELETE FROM attempts WHERE room_id = ?`, [room_id]);
            await systemDB.query(`DELETE FROM game_sessions WHERE room_id = ?`, [room_id]);
            await systemDB.query(`DELETE FROM room_students WHERE room_id = ?`, [room_id]);
            await systemDB.query(`DELETE FROM rooms WHERE room_id = ?`, [room_id]);

            res.json({ message: 'Room permanently deleted' });
        } catch (error) {
            console.error('Permanent delete room error:', error);
            res.status(500).json({ error: 'Failed to permanently delete room' });
        }
    }
);

router.get('/active/:room_id',
    authenticateToken,
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const userId = req.user.user_id;
            const role = req.user.role_id;

            // ==============================
            // 🔐 ACCESS CONTROL
            // ==============================

            if (role === 2) {
                // Teacher must own room
                const [room] = await systemDB.query(
                    `SELECT 1 FROM rooms
                     WHERE room_id = ? AND teacher_id = ?`,
                    [room_id, userId]
                );

                if (room.length === 0) {
                    return res.status(403).json({ error: "Not your room" });
                }
            } else {
                // Student must be approved member
                const [member] = await systemDB.query(
                    `SELECT 1 FROM room_students
                     WHERE room_id = ?
                     AND student_id = ?
                     AND status = 'Approved'`,
                    [room_id, userId]
                );

                if (member.length === 0) {
                    return res.status(403).json({ error: "Access denied" });
                }
            }

            // ==============================
            // 🎮 GET ACTIVE SESSION
            // ==============================

            const [sessions] = await systemDB.query(
                `SELECT 
                    gs.session_id,
                    gs.room_id,
                    gs.case_id,
                    gs.personal_time_limit,
                    gs.end_time,
                    gs.is_paused,
                    gs.paused_at,
                    c.title,
                    c.description,
                    c.objectives AS case_objectives_text,
                    c.mode
                 FROM game_sessions gs
                 JOIN cases c ON gs.case_id = c.case_id
                 WHERE gs.room_id = ?
                 AND gs.status = 'Active'
                 AND (gs.end_time > NOW() OR gs.is_paused = 1)
                 LIMIT 1`,
                [room_id]
            );

            if (sessions.length === 0) {
                return res.json({ active: false, error: "No active game" });
            }

            const session = sessions[0];

            // ==============================
            // 🎯 FETCH OBJECTIVES WITH STATUS
            // ==============================

            const [objectives] = await systemDB.query(
                `SELECT 
                    co.objective_id,
                    co.objective_text,
                    co.objective_order,
                    co.points,
                    CASE 
                        WHEN so.is_completed = 1 THEN 1
                        ELSE 0
                    END AS is_completed
                 FROM case_objectives co
                 LEFT JOIN session_objectives so
                    ON co.objective_id = so.objective_id
                    AND so.session_id = ?
                    AND so.user_id = ?
                 WHERE co.case_id = ?
                 ORDER BY co.objective_order ASC`,
                [
                    session.session_id,
                    userId,
                    session.case_id
                ]
            );

            // Check study material PDF (from TiDB persistent storage or disk)
            let hasMaterial = false;
            try {
                const [matRows] = await systemDB.query(
                    'SELECT case_id FROM case_study_materials WHERE case_id = ?',
                    [session.case_id]
                );
                const uploadsDir = path.join(__dirname, '../uploads');
                const pdfPath = path.join(uploadsDir, `study-material-${session.case_id}.pdf`);
                hasMaterial = matRows.length > 0 || fs.existsSync(pdfPath);
            } catch (matErr) {
                const uploadsDir = path.join(__dirname, '../uploads');
                const pdfPath = path.join(uploadsDir, `study-material-${session.case_id}.pdf`);
                hasMaterial = fs.existsSync(pdfPath);
            }
            const study_material_url = hasMaterial
                ? `${req.protocol}://${req.get('host')}/uploads/study-material-${session.case_id}.pdf`
                : null;

            // ==============================
            // 📦 FINAL RESPONSE
            // ==============================

            res.json({
                session_id: session.session_id,
                room_id: session.room_id,
                case_id: session.case_id,
                title: session.title,
                description: session.description,
                case_objectives_text: session.case_objectives_text,
                personal_time_limit: session.personal_time_limit,
                end_time: session.end_time,
                is_paused: session.is_paused === 1,
                paused_at: session.paused_at,
                mode: session.mode,
                objectives,
                study_material_url
            });

        } catch (error) {
            console.error("ACTIVE SESSION ERROR:", error);
            res.status(500).json({ error: "Failed to fetch active game" });
        }
    }
);

router.get('/leaderboard/:room_id',
    authenticateToken,
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const userId = req.user.user_id;
            const role = req.user.role_id;

            if (role === 2) {
                const [room] = await systemDB.query(
                    `SELECT 1 FROM rooms
                     WHERE room_id = ? AND teacher_id = ?`,
                    [room_id, userId]
                );

                if (room.length === 0) {
                    return res.status(403).json({ error: "Not your room" });
                }
            } else {
                const [member] = await systemDB.query(
                    `SELECT 1 FROM room_students
                     WHERE room_id = ?
                     AND student_id = ?
                     AND status = 'Approved'`,
                    [room_id, userId]
                );

                if (member.length === 0) {
                    return res.status(403).json({ error: "Access denied" });
                }
            }

            // 🔥 Get active session (or latest session if completed)
            const [activeSession] = await systemDB.query(
                `SELECT session_id
                FROM game_sessions
                WHERE room_id = ?
                ORDER BY (status = 'Active') DESC, session_id DESC
                LIMIT 1`,
                [room_id]
            );

            if (activeSession.length === 0) {
                return res.json([]); // no active session
            }

            const sessionId = activeSession[0].session_id;

            const [results] = await systemDB.query(
                `SELECT
                    u.user_id,
                    u.full_name,
                    CAST(COALESCE(fa.score_awarded, so.total_objective_points, 0) AS SIGNED) AS total_score,
                    COALESCE(so.completed_objectives, 0) AS completed_objectives,
                    CASE WHEN fa.is_correct = 1 THEN 1 ELSE 0 END AS solved_cases,
                    MIN(CASE WHEN a.sql_query != 'START_SESSION' AND a.sql_query != 'TIME_EXPIRED' THEN a.time_taken END) AS best_time,
                    RANK() OVER (
                        ORDER BY 
                            CAST(COALESCE(fa.score_awarded, so.total_objective_points, 0) AS SIGNED) DESC,
                            COALESCE(so.completed_objectives, 0) DESC,
                            CASE WHEN fa.is_correct = 1 THEN 1 ELSE 0 END DESC
                    ) AS ranking
                FROM room_students rs
                JOIN users u ON rs.student_id = u.user_id
                LEFT JOIN (
                    SELECT user_id, SUM(points_awarded) AS total_objective_points, COUNT(*) AS completed_objectives
                    FROM session_objectives
                    WHERE session_id = ? AND is_completed = 1
                    GROUP BY user_id
                ) so ON so.user_id = u.user_id
                LEFT JOIN (
                    SELECT a1.user_id, a1.score_awarded, a1.is_correct
                    FROM attempts a1
                    WHERE a1.session_id = ? AND a1.final_answer IS NOT NULL
                ) fa ON fa.user_id = u.user_id
                LEFT JOIN attempts a
                    ON a.user_id = u.user_id
                    AND a.session_id = ?
                    AND a.mode = 'Rank'
                WHERE rs.room_id = ?
                AND rs.status = 'Approved'
                GROUP BY u.user_id, u.full_name, fa.score_awarded, so.total_objective_points, so.completed_objectives, fa.is_correct`,
                [sessionId, sessionId, sessionId, room_id]
            );

            res.json(results);

        } catch (error) {
            console.error("LEADERBOARD ERROR:", error);
            res.status(500).json({ error: error.message });
        }
    }
);

// ─── RESET ROOM (teacher use) ─────────────────────────────────────────────────
router.post('/reset/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;

            // End any active game session for this room
            await systemDB.query(
                `UPDATE game_sessions SET status = 'ended', end_time = NOW()
                 WHERE room_id = ? AND status IN ('active', 'paused')`,
                [room_id]
            );

            res.json({ message: 'Room reset successfully' });
        } catch (error) {
            console.error('Reset room error:', error);
            res.status(500).json({ error: 'Failed to reset room' });
        }
    }
);

// ─── GET Difficulties (teacher use) ──────────────────────────────────────────
router.get('/difficulties',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const [rows] = await systemDB.query(
                `SELECT difficulty_id, difficulty_name FROM difficulty ORDER BY difficulty_id ASC`
            );
            res.json(rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch difficulties' });
        }
    }
);

router.get('/cases',

    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { type } = req.query;
            const params = [];
            let where = 'WHERE is_active = 1';
            if (type && ['DQL','DML','DDL'].includes(type)) {
                where += ' AND sql_type = ?';
                params.push(type);
            }
            const [cases] = await systemDB.query(
                `SELECT case_id, title, description, difficulty_id, sql_type, setup_sql, expected_result_sql, dataset_id
                 FROM cases
                 ${where}
                 ORDER BY sql_type, difficulty_id, case_id`,
                params
            );
            res.json(cases);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch cases" });
        }
    }
);

// ─── GET practice cases for students (DQL / DML / DDL) ─────────────────────
router.get('/practice-cases',
    authenticateToken,
    authorizeRole([1]),
    async (req, res) => {
        try {
            const { type } = req.query;
            if (!type || !['DQL','DML','DDL'].includes(type)) {
                return res.status(400).json({ error: 'type must be DQL, DML, or DDL' });
            }
            const [cases] = await systemDB.query(
                `SELECT c.case_id, c.title, c.description, c.objectives, c.base_points, c.difficulty_id, c.sql_type,
                        d.difficulty_name
                 FROM cases c
                 JOIN difficulty d ON c.difficulty_id = d.difficulty_id
                 WHERE c.is_active = 1 AND c.sql_type = ?
                 ORDER BY d.difficulty_id, c.case_id`,
                [type]
            );
            res.json(cases);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch practice cases' });
        }
    }
);

// ─── CREATE CASE (teacher) ─────────────────────────────────────────────────
router.post('/create-case',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { title, description, difficulty_id, sql_type, setup_sql, expected_result_sql, dataset_id, correct_query, correct_suspect_id } = req.body;
            if (!title || !description || !difficulty_id || !sql_type) {
                return res.status(400).json({ error: 'title, description, difficulty_id, sql_type are required' });
            }
            if (!['DQL','DML','DDL'].includes(sql_type)) {
                return res.status(400).json({ error: 'sql_type must be DQL, DML, or DDL' });
            }
            const [result] = await systemDB.query(
                `INSERT INTO cases (title, description, difficulty_id, sql_type, setup_sql, expected_result_sql, dataset_id, correct_query, correct_suspect_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [title, description, difficulty_id, sql_type, setup_sql || null, expected_result_sql || null, dataset_id || 1, correct_query || null, correct_suspect_id || null]
            );
            res.json({ message: 'Case created', case_id: result.insertId });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create case' });
        }
    }
);

// ─── UPDATE CASE (teacher) ─────────────────────────────────────────────────
router.put('/cases/:case_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { case_id } = req.params;
            const { title, description, difficulty_id, sql_type, setup_sql, expected_result_sql, dataset_id, correct_query, correct_suspect_id, is_active } = req.body;
            await systemDB.query(
                `UPDATE cases
                 SET title = COALESCE(?, title),
                     description = COALESCE(?, description),
                     difficulty_id = COALESCE(?, difficulty_id),
                     sql_type = COALESCE(?, sql_type),
                     setup_sql = ?,
                     expected_result_sql = ?,
                     dataset_id = COALESCE(?, dataset_id),
                     correct_query = COALESCE(?, correct_query),
                     correct_suspect_id = ?,
                     is_active = COALESCE(?, is_active)
                 WHERE case_id = ?`,
                [title, description, difficulty_id, sql_type, setup_sql, expected_result_sql, dataset_id, correct_query, correct_suspect_id !== undefined ? correct_suspect_id : null, is_active, case_id]
            );
            res.json({ message: 'Case updated' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update case' });
        }
    }
);

// ─── GET CASE OBJECTIVES (teacher) ──────────────────────────────────────────
router.get('/cases/:case_id/objectives',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { case_id } = req.params;
            const [objectives] = await systemDB.query(
                `SELECT objective_id, case_id, objective_text, objective_order, points, validation_type, required_keyword, expected_query
                 FROM case_objectives
                 WHERE case_id = ?
                 ORDER BY objective_order ASC`,
                [case_id]
            );
            res.json(objectives);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch case objectives' });
        }
    }
);

// ─── SAVE CASE OBJECTIVES (teacher) ──────────────────────────────────────────
router.post('/cases/:case_id/objectives',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { case_id } = req.params;
            const { objectives } = req.body;

            await systemDB.query(
                `DELETE FROM case_objectives WHERE case_id = ?`,
                [case_id]
            );

            if (Array.isArray(objectives) && objectives.length > 0) {
                for (let i = 0; i < objectives.length; i++) {
                    const obj = objectives[i];
                    if (!obj.objective_text || !obj.objective_text.trim()) continue;
                    await systemDB.query(
                        `INSERT INTO case_objectives
                         (case_id, objective_text, objective_order, points, validation_type, required_keyword, expected_query)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            case_id,
                            obj.objective_text.trim(),
                            i + 1,
                            Number(obj.points) || 50,
                            obj.validation_type || 'pattern',
                            obj.required_keyword || null,
                            obj.expected_query || null
                        ]
                    );
                }
            }

            res.json({ message: 'Objectives saved successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to save case objectives' });
        }
    }
);

router.delete('/cases/:case_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { case_id } = req.params;
            await systemDB.query(
                `UPDATE cases SET is_active = 0 WHERE case_id = ?`,
                [case_id]
            );
            res.json({ message: 'Case deactivated' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to delete case' });
        }
    }
);


router.get('/students/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            // Verify ownership
            const [room] = await systemDB.query(
                `SELECT 1 FROM rooms
                 WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );

            if (room.length === 0) {
                return res.status(403).json({ error: "Not your room" });
            }

            const [students] = await systemDB.query(
                `SELECT u.user_id, u.full_name
                 FROM room_students rs
                 JOIN users u ON rs.student_id = u.user_id
                 WHERE rs.room_id = ?
                 AND rs.status = 'Approved'`,
                [room_id]
            );

            res.json(students);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch students" });
        }
    }
);

router.get('/rank/suspects/:room_id',
    authenticateToken,
    async (req, res) => {
      try {
        const { room_id } = req.params;
        const userId = req.user.user_id;

        // 🔒 Check student is approved or teacher/admin
        const [member] = await systemDB.query(
          `SELECT 1 FROM room_students
           WHERE room_id = ?
           AND student_id = ?
           AND status = 'Approved'`,
          [room_id, userId]
        );

        if (member.length === 0) {
          const [roomOwner] = await systemDB.query(
            `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
            [room_id, userId]
          );
          if (roomOwner.length === 0 && req.user.role_id !== 3) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        // 🔥 Get active or latest game session + dataset
        const [sessions] = await systemDB.query(
          `SELECT gs.session_id, c.dataset_id
           FROM game_sessions gs
           JOIN cases c ON gs.case_id = c.case_id
           WHERE gs.room_id = ?
           ORDER BY (gs.status = 'Active' OR LOWER(gs.status) = 'active') DESC, gs.session_id DESC
           LIMIT 1`,
          [room_id]
        );

        if (sessions.length === 0) {
          return res.status(404).json({ error: "No game session found" });
        }

        const session = sessions[0];
   
        // Reset playground to correct dataset
        if (session.dataset_id) {
          try {
            await submissionService.resetPlayground(session.dataset_id);
          } catch (err) {
            console.warn("Playground reset warning:", err.message);
          }
        }
  
        // 👤 Fetch suspects with multiple schema fallbacks
        let suspects = [];
        const queries = [
            `SELECT person_id, name, role FROM persons`,
            `SELECT person_id, name FROM persons`,
            `SELECT id AS person_id, name FROM persons`,
            `SELECT id AS person_id, name FROM person`,
            `SELECT person_id, name FROM person`,
            `SELECT id AS person_id, name FROM suspects`,
            `SELECT suspect_id AS person_id, name FROM suspects`
        ];

        for (const q of queries) {
            try {
                const [rows] = await playgroundDB.query(q);
                if (rows && rows.length > 0) {
                    suspects = rows;
                    break;
                }
            } catch (e) {
                // Ignore and try next query format
            }
        }
  
        res.json({ suspects });
  
      } catch (error) {
        console.error("Failed to load suspects:", error);
        res.json({ suspects: [] });
      }
    }
);
router.put("/:id",
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
    const { id } = req.params;
    const { room_name, room_code } = req.body;

    try {
        const teacherId = req.user.user_id;

        // Verify ownership
        const [room] = await systemDB.query(
            `SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?`,
            [id, teacherId]
        );

        if (room.length === 0) {
            return res.status(403).json({ error: "Not your room" });
        }

        const [result] = await systemDB.query(
            "UPDATE rooms SET room_name = ?, room_code = ? WHERE room_id = ?",
            [room_name, room_code, id]
        );

        res.json({ success: true, result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

router.get('/session-logs/:room_id',
    authenticateToken,
    authorizeRole([2]),
    async (req, res) => {
        try {
            const { room_id } = req.params;
            const teacherId = req.user.user_id;

            // 🔒 Verify ownership
            const [room] = await systemDB.query(
                `SELECT room_name FROM rooms
                 WHERE room_id = ? AND teacher_id = ?`,
                [room_id, teacherId]
            );

            if (room.length === 0) {
                return res.status(403).json({ error: "Not your room" });
            }

            // Query ALL rank attempts for this room (no active session required)
            // This lets teachers export logs at any time, not just during live games

            const [results] = await systemDB.query(
                `SELECT 
                    u.student_id,
                    u.full_name,
                    u.email,
                    COALESCE(SUM(a.score_awarded), 0) AS total_score,
                    COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) AS correct_attempts,
                    COUNT(a.attempt_id) AS total_attempts,
                    MIN(a.time_taken) AS best_time_seconds,
                    MAX(a.attempt_date) AS last_attempt
                 FROM room_students rs
                 JOIN users u ON rs.student_id = u.user_id
                 LEFT JOIN attempts a 
                    ON a.user_id = u.user_id 
                    AND a.room_id = ?
                    AND a.mode = 'Rank'
                 WHERE rs.room_id = ? 
                 AND rs.status = 'Approved'
                 GROUP BY u.user_id, u.student_id, u.full_name, u.email
                 ORDER BY total_score DESC, best_time_seconds ASC`,
                [room_id, room_id]
            );

            if (req.query.format === 'json') {
                return res.json(results);
            }

            // Construct CSV
            let csv = 'Student ID,Full Name,Email,Total Score,Correct Attempts,Total Attempts,Best Time (Seconds),Last Attempt\n';
            results.forEach(row => {
                const studentId = row.student_id || 'N/A';
                const fullName = `"${(row.full_name || '').replace(/"/g, '""')}"`;
                const email = row.email || '';
                const totalScore = row.total_score || 0;
                const correctAttempts = row.correct_attempts || 0;
                const totalAttempts = row.total_attempts || 0;
                const bestTime = row.best_time_seconds !== null ? row.best_time_seconds : 'N/A';
                const lastAttempt = row.last_attempt ? new Date(row.last_attempt).toLocaleString() : 'Never';
                
                csv += `${studentId},${fullName},${email},${totalScore},${correctAttempts},${totalAttempts},${bestTime},"${lastAttempt}"\n`;
            });

            const safeRoomName = (room[0].room_name || `Room_${room_id}`).replace(/[^a-z0-9_]/gi, '_');
            const date = new Date().toISOString().slice(0, 10);
            const filename = `Session_Logs_${safeRoomName}_${date}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.status(200).send(csv);

        } catch (error) {
            console.error("SESSION LOGS ERROR:", error);
            res.status(500).json({ error: "Failed to download logs" });
        }
    }
);

module.exports = router;