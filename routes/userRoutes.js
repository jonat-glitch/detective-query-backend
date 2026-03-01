const express = require('express');
const { systemDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const submissionService = require('../services/submissionService');

const router = express.Router();


// 📚 Get cases with difficulty unlock system
router.get('/cases',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        // 🔓 Get unlocked difficulties
        const unlockedDifficulties =
            await submissionService.getUnlockedDifficulties(userId);

        const sql = `
            SELECT
                c.case_id,
                c.title,
                c.description,
                c.base_points,
                c.difficulty_id,
                d.difficulty_name,
                d.multiplier
            FROM cases c
            JOIN difficulty d
                ON c.difficulty_id = d.difficulty_id
            WHERE c.is_active = 1
            ORDER BY d.difficulty_id ASC, c.case_id ASC
        `;

        const [cases] = await systemDB.query(sql);

        // 🔎 Get completed cases for this user
        const [completedCases] = await systemDB.query(
            `SELECT case_id
            FROM user_case_progress
            WHERE user_id = ?
            AND status = 'Completed'`,
            [userId]
        );

        const completedIds = completedCases.map(c => c.case_id);

        const formatted = cases.map(c => ({
            ...c,
            status: unlockedDifficulties.includes(c.difficulty_id)
                ? 'Unlocked'
                : 'Locked',
            is_completed: completedIds.includes(c.case_id)
        }));

        res.json(formatted);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// 🏆 Leaderboard - Top 10 Students
router.get('/leaderboard',
    authenticateToken,
    async (req, res) => {

    try {
        const sql = `
            SELECT
                user_id,
                full_name,
                total_points,
                current_level,
                RANK() OVER (ORDER BY total_points DESC) AS ranking
            FROM users
            WHERE role_id = 1
            ORDER BY total_points DESC
            LIMIT 10
        `;

        const [results] = await systemDB.query(sql);

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});


// 👤 Get Personal Rank
router.get('/my-rank',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        const sql = `
            SELECT ranking, user_id, full_name, total_points, current_level
            FROM (
                SELECT
                    user_id,
                    full_name,
                    total_points,
                    current_level,
                    RANK() OVER (ORDER BY total_points DESC) AS ranking
                FROM users
                WHERE role_id = 1
            ) ranked_users
            WHERE user_id = ?
        `;

        const [results] = await systemDB.query(sql, [userId]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found in ranking' });
        }

        res.json(results[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get rank' });
    }
});


// 🎖 Get User Achievements
router.get('/achievements',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        const sql = `
            SELECT
                a.achievement_id,
                a.title,
                a.description,
                a.points_required,
                ua.date_earned
            FROM user_achievements ua
            JOIN achievements a
                ON ua.achievement_id = a.achievement_id
            WHERE ua.user_id = ?
            ORDER BY ua.date_earned DESC
        `;

        const [results] = await systemDB.query(sql, [userId]);

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// 👤 Get User Profile
router.get('/profile',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        const [results] = await systemDB.query(
            `SELECT full_name, total_points, current_level
             FROM users
             WHERE user_id = ?`,
            [userId]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(results[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// 🔐 Get current user role (for auto logout & real-time role sync)
router.get('/me-role',
    authenticateToken,
    async (req, res) => {
        try {
            const userId = req.user.user_id;

            const [rows] = await systemDB.query(
                "SELECT role_id FROM users WHERE user_id = ?",
                [userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({ role_id: rows[0].role_id });

        } catch (error) {
            console.error("ME-ROLE ERROR:", error);
            res.status(500).json({ error: "Server error" });
        }
    }
);

module.exports = router;