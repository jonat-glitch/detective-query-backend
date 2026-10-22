const express = require('express');
const router = express.Router();
const { systemDB, playgroundDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const submissionService = require('../services/submissionService');
const { evaluateSqlResult } = require('../utils/queryEvaluator');

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
    } else if (sqlType === 'DQL') {
        if (!/^\s*(select|with)\s/i.test(trimmed))
            return 'Only SELECT statements are allowed for DQL.';
        const forbidden = [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bdrop\b/i, /\balter\b/i, /\btruncate\b/i, /\bcreate\b/i];
        for (const p of forbidden) if (p.test(trimmed)) return 'Forbidden SQL operation for DQL.';
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
// GET /practice/curriculum-progress  —  Get module-by-module curriculum roadmap progress
// ══════════════════════════════════════════════════════════════════════════════
router.get('/curriculum-progress', authenticateToken, authorizeRole([1]), async (req, res) => {
    try {
        const userId = req.user.user_id;
        const requestedMode = req.query.mode && req.query.mode.toLowerCase() === 'rank' ? 'Rank' : 'Practice';

        const [rows] = await systemDB.query(
            `SELECT 
                c.sql_type,
                c.module_order,
                COUNT(DISTINCT c.case_id) AS total_cases,
                COALESCE(SUM(c.base_points), 0) AS total_points,
                COUNT(DISTINCT CASE WHEN ucp.status = 'Completed' THEN c.case_id END) AS completed_cases,
                COALESCE(SUM(CASE WHEN ucp.status = 'Completed' THEN c.base_points END), 0) AS points_earned
            FROM cases c
            LEFT JOIN user_case_progress ucp 
                ON c.case_id = ucp.case_id AND ucp.user_id = ?
            WHERE c.is_active = 1 AND c.mode = ?
            GROUP BY c.sql_type, c.module_order
            ORDER BY c.module_order ASC`,
            [userId, requestedMode]
        );

        const defaultModules = [
            { sql_type: 'DDL', module_order: 1, key: 'ddl', title: 'Archive Architecture', subtitle: 'Schema Definition Bureau' },
            { sql_type: 'DML', module_order: 2, key: 'dml', title: 'Crime Scene Alteration', subtitle: 'Data Manipulation Unit' },
            { sql_type: 'DQL', module_order: 3, key: 'dql', title: 'Detective Case Files', subtitle: 'Homicide & Investigation Div.' },
        ];

        let prevCompleted = true;
        let currentModuleKey = 'ddl';
        let totalAllCases = 0;
        let totalCompletedCases = 0;

        const modules = defaultModules.map((def) => {
            const found = rows.find(r => r.sql_type === def.sql_type) || {};
            const totalCases = Number(found.total_cases) || 0;
            const completedCases = Number(found.completed_cases) || 0;
            const totalPoints = Number(found.total_points) || 0;
            const pointsEarned = Number(found.points_earned) || 0;

            totalAllCases += totalCases;
            totalCompletedCases += completedCases;

            const isDone = totalCases > 0 ? (completedCases >= totalCases) : false;

            let status = 'upcoming';
            let unlockRequirement = null;

            if (isDone) {
                status = 'completed';
            } else if (completedCases > 0) {
                // Student has already started/solved tasks in this module — always keep accessible
                status = 'current';
            } else if (prevCompleted) {
                status = 'current';
                currentModuleKey = def.key;
            } else {
                status = 'upcoming';
                if (def.sql_type === 'DML') unlockRequirement = 'Complete Archive Architecture (DDL) first';
                if (def.sql_type === 'DQL') unlockRequirement = 'Complete Crime Scene Alteration (DML) first';
            }

            prevCompleted = isDone;

            return {
                key: def.key,
                sql_type: def.sql_type,
                module_order: def.module_order,
                title: def.title,
                subtitle: def.subtitle,
                total_cases: totalCases,
                completed_cases: completedCases,
                total_points: totalPoints,
                points_earned: pointsEarned,
                status,
                unlock_requirement: unlockRequirement,
                progress_pct: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0
            };
        });

        if (modules.every(m => m.status === 'completed')) {
            currentModuleKey = 'dql';
        }

        const overallProgressPct = totalAllCases > 0 ? Math.round((totalCompletedCases / totalAllCases) * 100) : 0;

        res.json({
            modules,
            current_module: currentModuleKey,
            total_cases: totalAllCases,
            completed_cases: totalCompletedCases,
            overall_progress_pct: overallProgressPct
        });

    } catch (err) {
        console.error('curriculum-progress error:', err);
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

        let previewRows = [];
        if (c.sql_type === 'DQL') {
            try {
                const [rows] = await connection.query(sql_query);
                previewRows = rows;
            } catch (queryErr) {
                return res.status(200).json({
                    preview_rows: [],
                    error: `SQL Error: ${queryErr.message}`
                });
            }
        } else {
            try {
                await connection.query(sql_query);
            } catch (queryErr) {
                return res.status(200).json({
                    preview_rows: [],
                    error: `SQL Error: ${queryErr.message}`
                });
            }

            if (c.expected_result_sql) {
                try {
                    const [rows] = await connection.query(c.expected_result_sql);
                    previewRows = rows;
                } catch (e) {
                    console.warn('Preview validation query error:', e.message);
                    if (e.code === 'ER_NO_SUCH_TABLE' || (e.message && e.message.includes("doesn't exist"))) {
                        try {
                            const [existingTables] = await connection.query('SHOW TABLES');
                            const tableNames = existingTables.map(t => Object.values(t)[0]);
                            if (tableNames.length > 0) {
                                const createdTable = tableNames[tableNames.length - 1];
                                const [userCols] = await connection.query(`SHOW COLUMNS FROM \`${createdTable}\``);
                                previewRows = userCols;
                            }
                        } catch (_) {}
                    }
                }
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

        let actualRows = [];
        let expectedRows = [];
        let is_correct = false;
        let validationErrorMessage = null;

        if (c.sql_type === 'DQL') {
            const dbName = await recreateStudentDatabase(userId);
            connection = await playgroundDB.getConnection();
            await connection.query(`USE \`${dbName}\``);
            await runSetup(connection, c.setup_sql);

            try {
                const [expRows] = await connection.query(c.correct_query || c.expected_result_sql);
                expectedRows = expRows;
            } catch (e) {
                console.warn('Expected state generation error:', e.message);
            }

            try {
                const [actRows] = await connection.query(sql_query);
                actualRows = actRows;
                is_correct = rowsMatch(actualRows, expectedRows);
            } catch (queryErr) {
                await recordAttempt(userId, case_id, sql_query, false, 0);
                return res.status(200).json({
                    is_correct: false,
                    feedback: `❌ SQL Error: ${queryErr.message}`,
                    actual_rows: [],
                    expected_rows: expectedRows
                });
            }
        } else {
            // ── Step A: Get EXPECTED state (fresh DB → setup → correct_query → validate)
            const dbName = await recreateStudentDatabase(userId);
            connection = await playgroundDB.getConnection();
            await connection.query(`USE \`${dbName}\``);

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
                    validationErrorMessage = e.message;

                    // Table not found check (e.g. Table 'witnesses' doesn't exist)
                    if (e.code === 'ER_NO_SUCH_TABLE' || (e.message && e.message.includes("doesn't exist"))) {
                        try {
                            const [existingTables] = await connection.query('SHOW TABLES');
                            const tableNames = existingTables.map(t => Object.values(t)[0]);

                            // Extract expected table name from expected_result_sql
                            const targetMatch = c.expected_result_sql.match(/(?:from|table|describe)\s+([`\w]+)/i);
                            const expectedTable = targetMatch ? targetMatch[1].replace(/[`]/g, '') : null;

                            if (tableNames.length > 0) {
                                const createdTable = tableNames[tableNames.length - 1];
                                if (expectedTable && createdTable && createdTable.toLowerCase() !== expectedTable.toLowerCase()) {
                                    validationErrorMessage = `Expected table '${expectedTable}' was not found. You created table '${createdTable}' instead. Please rename or recreate it as '${expectedTable}'!`;
                                } else {
                                    validationErrorMessage = `Expected table '${expectedTable || 'required'}' does not exist in your database.`;
                                }

                                // Load columns from user-created table so actual_rows shows in UI
                                try {
                                    const [userCols] = await connection.query(`SHOW COLUMNS FROM \`${createdTable}\``);
                                    actualRows = userCols;
                                } catch (_) {}
                            } else {
                                validationErrorMessage = `Table '${expectedTable || 'required'}' was not created. Ensure your CREATE TABLE statement executes successfully.`;
                            }
                        } catch (_) {}
                    }
                }

                if (validationErrorMessage) {
                    is_correct = false;
                } else if (expectedRows.length > 0) {
                    const evalResult = evaluateSqlResult(c.sql_type, actualRows, expectedRows, c.expected_result_sql);
                    is_correct = evalResult.is_perfect;
                    var evaluationResult = evalResult;
                } else {
                    is_correct = true;
                }
            } else {
                is_correct = true;
            }
        }

        // ── Comprehensive evaluation & Partial Star / Score Calculation ────────
        let evalResult = typeof evaluationResult !== 'undefined' ? evaluationResult : null;
        if (!evalResult) {
            evalResult = evaluateSqlResult(c.sql_type, actualRows, expectedRows, c.expected_result_sql);
            if (is_correct) {
                evalResult.is_perfect = true;
                evalResult.stars = 3;
                evalResult.percentage = 100;
            }
        }

        const basePoints = Number(c.base_points) || 50;
        const percentage = validationErrorMessage ? 0 : (is_correct ? 100 : evalResult.percentage);
        const stars = validationErrorMessage ? 0 : (is_correct ? 3 : evalResult.stars);
        const score = Math.round(basePoints * (percentage / 100));

        // Record attempt
        await recordAttempt(userId, case_id, sql_query, is_correct, score);

        // Update user progress: locked if 3 stars (100% correct), or partial progress saved if > 0 points
        if (score > 0) {
            const progressResult = await submissionService.updateUserProgress(
                systemDB,
                userId,
                case_id,
                score,
                is_correct, // true = Completed (locks task), false = In Progress (allows re-attempt to reach 3 stars)
                true        // allowPartial = true
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

        let feedback = '';
        if (validationErrorMessage) {
            feedback = `❌ ${validationErrorMessage}`;
        } else if (is_correct) {
            feedback = `🌟 Perfect! All specifications and constraints verified. (+${score} XP)`;
        } else if (evalResult && evalResult.feedback) {
            feedback = `${evalResult.feedback} (+${score} XP earned)`;
        } else if (expectedRows.length > 0 && actualRows.length > 0) {
            feedback = '❌ Structure or data mismatch: Your result does not match the expected blueprint. Check column names, types, and constraints.';
        } else {
            feedback = '❌ Not quite. Review the expected result and try again.';
        }

        res.json({
            is_correct,
            is_passing: evalResult ? evalResult.is_passing : is_correct,
            percentage,
            stars,
            score_awarded: score,
            base_points: basePoints,
            checks: evalResult ? evalResult.checks : [],
            missing_items: evalResult ? evalResult.missingItems : [],
            passed_items: evalResult ? evalResult.passedItems : [],
            feedback,
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
