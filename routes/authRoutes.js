const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { systemDB } = require('../db');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Register user
router.post('/register', async (req, res) => {
    try {
      const { full_name, email, password } = req.body;
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const [result] = await systemDB.query(
        "INSERT INTO users (full_name, email, password, role_id) VALUES (?, ?, ?, 1)",
        [full_name, email, hashedPassword]
      );
  
      const newUserId = result.insertId;
  
      res.json({ message: "User registered successfully!" });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Registration failed" });
    }
  });  

// 🔐 Login user
router.post('/login', loginLimiter, async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const sql = 'SELECT * FROM users WHERE email = ?';
        const [results] = await systemDB.query(sql, [email]);

        if (results.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role_id: user.role_id
            },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            token,
            role_id: user.role_id
          });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;