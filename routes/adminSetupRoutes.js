const express = require('express');
const router = express.Router();
const { systemDB } = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const crypto = require('crypto');

// 🔒 All routes here are ADMIN ONLY
router.use(authenticateToken);
router.use(authorizeRole([3]));

// ══════════════════════════════════════════════════════════
//  1. COURSES (3NF entity)
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/courses?archived=true/false
router.get('/courses', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    const [rows] = await systemDB.query(
      'SELECT * FROM courses WHERE is_archived = ? ORDER BY course_code ASC',
      [isArchived]
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
      'INSERT INTO courses (course_code, course_name, is_archived) VALUES (?, ?, 0)',
      [course_code.trim().toUpperCase(), course_name.trim()]
    );
    res.status(201).json({ message: 'Course created', course_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This course entry (Code and Name) already exists' });
    }
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PUT /api/admin/setup/courses/:id
// Body: { course_code, course_name }
router.put('/courses/:id', async (req, res) => {
  try {
    const { course_code, course_name } = req.body;
    if (!course_code || !course_name) {
      return res.status(400).json({ error: 'course_code and course_name are required' });
    }
    await systemDB.query(
      'UPDATE courses SET course_code = ?, course_name = ? WHERE course_id = ?',
      [course_code.trim().toUpperCase(), course_name.trim(), req.params.id]
    );
    res.json({ message: 'Course updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This course entry (Code and Name) already exists' });
    }
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// PUT /api/admin/setup/courses/:id/archive
router.put('/courses/:id/archive', async (req, res) => {
  try {
    await systemDB.query(
      'UPDATE courses SET is_archived = NOT is_archived WHERE course_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Course archive status updated' });
  } catch (err) {
    console.error('Archive course error:', err);
    res.status(500).json({ error: 'Failed to update course archive status' });
  }
});

// DELETE /api/admin/setup/courses/:id (Permanent delete)
router.delete('/courses/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM courses WHERE course_id = ?', [req.params.id]);
    res.json({ message: 'Course permanently deleted' });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ══════════════════════════════════════════════════════════
//  2. SECTIONS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/sections?archived=true/false
router.get('/sections', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    const [rows] = await systemDB.query(
      'SELECT * FROM sections WHERE is_archived = ? ORDER BY section_name ASC',
      [isArchived]
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
    const { section_name, auto_generate_code } = req.body;
    if (!section_name) {
      return res.status(400).json({ error: 'section_name is required' });
    }

    // Support comma-separated multiple sections: e.g. "3A, 3B, 3C"
    const names = String(section_name)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (names.length === 0) {
      return res.status(400).json({ error: 'At least one valid section name is required' });
    }

    // Get active semester if auto_generate_code is true
    let activeSem = null;
    if (auto_generate_code) {
      const [semRows] = await systemDB.query('SELECT semester_id FROM semesters WHERE is_active = 1 LIMIT 1');
      if (semRows.length > 0) activeSem = semRows[0].semester_id;
    }

    const created = [];
    const skipped = [];

    for (const name of names) {
      const [existing] = await systemDB.query('SELECT section_id FROM sections WHERE section_name = ?', [name]);
      if (existing.length > 0) {
        skipped.push(name);
        continue;
      }

      const [result] = await systemDB.query(
        'INSERT INTO sections (section_name, is_archived) VALUES (?, 0)',
        [name]
      );
      const newSecId = result.insertId;
      created.push({ section_id: newSecId, section_name: name });

      // If auto-generate code requested and active semester exists
      if (auto_generate_code && activeSem) {
        const uniqueCode = `${name.replace(/[^A-Z0-9]/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await systemDB.query(
          `INSERT INTO class_codes (code, section_id, semester_id, is_active, is_archived)
           VALUES (?, ?, ?, 1, 0)`,
          [uniqueCode, newSecId, activeSem]
        );
      }
    }

    if (created.length === 0 && skipped.length > 0) {
      return res.status(409).json({ error: `Section(s) already exist: ${skipped.join(', ')}` });
    }

    res.status(201).json({
      message: created.length === 1 
        ? `Section ${created[0].section_name} created${auto_generate_code ? ' (Class code auto-generated)' : ''}` 
        : `${created.length} sections created successfully${auto_generate_code ? ' (Class codes auto-generated)' : ''}`,
      created,
      skipped,
      section_id: created[0]?.section_id
    });
  } catch (err) {
    console.error('Create section error:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// PUT /api/admin/setup/sections/:id
// Body: { section_name }
router.put('/sections/:id', async (req, res) => {
  try {
    const { section_name } = req.body;
    if (!section_name) {
      return res.status(400).json({ error: 'section_name is required' });
    }
    await systemDB.query(
      'UPDATE sections SET section_name = ? WHERE section_id = ?',
      [section_name.trim().toUpperCase(), req.params.id]
    );
    res.json({ message: 'Section updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Section already exists' });
    }
    console.error('Update section error:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// PUT /api/admin/setup/sections/:id/archive
router.put('/sections/:id/archive', async (req, res) => {
  try {
    await systemDB.query(
      'UPDATE sections SET is_archived = NOT is_archived WHERE section_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Section archive status updated' });
  } catch (err) {
    console.error('Archive section error:', err);
    res.status(500).json({ error: 'Failed to update section archive status' });
  }
});

// DELETE /api/admin/setup/sections/:id (Permanent delete)
router.delete('/sections/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM sections WHERE section_id = ?', [req.params.id]);
    res.json({ message: 'Section permanently deleted' });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// ══════════════════════════════════════════════════════════
//  3. SEMESTERS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/semesters?archived=true/false
router.get('/semesters', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    const [rows] = await systemDB.query(
      'SELECT * FROM semesters WHERE is_archived = ? ORDER BY school_year DESC, FIELD(term,"1st","2nd","Summer")',
      [isArchived]
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
      'INSERT INTO semesters (school_year, term, is_active, is_archived) VALUES (?, ?, ?, 0)',
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

// PUT /api/admin/setup/semesters/:id
// Body: { school_year, term }
router.put('/semesters/:id', async (req, res) => {
  try {
    const { school_year, term } = req.body;
    if (!school_year || !term) {
      return res.status(400).json({ error: 'school_year and term are required' });
    }
    await systemDB.query(
      'UPDATE semesters SET school_year = ?, term = ? WHERE semester_id = ?',
      [school_year.trim(), term, req.params.id]
    );
    res.json({ message: 'Semester updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This semester already exists' });
    }
    console.error('Update semester error:', err);
    res.status(500).json({ error: 'Failed to update semester' });
  }
});

// PUT /api/admin/setup/semesters/:id/set-active
router.put('/semesters/:id/set-active', async (req, res) => {
  try {
    const semesterId = Number(req.params.id);
    await systemDB.query('UPDATE semesters SET is_active = 0');
    await systemDB.query(
      'UPDATE semesters SET is_active = 1, is_archived = 0 WHERE semester_id = ?',
      [semesterId]
    );
    res.json({ message: 'Active semester updated' });
  } catch (err) {
    console.error('Set active semester error:', err);
    res.status(500).json({ error: 'Failed to set active semester' });
  }
});

// PUT /api/admin/setup/semesters/:id/archive
router.put('/semesters/:id/archive', async (req, res) => {
  try {
    const [[sem]] = await systemDB.query('SELECT is_active FROM semesters WHERE semester_id = ?', [req.params.id]);
    if (sem && sem.is_active) {
      return res.status(400).json({ error: 'Cannot archive the currently active semester. Please activate another semester first.' });
    }
    await systemDB.query(
      'UPDATE semesters SET is_archived = NOT is_archived WHERE semester_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Semester archive status updated' });
  } catch (err) {
    console.error('Archive semester error:', err);
    res.status(500).json({ error: 'Failed to update semester archive status' });
  }
});

// DELETE /api/admin/setup/semesters/:id (Permanent delete)
router.delete('/semesters/:id', async (req, res) => {
  try {
    const [[sem]] = await systemDB.query('SELECT is_active FROM semesters WHERE semester_id = ?', [req.params.id]);
    if (sem && sem.is_active) {
      return res.status(400).json({ error: 'Cannot delete the active semester.' });
    }
    await systemDB.query('DELETE FROM semesters WHERE semester_id = ?', [req.params.id]);
    res.json({ message: 'Semester permanently deleted' });
  } catch (err) {
    console.error('Delete semester error:', err);
    res.status(500).json({ error: 'Failed to delete semester' });
  }
});

// ══════════════════════════════════════════════════════════
//  4. ALLOWED STUDENT NUMBERS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/student-numbers?semester_id=&section_id=&archived=true/false
router.get('/student-numbers', async (req, res) => {
  try {
    const { semester_id, section_id } = req.query;
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    let query = `
      SELECT asn.*, s.section_name, c.course_code, sem.school_year, sem.term
      FROM allowed_student_numbers asn
      LEFT JOIN sections s   ON s.section_id   = asn.section_id
      LEFT JOIN courses  c   ON c.course_id    = asn.course_id
      LEFT JOIN semesters sem ON sem.semester_id = asn.semester_id
      WHERE asn.is_archived = ?
    `;
    const params = [isArchived];
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
           (student_number, email_hint, section_id, course_id, year_level, semester_id, is_archived)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
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

// PUT /api/admin/setup/student-numbers/:id
// Body: { student_number, course_id, section_id, year_level, semester_id, email_hint }
router.put('/student-numbers/:id', async (req, res) => {
  try {
    const { student_number, course_id, section_id, year_level, semester_id, email_hint } = req.body;
    if (!student_number) {
      return res.status(400).json({ error: 'student_number is required' });
    }
    await systemDB.query(
      `UPDATE allowed_student_numbers
       SET student_number = ?, course_id = ?, section_id = ?, year_level = ?, semester_id = ?, email_hint = ?
       WHERE id = ?`,
      [
        student_number.trim(),
        course_id   || null,
        section_id  || null,
        year_level  || null,
        semester_id || null,
        email_hint  || null,
        req.params.id
      ]
    );
    res.json({ message: 'Student ID record updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This student number already exists' });
    }
    console.error('Update student number error:', err);
    res.status(500).json({ error: 'Failed to update student number' });
  }
});

// PUT /api/admin/setup/student-numbers/:id/archive
router.put('/student-numbers/:id/archive', async (req, res) => {
  try {
    await systemDB.query(
      'UPDATE allowed_student_numbers SET is_archived = NOT is_archived WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Student number archive status updated' });
  } catch (err) {
    console.error('Archive student number error:', err);
    res.status(500).json({ error: 'Failed to update student number archive status' });
  }
});

// DELETE /api/admin/setup/student-numbers/:id (Permanent delete)
router.delete('/student-numbers/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM allowed_student_numbers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Student number permanently removed' });
  } catch (err) {
    console.error('Delete student number error:', err);
    res.status(500).json({ error: 'Failed to delete student number' });
  }
});

// ══════════════════════════════════════════════════════════
//  5. CLASS CODES
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/class-codes?semester_id=&archived=true/false
router.get('/class-codes', async (req, res) => {
  try {
    const { semester_id } = req.query;
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    let query = `
      SELECT cc.*, s.section_name, sem.school_year, sem.term,
             u.full_name AS created_by_name
      FROM class_codes cc
      LEFT JOIN sections  s   ON s.section_id   = cc.section_id
      LEFT JOIN semesters sem ON sem.semester_id = cc.semester_id
      LEFT JOIN users     u   ON u.user_id       = cc.created_by
      WHERE cc.is_archived = ?
    `;
    const params = [isArchived];
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

    const [secRows] = await systemDB.query('SELECT section_name FROM sections WHERE section_id = ?', [section_id]);
    const [semRows] = await systemDB.query('SELECT term FROM semesters WHERE semester_id = ?', [semester_id]);
    const secPart  = secRows[0]?.section_name?.replace(/\s+/g, '') || 'SEC';
    const termPart = semRows[0]?.term?.replace('nd','').replace('st','').replace('rd','') || 'T';
    const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${secPart}-${termPart}-${randPart}`.substring(0, 20);

    const [result] = await systemDB.query(
      `INSERT INTO class_codes (code, section_id, semester_id, expires_at, created_by, is_archived)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [code, section_id, semester_id, expires_at || null, req.user.user_id]
    );

    res.status(201).json({ message: 'Class code generated', code_id: result.insertId, code });
  } catch (err) {
    console.error('Create class code error:', err);
    res.status(500).json({ error: 'Failed to generate class code' });
  }
});

// PUT /api/admin/setup/class-codes/:id
// Body: { section_id, semester_id, expires_at }
router.put('/class-codes/:id', async (req, res) => {
  try {
    const { section_id, semester_id, expires_at } = req.body;
    await systemDB.query(
      `UPDATE class_codes
       SET section_id = ?, semester_id = ?, expires_at = ?
       WHERE code_id = ?`,
      [section_id || null, semester_id || null, expires_at || null, req.params.id]
    );
    res.json({ message: 'Class code updated successfully' });
  } catch (err) {
    console.error('Update class code error:', err);
    res.status(500).json({ error: 'Failed to update class code' });
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

// PUT /api/admin/setup/class-codes/:id/archive
router.put('/class-codes/:id/archive', async (req, res) => {
  try {
    await systemDB.query(
      'UPDATE class_codes SET is_archived = NOT is_archived WHERE code_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Class code archive status updated' });
  } catch (err) {
    console.error('Archive class code error:', err);
    res.status(500).json({ error: 'Failed to update class code archive status' });
  }
});

// DELETE /api/admin/setup/class-codes/:id (Permanent delete)
router.delete('/class-codes/:id', async (req, res) => {
  try {
    await systemDB.query('DELETE FROM class_codes WHERE code_id = ?', [req.params.id]);
    res.json({ message: 'Class code permanently deleted' });
  } catch (err) {
    console.error('Delete class code error:', err);
    res.status(500).json({ error: 'Failed to delete class code' });
  }
});

// ══════════════════════════════════════════════════════════
//  6. TEACHER SECTION ASSIGNMENTS
// ══════════════════════════════════════════════════════════

// GET /api/admin/setup/teacher-assignments?semester_id=&archived=true/false
router.get('/teacher-assignments', async (req, res) => {
  try {
    const { semester_id } = req.query;
    const isArchived = req.query.archived === 'true' ? 1 : 0;
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
        tsa.is_archived,
        tsa.created_at
      FROM teacher_section_assignments tsa
      JOIN users     u   ON u.user_id      = tsa.teacher_id
      JOIN sections  s   ON s.section_id   = tsa.section_id
      JOIN courses   c   ON c.course_id    = tsa.course_id
      JOIN semesters sem ON sem.semester_id = tsa.semester_id
      WHERE tsa.is_archived = ?
    `;
    const params = [isArchived];
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
    let { teacher_id, section_id, course_id, year_level, semester_id, subject_name } = req.body;
    if (!teacher_id || !section_id || !subject_name) {
      return res.status(400).json({ error: 'Teacher, section, and subject name are required' });
    }

    // Auto-resolve semester_id if not provided
    if (!semester_id) {
      const [activeSemRows] = await systemDB.query('SELECT semester_id FROM semesters WHERE is_active = 1 LIMIT 1');
      if (activeSemRows.length > 0) {
        semester_id = activeSemRows[0].semester_id;
      } else {
        const [anySemRows] = await systemDB.query('SELECT semester_id FROM semesters ORDER BY semester_id DESC LIMIT 1');
        semester_id = anySemRows[0]?.semester_id;
      }
    }

    // Auto-resolve course_id if not provided
    if (!course_id) {
      const [firstCourse] = await systemDB.query('SELECT course_id FROM courses WHERE is_archived = 0 ORDER BY course_id ASC LIMIT 1');
      course_id = firstCourse[0]?.course_id || 1;
    }

    // Auto-resolve year_level from section name if not provided (e.g. "3J" -> 3)
    if (!year_level) {
      const [[secRow]] = await systemDB.query('SELECT section_name FROM sections WHERE section_id = ?', [section_id]);
      if (secRow) {
        const match = secRow.section_name.match(/^[A-Za-z]*([1-4])/);
        year_level = match ? Number(match[1]) : 1;
      } else {
        year_level = 1;
      }
    }

    const [[teacher]] = await systemDB.query(
      'SELECT user_id, full_name FROM users WHERE user_id = ? AND role_id = 2',
      [teacher_id]
    );
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const [result] = await systemDB.query(
      `INSERT INTO teacher_section_assignments
       (teacher_id, section_id, course_id, year_level, semester_id, subject_name, is_archived)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [teacher_id, section_id, course_id, year_level, semester_id, subject_name.trim()]
    );

    // 🚀 AUTO-CREATE ROOM & AUTO-ENROLL SECTION STUDENTS
    const roomInfo = await syncTeacherSectionRoom(teacher_id, section_id, course_id, year_level, semester_id, subject_name);

    res.status(201).json({
      message: `${teacher.full_name} assigned to section successfully. Auto-created classroom: ${roomInfo?.roomName || ''} (${roomInfo?.studentCount || 0} students auto-enrolled).`,
      assignment_id: result.insertId,
      room_id: roomInfo?.roomId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This teacher is already assigned to this section for this semester' });
    }
    console.error('Create teacher assignment error:', err);
    res.status(500).json({ error: 'Failed to create teacher assignment' });
  }
});

// Helper: Auto-create room for assigned teacher and auto-enroll all students of that section
async function syncTeacherSectionRoom(teacher_id, section_id, course_id, year_level, semester_id, subject_name) {
  try {
    const [[course]] = await systemDB.query('SELECT course_code, course_name FROM courses WHERE course_id = ?', [course_id]);
    const [[section]] = await systemDB.query('SELECT section_name FROM sections WHERE section_id = ?', [section_id]);
    const [[semester]] = await systemDB.query('SELECT school_year, term FROM semesters WHERE semester_id = ?', [semester_id]);

    const courseCode = course ? course.course_code : 'COURSE';
    const sectionName = section ? section.section_name : 'SEC';
    const roomName = `${courseCode} Sec ${sectionName} - ${subject_name.trim()}`;

    // Check if room already exists for this teacher, section, semester
    const [existingRooms] = await systemDB.query(
      `SELECT room_id, room_code FROM rooms 
       WHERE teacher_id = ? AND section_id = ? AND semester_id = ? AND (is_archived = 0 OR is_archived IS NULL)
       LIMIT 1`,
      [teacher_id, section_id, semester_id]
    );

    let roomId;
    if (existingRooms.length > 0) {
      roomId = existingRooms[0].room_id;
      await systemDB.query(
        `UPDATE rooms SET room_name = ?, course_id = ?, year_level = ? WHERE room_id = ?`,
        [roomName, course_id, year_level, roomId]
      );
    } else {
      let roomCode = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const [dup] = await systemDB.query('SELECT 1 FROM rooms WHERE room_code = ?', [roomCode]);
        if (dup.length === 0) isUnique = true;
        attempts++;
      }

      const [res] = await systemDB.query(
        `INSERT INTO rooms (teacher_id, room_name, room_code, is_archived, section_id, semester_id, course_id, year_level)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
        [teacher_id, roomName, roomCode, section_id, semester_id, course_id, year_level]
      );
      roomId = res.insertId;
    }

    // Auto-enroll all approved students belonging to this section
    const [students] = await systemDB.query(`
      SELECT DISTINCT u.user_id, u.student_id
      FROM users u
      LEFT JOIN allowed_student_numbers asn ON (asn.student_number = u.student_id)
      LEFT JOIN student_enrollments se ON (se.user_id = u.user_id)
      WHERE u.role_id = 1
        AND (se.section_id = ? OR asn.section_id = ?)
    `, [section_id, section_id]);

    for (const s of students) {
      // Create student enrollment record if missing
      await systemDB.query(
        `INSERT IGNORE INTO student_enrollments
         (user_id, course_id, year_level, section_id, semester_id)
         VALUES (?, ?, ?, ?, ?)`,
        [s.user_id, course_id, year_level, section_id, semester_id]
      );

      // Auto-approve in room_students
      await systemDB.query(
        `INSERT INTO room_students (room_id, student_id, status)
         VALUES (?, ?, 'Approved')
         ON DUPLICATE KEY UPDATE status = 'Approved'`,
        [roomId, s.user_id]
      );
    }

    return { roomId, roomName, studentCount: students.length };
  } catch (err) {
    console.error('Error auto-creating room for teacher section:', err);
    return null;
  }
}

// PUT /api/admin/setup/teacher-assignments/:id
// Body: { teacher_id, section_id, course_id, year_level, semester_id, subject_name }
router.put('/teacher-assignments/:id', async (req, res) => {
  try {
    const { teacher_id, section_id, course_id, year_level, semester_id, subject_name } = req.body;
    if (!teacher_id || !section_id || !course_id || !year_level || !semester_id || !subject_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    await systemDB.query(
      `UPDATE teacher_section_assignments
       SET teacher_id = ?, section_id = ?, course_id = ?, year_level = ?, semester_id = ?, subject_name = ?
       WHERE assignment_id = ?`,
      [teacher_id, section_id, course_id, year_level, semester_id, subject_name.trim(), req.params.id]
    );

    // Sync room for updated assignment
    await syncTeacherSectionRoom(teacher_id, section_id, course_id, year_level, semester_id, subject_name);

    res.json({ message: 'Teacher assignment updated successfully' });
  } catch (err) {
    console.error('Update teacher assignment error:', err);
    res.status(500).json({ error: 'Failed to update teacher assignment' });
  }
});

// PUT /api/admin/setup/teacher-assignments/:id/archive
router.put('/teacher-assignments/:id/archive', async (req, res) => {
  try {
    // BUG-07 FIX: Also archive/unarchive the associated auto-created room
    const [[assignment]] = await systemDB.query(
      'SELECT teacher_id, section_id, semester_id, is_archived FROM teacher_section_assignments WHERE assignment_id = ?',
      [req.params.id]
    );

    await systemDB.query(
      'UPDATE teacher_section_assignments SET is_archived = NOT is_archived WHERE assignment_id = ?',
      [req.params.id]
    );

    if (assignment) {
      // Toggle the matching room's archive status too
      const newArchiveState = assignment.is_archived ? 0 : 1;
      await systemDB.query(
        `UPDATE rooms 
         SET is_archived = ?, archived_at = ?
         WHERE teacher_id = ? AND section_id = ? AND semester_id = ?`,
        [
          newArchiveState,
          newArchiveState ? new Date() : null,
          assignment.teacher_id,
          assignment.section_id,
          assignment.semester_id
        ]
      );
    }

    res.json({ message: 'Teacher assignment archive status updated' });
  } catch (err) {
    console.error('Archive teacher assignment error:', err);
    res.status(500).json({ error: 'Failed to update teacher assignment archive status' });
  }
});

// DELETE /api/admin/setup/teacher-assignments/:id (Permanent delete)
router.delete('/teacher-assignments/:id', async (req, res) => {
  try {
    await systemDB.query(
      'DELETE FROM teacher_section_assignments WHERE assignment_id = ?',
      [req.params.id]
    );
    res.json({ message: 'Teacher assignment permanently removed' });
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
