const express = require("express");
const router = express.Router();
const { systemDB } = require("../db");
const { authenticateToken } = require("../middleware/auth");

// 🔥 GET USER PROGRESS (XP + Level)
// 🔥 GET USER PROGRESS (XP + Level + Streak)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // 🔹 Get XP + Level
    const [userRows] = await systemDB.query(
      `SELECT total_points, current_level
       FROM users
       WHERE user_id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔹 Get Streak
    const [streakRows] = await systemDB.query(
      `SELECT current_streak
       FROM user_streaks
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      totalPoints: userRows[0].total_points || 0,
      currentLevel: userRows[0].current_level || 1,
      currentStreak: streakRows.length > 0
        ? streakRows[0].current_streak
        : 0
    });

  } catch (error) {
    console.error("Progress route error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;