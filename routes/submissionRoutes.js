const express = require('express');
const { systemDB, playgroundDB } = require('../db');
const submissionService = require('../services/submissionService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function validateStudentQuery(query, sqlType = 'DQL') {
    const trimmedQuery = query.trim();

    // 🔥 Disallow multiple statements
    const semicolonCount = (trimmedQuery.match(/;/g) || []).length;
    if (semicolonCount > 1) {
        return 'Multiple SQL statements are not allowed.';
    }

    // 🔥 Always forbidden patterns (whole words, security bounds, comments)
    const alwaysForbidden = [
        /\bgrant\b/i,
        /\brevoke\b/i,
        /\binformation_schema\b/i,
        /\bmysql\b/i,
        /\bsys\b/i,
        /--/,
        /\/\*/,
        /\*\//,
        /#/
    ];

    for (const pattern of alwaysForbidden) {
        if (pattern.test(trimmedQuery)) {
            return 'Forbidden SQL operation or comments detected.';
        }
    }

    if (sqlType === 'DQL') {
        if (!/^\s*select\s/i.test(trimmedQuery)) {
            return 'Only SELECT statements are allowed for DQL.';
        }
        const forbiddenPatterns = [
            /\binsert\b/i,
            /\bupdate\b/i,
            /\bdelete\b/i,
            /\bdrop\b/i,
            /\balter\b/i,
            /\btruncate\b/i,
            /\bcreate\b/i
        ];
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(trimmedQuery)) {
                return 'Forbidden SQL operation detected for DQL.';
            }
        }
    } else if (sqlType === 'DML') {
        if (!/^\s*(insert|update|delete)\s/i.test(trimmedQuery)) {
            return 'Only INSERT, UPDATE, or DELETE statements are allowed for DML.';
        }
        const forbiddenPatterns = [
            /\bdrop\b/i,
            /\balter\b/i,
            /\btruncate\b/i,
            /\bcreate\b/i
        ];
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(trimmedQuery)) {
                return 'Forbidden SQL operation detected for DML.';
            }
        }
    } else if (sqlType === 'DDL') {
        if (!/^\s*(create|alter|drop)\s/i.test(trimmedQuery)) {
            return 'Only CREATE, ALTER, or DROP statements are allowed for DDL.';
        }
        const forbiddenPatterns = [
            /\binsert\b/i,
            /\bupdate\b/i,
            /\bdelete\b/i,
            /\btruncate\b/i
        ];
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(trimmedQuery)) {
                return 'Forbidden SQL operation detected for DDL.';
            }
        }
    }

    return null;
}

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

async function enforceSessionTime(session, userId, room_id) {

    // Get START_SESSION marker
    const [startAttempt] = await systemDB.query(
        `SELECT attempt_date FROM attempts
         WHERE user_id = ?
         AND session_id = ?
         AND sql_query = 'START_SESSION'
         LIMIT 1`,
        [userId, session.session_id]
    );

    if (startAttempt.length === 0) {
        return { allowed: false, error: "You must start the session first." };
    }

    const personalStart = new Date(startAttempt[0].attempt_date);
    const personalLimitMs = session.personal_time_limit * 60 * 1000;
    const personalDeadline = new Date(personalStart.getTime() + personalLimitMs);

    const globalDeadline = session.end_time
        ? new Date(session.end_time)
        : new Date(9999999999999);

    const effectiveDeadline =
        personalDeadline < globalDeadline
            ? personalDeadline
            : globalDeadline;

    if (new Date() > effectiveDeadline) {

        const [expired] = await systemDB.query(
            `SELECT 1 FROM attempts
             WHERE user_id = ?
             AND session_id = ?
             AND sql_query = 'TIME_EXPIRED'
             LIMIT 1`,
            [userId, session.session_id]
        );

        if (expired.length === 0) {
            await systemDB.query(
                `INSERT INTO attempts
                 (user_id, case_id, sql_query, is_correct,
                  score_awarded, room_id, session_id, mode)
                 VALUES (?, ?, 'TIME_EXPIRED', 0, 0, ?, ?, 'Rank')`,
                [
                    userId,
                    session.case_id,
                    room_id,
                    session.session_id
                ]
            );
        }

        return { allowed: false, error: "Your time is up." };
    }

    return { allowed: true };
}

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

        const { case_id, sql_query, suspect_id } = req.body;
        const user_id = req.user.user_id;

        if (!user_id || !case_id) {
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

        // Get correct query
        const [caseResult] = await connection.query(
            `SELECT correct_query,
                correct_suspect_id,
                dataset_id,
                base_points,
                difficulty_id,
                mode,
                sql_type
            FROM cases
            WHERE case_id = ?`,
            [case_id]
        );

        if (caseResult.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = caseResult[0];

        const {
            correct_query,
            correct_suspect_id,
            dataset_id,
            base_points,
            difficulty_id,
            mode,
            sql_type
        } = caseData;

        const sqlType = sql_type || 'DQL';

        let isCorrect = false;
        let score = 0;

        if (mode === "Practice") {

            if (!sql_query) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: "SQL query required." });
            }
        
            const validationError = validateStudentQuery(sql_query, sqlType);
            if (validationError) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: validationError });
            }
        
            if (!dataset_id) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'This case is not linked to any dataset.'
                });
            }
        
            if (sqlType === 'DQL') {
                await submissionService.resetPlayground(dataset_id);
            
                let studentResult;
            
                try {
                    const [rows] = await playgroundDB.query(sql_query);
                    studentResult = rows;
                } catch (err) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        error: 'Invalid SQL query.'
                    });
                }
            
                const [correctResult] = await playgroundDB.query(correct_query);
            
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
            
                isCorrect =
                    JSON.stringify(normalizedStudent) === JSON.stringify(normalizedCorrect);
            } else if (sqlType === 'DML') {
                try {
                    isCorrect = await submissionService.verifyDML(dataset_id, sql_query, correct_query);
                } catch (err) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        error: 'Invalid DML query: ' + err.message
                    });
                }
            } else if (sqlType === 'DDL') {
                try {
                    isCorrect = await submissionService.verifyDDL(dataset_id, sql_query, correct_query);
                } catch (err) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        error: 'Invalid DDL query: ' + err.message
                    });
                }
            }
        
            const [difficultyRow] = await connection.query(
                `SELECT multiplier FROM difficulty WHERE difficulty_id = ?`,
                [difficulty_id]
            );
        
            const multiplier = difficultyRow[0].multiplier;
            score = isCorrect ? Math.floor(base_points * multiplier) : 0;
        }

        else if (mode === "Rank") {

            if (!suspect_id) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: "Suspect ID required."
                });
            }
        
            isCorrect = parseInt(suspect_id) === correct_suspect_id;
            score = isCorrect ? base_points : 0;
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

            let streakData = null;

            if (progressResult) {
                streakData = await submissionService.updateUserStreak(
                    connection,
                    user_id
                );
            }

            await connection.query(
                `INSERT INTO attempts
                 (user_id, case_id, sql_query, is_correct, score_awarded, mode)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                 [
                    user_id,
                    case_id,
                    sql_query || suspect_id,
                    isCorrect,
                    score,
                    mode
                ]
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

router.post('/submit-rank', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { room_id, sql_query } = req.body;

        if (!sql_query || sql_query.length < 10) {
            return res.status(400).json({ error: "Query too short" });
        }

        // 1. Get active session
        const [sessions] = await systemDB.query(
            `SELECT gs.*, c.correct_query, c.base_points, c.dataset_id, c.sql_type
             FROM game_sessions gs
             JOIN cases c ON gs.case_id = c.case_id
             WHERE gs.room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            console.log("❌ Query too short");
            return res.status(400).json({ error: "No active game" });
        }

        const session = sessions[0];
        const sqlType = session.sql_type || 'DQL';

        const validationError = validateStudentQuery(sql_query, sqlType);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        if (!session.dataset_id) {
            return res.status(400).json({ error: "Dataset not configured" });
        }
        
        // 🔒 Ensure student is approved in this room
        const [approved] = await systemDB.query(
            `SELECT * FROM room_students
            WHERE room_id = ? AND student_id = ? AND status = 'Approved'`,
            [room_id, userId]
        );

        if (approved.length === 0) {
            return res.status(403).json({ error: "Not approved in this room" });
        }

        // ===============================
        // ⏳ PERSONAL TIMER CHECK
        // ===============================

        // Get first attempt (start marker)
        const [firstAttempt] = await systemDB.query(
            `SELECT attempt_date FROM attempts
            WHERE user_id = ?
            AND session_id = ?
            AND mode = 'Rank'
            AND sql_query = 'START_SESSION'
            LIMIT 1`,
            [userId, session.session_id]
        );

        if (firstAttempt.length === 0) {
            return res.status(400).json({ error: "You must start the session first." });
        }

        const personalStart = new Date(firstAttempt[0].attempt_date);
        const personalLimitMs = session.personal_time_limit * 60 * 1000;

        const personalDeadline = new Date(personalStart.getTime() + personalLimitMs);

        const globalDeadline = session.end_time
            ? new Date(session.end_time)
            : new Date(9999999999999);

        // Effective deadline = earlier one
        const effectiveDeadline =
            personalDeadline < globalDeadline
                ? personalDeadline
                : globalDeadline;

        if (new Date() > effectiveDeadline) {

            // 🔍 Check if already marked expired
            const [expired] = await systemDB.query(
                `SELECT 1 FROM attempts
                WHERE user_id = ?
                AND session_id = ?
                AND sql_query = 'TIME_EXPIRED'
                LIMIT 1`,
                [userId, session.session_id]
            );

            if (expired.length === 0) {
                await systemDB.query(
                    `INSERT INTO attempts
                    (user_id, case_id, sql_query, is_correct, score_awarded, time_taken, room_id, session_id, mode)
                    VALUES (?, ?, 'TIME_EXPIRED', 0, 0, ?, ?, ?, 'Rank')`,
                    [
                        userId,
                        session.case_id,
                        Math.floor((new Date() - personalStart) / 1000),
                        room_id,
                        session.session_id
                    ]
                );
            }

            return res.status(400).json({ error: "Your time is up." });
        }

        // 🔒 Rank Cooldown (5 seconds)
        const [lastAttempt] = await systemDB.query(
            `SELECT attempt_date FROM attempts
            WHERE user_id = ?
            AND room_id = ?
            AND mode = 'Rank'
            ORDER BY attempt_date DESC
            LIMIT 1`,
            [userId, room_id]
        );

        if (lastAttempt.length > 0) {
            const lastTime = new Date(lastAttempt[0].attempt_date);
            const now = new Date();
            const diff = (now - lastTime) / 1000;

            if (diff < 5) {
                return res.status(429).json({
                    error: "Please wait before submitting again."
                });
            }
        }

        // 🔒 Prevent duplicate submission
        const [duplicate] = await systemDB.query(
            `SELECT 1 FROM attempts
            WHERE user_id = ?
            AND room_id = ?
            AND sql_query = ?
            AND mode = 'Rank'
            LIMIT 1`,
            [userId, room_id, sql_query]
        );

        if (duplicate.length > 0) {
            return res.json({
                correct: false,
                score: 0,
                executionTimeMs: null,
                attemptNumber: null,
                message: "You already submitted this query."
            });
        }

        // 3. Prevent multiple correct
        const [existing] = await systemDB.query(
            `SELECT 1 FROM attempts
             WHERE user_id = ?
             AND case_id = ?
             AND room_id = ?
             AND mode = 'Rank'
             AND is_correct = 1
             LIMIT 1`,
            [userId, session.case_id, room_id]
          );

        if (existing.length > 0) {
            return res.status(400).json({ error: "Already solved" });
        }

        // 4. Execute student query safely
        let studentResult;
        let executionTimeMs = 0;
        let isCorrect = false;
        let score = 0;

        try {

            const startTime = process.hrtime.bigint();
            
            if (sqlType === 'DQL') {
                const [result] = await playgroundDB.query(sql_query);
                studentResult = result;

                // 7️⃣ Get correct result
                const [correctResult] = await playgroundDB.query(session.correct_query);

                // Normalize both results
                const normalize = (rows) =>
                    JSON.stringify(
                        rows.map(r => Object.values(r)).sort()
                    );

                isCorrect =
                    normalize(studentResult) === normalize(correctResult);
            } else if (sqlType === 'DML') {
                isCorrect = await submissionService.verifyDML(session.dataset_id, sql_query, session.correct_query);
            } else if (sqlType === 'DDL') {
                isCorrect = await submissionService.verifyDDL(session.dataset_id, sql_query, session.correct_query);
            }
            
            const endTime = process.hrtime.bigint();
            executionTimeMs = Number(endTime - startTime) / 1_000_000; // ms
            
            if (isCorrect) {
                score = session.base_points;
            }
        } catch (sqlError) {
            console.error("Student SQL Error:", sqlError.message);

            const msg = sqlError.message.toLowerCase();

            if (msg.includes("syntax")) {
                return res.status(400).json({
                    error: "Invalid SQL syntax."
                });
            }

            if (msg.includes("doesn't exist")) {
                return res.status(400).json({
                    error: "Table does not exist."
                });
            }

            if (msg.includes("unknown column")) {
                return res.status(400).json({
                    error: "Unknown column name."
                });
            }

            return res.status(400).json({
                error: "Invalid SQL query."
            });
        }

        // 5. Time taken
        const timeTaken = Math.floor(
            (new Date() - personalStart) / 1000
        );

        // Count REAL SQL attempts only (exclude markers)
        const [attemptCountRows] = await systemDB.query(
            `SELECT COUNT(*) AS totalAttempts
            FROM attempts
            WHERE user_id = ?
            AND session_id = ?
            AND mode = 'Rank'
            AND sql_query NOT IN ('START_SESSION', 'TIME_EXPIRED')`,
            [userId, session.session_id]
        );

        const attemptNumber = attemptCountRows[0].totalAttempts + 1;

        // 6. Save attempt ✅ FIXED
        await systemDB.query(
            `INSERT INTO attempts
             (user_id, case_id, sql_query, is_correct, score_awarded, time_taken, execution_time_ms, attempt_number, room_id, session_id, mode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Rank')`,
             [
                userId,
                session.case_id,
                sql_query,
                isCorrect ? 1 : 0,
                score,
                timeTaken,
                executionTimeMs,
                attemptNumber,
                room_id,
                session.session_id,
            ]
        );

        res.json({
            isCorrect,
            score,
            executionTimeMs,
            attemptNumber
        });

    } catch (error) {
        console.error("SUBMIT RANK ERROR:", error);
        res.status(500).json({ error: "Submission failed" });
    }
});

router.post('/rank/start', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { room_id } = req.body;

        // Get active session
        const [sessions] = await systemDB.query(
            `SELECT * FROM game_sessions gs
             WHERE room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            return res.status(400).json({ error: "No active game" });
        }

        const session = sessions[0];

        // 🔒 Prevent starting if global session already ended
        if (new Date() > new Date(session.end_time)) {
            return res.status(400).json({ error: "Game already ended" });
        }

        // Check approved
        const [approved] = await systemDB.query(
            `SELECT 1 FROM room_students
             WHERE room_id = ?
             AND student_id = ?
             AND status = 'Approved'`,
            [room_id, userId]
        );

        if (approved.length === 0) {
            return res.status(403).json({ error: "Not approved" });
        }

        // Check already started
        const [started] = await systemDB.query(
            `SELECT 1 FROM attempts
             WHERE user_id = ?
             AND session_id = ?
             AND sql_query = 'START_SESSION'
             LIMIT 1`,
            [userId, session.session_id]
        );

        if (started.length > 0) {
            return res.status(400).json({ error: "Already started" });
        }

        // Insert START marker
        await systemDB.query(
            `INSERT INTO attempts
            (user_id, case_id, sql_query, is_correct, score_awarded, time_taken, room_id, session_id, mode)
            VALUES (?, ?, 'START_SESSION', 0, 0, 0, ?, ?, 'Rank')`,
            [
                userId,
                session.case_id,
                room_id,
                session.session_id
            ]
        );

        res.json({ message: "Timer started" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to start session" });
    }
});

router.get('/rank/status/:room_id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { room_id } = req.params;

        // 1️⃣ Get active session
        const [sessions] = await systemDB.query(
            `SELECT * FROM game_sessions gs
             WHERE room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            return res.json({ hasActiveSession: false });
        }

        const session = sessions[0];

        // 2️⃣ Check if already solved this session
        const [solved] = await systemDB.query(
            `SELECT 1 FROM attempts
            WHERE user_id = ?
            AND session_id = ?
            AND mode = 'Rank'
            AND is_correct = 1
            LIMIT 1`,
            [userId, session.session_id]
        );

        const alreadySolved = solved.length > 0;

        // 2️⃣ Check if student started
        const [startAttempt] = await systemDB.query(
            `SELECT attempt_date
             FROM attempts
             WHERE user_id = ?
             AND session_id = ?
             AND mode = 'Rank'
             AND sql_query = 'START_SESSION'
             LIMIT 1`,
            [userId, session.session_id]
        );

        if (startAttempt.length === 0) {
            return res.json({
                hasActiveSession: true,
                hasStarted: false,
                alreadySolved
            });
        }

        const personalStart = new Date(startAttempt[0].attempt_date);
        const personalLimitMs = session.personal_time_limit * 60 * 1000;
        const personalDeadline = new Date(personalStart.getTime() + personalLimitMs);
        const globalDeadline = new Date(session.end_time);

        const effectiveDeadline =
            personalDeadline < globalDeadline
                ? personalDeadline
                : globalDeadline;

        if (new Date() > effectiveDeadline) {

            // Check if already marked expired
            const [expired] = await systemDB.query(
                `SELECT 1 FROM attempts
                WHERE user_id = ?
                AND session_id = ?
                AND sql_query = 'TIME_EXPIRED'
                LIMIT 1`,
                [userId, session.session_id]
            );

            if (expired.length === 0) {
                await systemDB.query(
                    `INSERT INTO attempts
                    (user_id, case_id, sql_query, is_correct, score_awarded, time_taken, room_id, session_id, mode)
                    VALUES (?, ?, 'TIME_EXPIRED', 0, 0, ?, ?, ?, 'Rank')`,
                    [
                        userId,
                        session.case_id,
                        Math.floor((new Date() - personalStart) / 1000),
                        room_id,
                        session.session_id
                    ]
                );
            }

            return res.json({
                hasActiveSession: true,
                hasStarted: true,
                expired: true,
                alreadySolved,
                personalStart,
                effectiveDeadline,
                session_id: session.session_id,
                case_id: session.case_id
            });
        }

        return res.json({
            hasActiveSession: true,
            hasStarted: true,
            alreadySolved,
            personalStart,
            effectiveDeadline,
            session_id: session.session_id,
            case_id: session.case_id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch rank status" });
    }
});

router.post('/rank/preview-query', authenticateToken, async (req, res) => {
    let connection;
    try {
        const userId = req.user.user_id;
        const { room_id, sql_query } = req.body;

        if (!sql_query || sql_query.length < 5) {
            return res.status(400).json({ error: "Query too short" });
        }

        const [sessions] = await systemDB.query(
            `SELECT gs.*, c.dataset_id, c.sql_type, c.setup_sql, c.expected_result_sql
             FROM game_sessions gs
             JOIN cases c ON gs.case_id = c.case_id
             WHERE gs.room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            return res.status(400).json({ error: "No active game" });
        }

        const session = sessions[0];

        const validationError = validateStudentQuery(sql_query, session.sql_type || 'DQL');
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const timeCheck = await enforceSessionTime(session, userId, room_id);
        if (!timeCheck.allowed) {
            return res.status(403).json({ error: timeCheck.error });
        }

        const startTime = Date.now();
        let rows = [];
        const isDql = (session.sql_type || 'DQL') === 'DQL';

        if (!isDql) {
            const dbName = await recreateStudentDatabase(userId);
            connection = await playgroundDB.getConnection();
            await connection.query(`USE \`${dbName}\``);

            await runSetup(connection, session.setup_sql);

            // Execute DML/DDL query
            await connection.query(sql_query);

            // Fetch table state preview
            if (session.expected_result_sql && session.expected_result_sql.trim()) {
                const [rowsExpected] = await connection.query(session.expected_result_sql);
                rows = rowsExpected;
            }
        } else {
            const [result] = await playgroundDB.query(sql_query);
            rows = result;
        }

        const executionTime = Date.now() - startTime;

        res.json({
            rows,
            executionTime
        });

    } catch (error) {
        res.status(400).json({ error: "SQL Error: " + error.message });
    } finally {
        if (connection) connection.release();
    }
});

router.post('/rank/run-query', authenticateToken, async (req, res) => {
    let connection;
    try {
        const userId = req.user.user_id;
        const { room_id, sql_query } = req.body;

        if (!sql_query || sql_query.length < 5) {
            return res.status(400).json({ error: "Query too short" });
        }

        // 1️⃣ Get active session with all case details
        const [sessions] = await systemDB.query(
            `SELECT gs.*, c.dataset_id, c.sql_type, c.setup_sql, c.expected_result_sql, c.correct_query, c.correct_suspect_id, c.base_points
             FROM game_sessions gs
             JOIN cases c ON gs.case_id = c.case_id
             WHERE gs.room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            return res.status(400).json({ error: "No active game" });
        }

        const session = sessions[0];

        const validationError = validateStudentQuery(sql_query, session.sql_type || 'DQL');
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const timeCheck = await enforceSessionTime(session, userId, room_id);
        if (!timeCheck.allowed) {
            return res.status(403).json({ error: timeCheck.error });
        }

        if (!session.dataset_id) {
            return res.status(400).json({ error: "Dataset not configured" });
        }

        const startTime = Date.now();
        let rows = [];
        const isDql = (session.sql_type || 'DQL') === 'DQL';
        let overallCorrect = false;

        try {
            if (!isDql) {
                // Isolate DML/DDL execution in student schema
                const dbName = await recreateStudentDatabase(userId);
                connection = await playgroundDB.getConnection();
                await connection.query(`USE \`${dbName}\``);

                await runSetup(connection, session.setup_sql);

                // Run student query
                const [result] = await connection.query(sql_query);
                rows = result;

                // Preview using expected_result_sql if defined
                if (session.expected_result_sql && session.expected_result_sql.trim()) {
                    const [rowsExpected] = await connection.query(session.expected_result_sql);
                    rows = rowsExpected;
                }

                // If case has no objectives (e.g. DML case 27 or DDL case 28), check overall state correctness
                const [objectivesCount] = await systemDB.query(
                    `SELECT COUNT(*) AS count FROM case_objectives WHERE case_id = ?`,
                    [session.case_id]
                );

                if (objectivesCount[0].count === 0 && session.expected_result_sql) {
                    // Check student state vs correct state
                    let expectedState = [];
                    const tempDb = `playground_temp_${userId}`;
                    try {
                        await systemDB.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
                        await systemDB.query(`CREATE DATABASE \`${tempDb}\``);
                        const tempConn = await playgroundDB.getConnection();
                        await tempConn.query(`USE \`${tempDb}\``);
                        await runSetup(tempConn, session.setup_sql);
                        await tempConn.query(session.correct_query);
                        const [expState] = await tempConn.query(session.expected_result_sql);
                        expectedState = expState;
                        tempConn.release();
                        await systemDB.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
                    } catch (e) {
                        console.error("Temp state error:", e.message);
                    }

                    if (rowsMatch(rows, expectedState)) {
                        overallCorrect = true;
                    }
                }
            } else {
                const [result] = await playgroundDB.query(sql_query);
                rows = result;
            }

            // ===============================
            // 🎯 OBJECTIVE AUTO-CHECK
            // ===============================
            const [objectives] = await systemDB.query(
                `SELECT * FROM case_objectives
                 WHERE case_id = ?
                 ORDER BY objective_order ASC`,
                [session.case_id]
            );

            for (const objective of objectives) {
                const lowerQuery = sql_query.toLowerCase();
                let isMatch = false;

                if (objective.validation_type === "pattern") {
                    if (objective.required_keyword) {
                        const keyword = objective.required_keyword.toLowerCase().trim();
                        const normalizedQuery = lowerQuery.replace(/\s+/g, ' ');
                        if (normalizedQuery.includes(keyword)) {
                            isMatch = true;
                        }
                    }
                } else if (objective.validation_type === "result") {
                    if (objective.expected_query && objective.expected_query.trim() !== "") {
                        let expectedResult = [];
                        try {
                            if (!isDql) {
                                // For DML/DDL, expected result SQL is run against correct query setup
                                const tempDb = `playground_temp_${userId}`;
                                await systemDB.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
                                await systemDB.query(`CREATE DATABASE \`${tempDb}\``);
                                const tempConn = await playgroundDB.getConnection();
                                await tempConn.query(`USE \`${tempDb}\``);
                                await runSetup(tempConn, session.setup_sql);
                                await tempConn.query(session.correct_query);
                                const [rowsExpected] = await tempConn.query(objective.expected_query);
                                expectedResult = rowsExpected;
                                tempConn.release();
                                await systemDB.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
                            } else {
                                const [rowsExpected] = await playgroundDB.query(objective.expected_query);
                                expectedResult = rowsExpected;
                            }
                        } catch (err) {
                            console.error("❌ Expected Query Error:", err.message);
                            continue;
                        }

                        let compareRows = rows;
                        if (!isDql && connection) {
                            // Run the objective query against the student's isolated database state
                            try {
                                const [studentActual] = await connection.query(objective.expected_query);
                                compareRows = studentActual;
                            } catch (e) {
                                compareRows = [];
                            }
                        }

                        if (rowsMatch(compareRows, expectedResult)) {
                            isMatch = true;
                        }
                    }
                }

                if (isMatch) {
                    // Check if previous objectives are completed first
                    const [previousObjectives] = await systemDB.query(
                        `SELECT COUNT(*) AS remaining
                          FROM case_objectives co
                          LEFT JOIN session_objectives so
                            ON co.objective_id = so.objective_id
                            AND so.session_id = ?
                            AND so.user_id = ?
                            AND so.is_completed = 1
                          WHERE co.case_id = ?
                          AND co.objective_order < ?
                          AND so.objective_id IS NULL`,
                        [
                            session.session_id,
                            userId,
                            session.case_id,
                            objective.objective_order
                        ]
                    );

                    if (previousObjectives[0].remaining > 0) {
                        continue;
                    }

                    // Check if already completed
                    const [existing] = await systemDB.query(
                        `SELECT 1 FROM session_objectives
                          WHERE session_id = ?
                          AND user_id = ?
                          AND objective_id = ?
                          AND is_completed = 1
                          LIMIT 1`,
                        [session.session_id, userId, objective.objective_id]
                    );

                    if (existing.length === 0) {
                        await systemDB.query(
                            `INSERT IGNORE INTO session_objectives
                              (session_id, user_id, objective_id,
                               objective_text, points_awarded,
                               is_completed, completed_at)
                              VALUES (?, ?, ?, ?, ?, 1, NOW())`,
                            [
                                session.session_id,
                                userId,
                                objective.objective_id,
                                objective.objective_text,
                                objective.points
                            ]
                        );
                    }
                }
            }
        } catch (sqlError) {
            return res.status(400).json({
                error: "SQL Error: " + sqlError.message
            });
        } finally {
            if (connection) connection.release();
        }

        const executionTime = Date.now() - startTime;

        const [progress] = await systemDB.query(
            `SELECT SUM(points_awarded) AS totalPoints
              FROM session_objectives
              WHERE session_id = ?
              AND user_id = ?
              AND is_completed = 1`,
            [session.session_id, userId]
        );

        const objectivePoints = progress[0].totalPoints || 0;

        // Save attempt log
        await systemDB.query(
            `INSERT INTO attempts (user_id, case_id, sql_query, is_correct, score_awarded, room_id, session_id, mode)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Rank')`,
            [userId, session.case_id, sql_query.substring(0, 1000), overallCorrect ? 1 : 0, overallCorrect ? session.base_points : 0, room_id, session.session_id]
        );

        res.json({
            rows,
            executionTime,
            objectivePoints,
            isCorrect: overallCorrect
        });

    } catch (error) {
        console.error("🔥 RUN QUERY ERROR:", error);
        res.status(500).json({ error: "Run query failed" });
    }
});

router.get('/rank/schema/:room_id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { room_id } = req.params;

        // 1️⃣ Get active session
        const [sessions] = await systemDB.query(
            `SELECT gs.*, c.dataset_id, c.sql_type
             FROM game_sessions gs
             JOIN cases c ON gs.case_id = c.case_id
             WHERE gs.room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            return res.status(400).json({ error: "No active game" });
        }

        const session = sessions[0];

        const timeCheck = await enforceSessionTime(session, userId, room_id);
        if (!timeCheck.allowed) {
            return res.status(403).json({ error: timeCheck.error });
        }

        if (!session.dataset_id) {
            return res.status(400).json({ error: "Dataset not configured" });
        }

        const dbName = session.sql_type === 'DQL' ? 'detective_query_playground' : `playground_user_${userId}`;

        // 3️⃣ Fetch schema from information_schema
        const [columns] = await playgroundDB.query(
            `SELECT table_name, column_name, data_type
             FROM information_schema.columns
             WHERE table_schema = ?
             ORDER BY table_name, ordinal_position`,
            [dbName]
        );

        // 4️⃣ Group by table
        const schema = {};

        for (const col of columns) {
            if (!schema[col.table_name]) {
                schema[col.table_name] = [];
            }

            schema[col.table_name].push({
                column: col.column_name,
                type: col.data_type
            });
        }

        res.json({ schema });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load schema" });
    }
});

router.post('/rank/submit-final', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { room_id, suspect_id } = req.body;

        // 1️⃣ Get active session
        const [sessions] = await systemDB.query(
            `SELECT gs.*, c.correct_suspect_id, c.base_points, c.sql_type
             FROM game_sessions gs
             JOIN cases c ON gs.case_id = c.case_id
             WHERE gs.room_id = ?
             AND gs.status = 'Active'
             LIMIT 1`,
            [room_id]
        );

        if (sessions.length === 0) {
            return res.status(400).json({ error: "No active game" });
        }

        const session = sessions[0];

        const isDql = session.sql_type === 'DQL' && session.correct_suspect_id !== null;

        if (isDql && !suspect_id) {
            return res.status(400).json({ error: "Suspect ID required." });
        }

        // 2️⃣ Prevent double final submission
        const [existingFinal] = await systemDB.query(
            `SELECT 1 FROM attempts
             WHERE user_id = ?
             AND session_id = ?
             AND final_answer IS NOT NULL
             LIMIT 1`,
            [userId, session.session_id]
        );

        if (existingFinal.length > 0) {
            return res.status(400).json({ error: "Final answer already submitted." });
        }

        // 3️⃣ CHECK PERSONAL + GLOBAL TIMER
        // Get START_SESSION marker
        const [startAttempt] = await systemDB.query(
            `SELECT attempt_date FROM attempts
            WHERE user_id = ?
            AND session_id = ?
            AND sql_query = 'START_SESSION'
            LIMIT 1`,
            [userId, session.session_id]
        );

        if (startAttempt.length === 0) {
            return res.status(400).json({ error: "You must start the session first." });
        }

        const personalStart = new Date(startAttempt[0].attempt_date);

        const personalLimitMs = session.personal_time_limit * 60 * 1000;
        const personalDeadline = new Date(personalStart.getTime() + personalLimitMs);

        const globalDeadline = session.end_time
            ? new Date(session.end_time)
            : new Date(9999999999999); // far future fallback

        // Effective deadline = earlier one
        const effectiveDeadline =
            personalDeadline < globalDeadline
                ? personalDeadline
                : globalDeadline;

        // 🚨 BLOCK if expired
        if (new Date() > effectiveDeadline) {

            // Insert TIME_EXPIRED marker (only once)
            const [expired] = await systemDB.query(
                `SELECT 1 FROM attempts
                WHERE user_id = ?
                AND session_id = ?
                AND sql_query = 'TIME_EXPIRED'
                LIMIT 1`,
                [userId, session.session_id]
            );

            if (expired.length === 0) {
                await systemDB.query(
                    `INSERT INTO attempts
                    (user_id, case_id, sql_query, is_correct,
                    score_awarded, room_id, session_id, mode)
                    VALUES (?, ?, 'TIME_EXPIRED', 0, 0, ?, ?, 'Rank')`,
                    [
                        userId,
                        session.case_id,
                        room_id,
                        session.session_id
                    ]
                );
            }

            return res.status(400).json({
                error: "Time expired. Final submission locked."
            });
        }

        // 🎯 Check correctness
        let isCorrect = false;
        if (isDql) {
            isCorrect = parseInt(suspect_id) === session.correct_suspect_id;
        } else {
            // For DML/DDL or suspectless cases: solved if all objectives completed, or if any correct attempt exists
            const [objs] = await systemDB.query(
                `SELECT COUNT(*) AS total FROM case_objectives WHERE case_id = ?`,
                [session.case_id]
            );
            const totalObjs = objs[0].total;

            if (totalObjs > 0) {
                const [comp] = await systemDB.query(
                    `SELECT COUNT(*) AS completed FROM session_objectives 
                     WHERE session_id = ? AND user_id = ? AND is_completed = 1`,
                    [session.session_id, userId]
                );
                isCorrect = comp[0].completed >= totalObjs;
            } else {
                const [attempts] = await systemDB.query(
                    `SELECT 1 FROM attempts 
                     WHERE user_id = ? AND session_id = ? AND is_correct = 1 LIMIT 1`,
                    [userId, session.session_id]
                );
                isCorrect = attempts.length > 0;
            }
        }

        // Points allocation
        let finalAnswerPoints = 0;
        let objectivePoints = 0;
        let totalScore = 0;

        if (isDql) {
            finalAnswerPoints = isCorrect ? Math.floor(Number(session.base_points) * 0.3) : 0;
            const [objectiveRows] = await systemDB.query(
              `SELECT SUM(points_awarded) AS totalPoints
               FROM session_objectives
               WHERE session_id = ?
               AND user_id = ?
               AND is_completed = 1`,
              [session.session_id, userId]
            );
            objectivePoints = Number(objectiveRows[0].totalPoints) || 0;
            totalScore = Number(objectivePoints) + Number(finalAnswerPoints);
        } else {
            // DML/DDL award full base points on successful completion
            totalScore = isCorrect ? session.base_points : 0;
            if (!isCorrect) {
                // If not fully correct, award partial objective points if any
                const [objectiveRows] = await systemDB.query(
                  `SELECT SUM(points_awarded) AS totalPoints
                   FROM session_objectives
                   WHERE session_id = ?
                   AND user_id = ?
                   AND is_completed = 1`,
                  [session.session_id, userId]
                );
                objectivePoints = Number(objectiveRows[0].totalPoints) || 0;
                totalScore = objectivePoints;
            } else {
                objectivePoints = session.base_points;
            }
        }
        
        // 5️⃣ Save final attempt
        await systemDB.query(
            `INSERT INTO attempts
             (user_id, case_id, final_answer, is_correct, score_awarded,
              room_id, session_id, mode)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Rank')`,
            [
                userId,
                session.case_id,
                isDql ? suspect_id : 'COMPLETED',
                isCorrect ? 1 : 0,
                totalScore,
                room_id,
                session.session_id
            ]
        );

        // 6️⃣ Always mark case as participated (save to user_case_progress)
        //    XP + streak only awarded if suspect/case is correct
        if (totalScore > 0 || isCorrect) {
            await submissionService.updateUserProgress(
                systemDB,
                userId,
                session.case_id,
                totalScore,
                true   // pass true so updateUserProgress always runs the INSERT/UPDATE
            );
        }

        if (isCorrect) {
            await submissionService.updateUserStreak(
                systemDB,
                userId
            );
        }

        res.json({
            correct: isCorrect,
            objectivePoints,
            finalAnswerPoints,
            totalScore
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Final submission failed" });
    }
});

module.exports = router;