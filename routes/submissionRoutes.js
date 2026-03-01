const express = require('express');
const { systemDB, playgroundDB } = require('../db');
const submissionService = require('../services/submissionService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function validateStudentQuery(query) {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery.startsWith('select')) {
        return 'Only SELECT statements are allowed.';
    }

    if (lowerQuery.includes(';') && lowerQuery.split(';').length > 2) {
        return 'Multiple SQL statements are not allowed.';
    }

    const forbiddenKeywords = [
        'insert', 'update', 'delete', 'drop', 'alter',
        'truncate', 'create', 'grant', 'revoke',
        'information_schema', 'mysql', 'sys', '--'
    ];

    for (let keyword of forbiddenKeywords) {
        if (lowerQuery.includes(keyword)) {
            return `Forbidden keyword detected: ${keyword}`;
        }
    }

    return null;
}

// 🔹 Get single case details
router.get('/level/:id', authenticateToken, async (req, res) => {
    try {
        const caseId = req.params.id;
        const userId = req.user.user_id;

        // 🔓 Get unlocked difficulties
        const unlockedDifficulties =
            await submissionService.getUnlockedDifficulties(userId);

        // 🔍 Get case info
        const [cases] = await systemDB.query(
            `SELECT 
                c.case_id,
                c.description AS question_text,
                c.difficulty_id,
                d.difficulty_name
             FROM cases c
             JOIN difficulty d ON c.difficulty_id = d.difficulty_id
             WHERE c.case_id = ? AND c.is_active = 1`,
            [caseId]
        );

        if (cases.length === 0) {
            return res.status(404).json({ error: "Case not found" });
        }

        const caseData = cases[0];

        // 🔐 Determine lock status
        const status = unlockedDifficulties.includes(caseData.difficulty_id)
            ? "Unlocked"
            : "Locked";

        // ✅ Check if user already solved this case
        const [completed] = await systemDB.query(
            `SELECT 1 FROM attempts
            WHERE user_id = ? 
            AND case_id = ? 
            AND is_correct = 1
            LIMIT 1`,
            [userId, caseId]
        );

        res.json({
            case_id: caseData.case_id,
            question_text: caseData.question_text,
            difficulty_name: caseData.difficulty_name,
            status,
            is_completed: completed.length > 0
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch case details" });
    }
});

router.post('/submit-attempt', authenticateToken, async (req, res) => {

    let connection;

    try {
        const userId = req.user.user_id;
        
        connection = await systemDB.getConnection();
        await connection.beginTransaction();

        const { case_id, sql_query } = req.body;
        const user_id = req.user.user_id;

        if (!user_id || !case_id || !sql_query) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Cooldown
        const remainingTime = await submissionService.checkSubmissionCooldown(user_id);

        if (remainingTime) {
            await connection.rollback();
            connection.release();
            return res.status(429).json({
                error: `Please wait ${remainingTime} seconds before submitting again.`
            });
        }

        const validationError = validateStudentQuery(sql_query);
        if (validationError) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: validationError });
        }

        // Get correct query
        const [caseResult] = await connection.query(
            `SELECT correct_query, dataset_id
             FROM cases
             WHERE case_id = ?`,
            [case_id]
        );

        if (caseResult.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Case not found' });
        }

        const correctQuery = caseResult[0].correct_query;
        const datasetId = caseResult[0].dataset_id;

        if (!datasetId) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'This case is not linked to any dataset.'
            });
        }

        await submissionService.resetPlayground(datasetId);
        console.log("🧱 Playground reset complete for dataset:", datasetId);

        // Execute student query
        let studentResult;
        try {
            console.log("🔎 Executing student query:", sql_query);

            const [rows] = await playgroundDB.query(sql_query);

            console.log("✅ Student query result:", rows);

            studentResult = rows;
        } catch (err) {
            console.error("❌ STUDENT QUERY ERROR:", err);

            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'Invalid SQL query or table does not exist in playground environment.'
            });
        }

        // Execute correct query
        const [correctResult] = await playgroundDB.query(correctQuery);

        function normalizeResults(rows) {
            return rows
                .map(row => {
                    const sortedKeys = Object.keys(row).sort();
                    const sortedRow = {};
                    sortedKeys.forEach(key => {
                        sortedRow[key] = row[key];
                    });
                    return sortedRow;
                })
                .sort((a, b) =>
                    JSON.stringify(a).localeCompare(JSON.stringify(b))
                );
        }
        
        const normalizedStudent = normalizeResults(studentResult);
        const normalizedCorrect = normalizeResults(correctResult);
        
        const isCorrect =
            JSON.stringify(normalizedStudent) === JSON.stringify(normalizedCorrect);        

        // Get case info
        const [caseInfo] = await connection.query(
            `SELECT c.base_points, d.multiplier
             FROM cases c
             JOIN difficulty d ON c.difficulty_id = d.difficulty_id
             WHERE c.case_id = ?`,
            [case_id]
        );

        const basePoints = caseInfo[0].base_points;
        const multiplier = caseInfo[0].multiplier;

        const score = isCorrect ? Math.floor(basePoints * multiplier) : 0;

        let totalPoints = null;
        let newLevel = null;

        const progressResult =
            await submissionService.updateUserProgress(
                connection,
                user_id,
                case_id,
                score,
                isCorrect
            );
        
            let unlockedAchievements = [];

            if (progressResult) {
                unlockedAchievements = await submissionService.handleAchievements(
                    connection,
                    userId,
                    progressResult.totalPoints
                );
            }

            if (progressResult) {
                totalPoints = progressResult.totalPoints;
                newLevel = progressResult.newLevel;

                await submissionService.handleAchievements(
                    connection,
                    user_id,
                    totalPoints
                );
            }

            let streakData = null;

            if (progressResult) {
                streakData = await submissionService.updateUserStreak(
                    connection,
                    user_id
                );
            }

        await connection.query(
            `INSERT INTO attempts
             (user_id, case_id, sql_query, is_correct, score_awarded)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, case_id, sql_query, isCorrect, score]
        );

        await connection.commit();
        connection.release();

        res.json({
            isCorrect,
            score,
            achievements: unlockedAchievements,
            streak: streakData
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
            connection.release();
        }

        console.error(error);
        res.status(500).json({ error: 'Server error during submission' });
    }
});

module.exports = router;
