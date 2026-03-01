const express = require("express");
const router = express.Router();
const { systemDB } = require("../db");
const { authenticateToken, authorizeRole } = require("../middleware/auth");

// 🔒 All routes here are ADMIN ONLY
router.use(authenticateToken);
router.use(authorizeRole([3]));

// 📋 Get All Users
router.get("/users", async (req, res) => {
  try {
    const [users] = await systemDB.query(`
      SELECT user_id, full_name, email, role_id, total_points, current_level
      FROM users
      ORDER BY role_id ASC, total_points DESC
    `);

    res.json(users);
  } catch (error) {
    console.error("Admin fetch users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// 🔄 Update User Role
router.put("/users/:id/role", async (req, res) => {
  try {
    const { role_id } = req.body;
    const userId = Number(req.params.id);

    // Update role
    await systemDB.query(
      "UPDATE users SET role_id = ? WHERE user_id = ?",
      [role_id, userId]
    );

    // 🔥 If admin changed THEIR OWN role → force logout
    if (req.user.user_id === userId) {
      return res.status(440).json({
        message: "Your role has changed. Please login again."
      });
    }

    res.json({ message: "User role updated successfully" });

  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// 🔘 Toggle Case Active
router.put("/cases/:id/toggle", async (req, res) => {
  try {
    const caseId = req.params.id;

    await systemDB.query(`
      UPDATE cases
      SET is_active = NOT is_active
      WHERE case_id = ?
    `, [caseId]);

    res.json({ message: "Case status updated" });

  } catch (error) {
    console.error("Toggle case error:", error);
    res.status(500).json({ error: "Failed to update case" });
  }
});

module.exports = router;