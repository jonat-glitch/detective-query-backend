// routes/inviteRoutes.js
// Handles public invitation verification and student/teacher account setup
// GET  /api/invite/verify/:token  — Verify invitation token and get prefilled data
// POST /api/invite/setup          — Finalize account setup with password and profile details

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { systemDB } = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invite/verify/:token (or /verify?token=...)
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/verify/:token', '/verify'], async (req, res) => {
  const token = req.params.token || req.query.token;

  if (!token) {
    return res.status(400).json({ error: 'Invitation token is required.' });
  }

  try {
    const [rows] = await systemDB.query(
      `SELECT
        si.*,
        s.section_name,
        c.course_code,
        sem.school_year,
        sem.term
       FROM student_invitations si
       LEFT JOIN sections s ON s.section_id = si.section_id
       LEFT JOIN courses c ON c.course_id = si.course_id
       LEFT JOIN semesters sem ON sem.semester_id = si.semester_id
       WHERE si.invite_token = ?`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invitation link. Please check your email or contact your administrator.' });
    }

    const inv = rows[0];

    // Check if already completed
    if (inv.status === 'completed') {
      return res.status(400).json({
        error: 'This invitation has already been used to set up an account. You can log in directly.',
        completed: true
      });
    }

    // Check if cancelled
    if (inv.status === 'cancelled') {
      return res.status(400).json({
        error: 'This invitation has been cancelled. Please contact your school administrator.',
        cancelled: true
      });
    }

    // Check if expired
    const isExpired = inv.token_expires_at && new Date(inv.token_expires_at) < new Date();
    if (isExpired || inv.status === 'expired') {
      if (inv.status !== 'expired') {
        await systemDB.query('UPDATE student_invitations SET status = \'expired\' WHERE invitation_id = ?', [inv.invitation_id]);
      }
      return res.status(400).json({
        error: 'This invitation link has expired (valid for 7 days). Please contact your administrator to resend your invite.',
        expired: true
      });
    }

    // Return safe pre-filled data
    res.json({
      valid: true,
      email: inv.email,
      first_name: inv.first_name || '',
      middle_name: inv.middle_name || '',
      last_name: inv.last_name || '',
      extension_name: inv.extension_name || '',
      student_number: inv.student_number || '',
      section_id: inv.section_id,
      section_name: inv.section_name || '',
      course_id: inv.course_id,
      course_code: inv.course_code || '',
      year_level: inv.year_level,
      semester_id: inv.semester_id,
      school_year: inv.school_year || '',
      term: inv.term || '',
      // Default to student (1) if not specified
      role_id: 1
    });

  } catch (err) {
    console.error('[Invite Verify]', err);
    res.status(500).json({ error: 'Failed to verify invitation link.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invite/setup
// Complete profile setup, set password, and create account
// ─────────────────────────────────────────────────────────────────────────────
router.post('/setup', async (req, res) => {
  const {
    token,
    password,
    first_name,
    middle_name,
    last_name,
    extension_name,
    student_number,
    gender,
    civil_status,
    birthday,
    sex
  } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Invitation token is required.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // 1. Fetch and validate invitation
    const [rows] = await systemDB.query(
      `SELECT * FROM student_invitations WHERE invite_token = ?`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invitation link.' });
    }

    const inv = rows[0];

    if (inv.status === 'completed') {
      return res.status(400).json({ error: 'This invitation has already been completed. Please log in.' });
    }

    if (inv.status === 'cancelled') {
      return res.status(400).json({ error: 'This invitation has been cancelled.' });
    }

    if (inv.token_expires_at && new Date(inv.token_expires_at) < new Date()) {
      await systemDB.query('UPDATE student_invitations SET status = \'expired\' WHERE invitation_id = ?', [inv.invitation_id]);
      return res.status(400).json({ error: 'This invitation link has expired. Please ask your administrator to resend.' });
    }

    const email = inv.email.toLowerCase().trim();

    // 2. Double check if email already registered
    const [existing] = await systemDB.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // 3. Assemble profile fields (prefers form submission, falls back to invitation values)
    const finalFirstName = (first_name || inv.first_name || '').trim();
    const finalLastName = (last_name || inv.last_name || '').trim();
    const finalMiddleName = (middle_name !== undefined ? middle_name : inv.middle_name || '').trim() || null;
    const finalExtName = (extension_name !== undefined ? extension_name : inv.extension_name || '').trim() || null;
    const finalStudentNumber = (student_number || inv.student_number || '').trim() || null;

    if (!finalFirstName || !finalLastName) {
      return res.status(400).json({ error: 'First name and last name are required.' });
    }

    if (birthday) {
      const birthDate = new Date(birthday);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({ error: 'Please enter a valid birthday.' });
      }
      if (birthDate > today) {
        return res.status(400).json({ error: 'Birthday cannot be in the future.' });
      }
      if (birthDate.getFullYear() < 1900) {
        return res.status(400).json({ error: 'Please enter a valid birthday.' });
      }
      const age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      const calculatedAge = (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) ? age - 1 : age;
      if (calculatedAge < 10) {
        return res.status(400).json({ error: 'Student must be at least 10 years old.' });
      }
    }

    const fullName = [
      finalFirstName,
      finalMiddleName,
      finalLastName,
      finalExtName
    ].filter(Boolean).join(' ');

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const roleId = 1; // student (or could infer if teacher role was saved)

    // 5. Insert into users
    const [insertResult] = await systemDB.query(
      `INSERT INTO users
        (first_name, middle_name, last_name, extension_name, full_name,
         sex, gender, civil_status, birthday,
         email, password, role_id, student_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalFirstName,
        finalMiddleName,
        finalLastName,
        finalExtName,
        fullName,
        sex || null,
        gender || null,
        civil_status || null,
        birthday || null,
        email,
        hashedPassword,
        roleId,
        finalStudentNumber
      ]
    );

    const newUserId = insertResult.insertId;

    // 6. If student: enrollment & room auto-join
    if (roleId === 1 && inv.section_id && inv.semester_id) {
      try {
        await systemDB.query(
          `INSERT IGNORE INTO student_enrollments
           (user_id, course_id, year_level, section_id, semester_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            newUserId,
            inv.course_id || null,
            inv.year_level || null,
            inv.section_id,
            inv.semester_id
          ]
        );
      } catch (enrollErr) {
        console.warn('[Invite Setup] enrollment error:', enrollErr.message);
      }

      // Auto-join rooms for section
      try {
        const [matchingRooms] = await systemDB.query(
          `SELECT room_id FROM rooms WHERE section_id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
          [inv.section_id]
        );
        for (const mr of matchingRooms) {
          await systemDB.query(
            `INSERT INTO room_students (room_id, student_id, status)
             VALUES (?, ?, 'Approved')
             ON DUPLICATE KEY UPDATE status = 'Approved'`,
            [mr.room_id, newUserId]
          );
        }
      } catch (roomErr) {
        console.warn('[Invite Setup] room auto-join error:', roomErr.message);
      }

      // Mark student number as used if present in allowed_student_numbers
      if (finalStudentNumber) {
        try {
          await systemDB.query(
            `UPDATE allowed_student_numbers SET is_used = 1 WHERE student_number = ?`,
            [finalStudentNumber]
          );
        } catch (asnErr) {
          console.warn('[Invite Setup] allowed_student_numbers update:', asnErr.message);
        }
      }
    }

    // 7. Mark invitation as completed
    await systemDB.query(
      `UPDATE student_invitations
       SET status = 'completed', user_id = ?, completed_at = NOW()
       WHERE invitation_id = ?`,
      [newUserId, inv.invitation_id]
    );

    // 8. Generate JWT tokens for instant login
    const accessToken = jwt.sign(
      { user_id: newUserId, role_id: roleId },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { user_id: newUserId },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await systemDB.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [newUserId, refreshToken, expiresAt]
    );

    res.status(201).json({
      message: 'Account setup successful! Welcome to Detective Query.',
      accessToken,
      refreshToken,
      role_id: roleId,
      full_name: fullName,
      email
    });

  } catch (err) {
    console.error('[Invite Setup]', err);
    res.status(500).json({ error: 'Failed to complete account setup.' });
  }
});

module.exports = router;
