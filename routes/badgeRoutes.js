/**
 * badgeRoutes.js
 * POST /api/badges/sync   — compute earned badges for the user and persist new ones
 * GET  /api/badges        — return all badge_ids unlocked by the user
 */

const express = require('express');
const router = express.Router();
const { systemDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { BADGE_DEFS } = require('../services/badgeService');

/* ──────────────────────────────────────────────────────────────
   GET /api/badges
   Returns: [{ badge_id, unlocked_at }]
   ────────────────────────────────────────────────────────────── */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await systemDB.query(
      'SELECT badge_id, unlocked_at FROM user_badges WHERE user_id = ? ORDER BY unlocked_at ASC',
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[badgeRoutes] GET /badges error:', err.message);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/badges/sync
   Evaluates all BADGE_DEFS against the user's current stats,
   persists any newly earned badges, and returns all unlocked IDs.
   ────────────────────────────────────────────────────────────── */
router.post('/sync', authenticateToken, async (req, res) => {
  const userId = req.user.user_id;
  try {
    // 1. Fetch stats needed for badge evaluation
    const [userRows] = await systemDB.query(
      'SELECT total_points, current_level FROM users WHERE user_id = ?',
      [userId]
    );
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });

    const { total_points, current_level } = userRows[0];

    const [progressRows] = await systemDB.query(
      "SELECT COUNT(*) AS solved_cases FROM user_case_progress WHERE user_id = ? AND status = 'Completed'",
      [userId]
    );
    const solved_cases = progressRows[0]?.solved_cases || 0;

    // Difficulty progress (for Beginner Clear / Intermediate Clear badges)
    const [diffRows] = await systemDB.query(
      `SELECT d.difficulty_name,
              COUNT(c.case_id) AS totalCases,
              COUNT(ucp.case_id) AS completed
       FROM difficulty d
       LEFT JOIN cases c ON c.difficulty_id = d.difficulty_id AND c.is_active = 1
       LEFT JOIN user_case_progress ucp
           ON ucp.case_id = c.case_id AND ucp.user_id = ? AND ucp.status = 'Completed'
       GROUP BY d.difficulty_id, d.difficulty_name`,
      [userId]
    );

    const stats = { total_points, current_level, solved_cases };

    // 2. Fetch already-unlocked badge IDs
    const [existingRows] = await systemDB.query(
      'SELECT badge_id FROM user_badges WHERE user_id = ?',
      [userId]
    );
    const existingIds = new Set(existingRows.map(r => r.badge_id));

    // 3. Find newly earned badges
    const nowEarned = BADGE_DEFS.filter(b => b.check(stats, diffRows));
    const newlyEarned = nowEarned.filter(b => !existingIds.has(b.id));

    // 4. Persist new badges
    if (newlyEarned.length > 0) {
      const insertValues = newlyEarned.map(b => [b.id, userId]);
      await systemDB.query(
        'INSERT IGNORE INTO user_badges (badge_id, user_id) VALUES ?',
        [insertValues]
      );
    }

    // 5. Return all unlocked IDs (existing + new)
    const allUnlocked = [...existingIds, ...newlyEarned.map(b => b.id)];

    res.json({
      unlocked_badge_ids: allUnlocked,
      newly_earned: newlyEarned.map(b => ({ id: b.id, title: b.title, description: b.description })),
    });

  } catch (err) {
    console.error('[badgeRoutes] POST /badges/sync error:', err.message);
    res.status(500).json({ error: 'Badge sync failed' });
  }
});

module.exports = router;
