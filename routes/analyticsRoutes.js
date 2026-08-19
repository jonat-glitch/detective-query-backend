const express = require('express');
const router = express.Router();
const { systemDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// 🔒 All analytics routes are Teacher/Admin only
router.use(authenticateToken);
router.use(authorizeRole([2, 3]));

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/global
// Global completions by difficulty, across all sql_types
// ──────────────────────────────────────────────────────────────────────────────
router.get('/global', async (req, res) => {
    try {
        const [results] = await systemDB.query(`
            SELECT
                d.difficulty_name,
                COUNT(DISTINCT c.case_id)                                           AS total_cases,
                COUNT(DISTINCT ucp.case_id)                                         AS completed_instances,
                COUNT(DISTINCT ucp.user_id)                                         AS students_completed
            FROM difficulty d
            LEFT JOIN cases c          ON c.difficulty_id = d.difficulty_id AND c.is_active = 1
            LEFT JOIN user_case_progress ucp
                ON ucp.case_id = c.case_id AND ucp.status = 'Completed'
            GROUP BY d.difficulty_id, d.difficulty_name
            ORDER BY d.difficulty_id ASC
        `);
        res.json(results);
    } catch (error) {
        console.error('GLOBAL ANALYTICS ERROR:', error);
        res.status(500).json({ error: 'Failed to load global analytics' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/sql-type-summary
// Global completions broken down by DQL / DML / DDL
// ──────────────────────────────────────────────────────────────────────────────
router.get('/sql-type-summary', async (req, res) => {
    try {
        const [results] = await systemDB.query(`
            SELECT
                c.sql_type,
                COUNT(DISTINCT c.case_id)        AS total_cases,
                COUNT(DISTINCT ucp.case_id)       AS completed_cases,
                COUNT(DISTINCT ucp.user_id)       AS students_completed,
                COUNT(ucp.progress_id)            AS total_completions
            FROM cases c
            LEFT JOIN user_case_progress ucp
                ON ucp.case_id = c.case_id AND ucp.status = 'Completed'
            WHERE c.is_active = 1
            GROUP BY c.sql_type
            ORDER BY c.sql_type ASC
        `);
        res.json(results);
    } catch (error) {
        console.error('SQL TYPE SUMMARY ERROR:', error);
        res.status(500).json({ error: 'Failed to load SQL type summary' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/room/:room_id
// Room-level difficulty breakdown
// ──────────────────────────────────────────────────────────────────────────────
router.get('/room/:room_id', async (req, res) => {
    try {
        const { room_id } = req.params;
        const teacherId = req.user.user_id;

        if (req.user.role_id === 2) {
            const [room] = await systemDB.query(
                'SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?',
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });
        }

        const [results] = await systemDB.query(`
            SELECT
                d.difficulty_name,
                COUNT(DISTINCT a.case_id)   AS completed_cases_count,
                COUNT(a.attempt_id)         AS total_attempts,
                COUNT(DISTINCT a.user_id)   AS active_students
            FROM difficulty d
            JOIN cases c  ON c.difficulty_id = d.difficulty_id
            LEFT JOIN attempts a
                ON a.case_id = c.case_id AND a.room_id = ? AND a.is_correct = 1
            GROUP BY d.difficulty_id, d.difficulty_name
            ORDER BY d.difficulty_id ASC
        `, [room_id]);
        res.json(results);
    } catch (error) {
        console.error('ROOM ANALYTICS ERROR:', error);
        res.status(500).json({ error: 'Failed to load room analytics' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/students/:room_id
// Per-student progress table for a room
// ──────────────────────────────────────────────────────────────────────────────
router.get('/students/:room_id', async (req, res) => {
    try {
        const { room_id } = req.params;
        const teacherId = req.user.user_id;

        if (req.user.role_id === 2) {
            const [room] = await systemDB.query(
                'SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?',
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });
        }

        // All students enrolled in the room
        const [students] = await systemDB.query(`
            SELECT u.user_id, u.full_name, u.total_points, u.current_level,
                   rs.requested_at AS joined_at
            FROM room_students rs
            JOIN users u ON u.user_id = rs.student_id
            WHERE rs.room_id = ? AND rs.status = 'Approved'
            ORDER BY u.full_name ASC
        `, [room_id]);

        if (students.length === 0) return res.json([]);

        const userIds = students.map(s => s.user_id);

        // Attempts summary per student (all modes)
        const [attemptStats] = await systemDB.query(`
            SELECT
                a.user_id,
                COUNT(a.attempt_id)                                   AS total_attempts,
                SUM(a.is_correct)                                     AS correct_attempts,
                SUM(a.score_awarded)                                  AS xp_from_attempts,
                MAX(a.attempt_date)                                   AS last_active,
                COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.case_id END) AS cases_solved
            FROM attempts a
            WHERE a.user_id IN (?)
            GROUP BY a.user_id
        `, [userIds]);

        // DQL / DML / DDL breakdown per student
        const [typeStats] = await systemDB.query(`
            SELECT
                ucp.user_id,
                c.sql_type,
                COUNT(*) AS solved
            FROM user_case_progress ucp
            JOIN cases c ON c.case_id = ucp.case_id
            WHERE ucp.user_id IN (?) AND ucp.status = 'Completed'
            GROUP BY ucp.user_id, c.sql_type
        `, [userIds]);

        // Build lookup maps
        const attemptMap = {};
        for (const a of attemptStats) attemptMap[a.user_id] = a;

        const typeMap = {};
        for (const t of typeStats) {
            if (!typeMap[t.user_id]) typeMap[t.user_id] = {};
            typeMap[t.user_id][t.sql_type] = t.solved;
        }

        const result = students.map(s => {
            const a = attemptMap[s.user_id] || {};
            const t = typeMap[s.user_id] || {};
            const total = Number(a.total_attempts || 0);
            const correct = Number(a.correct_attempts || 0);
            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
            return {
                user_id: s.user_id,
                full_name: s.full_name,
                total_points: s.total_points || 0,
                current_level: s.current_level || 1,
                cases_solved: Number(a.cases_solved || 0),
                total_attempts: total,
                correct_attempts: correct,
                accuracy_pct: accuracy,
                last_active: a.last_active || null,
                dql_solved: t['DQL'] || 0,
                dml_solved: t['DML'] || 0,
                ddl_solved: t['DDL'] || 0,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('STUDENTS ANALYTICS ERROR:', error);
        res.status(500).json({ error: 'Failed to load student analytics' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/export/room/:room_id
// Download CSV report for a room
// ──────────────────────────────────────────────────────────────────────────────
router.get('/export/room/:room_id', async (req, res) => {
    try {
        const { room_id } = req.params;
        const teacherId = req.user.user_id;

        // Verify ownership
        let roomName = `Room_${room_id}`;
        if (req.user.role_id === 2) {
            const [room] = await systemDB.query(
                'SELECT room_name FROM rooms WHERE room_id = ? AND teacher_id = ?',
                [room_id, teacherId]
            );
            if (room.length === 0) return res.status(403).json({ error: 'Not your room' });
            roomName = room[0].room_name;
        } else {
            const [room] = await systemDB.query('SELECT room_name FROM rooms WHERE room_id = ?', [room_id]);
            if (room.length > 0) roomName = room[0].room_name;
        }

        // Reuse the students query logic
        const [students] = await systemDB.query(`
            SELECT u.user_id, u.full_name, u.total_points, u.current_level, rs.requested_at AS joined_at
            FROM room_students rs
            JOIN users u ON u.user_id = rs.student_id
            WHERE rs.room_id = ? AND rs.status = 'Approved'
            ORDER BY u.full_name ASC
        `, [room_id]);

        let rows = [];

        if (students.length > 0) {
            const userIds = students.map(s => s.user_id);

            const [attemptStats] = await systemDB.query(`
                SELECT
                    a.user_id,
                    COUNT(a.attempt_id)                                          AS total_attempts,
                    SUM(a.is_correct)                                            AS correct_attempts,
                    MAX(a.attempt_date)                                          AS last_active,
                    COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.case_id END) AS cases_solved
                FROM attempts a WHERE a.user_id IN (?) GROUP BY a.user_id
            `, [userIds]);

            const [typeStats] = await systemDB.query(`
                SELECT ucp.user_id, c.sql_type, COUNT(*) AS solved
                FROM user_case_progress ucp JOIN cases c ON c.case_id = ucp.case_id
                WHERE ucp.user_id IN (?) AND ucp.status = 'Completed'
                GROUP BY ucp.user_id, c.sql_type
            `, [userIds]);

            const attemptMap = {};
            for (const a of attemptStats) attemptMap[a.user_id] = a;
            const typeMap = {};
            for (const t of typeStats) {
                if (!typeMap[t.user_id]) typeMap[t.user_id] = {};
                typeMap[t.user_id][t.sql_type] = t.solved;
            }

            rows = students.map(s => {
                const a = attemptMap[s.user_id] || {};
                const t = typeMap[s.user_id] || {};
                const total = Number(a.total_attempts || 0);
                const correct = Number(a.correct_attempts || 0);
                const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                return {
                    'Student Name': s.full_name,
                    'Level': s.current_level || 1,
                    'Total XP': s.total_points || 0,
                    'Cases Solved': Number(a.cases_solved || 0),
                    'DQL Solved': t['DQL'] || 0,
                    'DML Solved': t['DML'] || 0,
                    'DDL Solved': t['DDL'] || 0,
                    'Total Attempts': total,
                    'Correct Attempts': correct,
                    'Accuracy (%)': accuracy,
                    'Last Active': a.last_active ? new Date(a.last_active).toLocaleString() : 'Never',
                    'Joined Room': s.joined_at ? new Date(s.joined_at).toLocaleString() : '',
                };
            });
        }

        // Build CSV
        const headers = rows.length > 0
            ? Object.keys(rows[0])
            : ['Student Name','Level','Total XP','Cases Solved','DQL Solved','DML Solved','DDL Solved','Total Attempts','Correct Attempts','Accuracy (%)','Last Active','Joined Room'];

        const escape = v => `"${String(v).replace(/"/g, '""')}"`;
        const csvLines = [
            headers.map(escape).join(','),
            ...rows.map(r => headers.map(h => escape(r[h] ?? '')).join(','))
        ];

        const safeRoomName = roomName.replace(/[^a-z0-9_]/gi, '_');
        const date = new Date().toISOString().slice(0, 10);
        const filename = `room_report_${safeRoomName}_${date}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvLines.join('\n'));

    } catch (error) {
        console.error('EXPORT ERROR:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});


// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/overview
// 6 KPI cards for the dashboard header
// ──────────────────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
    try {
        const [[studentRow]]    = await systemDB.query(`SELECT COUNT(*) AS cnt FROM users WHERE role_id = 1`);
        const [[activeRow]]     = await systemDB.query(`SELECT COUNT(DISTINCT user_id) AS cnt FROM attempts`);
        const [[solvedRow]]     = await systemDB.query(`SELECT COUNT(*) AS cnt FROM user_case_progress WHERE status = 'Completed'`);
        const [[attemptsRow]]   = await systemDB.query(`SELECT COUNT(*) AS total, SUM(is_correct) AS correct FROM attempts`);
        const [[avgScoreRow]]   = await systemDB.query(`SELECT AVG(score_awarded) AS avg_score FROM attempts WHERE is_correct = 1`);

        const total    = Number(attemptsRow.total   || 0);
        const correct  = Number(attemptsRow.correct || 0);

        res.json({
            total_students:   Number(studentRow.cnt),
            active_students:  Number(activeRow.cnt),
            total_solved:     Number(solvedRow.cnt),
            total_attempts:   total,
            success_rate:     total > 0 ? Math.round((correct / total) * 100) : 0,
            avg_score:        avgScoreRow.avg_score != null ? Math.round(Number(avgScoreRow.avg_score) * 10) / 10 : 0,
        });
    } catch (error) {
        console.error('OVERVIEW ERROR:', error);
        res.status(500).json({ error: 'Failed to load overview' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/sql-performance
// Per-SQL-type: attempt count, distinct users, solved, avg score, success rate
// ──────────────────────────────────────────────────────────────────────────────
router.get('/sql-performance', async (req, res) => {
    try {
        const [rows] = await systemDB.query(`
            SELECT
                c.sql_type,
                COUNT(a.attempt_id)                                     AS total_attempts,
                COUNT(DISTINCT a.user_id)                               AS students_attempted,
                SUM(a.is_correct)                                       AS correct_attempts,
                COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.case_id END) AS cases_solved,
                AVG(CASE WHEN a.is_correct = 1 THEN a.score_awarded END) AS avg_score
            FROM cases c
            LEFT JOIN attempts a ON a.case_id = c.case_id
            WHERE c.is_active = 1
            GROUP BY c.sql_type
            ORDER BY c.sql_type ASC
        `);

        const result = rows.map(r => {
            const total   = Number(r.total_attempts   || 0);
            const correct = Number(r.correct_attempts || 0);
            return {
                sql_type:           r.sql_type,
                total_attempts:     total,
                students_attempted: Number(r.students_attempted || 0),
                cases_solved:       Number(r.cases_solved       || 0),
                avg_score:          r.avg_score != null ? Math.round(Number(r.avg_score) * 10) / 10 : 0,
                success_rate:       total > 0 ? Math.round((correct / total) * 100) : 0,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('SQL PERFORMANCE ERROR:', error);
        res.status(500).json({ error: 'Failed to load SQL performance' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/case-difficulty
// Per-case: attempts, solved, success%, avg attempts before success, avg time
// ──────────────────────────────────────────────────────────────────────────────
router.get('/case-difficulty', async (req, res) => {
    try {
        const [rows] = await systemDB.query(`
            SELECT
                c.case_id,
                c.title,
                c.sql_type,
                d.difficulty_name,
                COUNT(a.attempt_id)                                         AS total_attempts,
                SUM(a.is_correct)                                           AS times_solved,
                AVG(CASE WHEN a.is_correct = 1 THEN a.attempt_number END)   AS avg_attempts_before_solve,
                AVG(a.time_taken)                                            AS avg_time_seconds
            FROM cases c
            LEFT JOIN difficulty d ON d.difficulty_id = c.difficulty_id
            LEFT JOIN attempts   a ON a.case_id = c.case_id
            WHERE c.is_active = 1
            GROUP BY c.case_id, c.title, c.sql_type, d.difficulty_name
            ORDER BY
                CASE WHEN COUNT(a.attempt_id) = 0 THEN 1 ELSE 0 END ASC,
                (SUM(a.is_correct) / NULLIF(COUNT(a.attempt_id), 0)) ASC
        `);

        const result = rows.map(r => {
            const total  = Number(r.total_attempts || 0);
            const solved = Number(r.times_solved   || 0);
            return {
                case_id:                  r.case_id,
                title:                    r.title,
                sql_type:                 r.sql_type,
                difficulty_name:          r.difficulty_name || 'Unknown',
                total_attempts:           total,
                times_solved:             solved,
                success_rate:             total > 0 ? Math.round((solved / total) * 100) : null,
                avg_attempts_before_solve: r.avg_attempts_before_solve != null
                                            ? Math.round(Number(r.avg_attempts_before_solve) * 10) / 10
                                            : null,
                avg_time_seconds:         r.avg_time_seconds != null
                                            ? Math.round(Number(r.avg_time_seconds))
                                            : null,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('CASE DIFFICULTY ERROR:', error);
        res.status(500).json({ error: 'Failed to load case difficulty analytics' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/all-students[?room_id=X]
// All students (optionally filtered to a room) with full performance breakdown
// ──────────────────────────────────────────────────────────────────────────────
router.get('/all-students', async (req, res) => {
    try {
        const teacherId = req.user.user_id;
        const { room_id } = req.query;

        let studentQuery, studentParams;
        if (room_id) {
            // Teachers can only filter to their own rooms
            if (req.user.role_id === 2) {
                const [own] = await systemDB.query(
                    'SELECT 1 FROM rooms WHERE room_id = ? AND teacher_id = ?',
                    [room_id, teacherId]
                );
                if (own.length === 0) return res.status(403).json({ error: 'Not your room' });
            }
            studentQuery  = `
                SELECT u.user_id, u.full_name, u.total_points, u.current_level
                FROM room_students rs
                JOIN users u ON u.user_id = rs.student_id
                WHERE rs.room_id = ? AND rs.status = 'Approved'
                ORDER BY u.full_name ASC
            `;
            studentParams = [room_id];
        } else {
            studentQuery  = `
                SELECT user_id, full_name, total_points, current_level
                FROM users
                WHERE role_id = 1
                ORDER BY full_name ASC
            `;
            studentParams = [];
        }

        const [students] = await systemDB.query(studentQuery, studentParams);
        if (students.length === 0) return res.json([]);

        const userIds = students.map(s => s.user_id);

        const [attemptStats] = await systemDB.query(`
            SELECT
                a.user_id,
                COUNT(a.attempt_id)                                           AS total_attempts,
                SUM(a.is_correct)                                             AS correct_attempts,
                MAX(a.attempt_date)                                           AS last_active,
                COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.case_id END) AS cases_solved
            FROM attempts a
            WHERE a.user_id IN (?)
            GROUP BY a.user_id
        `, [userIds]);

        const [typeStats] = await systemDB.query(`
            SELECT ucp.user_id, c.sql_type, COUNT(*) AS solved
            FROM user_case_progress ucp
            JOIN cases c ON c.case_id = ucp.case_id
            WHERE ucp.user_id IN (?) AND ucp.status = 'Completed'
            GROUP BY ucp.user_id, c.sql_type
        `, [userIds]);

        const attemptMap = {};
        for (const a of attemptStats) attemptMap[a.user_id] = a;

        const typeMap = {};
        for (const t of typeStats) {
            if (!typeMap[t.user_id]) typeMap[t.user_id] = {};
            typeMap[t.user_id][t.sql_type] = Number(t.solved);
        }

        const result = students.map(s => {
            const a       = attemptMap[s.user_id] || {};
            const t       = typeMap[s.user_id]    || {};
            const total   = Number(a.total_attempts   || 0);
            const correct = Number(a.correct_attempts || 0);
            return {
                user_id:         s.user_id,
                full_name:       s.full_name,
                total_points:    s.total_points   || 0,
                current_level:   s.current_level  || 1,
                cases_solved:    Number(a.cases_solved || 0),
                total_attempts:  total,
                correct_attempts: correct,
                accuracy_pct:    total > 0 ? Math.round((correct / total) * 100) : 0,
                last_active:     a.last_active || null,
                dql_solved:      t['DQL'] || 0,
                dml_solved:      t['DML'] || 0,
                ddl_solved:      t['DDL'] || 0,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('ALL STUDENTS ERROR:', error);
        res.status(500).json({ error: 'Failed to load student analytics' });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /analytics/progress-weekly
// Attempt volume + success rate grouped by ISO week, last 8 weeks
// ──────────────────────────────────────────────────────────────────────────────
router.get('/progress-weekly', async (req, res) => {
    try {
        const [rows] = await systemDB.query(`
            SELECT
                YEARWEEK(attempt_date, 1)  AS yw,
                MIN(DATE(attempt_date))    AS week_start,
                COUNT(*)                   AS total_attempts,
                SUM(is_correct)            AS correct_attempts
            FROM attempts
            WHERE attempt_date >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
            GROUP BY yw
            ORDER BY yw ASC
            LIMIT 8
        `);

        const result = rows.map(r => {
            const total   = Number(r.total_attempts   || 0);
            const correct = Number(r.correct_attempts || 0);
            const d       = new Date(r.week_start);
            const label   = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return {
                week_label:     label,
                total_attempts: total,
                correct_attempts: correct,
                success_rate:   total > 0 ? Math.round((correct / total) * 100) : 0,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('WEEKLY PROGRESS ERROR:', error);
        res.status(500).json({ error: 'Failed to load weekly progress' });
    }
});

module.exports = router;
