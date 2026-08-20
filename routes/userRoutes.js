const express = require('express');
const { systemDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const submissionService = require('../services/submissionService');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Auto-ensure account_change_requests supports all request types (VARCHAR(50))
systemDB.query("ALTER TABLE account_change_requests MODIFY COLUMN request_type VARCHAR(50) NOT NULL")
  .then(() => console.log("✅ account_change_requests table verified (VARCHAR(50))"))
  .catch(() => {});

// 📚 Get cases with difficulty unlock system
router.get('/cases',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        // 🔓 Get unlocked difficulties
        const unlockedDifficulties =
            await submissionService.getUnlockedDifficulties(userId);

        const sql = `
            SELECT
                c.case_id,
                c.title,
                c.description,
                c.base_points,
                c.difficulty_id,
                d.difficulty_name,
                d.multiplier
            FROM cases c
            JOIN difficulty d
                ON c.difficulty_id = d.difficulty_id
            WHERE c.is_active = 1
            ORDER BY d.difficulty_id ASC, c.case_id ASC
        `;

        const [cases] = await systemDB.query(sql);

        // 🔎 Get completed cases for this user
        const [completedCases] = await systemDB.query(
            `SELECT case_id
            FROM user_case_progress
            WHERE user_id = ?
            AND status = 'Completed'`,
            [userId]
        );

        const completedIds = completedCases.map(c => c.case_id);

        const formatted = cases.map(c => ({
            ...c,
            status: unlockedDifficulties.includes(c.difficulty_id)
                ? 'Unlocked'
                : 'Locked',
            is_completed: completedIds.includes(c.case_id)
        }));

        res.json(formatted);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// 🏆 Leaderboard - Top 10 Students
router.get('/leaderboard',
    authenticateToken,
    async (req, res) => {

    try {
        const sql = `
            SELECT
                user_id,
                full_name,
                total_points,
                current_level,
                RANK() OVER (ORDER BY total_points DESC) AS ranking
            FROM users
            WHERE role_id = 1
            ORDER BY total_points DESC
            LIMIT 10
        `;

        const [results] = await systemDB.query(sql);

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// 👤 Get Personal Rank
router.get('/my-rank',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        const sql = `
            SELECT ranking, user_id, full_name, total_points, current_level
            FROM (
                SELECT
                    user_id,
                    full_name,
                    total_points,
                    current_level,
                    RANK() OVER (ORDER BY total_points DESC) AS ranking
                FROM users
                WHERE role_id = 1
            ) ranked_users
            WHERE user_id = ?
        `;

        const [results] = await systemDB.query(sql, [userId]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found in ranking' });
        }

        res.json(results[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get rank' });
    }
});

// 🎖 Get User Achievements
router.get('/achievements',
    authenticateToken,
    async (req, res) => {

    try {
        const userId = req.user.user_id;

        const sql = `
            SELECT
                a.achievement_id,
                a.title,
                a.description,
                a.points_required,
                ua.date_earned
            FROM user_achievements ua
            JOIN achievements a
                ON ua.achievement_id = a.achievement_id
            WHERE ua.user_id = ?
            ORDER BY ua.date_earned DESC
        `;

        const [results] = await systemDB.query(sql, [userId]);

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// NOTE: /profile is served by server.js directly (the full version with stats/achievements/streak).
// Do NOT add a /profile route here — it would shadow the rich version.
// 🔐 Get current user role (FAST - uses JWT first)
router.get('/me-role',
    authenticateToken,
    async (req, res) => {
        try {
            // 🔥 INSTANT response using JWT (no DB timeout)
            if (req.user && req.user.role_id) {
                return res.json({ role_id: req.user.role_id });
            }

            // Fallback to DB (rare case)
            const userId = req.user.user_id;

            const [rows] = await systemDB.query(
                "SELECT role_id FROM users WHERE user_id = ?",
                [userId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({ role_id: rows[0].role_id });

        } catch (error) {
            console.error("ME-ROLE ERROR:", error);
            res.status(500).json({ error: "Server error" });
        }
    }
);
router.put('/change-name', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { full_name } = req.body;

        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ error: "Name cannot be empty" });
        }

        const [result] = await systemDB.query(
            "UPDATE users SET full_name = ? WHERE user_id = ?",
            [full_name.trim(), userId]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: "No user updated" });
        }

        res.json({ success: true });

    } catch (err) {
        console.error("CHANGE NAME ERROR:", err);
        res.status(500).json({ error: "Failed to update name" });
    }
});
// 🔒 Change Password (verify old password first)
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: "All fields required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password too short" });
        }

        const [rows] = await systemDB.query(
            "SELECT password FROM users WHERE user_id = ?",
            [userId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "User not found" });
        }

        const match = await bcrypt.compare(oldPassword, rows[0].password);

        if (!match) {
            return res.status(401).json({ error: "Old password incorrect" });
        }

        const hashed = await bcrypt.hash(newPassword, 10);

        await systemDB.query(
            "UPDATE users SET password = ? WHERE user_id = ?",
            [hashed, userId]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("CHANGE PASSWORD ERROR:", err);
        res.status(500).json({ error: "Failed to change password" });
    }
});

const { sendVerificationCode } = require('../services/emailService');

// In-memory OTP storage for email changes: `${userId}_${email}` -> { code, expiresAt }
const changeEmailOtpStore = new Map();

// ───────────────────────────────────────────────────────────────
// 📧 Send OTP to New Email/Gmail Address for verification
// POST /api/users/send-change-email-otp
// ───────────────────────────────────────────────────────────────
router.post('/send-change-email-otp', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email address is required." });
        }

        const emailLower = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return res.status(400).json({ error: "Please enter a valid email address format." });
        }

        // Check if user is trying to change to their current email
        const [userRows] = await systemDB.query("SELECT email FROM users WHERE user_id = ?", [userId]);
        if (userRows.length > 0 && userRows[0].email.toLowerCase() === emailLower) {
            return res.status(400).json({ error: "New email must be different from your current email address." });
        }

        // Check if another account already uses this email
        const [existingUser] = await systemDB.query(
            'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
            [emailLower, userId]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({ error: "An account with this email address already exists. Please choose a different email." });
        }

        // Generate 6-digit OTP code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const otpKey = `${userId}_${emailLower}`;
        changeEmailOtpStore.set(otpKey, {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        // Send OTP via Brevo to the NEW email
        try {
            await sendVerificationCode({ to: emailLower, code });
        } catch (mailErr) {
            console.error("[Send Change Email OTP Error]:", mailErr);
            return res.status(500).json({
                error: `Failed to send verification email to ${emailLower}: ${mailErr.message || 'Email Delivery Error'}. Please check your Gmail address and try again.`
            });
        }

        res.json({
            message: `Verification code sent to ${emailLower}! Please check your inbox.`,
            success: true
        });
    } catch (error) {
        console.error("SEND CHANGE EMAIL OTP ERROR:", error);
        res.status(500).json({ error: `Server error: ${error.message || 'Unknown error'}` });
    }
});

// ───────────────────────────────────────────────────────────────
// 📩 Submit Account Change Request (Section, Password, or Email)
// POST /api/users/request-change
// ───────────────────────────────────────────────────────────────
router.post('/request-change', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { request_type, new_value, reason, otp_code } = req.body;

        if (!request_type || !['change_section', 'change_password', 'change_email'].includes(request_type)) {
            return res.status(400).json({ error: "Invalid request type" });
        }

        if (!new_value || !String(new_value).trim()) {
            return res.status(400).json({ error: "New value is required" });
        }

        // Get current user info (for old_value)
        const [userRows] = await systemDB.query(
            "SELECT full_name, section, email FROM users WHERE user_id = ?",
            [userId]
        );

        if (!userRows.length) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = userRows[0];
        let oldValue = null;
        let storedNewValue = String(new_value).trim();

        if (request_type === 'change_section') {
            oldValue = user.section || 'Unassigned';
            storedNewValue = storedNewValue.toUpperCase();
        } else if (request_type === 'change_password') {
            if (storedNewValue.length < 6) {
                return res.status(400).json({ error: "Password must be at least 6 characters" });
            }
            oldValue = 'Current Password';
            // Hash password before saving to request table
            storedNewValue = await bcrypt.hash(storedNewValue, 10);
        } else if (request_type === 'change_email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            storedNewValue = storedNewValue.toLowerCase().trim();
            if (!emailRegex.test(storedNewValue)) {
                return res.status(400).json({ error: "Please enter a valid email address format" });
            }
            if (storedNewValue === user.email.toLowerCase()) {
                return res.status(400).json({ error: "New email must be different from your current email" });
            }
            // Check if email is already used by another account
            const [existing] = await systemDB.query(
                "SELECT user_id FROM users WHERE email = ? AND user_id != ?",
                [storedNewValue, userId]
            );
            if (existing.length > 0) {
                return res.status(400).json({ error: "This email address is already in use by another account" });
            }

            // Verify OTP code for new email
            if (!otp_code || !String(otp_code).trim()) {
                return res.status(400).json({ error: "Please enter the 6-digit verification code (OTP) sent to your new email." });
            }

            const otpKey = `${userId}_${storedNewValue}`;
            const storedOtp = changeEmailOtpStore.get(otpKey);
            if (!storedOtp) {
                return res.status(400).json({ error: "No active verification code found for this email. Please click 'Send OTP' first." });
            }
            if (Date.now() > storedOtp.expiresAt) {
                changeEmailOtpStore.delete(otpKey);
                return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
            }
            if (storedOtp.code !== String(otp_code).trim()) {
                return res.status(400).json({ error: "Invalid verification code. Please check your new email and enter the correct 6-digit code." });
            }

            // OTP is valid - consume it
            changeEmailOtpStore.delete(otpKey);
            oldValue = user.email;
        }

        // Cancel/delete any existing pending request of the same type
        await systemDB.query(
            "DELETE FROM account_change_requests WHERE user_id = ? AND request_type = ? AND status = 'pending'",
            [userId, request_type]
        );

        // Insert new request
        await systemDB.query(
            `INSERT INTO account_change_requests 
             (user_id, request_type, old_value, new_value, reason, status) 
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [userId, request_type, oldValue, storedNewValue, reason || null]
        );

        // Notify Admins
        try {
            const [admins] = await systemDB.query("SELECT user_id FROM users WHERE role_id = 3");
            if (admins.length > 0) {
                const notifAction = request_type === 'change_section' ? `change section to ${storedNewValue}` : request_type === 'change_email' ? `change email to ${storedNewValue}` : 'reset their password';
                const notifMsg = `${user.full_name} submitted a request to ${notifAction}.`;
                const insertNotifs = admins.map(a => [a.user_id, userId, notifMsg, 0, 'announcement']);
                await systemDB.query(
                    "INSERT INTO notifications (user_id, sender_id, message, is_read, notification_type) VALUES ?",
                    [insertNotifs]
                );
            }
        } catch (notifErr) {
            console.warn('[Notification] Notice insertion warning:', notifErr.message);
        }

        res.json({
            message: "Request submitted successfully! The administrator will review your request.",
            success: true
        });

    } catch (err) {
        console.error("REQUEST CHANGE ERROR:", err);
        res.status(500).json({ error: err.message || "Failed to submit request" });
    }
});

// ───────────────────────────────────────────────────────────────
// 📋 GET Logged-in User's Change Requests
// GET /api/users/my-requests
// ───────────────────────────────────────────────────────────────
router.get('/my-requests', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const [rows] = await systemDB.query(
            `SELECT request_id, request_type, old_value, 
                    CASE WHEN request_type = 'change_password' THEN '••••••' ELSE new_value END AS display_new_value,
                    reason, status, reject_reason, created_at, reviewed_at
             FROM account_change_requests 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [userId]
        );

        res.json(rows);
    } catch (err) {
        console.error("FETCH MY REQUESTS ERROR:", err);
        res.status(500).json({ error: "Failed to fetch requests" });
    }
});

module.exports = router;