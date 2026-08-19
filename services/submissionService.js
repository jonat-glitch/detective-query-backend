const { systemDB, playgroundDB } = require('../db');

async function checkSubmissionCooldown(userId) {
    const [lastAttempt] = await systemDB.query(
        `SELECT attempt_date
         FROM attempts
         WHERE user_id = ?
         ORDER BY attempt_date DESC
         LIMIT 1`,
        [userId]
    );

    if (lastAttempt.length === 0) return null;

    const lastTime = new Date(lastAttempt[0].attempt_date);
    const currentTime = new Date();

    const diffInSeconds = Math.floor((currentTime - lastTime) / 1000);
    const cooldownSeconds = 5;

    if (diffInSeconds < cooldownSeconds) {
        return cooldownSeconds - diffInSeconds;
    }

    return null;
}

async function resetPlayground(datasetId) {
    if (!datasetId) return;

    try {
        const [datasetRows] = await systemDB.query(
            `SELECT schema_definition, sample_data
             FROM datasets
             WHERE dataset_id = ?`,
            [datasetId]
        );

        if (datasetRows.length === 0) {
            console.warn(`Dataset #${datasetId} not found in database.`);
            return;
        }

        const schemaSQL = datasetRows[0].schema_definition;
        const sampleDataSQL = datasetRows[0].sample_data;

        if (!schemaSQL) return;

        // Disable FK checks
        await playgroundDB.query('SET FOREIGN_KEY_CHECKS = 0');

        // Execute schema statements
        const statements = schemaSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await playgroundDB.query(statement);
            } catch (err) {
                console.warn("Schema execution warning:", err.message);
            }
        }

        // Insert sample data
        if (sampleDataSQL && sampleDataSQL.trim() !== '') {
            const insertStatements = sampleDataSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const statement of insertStatements) {
                try {
                    await playgroundDB.query(statement);
                } catch (err) {
                    console.warn("Sample data insertion warning:", err.message);
                }
            }
        }

        // Re-enable FK checks
        await playgroundDB.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (error) {
        console.error("resetPlayground error:", error);
    }
}

async function updateUserProgress(connection, userId, caseId, score, isCorrect) {

    // Only run if student got it correct OR we explicitly want to save progress
    if (!isCorrect) return null;

    const [existing] = await connection.query(
        `SELECT highest_score
         FROM user_case_progress
         WHERE user_id = ? AND case_id = ?`,
        [userId, caseId]
    );

    let previousScore = 0;
    if (existing.length > 0) {
        previousScore = existing[0].highest_score || 0;
    }

    // Always update/insert progress
    await connection.query(
        `INSERT INTO user_case_progress
         (user_id, case_id, status, highest_score, is_unlocked, completed_at)
         VALUES (?, ?, 'Completed', ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
            status = 'Completed',
            highest_score = GREATEST(highest_score, VALUES(highest_score)),
            is_unlocked = 1,
            completed_at = NOW()`,
        [userId, caseId, score]
    );

    // Only award XP if the student beats their previous high score
    if (score > previousScore) {
        const pointsToAdd = score - previousScore;
        await connection.query(
            `UPDATE users
             SET total_points = COALESCE(total_points, 0) + ?
             WHERE user_id = ?`,
            [pointsToAdd, userId]
        );
    }

    const [userData] = await connection.query(
        `SELECT total_points FROM users WHERE user_id = ?`,
        [userId]
    );

    const totalPoints = userData[0].total_points;
    const newLevel = Math.floor(totalPoints / 500) + 1;

    await connection.query(
        `UPDATE users
         SET current_level = ?
         WHERE user_id = ?`,
         [newLevel, userId]
    );

    return {
        totalPoints,
        newLevel
    };
}

async function handleAchievements(connection, userId, totalPoints) {

    const unlockedNow = [];

    // Get all achievements
    const [allAchievements] = await connection.query(
        `SELECT achievement_id, title, description, points_required
         FROM achievements`
    );

    // Get solved count
    const [solvedRows] = await connection.query(
        `SELECT COUNT(DISTINCT case_id) AS solvedCount
         FROM user_case_progress
         WHERE user_id = ? AND status = 'Completed'`,
        [userId]
    );

    const solvedCount = solvedRows[0].solvedCount;

    // Get streak
    const [streakRows] = await connection.query(
        `SELECT current_streak
         FROM user_streaks
         WHERE user_id = ?`,
        [userId]
    );

    const currentStreak =
        streakRows.length > 0 ? streakRows[0].current_streak : 0;

    for (const achievement of allAchievements) {

        let shouldUnlock = false;

        // 🎯 XP-Based Achievement
        if (achievement.points_required !== null) {
            if (totalPoints >= achievement.points_required) {
                shouldUnlock = true;
            }
        }

        // 🥇 First Blood
        if (achievement.title === "First Blood" && solvedCount >= 1) {
            shouldUnlock = true;
        }

        // 🧠 SQL Apprentice
        if (achievement.title === "SQL Apprentice" && solvedCount >= 5) {
            shouldUnlock = true;
        }

        // 🏆 SQL Master
        if (achievement.title === "SQL Master" && solvedCount >= 20) {
            shouldUnlock = true;
        }

        // 🔥 On Fire
        if (achievement.title === "On Fire" && currentStreak >= 3) {
            shouldUnlock = true;
        }

        if (shouldUnlock) {

            const [existing] = await connection.query(
                `SELECT 1
                 FROM user_achievements
                 WHERE user_id = ? AND achievement_id = ?`,
                [userId, achievement.achievement_id]
            );

            if (existing.length === 0) {

                await connection.query(
                    `INSERT INTO user_achievements (user_id, achievement_id)
                     VALUES (?, ?)`,
                    [userId, achievement.achievement_id]
                );

                unlockedNow.push({
                    id: achievement.achievement_id,
                    title: achievement.title,
                    description: achievement.description
                });
            }
        }
    }

    return unlockedNow;
}

async function getUnlockedDifficulties(userId) {
    // Get all difficulties
    const [difficulties] = await systemDB.query(
        `SELECT difficulty_id FROM difficulty ORDER BY difficulty_id ASC`
    );

    const unlocked = [];

    for (const diff of difficulties) {

        if (diff.difficulty_id === 1) {
            unlocked.push(1);
            continue;
        }

        // Check previous difficulty completion
        const [casesInPrevDifficulty] = await systemDB.query(
            `SELECT case_id FROM cases WHERE difficulty_id = ?`,
            [diff.difficulty_id - 1]
        );

        const caseIds = casesInPrevDifficulty.map(c => c.case_id);

        if (caseIds.length === 0) continue;

        const [completed] = await systemDB.query(
            `SELECT COUNT(*) AS completedCount
             FROM user_case_progress
             WHERE user_id = ?
             AND case_id IN (?)
             AND status = 'Completed'`,
            [userId, caseIds]
        );

        if (completed[0].completedCount === caseIds.length) {
            unlocked.push(diff.difficulty_id);
        }
    }

    return unlocked;
}

async function updateUserStreak(connection, userId) {

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const [rows] = await connection.query(
        `SELECT current_streak, last_solved_date
         FROM user_streaks
         WHERE user_id = ?`,
        [userId]
    );

    let newStreak = 1;
    let bonusXP = 0;

    if (rows.length === 0) {
        // First time solving
        await connection.query(
            `INSERT INTO user_streaks (user_id, current_streak, last_solved_date)
             VALUES (?, 1, ?)`,
            [userId, todayStr]
        );
        newStreak = 1;
    } else {

        const lastDate = rows[0].last_solved_date
            ? rows[0].last_solved_date.toISOString().split('T')[0]
            : null;

        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastDate === todayStr) {
            // Already solved today
            newStreak = rows[0].current_streak;
        }
        else if (lastDate === yesterdayStr) {
            newStreak = rows[0].current_streak + 1;
        }
        else {
            newStreak = 1;
        }

        await connection.query(
            `UPDATE user_streaks
             SET current_streak = ?, last_solved_date = ?
             WHERE user_id = ?`,
            [newStreak, todayStr, userId]
        );
    }

    // 🔥 BONUS LOGIC (scales but safe)
    bonusXP = newStreak * 5;

    await connection.query(
        `UPDATE users
         SET total_points = total_points + ?
         WHERE user_id = ?`,
        [bonusXP, userId]
    );

    return {
        currentStreak: newStreak,
        bonusXP
    };
}

async function dumpPlaygroundData() {
    const [tables] = await playgroundDB.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    const dump = {};
    for (const tableName of tableNames) {
        const [rows] = await playgroundDB.query(`SELECT * FROM \`${tableName}\``);
        dump[tableName] = rows.map(row => {
            const sortedRow = {};
            Object.keys(row).sort().forEach(key => {
                sortedRow[key] = row[key];
            });
            return sortedRow;
        }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    return dump;
}

async function dumpPlaygroundSchema() {
    const [rows] = await playgroundDB.query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'detective_query_playground'
        ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    return rows;
}

async function verifyDML(datasetId, studentQuery, correctQuery) {
    // 1. Reset and run student query
    await resetPlayground(datasetId);
    await playgroundDB.query(studentQuery);
    const studentData = await dumpPlaygroundData();

    // 2. Reset and run correct query
    await resetPlayground(datasetId);
    await playgroundDB.query(correctQuery);
    const correctData = await dumpPlaygroundData();

    // 3. Reset playground to clean state
    await resetPlayground(datasetId);

    // 4. Compare JSON strings
    return JSON.stringify(studentData) === JSON.stringify(correctData);
}

async function verifyDDL(datasetId, studentQuery, correctQuery) {
    // 1. Reset and run student query
    await resetPlayground(datasetId);
    await playgroundDB.query(studentQuery);
    const studentSchema = await dumpPlaygroundSchema();

    // 2. Reset and run correct query
    await resetPlayground(datasetId);
    await playgroundDB.query(correctQuery);
    const correctSchema = await dumpPlaygroundSchema();

    // 3. Reset playground to clean state
    await resetPlayground(datasetId);

    // 4. Compare JSON strings
    return JSON.stringify(studentSchema) === JSON.stringify(correctSchema);
}

module.exports = {
    checkSubmissionCooldown,
    resetPlayground,
    updateUserProgress,
    handleAchievements,
    getUnlockedDifficulties,
    updateUserStreak,
    verifyDML,
    verifyDDL
};