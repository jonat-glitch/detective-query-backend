/**
 * Shared in-memory proctoring state registry.
 * Extracted into its own module so both roomRoutes and submissionRoutes
 * can reference the same Map instance (Node.js module caching guarantees
 * the same object is returned on every require()).
 *
 * NOTE: This state is volatile — it is lost on server restart.
 * Proctor records are auto-cleared when a new game session starts
 * (via /activate) or when the game ends (via /end-game).
 */

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
 * Returns the proctor record for a student in a room, or null if none exists.
 * @param {string|number} roomId
 * @param {number} userId
 * @returns {{ strike_count: number, penalty_points: number, is_disqualified: boolean } | null}
 */
function getStudentProctorRecord(roomId, userId) {
    const roomMap = getOrCreateRoomProctorMap(roomId);
    return roomMap.get(Number(userId)) || null;
}

module.exports = { activeProctorIncidents, getOrCreateRoomProctorMap, getStudentProctorRecord };

