require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { systemDB, playgroundDB } = require('./db');
const bcrypt = require('bcryptjs');
const submissionService = require('./services/submissionService');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('./middleware/auth');
const { apiLimiter, loginLimiter } = require('./middleware/rateLimiter');

const path = require('path');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const errorHandler = require('./middleware/errorHandler');
const progressRoutes = require("./routes/progressRoutes");
const difficultyProgressRoutes = require("./routes/difficultyProgressRoutes");
const adminRoutes = require("./routes/adminRoutes");
const roomRoutes = require('./routes/roomRoutes');

// ✅ FIXED (CASE SENSITIVE IMPORT)
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const uploadRoutes = require('./routes/uploadRoutes');
const practiceRoutes = require('./routes/practiceRoutes');

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(apiLimiter);

/* ================= ROUTES ================= */

// AUTH
app.use('/api', authRoutes);

// USERS
app.use('/api/users', userRoutes);
app.use('/api', userRoutes); // provides /api/me-role, /api/my-rank, /api/leaderboard, /api/change-name, /api/change-password

// SUBMISSIONS
app.use('/api', submissionRoutes);

// PROGRESS
app.use('/api/progress', progressRoutes);
app.use('/api/difficulty-progress', difficultyProgressRoutes);

// ADMIN
app.use('/api/admin', adminRoutes);

// ROOMS
app.use("/api/rooms", require("./routes/roomRoutes"));

// NOTIFICATIONS
app.use('/api', notificationRoutes);

// ANALYTICS
app.use('/api/analytics', analyticsRoutes);

// FILE UPLOADS
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', uploadRoutes);

// PRACTICE (DML / DDL)
app.use('/api/practice', practiceRoutes);

/* ================= PROFILE (full — includes stats, achievements, streak) ================= */
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;

        // 1. Fetch basic profile info
        const [userRows] = await systemDB.query(
            `SELECT user_id, full_name, email, role_id, avatar, total_points, current_level, section, created_at, student_id
             FROM users
             WHERE user_id = ?`,
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        const user = userRows[0];

        // Dynamically re-base avatar URL to current host so server IP changes never break avatar loads
        if (user.avatar && user.avatar.includes('/uploads/')) {
            const filename = user.avatar.split('/uploads/').pop();
            user.avatar = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
        }

        // 2. Fetch streak
        const [streakRows] = await systemDB.query(
            `SELECT current_streak FROM user_streaks WHERE user_id = ?`,
            [userId]
        );
        const streak = streakRows.length > 0 ? streakRows[0].current_streak : 0;

        // 3. Fetch query attempt totals
        const [attemptRows] = await systemDB.query(
            `SELECT 
                COUNT(*) AS total_attempts,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_attempts,
                SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong_attempts
             FROM attempts
             WHERE user_id = ?`,
            [userId]
        );
        const stats = attemptRows[0] || { total_attempts: 0, correct_attempts: 0, wrong_attempts: 0 };
        const total = stats.total_attempts || 0;
        const correct = stats.correct_attempts || 0;
        const wrong = stats.wrong_attempts || 0;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

        // 4. Solves details (practice and ranked)
        const [progressRows] = await systemDB.query(
            `SELECT COUNT(*) AS solved_cases FROM user_case_progress WHERE user_id = ? AND status = 'Completed'`,
            [userId]
        );
        const solvedCases = progressRows[0]?.solved_cases || 0;

        const [practiceRows] = await systemDB.query(
            `SELECT COUNT(DISTINCT case_id) AS practice_solved FROM attempts WHERE user_id = ? AND is_correct = 1 AND mode = 'Practice'`,
            [userId]
        );
        const practiceCases = practiceRows[0]?.practice_solved || 0;

        const [rankedRows] = await systemDB.query(
            `SELECT COUNT(DISTINCT case_id) AS ranked_solved FROM attempts WHERE user_id = ? AND is_correct = 1 AND mode = 'Rank'`,
            [userId]
        );
        const rankedWins = rankedRows[0]?.ranked_solved || 0;

        // 5. SQL keyword analysis for topic progress
        const [queryRows] = await systemDB.query(
            `SELECT sql_query FROM attempts WHERE user_id = ? AND is_correct = 1`,
            [userId]
        );
        
        let selectCount = 0, whereCount = 0, orderCount = 0;
        let groupCount = 0, joinCount = 0, ddlCount = 0, dmlCount = 0;

        queryRows.forEach(row => {
            const q = (row.sql_query || '').toUpperCase();
            if (q.includes('SELECT')) selectCount++;
            if (q.includes('WHERE')) whereCount++;
            if (q.includes('ORDER BY')) orderCount++;
            if (q.includes('GROUP BY')) groupCount++;
            if (q.includes('JOIN') || q.includes('ON')) joinCount++;
            if (q.includes('CREATE') || q.includes('ALTER') || q.includes('DROP') || q.includes('TABLE')) ddlCount++;
            if (q.includes('INSERT') || q.includes('UPDATE') || q.includes('DELETE')) dmlCount++;
        });

        const sqlProgress = {
            select: Math.min(100, Math.max(10, selectCount * 10)),
            where: Math.min(100, Math.max(10, whereCount * 10)),
            orderby: Math.min(100, Math.max(10, orderCount * 10)),
            groupby: Math.min(100, Math.max(10, groupCount * 10)),
            joins: Math.min(100, Math.max(10, joinCount * 10)),
            ddl: Math.min(100, Math.max(10, ddlCount * 10)),
            dml: Math.min(100, Math.max(10, dmlCount * 10))
        };

        // 6. Recent activity (last 5 solved cases with score)
        const [activityRows] = await systemDB.query(
            `SELECT c.title, ucp.completed_at, c.difficulty_id,
                    COALESCE(ucp.highest_score, 0) AS xp_earned
             FROM user_case_progress ucp
             JOIN cases c ON ucp.case_id = c.case_id
             WHERE ucp.user_id = ? AND ucp.status = 'Completed'
             ORDER BY ucp.completed_at DESC
             LIMIT 5`,
            [userId]
        );

        // 7. Achievements from DB
        const [achievementRows] = await systemDB.query(
            `SELECT a.achievement_id, a.title, a.description, a.points_required, ua.date_earned
             FROM user_achievements ua
             JOIN achievements a ON ua.achievement_id = a.achievement_id
             WHERE ua.user_id = ?
             ORDER BY ua.date_earned DESC`,
            [userId]
        );

        res.json({
            ...user,
            streak,
            stats: {
                total_attempts: total,
                correct_attempts: correct,
                wrong_attempts: wrong,
                accuracy,
                solved_cases: solvedCases,
                practice_cases: practiceCases,
                ranked_wins: rankedWins
            },
            sqlProgress,
            recentActivity: activityRows || [],
            achievements: achievementRows || []
        });

    } catch (err) {
        console.error("Profile endpoint error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

/* ================= DQL CASES (legacy case map flow) ================= */
app.get('/api/cases', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const [cases] = await systemDB.query(
            `SELECT c.case_id, c.title, c.difficulty_id, d.difficulty_name,
                    CASE WHEN ucp.status = 'Completed' THEN 1 ELSE 0 END AS is_completed,
                    CASE WHEN ucp.status = 'Completed' THEN 'Unlocked' ELSE 'Unlocked' END AS status
             FROM cases c
             JOIN difficulty d ON c.difficulty_id = d.difficulty_id
             LEFT JOIN user_case_progress ucp ON ucp.case_id = c.case_id AND ucp.user_id = ?
             WHERE c.is_active = 1 AND (c.sql_type = 'DQL' OR c.sql_type IS NULL)
             ORDER BY c.difficulty_id ASC, c.case_id ASC`,
            [userId]
        );
        res.json(cases);
    } catch (err) {
        console.error("Cases fetch error:", err);
        res.status(500).json({ error: "Failed to fetch cases" });
    }
});

/* ================= ROOT ================= */
app.get('/', (req, res) => {
    res.send('Detective Query Backend is Running');
});

/* ================= USERS ================= */
app.get('/api/users', authenticateToken, authorizeRole([3]), async (req, res) => {
    try {
        const sql = `
            SELECT u.user_id, u.full_name, u.email, u.role_id, up.total_xp
            FROM users u
            LEFT JOIN user_progress up ON u.user_id = up.user_id
        `;

        const [results] = await systemDB.query(sql);
        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database query failed' });
    }
});

/* ================= PLAYGROUND ================= */
app.get('/api/test-playground', async (req, res) => {
    try {
        const [rows] = await playgroundDB.query('SELECT * FROM persons');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Playground test failed' });
    }
});

/* ================= ERROR HANDLER ================= */
app.use(errorHandler);

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});