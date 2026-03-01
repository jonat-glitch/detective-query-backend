const express = require("express");
const router = express.Router();
const { systemDB } = require("../db");
const { authenticateToken } = require("../middleware/auth");

// 🔥 Get progress per difficulty
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get all difficulties
    const [difficulties] = await systemDB.query(
      `SELECT difficulty_id, difficulty_name
       FROM difficulty
       ORDER BY difficulty_id ASC`
    );

    const results = [];

    for (const diff of difficulties) {

      // Total cases in difficulty
      const [totalCasesRows] = await systemDB.query(
        `SELECT COUNT(*) AS total
         FROM cases
         WHERE difficulty_id = ?`,
        [diff.difficulty_id]
      );

      const totalCases = totalCasesRows[0].total;

      // Completed cases by user
      const [completedRows] = await systemDB.query(
        `SELECT COUNT(*) AS completed
         FROM user_case_progress ucp
         JOIN cases c ON ucp.case_id = c.case_id
         WHERE ucp.user_id = ?
         AND ucp.status = 'Completed'
         AND c.difficulty_id = ?`,
        [userId, diff.difficulty_id]
      );

      const completed = completedRows[0].completed;

      const percent =
        totalCases === 0
          ? 0
          : Math.floor((completed / totalCases) * 100);

      results.push({
        difficulty_id: diff.difficulty_id,
        difficulty_name: diff.difficulty_name,
        totalCases,
        completed,
        percent
      });
    }

    res.json(results);

  } catch (error) {
    console.error("Difficulty progress error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;