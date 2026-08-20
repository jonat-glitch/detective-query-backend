const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { systemDB } = require('../db');
const { loginLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { sendVerificationCode } = require('../services/emailService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// In-memory OTP storage: email -> { code, expiresAt }
const otpStore = new Map();

// ================= SEND EMAIL VERIFICATION CODE (OTP) =================
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required." });
        }

        const emailLower = email.trim().toLowerCase();
        if (!emailLower.endsWith('@gmail.com')) {
            return res.status(400).json({ error: "Only valid @gmail.com email addresses are accepted." });
        }

        // Check if account already exists
        const [existingUser] = await systemDB.query(
            'SELECT user_id FROM users WHERE email = ?', [emailLower]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({ error: "An account with this Gmail already exists. Please log in." });
        }

        // Check if pending request exists
        const [existingReq] = await systemDB.query(
            'SELECT request_id, status FROM registration_requests WHERE email = ?', [emailLower]
        );
        if (existingReq.length > 0 && existingReq[0].status === 'pending') {
            return res.status(409).json({ error: "A pending request with this Gmail already exists. Please wait for admin approval." });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(emailLower, {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        });

        // Send OTP via Gmail
        await sendVerificationCode({ to: emailLower, code });

        res.json({
            message: "Verification code sent! Please check your Gmail inbox."
        });
    } catch (error) {
        console.error("[Send OTP Error]:", error);
        res.status(500).json({ error: "Failed to send verification code. Please check that your Gmail address is correct and active." });
    }
});

// ================= REGISTER (now requires verified OTP) =================
router.post('/register', async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            sex,
            section,
            email,
            password,
            role_id,
            student_id,
            teacher_id,
            otp_code
        } = req.body;

        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Gmail-only enforcement
        const emailLower = email.trim().toLowerCase();
        if (!emailLower.endsWith('@gmail.com')) {
            return res.status(400).json({ error: "Only @gmail.com email addresses are accepted for registration." });
        }

        // Verify OTP code
        if (!otp_code) {
            return res.status(400).json({ error: "Email verification code is required. Please verify your Gmail first." });
        }

        const storedOtp = otpStore.get(emailLower);
        if (!storedOtp) {
            return res.status(400).json({ error: "Verification code expired or not requested. Please request a new code." });
        }

        if (Date.now() > storedOtp.expiresAt) {
            otpStore.delete(emailLower);
            return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
        }

        if (storedOtp.code !== otp_code.trim()) {
            return res.status(400).json({ error: "Invalid verification code. Please check your Gmail inbox." });
        }

        // OTP is valid - remove it
        otpStore.delete(emailLower);

        // Check if email already has an existing account
        const [existingUser] = await systemDB.query(
            'SELECT user_id FROM users WHERE email = ?', [emailLower]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        const [existingRequest] = await systemDB.query(
            `SELECT request_id, status FROM registration_requests WHERE email = ?`, [emailLower]
        );
        if (existingRequest.length > 0) {
            const status = existingRequest[0].status;
            if (status === 'pending') {
                return res.status(409).json({ error: "A pending request with this email already exists. Please wait for admin approval." });
            }
            if (status === 'approved') {
                return res.status(409).json({ error: "This email has already been approved. Please log in." });
            }
            // If rejected, delete old request and allow re-application
            await systemDB.query(
                'DELETE FROM registration_requests WHERE email = ?', [emailLower]
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await systemDB.query(
            `INSERT INTO registration_requests
            (first_name, last_name, email, password_hash, role_id, sex, section, student_id, teacher_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                first_name,
                last_name,
                emailLower,
                hashedPassword,
                role_id || 1,
                sex || null,
                section || null,
                student_id || null,
                teacher_id || null
            ]
        );

        res.status(202).json({
            message: "Request submitted",
            detail: "Your access request has been submitted and is pending admin review. You will be notified by email once a decision is made."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Registration failed" });
    }
});


// ================= LOGIN =================
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const [results] = await systemDB.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (results.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        // SECURITY: Never log passwords or hashes in production

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
            { user_id: user.user_id, role_id: user.role_id },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { user_id: user.user_id },
            JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Store refresh token in DB (survives server restarts)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await systemDB.query(
            `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
            [user.user_id, refreshToken, expiresAt]
        );

        res.json({
            message: "Login successful",
            accessToken,
            refreshToken,
            role_id: user.role_id,
            full_name: user.full_name
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ================= REFRESH TOKEN =================
router.post('/refresh-token', async (req, res) => {

    if (!req.body || !req.body.refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
    }

    const refreshToken = req.body.refreshToken;

    try {
        // Check token exists in DB and is not expired
        const [rows] = await systemDB.query(
            `SELECT rt.user_id, u.role_id
             FROM refresh_tokens rt
             JOIN users u ON u.user_id = rt.user_id
             WHERE rt.token = ? AND rt.expires_at > NOW()`,
            [refreshToken]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: "Invalid or expired refresh token" });
        }

        // Verify JWT signature
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid refresh token" });
            }

            const newAccessToken = jwt.sign(
                {
                    user_id: rows[0].user_id,
                    role_id: rows[0].role_id
                },
                JWT_SECRET,
                { expiresIn: "15m" }
            );

            res.json({ accessToken: newAccessToken });
        });

    } catch (error) {
        console.error("REFRESH TOKEN ERROR:", error);
        res.status(500).json({ error: "Server error during token refresh" });
    }
});

// ================= LOGOUT =================
router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
        try {
            await systemDB.query(
                `DELETE FROM refresh_tokens WHERE token = ?`,
                [refreshToken]
            );
        } catch (err) {
            console.error("Logout token cleanup error:", err);
        }
    }
    res.json({ message: "Logged out successfully" });
});

module.exports = router;