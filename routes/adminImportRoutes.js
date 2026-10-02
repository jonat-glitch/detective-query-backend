// routes/adminImportRoutes.js
// Handles CSV/Excel student & teacher import, invitation sending, and account setup validation.
// POST /api/admin/import/csv         — Upload CSV/Excel → parse → create invitations → send emails
// GET  /api/admin/import/batches     — List all import batches
// GET  /api/admin/import/batch/:id   — List invitations in a batch
// POST /api/admin/import/resend/:id  — Resend invite email for one invitation
// POST /api/admin/import/resend-batch/:batchId — Resend all pending in a batch
// POST /api/admin/import/cancel/:id  — Cancel an invitation

const express = require('express');
const multer  = require('multer');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const ExcelJS = require('exceljs');
const { parse: parseCsvSync } = require('csv-parse/sync');

const { systemDB }         = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendStudentInvitationEmail } = require('../services/emailService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/import/template (public/blank template download)
// Placed before auth middleware so direct window.open / browser downloads work
// ─────────────────────────────────────────────────────────────────────────────
router.get('/template', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Detective Query';
    workbook.created = new Date();

    // Sheet 1: Students (with real-world sample rows)
    const wsStudents = workbook.addWorksheet('Students');
    wsStudents.columns = [
      { header: 'email', key: 'email', width: 28 },
      { header: 'first_name', key: 'first_name', width: 16 },
      { header: 'middle_name', key: 'middle_name', width: 16 },
      { header: 'last_name', key: 'last_name', width: 16 },
      { header: 'extension_name', key: 'extension_name', width: 16 },
      { header: 'student_number', key: 'student_number', width: 18 },
      { header: 'section', key: 'section', width: 12 },
      { header: 'course_code', key: 'course_code', width: 14 },
      { header: 'year_level', key: 'year_level', width: 12 },
      { header: 'role', key: 'role', width: 12 },
    ];

    wsStudents.addRows([
      ['juan.delacruz@example.com', 'Juan', 'Santos', 'Dela Cruz', 'Jr.', '21-00123', '3J', 'BSIT', 3, 'student'],
      ['maria.santos@example.com', 'Maria Clara', 'Reyes', 'Santos', '', '21-00456', '2E', 'BSIT', 2, 'student'],
      ['pedro.penduko@example.com', 'Pedro', 'Cruz', 'Penduko', '', '21-00789', '3J', 'BSIT', 3, 'student']
    ]);

    // Sheet 2: Column Instructions & Reference
    const wsGuide = workbook.addWorksheet('Column Guide');
    wsGuide.columns = [
      { header: 'COLUMN NAME', key: 'col', width: 18 },
      { header: 'REQUIRED?', key: 'req', width: 12 },
      { header: 'DESCRIPTION', key: 'desc', width: 60 },
      { header: 'EXAMPLE VALUE', key: 'example', width: 30 }
    ];

    wsGuide.addRows([
      ['email', 'YES', 'Active Gmail or university email. Private setup link is sent here.', 'juan.delacruz@gmail.com'],
      ['first_name', 'YES', 'Student given name.', 'Juan'],
      ['middle_name', 'NO', 'Middle name or middle initial. Leave blank if none.', 'Santos'],
      ['last_name', 'YES', 'Family name / Surname.', 'Dela Cruz'],
      ['extension_name', 'NO', 'Name suffix (Jr., Sr., III). Leave blank if none.', 'Jr.'],
      ['student_number', 'YES', 'Official School ID Number from registrar.', '21-00123'],
      ['section', 'YES', 'Section name matching Academic Setup (case-insensitive).', '3J'],
      ['course_code', 'YES', 'Course/Program code matching Academic Setup.', 'BSIT'],
      ['year_level', 'YES', 'Year level number (1, 2, 3, or 4).', '3'],
      ['role', 'NO', 'Leave as "student" (default) or "teacher".', 'student']
    ]);

    const buf = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', 'attachment; filename="detective_query_import_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// All other import routes below are admin-only
router.use(authenticateToken, requireAdmin);

// Multer: accept .csv / .xlsx in memory (no disk write)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter(req, file, cb) {
    const allowed = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (['csv', 'xlsx', 'xls'].includes(ext)) return cb(null, true);
    cb(new Error('Only CSV and Excel files are allowed'));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Parse uploaded file buffer → array of row objects
// ─────────────────────────────────────────────────────────────────────────────
async function parseFile(buffer, originalname) {
  const ext = originalname.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    return parseCsvSync(buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = (cell.text || cell.value || '').toString().trim();
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData = {};
    let hasAnyVal = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colName = headers[colNumber];
      if (colName) {
        let val = cell.value;
        if (val !== null && typeof val === 'object') {
          val = val.text || val.result || '';
        }
        val = val !== undefined && val !== null ? String(val).trim() : '';
        if (val) hasAnyVal = true;
        rowData[colName] = val;
      }
    });
    if (hasAnyVal) {
      rows.push(rowData);
    }
  });

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Normalize column names from various possible header spellings
// ─────────────────────────────────────────────────────────────────────────────
function normalizeRow(raw) {
  const pick = (...keys) => {
    for (const k of keys) {
      const found = Object.keys(raw).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
      if (found && raw[found] !== undefined && raw[found] !== '') return String(raw[found]).trim();
    }
    return null;
  };
  return {
    email:          pick('email', 'email address', 'gmail'),
    first_name:     pick('first_name', 'firstname', 'first name', 'given name'),
    middle_name:    pick('middle_name', 'middlename', 'middle name', 'middle initial'),
    last_name:      pick('last_name', 'lastname', 'last name', 'surname', 'family name'),
    extension_name: pick('extension_name', 'suffix', 'ext', 'extension'),
    student_number: pick('student_number', 'student_id', 'id number', 'id no', 'school id'),
    section:        pick('section', 'section_name', 'class'),
    course_code:    pick('course_code', 'course', 'program', 'course code'),
    year_level:     pick('year_level', 'year', 'year level'),
    role:           pick('role', 'type', 'user_type'),  // 'student' or 'teacher'
    teacher_id:     pick('teacher_id', 'employee_id', 'employee id', 'faculty id'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/import/csv
// Body (multipart): file, semester_id, [label]
// ─────────────────────────────────────────────────────────────────────────────
router.post('/csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const semester_id = Number(req.body.semester_id) || null;
  const label       = (req.body.label || '').trim() || null;
  if (!semester_id) return res.status(400).json({ error: 'semester_id is required' });

  let rows;
  try {
    rows = await parseFile(req.file.buffer, req.file.originalname);
  } catch (e) {
    return res.status(400).json({ error: 'Failed to parse file: ' + e.message });
  }

  if (!rows.length) return res.status(400).json({ error: 'File is empty or has no data rows' });

  // Fetch section and course lookup maps
  const [sectionRows] = await systemDB.query('SELECT section_id, section_name FROM sections');
  const [courseRows]  = await systemDB.query('SELECT course_id, course_code FROM courses');

  const sectionMap = {};
  sectionRows.forEach(s => { sectionMap[s.section_name.toLowerCase()] = s.section_id; });
  const courseMap = {};
  courseRows.forEach(c => { courseMap[c.course_code.toLowerCase()] = c.course_id; });

  // Unique batch ID for this import session
  const batchId     = `BATCH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const importedBy  = req.user.user_id;
  const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const results = { success: [], skipped: [], errors: [] };

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);

    if (!row.email) {
      results.skipped.push({ row: rawRow, reason: 'Missing email' });
      continue;
    }

    const email = row.email.toLowerCase();

    // Skip if already an active user
    const [existingUser] = await systemDB.query(
      'SELECT user_id FROM users WHERE email = ?', [email]
    );
    if (existingUser.length > 0) {
      results.skipped.push({ email, reason: 'Already has an account' });
      continue;
    }

    // Skip if already invited in this batch
    const [existingInvite] = await systemDB.query(
      'SELECT invitation_id FROM student_invitations WHERE email = ? AND import_batch_id = ?',
      [email, batchId]
    );
    if (existingInvite.length > 0) {
      results.skipped.push({ email, reason: 'Duplicate in this batch' });
      continue;
    }

    // Resolve section & course
    const section_id = row.section ? (sectionMap[row.section.toLowerCase()] || null) : null;
    const course_id  = row.course_code ? (courseMap[row.course_code.toLowerCase()] || null) : null;
    const year_level = row.year_level ? Number(row.year_level) || null : null;

    // Determine role
    const roleLower = (row.role || 'student').toLowerCase();
    const role_id   = roleLower === 'teacher' ? 2 : 1;

    // Generate unique token
    const invite_token = crypto.randomBytes(48).toString('hex');

    try {
      await systemDB.query(
        `INSERT INTO student_invitations
         (email, first_name, middle_name, last_name, extension_name, student_number,
          section_id, course_id, year_level, semester_id,
          invite_token, token_expires_at, status,
          import_batch_id, imported_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          email,
          row.first_name || null,
          row.middle_name || null,
          row.last_name   || null,
          row.extension_name || null,
          row.student_number || row.teacher_id || null,
          section_id, course_id, year_level, semester_id,
          invite_token, tokenExpiry,
          batchId, importedBy,
        ]
      );

      // Send invitation email (fire and continue even if one fails)
      try {
        const displayName = [row.first_name, row.last_name].filter(Boolean).join(' ') || email;
        await sendStudentInvitationEmail({
          to:          email,
          fullName:    displayName,
          token:       invite_token,
          role_id,
          section:     row.section,
          course_code: row.course_code,
          year_level,
          label,
        });
        results.success.push({ email, name: displayName });
      } catch (mailErr) {
        console.error(`[Import] Email failed for ${email}:`, mailErr.message);
        results.success.push({ email, name: row.first_name || email, email_error: mailErr.message });
      }
    } catch (dbErr) {
      console.error(`[Import] DB error for ${email}:`, dbErr.message);
      results.errors.push({ email, reason: dbErr.message });
    }
  }

  res.json({
    message: `Import complete. ${results.success.length} invited, ${results.skipped.length} skipped, ${results.errors.length} errors.`,
    batch_id: batchId,
    label,
    results,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/import/batches
// List all import batches with summary stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/batches', async (req, res) => {
  try {
    const [rows] = await systemDB.query(`
      SELECT
        si.import_batch_id                        AS batch_id,
        MIN(si.invited_at)                        AS imported_at,
        u.full_name                               AS imported_by_name,
        sem.school_year,
        sem.term,
        COUNT(*)                                  AS total,
        SUM(si.status = 'pending')                AS pending,
        SUM(si.status = 'completed')              AS completed,
        SUM(si.status = 'expired')                AS expired,
        SUM(si.status = 'cancelled')              AS cancelled
      FROM student_invitations si
      LEFT JOIN users u ON u.user_id = si.imported_by
      LEFT JOIN semesters sem ON sem.semester_id = si.semester_id
      GROUP BY si.import_batch_id, u.full_name, sem.school_year, sem.term
      ORDER BY MIN(si.invited_at) DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[Import Batches]', err);
    res.status(500).json({ error: 'Failed to fetch import batches' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/import/batch/:batchId
// List all invitations in a specific batch
// ─────────────────────────────────────────────────────────────────────────────
router.get('/batch/:batchId', async (req, res) => {
  try {
    const [rows] = await systemDB.query(`
      SELECT
        si.*,
        s.section_name,
        c.course_code,
        sem.school_year,
        sem.term,
        u.full_name AS completed_user_name
      FROM student_invitations si
      LEFT JOIN sections  s   ON s.section_id   = si.section_id
      LEFT JOIN courses   c   ON c.course_id    = si.course_id
      LEFT JOIN semesters sem ON sem.semester_id = si.semester_id
      LEFT JOIN users     u   ON u.user_id       = si.user_id
      WHERE si.import_batch_id = ?
      ORDER BY si.invited_at DESC
    `, [req.params.batchId]);
    res.json(rows);
  } catch (err) {
    console.error('[Batch Detail]', err);
    res.status(500).json({ error: 'Failed to fetch batch details' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/import/resend/:invitationId
// Resend invite email for a single invitation (generates new token)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resend/:invitationId', async (req, res) => {
  try {
    const [[inv]] = await systemDB.query(
      'SELECT * FROM student_invitations WHERE invitation_id = ?',
      [req.params.invitationId]
    );
    if (!inv) return res.status(404).json({ error: 'Invitation not found' });
    if (inv.status === 'completed') return res.status(400).json({ error: 'Invitation already completed' });
    if (inv.status === 'cancelled') return res.status(400).json({ error: 'Invitation has been cancelled' });

    const newToken   = crypto.randomBytes(48).toString('hex');
    const newExpiry  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await systemDB.query(
      `UPDATE student_invitations
       SET invite_token = ?, token_expires_at = ?, status = 'pending', resent_at = NOW()
       WHERE invitation_id = ?`,
      [newToken, newExpiry, inv.invitation_id]
    );

    const displayName = [inv.first_name, inv.last_name].filter(Boolean).join(' ') || inv.email;
    await sendStudentInvitationEmail({
      to:       inv.email,
      fullName: displayName,
      token:    newToken,
    });

    res.json({ message: `Invite resent to ${inv.email}` });
  } catch (err) {
    console.error('[Resend Invite]', err);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/import/resend-batch/:batchId
// Resend all pending/expired invitations in a batch (generates new tokens)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resend-batch/:batchId', async (req, res) => {
  try {
    const [pending] = await systemDB.query(
      `SELECT * FROM student_invitations
       WHERE import_batch_id = ? AND status IN ('pending','expired')`,
      [req.params.batchId]
    );
    if (!pending.length) return res.json({ message: 'No pending invitations to resend', count: 0 });

    let sent = 0, failed = 0;
    for (const inv of pending) {
      const newToken  = crypto.randomBytes(48).toString('hex');
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await systemDB.query(
        `UPDATE student_invitations
         SET invite_token = ?, token_expires_at = ?, status = 'pending', resent_at = NOW()
         WHERE invitation_id = ?`,
        [newToken, newExpiry, inv.invitation_id]
      );
      try {
        const displayName = [inv.first_name, inv.last_name].filter(Boolean).join(' ') || inv.email;
        await sendStudentInvitationEmail({ to: inv.email, fullName: displayName, token: newToken });
        sent++;
      } catch {
        failed++;
      }
    }

    res.json({ message: `Batch resend complete`, sent, failed });
  } catch (err) {
    console.error('[Resend Batch]', err);
    res.status(500).json({ error: 'Failed to resend batch' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/import/cancel/:invitationId
// Cancel a pending invitation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cancel/:invitationId', async (req, res) => {
  try {
    const [[inv]] = await systemDB.query(
      'SELECT invitation_id, status FROM student_invitations WHERE invitation_id = ?',
      [req.params.invitationId]
    );
    if (!inv) return res.status(404).json({ error: 'Invitation not found' });
    if (inv.status === 'completed') return res.status(400).json({ error: 'Cannot cancel a completed invitation' });

    await systemDB.query(
      `UPDATE student_invitations SET status = 'cancelled' WHERE invitation_id = ?`,
      [inv.invitation_id]
    );
    res.json({ message: 'Invitation cancelled' });
  } catch (err) {
    console.error('[Cancel Invite]', err);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

module.exports = router;
