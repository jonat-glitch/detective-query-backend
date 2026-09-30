const express = require('express');
const router = express.Router();
const { systemDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const crypto = require('crypto');

// 🔒 All routes here are ADMIN ONLY
router.use(authenticateToken);
router.use(authorizeRole([3]));

// ══════════════════════════════════════════════════════════
//  COURSES
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/courses
router.get('/courses', async (req, res) => {
  try {
    const [rows] = await systemDB.query(
      'SELECT * FROM courses ORDER BY course_code ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch courses error:', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// POST /api/admin/setup/courses
// Body: { course_code, course_name }
router.post('/courses', async (req, res) => {
  try {
    const { course_code, course_name } = req.body;
    if (!course_code || !course_name) {
      return res.status(400).json({ error: 'course_code and course_name are required' });
    }
    const [result] = await systemDB.query(
      'INSERT INTO courses (course_code, course_name) VALUES (?, ?)',
      [course_code.trim().toUpperCase(), course_name.trim()]
    );
    res.status(201).json({ message: 'Course created', course_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Course code already exists' });
    }
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// DELETE /api/admin/setup/courses/:id
router.delete('/courses/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM courses WHERE course_id = ?', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ══════════════════════════════════════════════════════════
//  SECTIONS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/sections
router.get('/sections', async (req, res) => {
  try {
    const [rows] = await systemDB.query(
      'SELECT * FROM sections ORDER BY section_name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch sections error:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// POST /api/admin/setup/sections
// Body: { section_name }
router.post('/sections', async (req, res) => {
  try {
    const { section_name } = req.body;
    if (!section_name) {
      return res.status(400).json({ error: 'section_name is required' });
    }
    const [result] = await systemDB.query(
      'INSERT INTO sections (section_name) VALUES (?)',
      [section_name.trim().toUpperCase()]
    );
    res.status(201).json({ message: 'Section created', section_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Section already exists' });
    }
    console.error('Create section error:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// DELETE /api/admin/setup/sections/:id
router.delete('/sections/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM sections WHERE section_id = ?', [req.params.id]);
    res.json({ message: 'Section deleted' });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// ══════════════════════════════════════════════════════════
//  SEMESTERS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/semesters
router.get('/semesters', async (req, res) => {
  try {
    const [rows] = await systemDB.query(
      'SELECT * FROM semesters ORDER BY school_year DESC, FIELD(term,"1st","2nd","Summer")'
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch semesters error:', err);
    res.status(500).json({ error: 'Failed to fetch semesters' });
  }
});

// POST /api/admin/setup/semesters
// Body: { school_year, term, set_active? }
router.post('/semesters', async (req, res) => {
  try {
    const { school_year, term, set_active } = req.body;
    if (!school_year || !term) {
      return res.status(400).json({ error: 'school_year and term are required' });
    }

    const [result] = await systemDB.query(
      'INSERT INTO semesters (school_year, term, is_active) VALUES (?, ?, ?)',
      [school_year.trim(), term, set_active ? 1 : 0]
    );

    // If setting as active, deactivate all others
    if (set_active) {
      await systemDB.query(
        'UPDATE semesters SET is_active = 0 WHERE semester_id != ?',
        [result.insertId]
      );
    }

    res.status(201).json({ message: 'Semester created', semester_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This semester already exists' });
    }
    console.error('Create semester error:', err);
    res.status(500).json({ error: 'Failed to create semester' });
  }
});

// PUT /api/admin/setup/semesters/:id/set-active
router.put('/semesters/:id/set-active', async (req, res) => {
  try {
    const semesterId = Number(req.params.id);
    // Deactivate all
    await systemDB.query('UPDATE semesters SET is_active = 0');
    // Activate target
    await systemDB.query(
      'UPDATE semesters SET is_active = 1 WHERE semester_id = ?',
      [semesterId]
    );
    res.json({ message: 'Active semester updated' });
  } catch (err) {
    console.error('Set active semester error:', err);
    res.status(500).json({ error: 'Failed to set active semester' });
  }
});

// ══════════════════════════════════════════════════════════
//  ALLOWED STUDENT NUMBERS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/student-numbers?semester_id=&section_id=
router.get('/student-numbers', async (req, res) => {
  try {
    const { semester_id, section_id } = req.query;
    let query = `
      SELECT asn.*, s.section_name, c.course_code, sem.school_year, sem.term
      FROM allowed_student_numbers asn
      LEFT JOIN sections s   ON s.section_id   = asn.section_id
      LEFT JOIN courses  c   ON c.course_id    = asn.course_id
      LEFT JOIN semesters sem ON sem.semester_id = asn.semester_id
      WHERE 1=1
    `;
    const params = [];
    if (semester_id) { query += ' AND asn.semester_id = ?'; params.push(semester_id); }
    if (section_id)  { query += ' AND asn.section_id = ?';  params.push(section_id); }
    query += ' ORDER BY asn.created_at DESC';
    const [rows] = await systemDB.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch student numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch student numbers' });
  }
});

// POST /api/admin/setup/student-numbers
// Body: { entries: [{ student_number, section_id, course_id, year_level, semester_id, email_hint? }] }
router.post('/student-numbers', async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    let inserted = 0;
    let skipped = 0;
    for (const entry of entries) {
      const { student_number, section_id, course_id, year_level, semester_id, email_hint } = entry;
      if (!student_number) { skipped++; continue; }
      try {
        await systemDB.query(
          `INSERT IGNORE INTO allowed_student_numbers
           (student_number, email_hint, section_id, course_id, year_level, semester_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            student_number.trim(),
            email_hint || null,
            section_id  || null,
            course_id   || null,
            year_level  || null,
            semester_id || null
          ]
        );
        inserted++;
      } catch (rowErr) {
        skipped++;
      }
    }

    res.json({ message: `Inserted ${inserted}, skipped ${skipped} (duplicates or invalid).` });
  } catch (err) {
    console.error('Add student numbers error:', err);
    res.status(500).json({ error: 'Failed to add student numbers' });
  }
});

// DELETE /api/admin/setup/student-numbers/:id
router.delete('/student-numbers/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM allowed_student_numbers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Student number removed' });
  } catch (err) {
    console.error('Delete student number error:', err);
    res.status(500).json({ error: 'Failed to delete student number' });
  }
});

// ══════════════════════════════════════════════════════════
//  CLASS CODES
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/class-codes?semester_id=
router.get('/class-codes', async (req, res) => {
  try {
    const { semester_id } = req.query;
    let query = `
      SELECT cc.*, s.section_name, sem.school_year, sem.term,
             u.full_name AS created_by_name
      FROM class_codes cc
      LEFT JOIN sections  s   ON s.section_id   = cc.section_id
      LEFT JOIN semesters sem ON sem.semester_id = cc.semester_id
      LEFT JOIN users     u   ON u.user_id       = cc.created_by
      WHERE 1=1
    `;
    const params = [];
    if (semester_id) { query += ' AND cc.semester_id = ?'; params.push(semester_id); }
    query += ' ORDER BY cc.created_at DESC';
    const [rows] = await systemDB.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch class codes error:', err);
    res.status(500).json({ error: 'Failed to fetch class codes' });
  }
});

// POST /api/admin/setup/class-codes
// Body: { section_id, semester_id, expires_at? }
router.post('/class-codes', async (req, res) => {
  try {
    const { section_id, semester_id, expires_at } = req.body;
    if (!section_id || !semester_id) {
      return res.status(400).json({ error: 'section_id and semester_id are required' });
    }

    // Generate unique code: e.g. "A-S1-K7X2P"
    const [secRows] = await systemDB.query('SELECT section_name FROM sections WHERE section_id = ?', [section_id]);
    const [semRows] = await systemDB.query('SELECT term FROM semesters WHERE semester_id = ?', [semester_id]);
    const secPart  = secRows[0]?.section_name?.replace(/\s+/g, '') || 'SEC';
    const termPart = semRows[0]?.term?.replace('nd','').replace('st','').replace('rd','') || 'T';
    const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${secPart}-${termPart}-${randPart}`.substring(0, 20);

    const [result] = await systemDB.query(
      `INSERT INTO class_codes (code, section_id, semester_id, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [code, section_id, semester_id, expires_at || null, req.user.user_id]
    );

    res.status(201).json({ message: 'Class code generated', code_id: result.insertId, code });
  } catch (err) {
    console.error('Create class code error:', err);
    res.status(500).json({ error: 'Failed to generate class code' });
  }
});

// PUT /api/admin/setup/class-codes/:id/toggle
router.put('/class-codes/:id/toggle', async (req, res) => {
  try {
    await systemDB.query(
      'UPDATE class_codes SET is_active = NOT is_active WHERE code_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Class code status toggled' });
  } catch (err) {
    console.error('Toggle class code error:', err);
    res.status(500).json({ error: 'Failed to toggle class code' });
  }
});

// DELETE /api/admin/setup/class-codes/:id
router.delete('/class-codes/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM class_codes WHERE code_id = ?', [req.params.id]);
    res.json({ message: 'Class code deleted' });
  } catch (err) {
    console.error('Delete class code error:', err);
    res.status(500).json({ error: 'Failed to delete class code' });
  }
});

// ══════════════════════════════════════════════════════════
//  TEACHER SECTION ASSIGNMENTS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/teacher-assignments?semester_id=
router.get('/teacher-assignments', async (req, res) => {
  try {
    const { semester_id } = req.query;
    let query = `
      SELECT
        tsa.assignment_id,
        tsa.teacher_id,
        u.full_name AS teacher_name,
        u.email AS teacher_email,
        tsa.section_id,
        s.section_name,
        tsa.course_id,
        c.course_code,
        c.course_name,
        tsa.year_level,
        tsa.semester_id,
        sem.school_year,
        sem.term,
        tsa.subject_name,
        tsa.created_at
      FROM teacher_section_assignments tsa
      JOIN users     u   ON u.user_id      = tsa.teacher_id
      JOIN sections  s   ON s.section_id   = tsa.section_id
      JOIN courses   c   ON c.course_id    = tsa.course_id
      JOIN semesters sem ON sem.semester_id = tsa.semester_id
      WHERE 1=1
    `;
    const params = [];
    if (semester_id) { query += ' AND tsa.semester_id = ?'; params.push(semester_id); }
    query += ' ORDER BY sem.school_year DESC, s.section_name ASC';
    const [rows] = await systemDB.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch teacher assignments error:', err);
    res.status(500).json({ error: 'Failed to fetch teacher assignments' });
  }
});

// POST /api/admin/setup/teacher-assignments
// Body: { teacher_id, section_id, course_id, year_level, semester_id, subject_name }
router.post('/teacher-assignments', async (req, res) => {
  try {
    const { teacher_id, section_id, course_id, year_level, semester_id, subject_name } = req.body;
    if (!teacher_id || !section_id || !course_id || !year_level || !semester_id || !subject_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify teacher exists and is role_id=2
    const [[teacher]] = await systemDB.query(
      'SELECT user_id, full_name FROM users WHERE user_id = ? AND role_id = 2',
      [teacher_id]
    );
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const [result] = await systemDB.query(
      `INSERT INTO teacher_section_assignments
       (teacher_id, section_id, course_id, year_level, semester_id, subject_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacher_id, section_id, course_id, year_level, semester_id, subject_name.trim()]
    );

    res.status(201).json({
      message: `${teacher.full_name} assigned to section successfully`,
      assignment_id: result.insertId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This teacher is already assigned to this section for this semester' });
    }
    console.error('Create teacher assignment error:', err);
    res.status(500).json({ error: 'Failed to create teacher assignment' });
  }
});

// DELETE /api/admin/setup/teacher-assignments/:id
router.delete('/teacher-assignments/:id', async (req, res) => {
  try {
    await systemDB.query(
      'DELETE FROM teacher_section_assignments WHERE assignment_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Teacher assignment removed' });
  } catch (err) {
    console.error('Delete teacher assignment error:', err);
    res.status(500).json({ error: 'Failed to delete teacher assignment' });
  }
});

// ══════════════════════════════════════════════════════════
//  HELPER: Get all teachers (for assignment dropdown)
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/teachers
router.get('/teachers', async (req, res) => {
  try {
    const [rows] = await systemDB.query(
      `SELECT user_id, full_name, email, teacher_id
       FROM users WHERE role_id = 2 ORDER BY full_name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch teachers error:', err);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

module.exports = router;
