/**
 * Shared in-memory proctoring state registry.
 * Extracted into its own module so both roomRoutes and submissionRoutes
 * can reference the same Map instance (Node.js module caching guarantees
 * the same object is returned on every require()).
 *
 * C2 FIX: State is now persisted to `proctor_sessions` table (auto-created on
 * first use). On server restart, getStudentProctorRecord() falls back to the DB
 * so disqualified students remain blocked even after a Render cold start.
 *
 * Proctor records are cleared from both memory and DB when:
 *  - A new game session starts (/activate)
 *  - The game session ends (/end-game, /reset)
 *  - Teacher manually resets a student (/proctor-reset)
 */

const { systemDB } = require('../db');

// ── Ensure proctor_sessions table exists (runs once on module load) ──────────
// This is a runtime/session-scoped table — not in the ERD, no schema changes.
systemDB.query(`
    CREATE TABLE IF NOT EXISTS proctor_sessions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        room_id      INT NOT NULL,
        user_id      INT NOT NULL,
        session_id   INT DEFAULT NULL,
        full_name    VARCHAR(255) DEFAULT '',
        strike_count INT DEFAULT 0,
        penalty_points INT DEFAULT 0,
        is_disqualified TINYINT(1) DEFAULT 0,
        last_violation  VARCHAR(100) DEFAULT NULL,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_room_user (room_id, user_id)
    )
`).catch(err => console.error('[proctorState] Failed to create proctor_sessions table:', err.message));

// roomId (string) → Map(userId (number) → incidentRecord)
const activeProctorIncidents = new Map();

function getOrCreateRoomProctorMap(roomId) {
    const key = String(roomId);
    if (!activeProctorIncidents.has(key)) {
        activeProctorIncidents.set(key, new Map());
    }
    return activeProctorIncidents.get(key);
}

/**
 * Persist a proctor record to the DB (upsert).
 * Called every time a student's strike count changes.
 * Fire-and-forget — does not block the response.
 */
async function persistProctorRecord(roomId, record) {
    try {
        await systemDB.query(
            `INSERT INTO proctor_sessions
                (room_id, user_id, full_name, strike_count, penalty_points, is_disqualified, last_violation)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                full_name       = VALUES(full_name),
                strike_count    = VALUES(strike_count),
                penalty_points  = VALUES(penalty_points),
                is_disqualified = VALUES(is_disqualified),
                last_violation  = VALUES(last_violation)`,
            [
                roomId,
                record.user_id,
                record.full_name || '',
                record.strike_count,
                record.penalty_points,
                record.is_disqualified ? 1 : 0,
                record.last_violation || null,
            ]
        );
    } catch (err) {
        console.error('[proctorState] Failed to persist proctor record:', err.message);
    }
}

/**
 * Remove all proctor records for a room from the DB.
 * Called when a new session starts or the session ends.
 */
async function clearPersistedRoom(roomId) {
    try {
        await systemDB.query(
            `DELETE FROM proctor_sessions WHERE room_id = ?`,
            [String(roomId)]
        );
    } catch (err) {
        console.error('[proctorState] Failed to clear proctor_sessions for room', roomId, ':', err.message);
    }
}

/**
 * Remove a single student's proctor record from the DB.
 * Called when teacher resets an individual student.
 */
async function clearPersistedStudent(roomId, userId) {
    try {
        await systemDB.query(
            `DELETE FROM proctor_sessions WHERE room_id = ? AND user_id = ?`,
            [String(roomId), Number(userId)]
        );
    } catch (err) {
        console.error('[proctorState] Failed to clear proctor_sessions for student', userId, ':', err.message);
    }
}

/**
 * Returns the proctor record for a student in a room.
 * Checks in-memory first; falls back to DB on cache miss (server restart scenario).
 * Returns null if no record exists in either.
 *
 * @param {string|number} roomId
 * @param {number} userId
 * @returns {Promise<{ strike_count: number, penalty_points: number, is_disqualified: boolean } | null>}
 */
async function getStudentProctorRecord(roomId, userId) {
    const roomMap = getOrCreateRoomProctorMap(roomId);
    const cached = roomMap.get(Number(userId));
    if (cached) return cached;

    // Cache miss — server may have restarted; check DB
    try {
        const [rows] = await systemDB.query(
            `SELECT user_id, full_name, strike_count, penalty_points, is_disqualified, last_violation
             FROM proctor_sessions
             WHERE room_id = ? AND user_id = ?`,
            [String(roomId), Number(userId)]
        );
        if (rows.length > 0) {
            const dbRecord = {
                user_id:        rows[0].user_id,
                full_name:      rows[0].full_name,
                strike_count:   rows[0].strike_count,
                penalty_points: rows[0].penalty_points,
                is_disqualified: Boolean(rows[0].is_disqualified),
                last_violation: rows[0].last_violation,
                incidents: [], // history not persisted, only current state
            };
            // Re-hydrate in-memory cache
            roomMap.set(Number(userId), dbRecord);
            return dbRecord;
        }
    } catch (err) {
        console.error('[proctorState] DB fallback lookup failed:', err.message);
    }
    return null;
}

module.exports = {
    activeProctorIncidents,
    getOrCreateRoomProctorMap,
    getStudentProctorRecord,
    persistProctorRecord,
    clearPersistedRoom,
    clearPersistedStudent,
};

