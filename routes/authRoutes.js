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
const { setOtp, verifyOtp } = require('../utils/otpStore');

// ================= SEND EMAIL VERIFICATION CODE (OTP) =================
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required." });
        }

        const emailLower = email.trim().toLowerCase();

        // Check if account already exists in users or already approved
        const [existingUser] = await systemDB.query(
            'SELECT user_id FROM users WHERE email = ?', [emailLower]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({ error: "An account with this Gmail already exists. Please log in." });
        }

        const [approvedReq] = await systemDB.query(
            "SELECT request_id FROM registration_requests WHERE email = ? AND status = 'approved'", [emailLower]
        );
        if (approvedReq.length > 0) {
            return res.status(409).json({ error: "This Gmail account has already been approved. Please log in." });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await setOtp(emailLower, code, 10);

        // Only print OTP to terminal in development (never in production logs)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n========================================`);
            console.log(`🔑 [VERIFICATION OTP CODE]: ${code}`);
            console.log(`📧 Target Email: ${emailLower}`);
            console.log(`========================================\n`);
        }

        // Send OTP via Brevo
        try {
            await sendVerificationCode({ to: emailLower, code });
        } catch (mailErr) {
            console.error("[Send OTP Mail Error]:", mailErr);

            // If Brevo blocks the local IP address, provide a dev fallback so local testing is never blocked:
            if (mailErr.message && (mailErr.message.includes('unrecognised IP address') || mailErr.message.includes('unrecognised IP'))) {
                return res.json({
                    message: `Local Dev Notice: Brevo IP whitelist blocked local IP. Your verification code is: ${code} (also printed in backend terminal).`,
                    devCode: code
                });
            }

            return res.status(500).json({
                error: `Failed to send email to ${emailLower}: ${mailErr.message || 'SMTP Error'}. Please check your Gmail address or try again.`
            });
        }

        res.json({
            message: "Verification code sent! Please check your Gmail inbox."
        });
    } catch (error) {
        console.error("[Send OTP Error]:", error);
        res.status(500).json({ error: `Server error: ${error.message || 'Unknown error'}` });
    }
});

// ================= PUBLIC: VALIDATE CLASS CODE =================
// POST /validate-class-code
// Returns: { valid: bool, section_id, section_name, course_id, course_code, year_level, semester_id }
router.post('/validate-class-code', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Class code is required' });

        const [rows] = await systemDB.query(
            `SELECT cc.code_id, cc.section_id, cc.semester_id, cc.is_active, cc.expires_at,
                    cc.is_archived,
                    s.section_name, sem.school_year, sem.term
             FROM class_codes cc
             LEFT JOIN sections  s   ON s.section_id   = cc.section_id
             LEFT JOIN semesters sem ON sem.semester_id = cc.semester_id
             WHERE cc.code = ?`,
            [code.trim().toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'Invalid class code. Please check with your teacher.' });
        }

        const cc = rows[0];

        // BUG-09 FIX: Reject archived class codes
        if (cc.is_archived) {
            return res.status(400).json({ valid: false, error: 'This class code has been archived and is no longer valid.' });
        }

        if (!cc.is_active) {
            return res.status(400).json({ valid: false, error: 'This class code has been deactivated.' });
        }

        if (cc.expires_at && new Date(cc.expires_at) < new Date()) {
            return res.status(400).json({ valid: false, error: 'This class code has expired.' });
        }

        res.json({
            valid: true,
            section_id:   cc.section_id,
            section_name: cc.section_name,
            semester_id:  cc.semester_id,
            school_year:  cc.school_year,
            term:         cc.term
        });
    } catch (err) {
        console.error('[Validate Class Code Error]:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ================= PUBLIC: VALIDATE STUDENT NUMBER =================
// POST /validate-student-number
// Returns: { valid: bool, section_id, course_id, year_level, semester_id }
router.post('/validate-student-number', async (req, res) => {
    try {
        const { student_number, section_id, semester_id } = req.body;
        if (!student_number) return res.status(400).json({ error: 'Student number is required' });

        const [rows] = await systemDB.query(
            `SELECT id, section_id, course_id, year_level, semester_id, is_used
             FROM allowed_student_numbers
             WHERE student_number = ?`,
            [student_number.trim()]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                valid: false,
                error: 'Student number not found. Make sure it matches your official student ID number, or contact your administrator.'
            });
        }

        const asn = rows[0];

        if (asn.is_used) {
            return res.status(409).json({
                valid: false,
                error: 'This student number has already been registered. If this is an error, contact your administrator.'
            });
        }

        // Cross-check section if class code was already validated
        if (section_id && asn.section_id && asn.section_id !== Number(section_id)) {
            return res.status(400).json({
                valid: false,
                error: 'Your student number does not match the class code section. Please verify with your teacher.'
            });
        }

        res.json({
            valid: true,
            section_id:  asn.section_id,
            course_id:   asn.course_id,
            year_level:  asn.year_level,
            semester_id: asn.semester_id
        });
    } catch (err) {
        console.error('[Validate Student Number Error]:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ================= REGISTER (gated: class code + student number + OTP + admin approval) =================
router.post('/register', async (req, res) => {
    try {
        const {
            first_name,
            middle_name,
            last_name,
            extension_name,
            gender,
            civil_status,
            birthday,
            sex,
            email,
            password,
            role_id,
            student_id,
            student_number,
            teacher_id,
            otp_code,
            class_code,
            section_id,
            course_id,
            year_level,
            semester_id
        } = req.body;

        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const emailLower = email.trim().toLowerCase();
        const isStudent = (role_id || 1) == 1;

        // ── Layer 2 & 3: Class code + student number required for students ──
        if (isStudent) {
            if (!class_code) {
                return res.status(400).json({ error: "A class code is required to register as a student." });
            }
            if (!student_number) {
                return res.status(400).json({ error: "Your student number is required." });
            }

            // Validate class code
            const [ccRows] = await systemDB.query(
                `SELECT code_id, is_active, is_archived, expires_at FROM class_codes WHERE code = ?`,
                [class_code.trim().toUpperCase()]
            );
            // BUG-09 FIX: Also block archived codes during registration
            if (ccRows.length === 0 || !ccRows[0].is_active || ccRows[0].is_archived) {
                return res.status(400).json({ error: "Invalid, inactive, or archived class code. Please check with your teacher." });
            }
            if (ccRows[0].expires_at && new Date(ccRows[0].expires_at) < new Date()) {
                return res.status(400).json({ error: "This class code has expired. Please get a new one from your teacher." });
            }

            // Validate student number
            const [asnRows] = await systemDB.query(
                `SELECT id, is_used FROM allowed_student_numbers WHERE student_number = ?`,
                [student_number.trim()]
            );
            if (asnRows.length === 0) {
                return res.status(400).json({ error: "Student number not found in the system. Contact your administrator." });
            }
            if (asnRows[0].is_used) {
                return res.status(409).json({ error: "This student number is already registered." });
            }
        }

        // ── Layer 4: OTP ──
        if (!otp_code) {
            return res.status(400).json({ error: "Email verification code is required." });
        }

        const otpResult = await verifyOtp(emailLower, otp_code);
        if (!otpResult.valid) {
            if (otpResult.reason === 'NOT_FOUND') {
                return res.status(400).json({ error: "Verification code expired or not requested. Please request a new code." });
            }
            if (otpResult.reason === 'EXPIRED') {
                return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
            }
            return res.status(400).json({ error: "Invalid verification code. Please check your email inbox." });
        }

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
            if (status === 'approved') {
                return res.status(409).json({ error: "This email has already been approved. Please log in." });
            }
            await systemDB.query(
                'DELETE FROM registration_requests WHERE email = ?', [emailLower]
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await systemDB.query(
            `INSERT INTO registration_requests
            (first_name, middle_name, last_name, extension_name, gender, civil_status, birthday,
             email, password_hash, role_id, sex, student_id, student_number, teacher_id,
             class_code, section_id, course_id, year_level, semester_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                first_name,
                middle_name    || null,
                last_name,
                extension_name || null,
                gender         || null,
                civil_status   || null,
                birthday       || null,
                emailLower,
                hashedPassword,
                role_id        || 1,
                sex            || null,
                student_id     || null,
                student_number || null,
                teacher_id     || null,
                class_code     || null,
                section_id     || null,
                course_id      || null,
                year_level     || null,
                semester_id    || null
            ]
        );

        res.status(202).json({
            message: "Request submitted",
            detail: "Your access request has been submitted and is pending admin review. You will be notified by email once approved."
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