const express = require('express');
const router = express.Router();
const { systemDB, playgroundDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const submissionService = require('../services/submissionService');

// ─── SQL Validator (DML / DDL only) ──────────────────────────────────────────
function validatePracticeQuery(query, sqlType) {
    const trimmed = query.trim();
    const semicolonCount = (trimmed.match(/;/g) || []).length;
    if (semicolonCount > 1) return 'Multiple SQL statements are not allowed.';

    const alwaysForbidden = [
        /\bgrant\b/i, /\brevoke\b/i, /\binformation_schema\b/i,
        /\bmysql\b/i, /\bsys\b/i, /--/, /\/\*/, /\*\//, /#/
    ];
    for (const p of alwaysForbidden) {
        if (p.test(trimmed)) return 'Forbidden SQL operation or comments detected.';
    }

    if (sqlType === 'DML') {
        if (!/^\s*(insert|update|delete)\s/i.test(trimmed))
            return 'Only INSERT, UPDATE, or DELETE statements are allowed for DML.';
        const forbidden = [/\bdrop\b/i, /\balter\b/i, /\btruncate\b/i, /\bcreate\b/i];
        for (const p of forbidden) if (p.test(trimmed)) return 'Forbidden SQL operation for DML.';
    } else if (sqlType === 'DDL') {
        if (!/^\s*(create|alter|drop)\s/i.test(trimmed))
            return 'Only CREATE, ALTER, or DROP statements are allowed for DDL.';
        const forbidden = [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\btruncate\b/i];
        for (const p of forbidden) if (p.test(trimmed)) return 'Forbidden SQL operation for DDL.';
    } else {
        return 'Invalid sql_type for practice submission.';
    }
    return null;
}

// ─── Helper: Recreate Isolated Student Database ───────────────────────────────
async function recreateStudentDatabase(userId) {
    const dbName = `playground_user_${userId}`;
    try {
        await systemDB.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await systemDB.query(`CREATE DATABASE \`${dbName}\``);
        await systemDB.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO 'sandbox_user'@'localhost'`);
        await systemDB.query(`FLUSH PRIVILEGES`);
    } catch (err) {
        console.error(`Error recreating database ${dbName}:`, err.message);
    }
    return dbName;
}

// ─── Helper: run multi-statement setup SQL on specific connection ────────────
async function runSetup(connection, setupSql) {
    if (!setupSql || !setupSql.trim()) return;
    const statements = setupSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    for (const stmt of statements) {
        try {
            await connection.query(stmt);
        } catch (e) {
            console.warn('Setup SQL warning:', e.message);
        }
    }
}

// ─── Helper: normalize rows for comparison ────────────────────────────────────
function normalizeRows(rows) {
    return rows.map(row =>
        JSON.stringify(
            Object.fromEntries(
                Object.entries(row).map(([k, v]) => [
                    k.toLowerCase(),
                    v === null ? null : String(v).trim().toLowerCase()
                ])
            )
        )
    ).sort();
}

function rowsMatch(actual, expected) {
    if (actual.length !== expected.length) return false;
    const a = normalizeRows(actual);
    const e = normalizeRows(expected);
    return JSON.stringify(a) === JSON.stringify(e);
}

// ─── Record attempt ───────────────────────────────────────────────────────────
async function recordAttempt(userId, caseId, sqlQuery, isCorrect, score) {
    try {
        await systemDB.query(
            `INSERT INTO attempts (user_id, case_id, sql_query, is_correct, score_awarded, mode)
             VALUES (?, ?, ?, ?, ?, 'Practice')`,
            [userId, caseId, sqlQuery.substring(0, 1000), isCorrect ? 1 : 0, score]
        );
    } catch (e) {
        console.error('Failed to record attempt:', e.message);
    }
}

// ─── Upsert user_case_progress ────────────────────────────────────────────────
async function markCaseCompleted(userId, caseId, score) {
    try {
        const [existing] = await systemDB.query(
            `SELECT progress_id FROM user_case_progress WHERE user_id = ? AND case_id = ? LIMIT 1`,
            [userId, caseId]
        );
        if (existing.length > 0) {
            await systemDB.query(
                `UPDATE user_case_progress
                 SET status = 'Completed', highest_score = GREATEST(highest_score, ?), completed_at = NOW()
                 WHERE user_id = ? AND case_id = ?`,
                [score, userId, caseId]
            );
        } else {
            await systemDB.query(
                `INSERT INTO user_case_progress (user_id, case_id, status, highest_score, is_unlocked, completed_at)
                 VALUES (?, ?, 'Completed', ?, 1, NOW())`,
                [userId, caseId, score]
            );
        }
    } catch (e) {
        console.error('Failed to mark case completed:', e.message);
    }
}

// ─── Check if already completed ──────────────────────────────────────────────
async function isAlreadyCompleted(userId, caseId) {
    const [rows] = await systemDB.query(
        `SELECT progress_id FROM user_case_progress
         WHERE user_id = ? AND case_id = ? AND status = 'Completed' LIMIT 1`,
        [userId, caseId]
    );
    return rows.length > 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /practice/status/:case_id  —  Check if student already completed a case
// ══════════════════════════════════════════════════════════════════════════════
router.get('/status/:case_id', authenticateToken, authorizeRole([1]), async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { case_id } = req.params;
        const completed = await isAlreadyCompleted(userId, case_id);
        res.json({ completed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /practice/status-bulk  —  Check completion for all cases at once
// ══════════════════════════════════════════════════════════════════════════════
router.get('/status-bulk', authenticateToken, authorizeRole([1]), async (req, res) => {
    try {
        const userId = req.user.user_id;
        const [rows] = await systemDB.query(
            `SELECT case_id FROM user_case_progress
             WHERE user_id = ? AND status = 'Completed'`,
            [userId]
        );
        const completedIds = rows.map(r => r.case_id);
        res.json({ completed_case_ids: completedIds });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /practice/run  —  Preview (no submission recorded)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/run', authenticateToken, authorizeRole([1]), async (req, res) => {
    let connection;
    try {
        const { case_id, sql_query } = req.body;
        const userId = req.user.user_id;
        if (!case_id || !sql_query) return res.status(400).json({ error: 'case_id and sql_query are required' });

        // Block if already completed (no point running)
        const completed = await isAlreadyCompleted(userId, case_id);
        if (completed) {
            return res.status(403).json({
                error: 'You have already completed this task. It is now locked.',
                already_completed: true
            });
        }

        const [cases] = await systemDB.query(
            `SELECT case_id, sql_type, setup_sql, expected_result_sql FROM cases WHERE case_id = ? AND is_active = 1`,
            [case_id]
        );
        if (cases.length === 0) return res.status(404).json({ error: 'Case not found' });
        const c = cases[0];

        const validationError = validatePracticeQuery(sql_query, c.sql_type);
        if (validationError) return res.status(400).json({ error: validationError });

        const dbName = await recreateStudentDatabase(userId);
        connection = await playgroundDB.getConnection();
        await connection.query(`USE \`${dbName}\``);

        await runSetup(connection, c.setup_sql);

        try {
            await connection.query(sql_query);
        } catch (queryErr) {
            return res.status(200).json({
                preview_rows: [],
                error: `SQL Error: ${queryErr.message}`
            });
        }

        let previewRows = [];
        if (c.expected_result_sql) {
            try {
                const [rows] = await connection.query(c.expected_result_sql);
                previewRows = rows;
            } catch (e) {
                console.warn('Preview validation query error:', e.message);
            }
        }

        res.json({ preview_rows: previewRows, message: 'Preview only — not submitted' });

    } catch (err) {
        console.error('practice/run error:', err);
        res.status(500).json({ error: err.message || 'Query execution failed' });
    } finally {
        if (connection) connection.release();
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /practice/submit  —  Submit and validate (LOCKED after first correct)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/submit', authenticateToken, authorizeRole([1]), async (req, res) => {
    let connection;
    try {
        const { case_id, sql_query } = req.body;
        const userId = req.user.user_id;
        if (!case_id || !sql_query) return res.status(400).json({ error: 'case_id and sql_query are required' });

        // ── Lock check: block if already correctly completed ──────────────────
        const completed = await isAlreadyCompleted(userId, case_id);
        if (completed) {
            return res.status(403).json({
                error: 'You have already completed this task. It is now locked.',
                already_completed: true
            });
        }

        const [cases] = await systemDB.query(
            `SELECT case_id, sql_type, setup_sql, expected_result_sql, correct_query, difficulty_id, base_points
             FROM cases WHERE case_id = ? AND is_active = 1`,
            [case_id]
        );
        if (cases.length === 0) return res.status(404).json({ error: 'Case not found' });
        const c = cases[0];

        const validationError = validatePracticeQuery(sql_query, c.sql_type);
        if (validationError) {
            await recordAttempt(userId, case_id, sql_query, false, 0);
            return res.status(400).json({ error: validationError, is_correct: false });
        }

        // ── Step A: Get EXPECTED state (fresh DB → setup → correct_query → validate)
        const dbName = await recreateStudentDatabase(userId);
        connection = await playgroundDB.getConnection();
        await connection.query(`USE \`${dbName}\``);

        let actualRows = [];
        let expectedRows = [];
        let is_correct = false;

        if (c.correct_query && c.expected_result_sql) {
            await runSetup(connection, c.setup_sql);
            try {
                await connection.query(c.correct_query);
                const [expRows] = await connection.query(c.expected_result_sql);
                expectedRows = expRows;
            } catch (e) {
                console.warn('Expected state generation error:', e.message);
            }
        }

        // ── Step B: Get ACTUAL state (fresh DB → setup → student query → validate)
        await recreateStudentDatabase(userId);
        await connection.query(`USE \`${dbName}\``);
        await runSetup(connection, c.setup_sql);

        try {
            await connection.query(sql_query);
        } catch (queryErr) {
            await recordAttempt(userId, case_id, sql_query, false, 0);
            return res.status(200).json({
                is_correct: false,
                feedback: `❌ SQL Error: ${queryErr.message}`,
                actual_rows: [],
                expected_rows: expectedRows
            });
        }

        if (c.expected_result_sql) {
            try {
                const [actRows] = await connection.query(c.expected_result_sql);
                actualRows = actRows;
            } catch (e) {
                console.warn('Actual state validation error:', e.message);
            }

            is_correct = expectedRows.length > 0
                ? rowsMatch(actualRows, expectedRows)
                : true;
        } else {
            is_correct = true;
        }

        // ── Award XP + lock task on first correct ─────────────────────────────
        const score = is_correct ? (c.base_points || 50) : 0;
        await recordAttempt(userId, case_id, sql_query, is_correct, score);

        if (is_correct) {
            // Use unified submissionService to update progress, award points/level, handle achievements & streak
            const progressResult = await submissionService.updateUserProgress(
                systemDB,
                userId,
                case_id,
                score,
                true
            );

            if (progressResult) {
                await submissionService.handleAchievements(
                    systemDB,
                    userId,
                    progressResult.totalPoints
                );
            }

            await submissionService.updateUserStreak(
                systemDB,
                userId
            );
        }

        res.json({
            is_correct,
            score_awarded: score,
            feedback: is_correct
                ? `✅ Correct! Task completed and locked. (+${score} XP)`
                : '❌ Not quite. Review the expected result and try again.',
            actual_rows: actualRows,
            expected_rows: expectedRows
        });

    } catch (err) {
        console.error('practice/submit error:', err);
        res.status(500).json({ error: err.message || 'Submission failed' });
    } finally {
        if (connection) connection.release();
    }
});

// GET /practice/schema — Retrieve schema details of the playground database
router.get('/schema', authenticateToken, async (req, res) => {
    try {
        const [columns] = await playgroundDB.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position
        `);
        res.json(columns);
    } catch (error) {
        console.error("practice/schema fetch error:", error);
        res.status(500).json({ error: "Failed to fetch playground schema" });
    }
});

module.exports = router;
