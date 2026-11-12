/**
 * generate_normalization_docx.js
 * Generates NORMALIZATION.docx for Detective Query thesis defense.
 * Run: node scripts/generate_normalization_docx.js
 * Output: c:\Users\PC\Documents\4th Year Project\NORMALIZATION.docx
 */

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, convertInchesToTwip, PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');

const C = {
  navy:    '1B3A5C',
  blue:    '2E5C99',
  lblue:   'D6E4F7',
  altRow:  'EBF2FA',
  white:   'FFFFFF',
  green:   'D4EDDA',
  amber:   'FFF3CD',
  red:     'FDECEA',
  gray:    'F2F2F2',
  border:  'AEC6E0',
  dark:    '1A1A2E',
  gold:    'C9A84C',
};

// ── helpers ──────────────────────────────────────────────────────────────────
const tr = (text, opts = {}) => new TextRun({ text: String(text ?? ''), size: opts.size ?? 20, bold: opts.bold, italics: opts.italic, color: opts.color ?? C.dark });

const borders = { top: { style: BorderStyle.SINGLE, size: 1, color: C.border }, bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border }, left: { style: BorderStyle.SINGLE, size: 1, color: C.border }, right: { style: BorderStyle.SINGLE, size: 1, color: C.border } };

function tc(text, bg = C.white, bold = false, color = C.dark, size = 18) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? '—'), size, bold, color })], spacing: { before: 40, after: 40 } })],
    shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 60, bottom: 60, left: 120, right: 80 },
    borders,
  });
}

function hrow(labels, bg = C.navy) {
  return new TableRow({ children: labels.map(l => tc(l, bg, true, C.white, 18)), tableHeader: true });
}

function drow(vals, idx, bg) {
  const rowBg = bg ?? (idx % 2 === 0 ? C.white : C.altRow);
  return new TableRow({ children: vals.map(v => tc(v, rowBg, false, C.dark, 17)) });
}

function fullTable(headers, rows, bgs) {
  return new Table({
    rows: [hrow(headers), ...rows.map((r, i) => drow(r, i, bgs ? bgs[i] : undefined))],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function h1(text) {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 30, color: C.white })], heading: HeadingLevel.HEADING_1, shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' }, spacing: { before: 360, after: 120 }, indent: { left: 120 } });
}
function h2(text) {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 26, color: C.white })], heading: HeadingLevel.HEADING_2, shading: { fill: C.blue, type: ShadingType.CLEAR, color: 'auto' }, spacing: { before: 240, after: 80 }, indent: { left: 120 } });
}
function h3(text) {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 22, color: C.blue })], spacing: { before: 200, after: 60 } });
}
function p(text, indent = 0, spacing = 80) {
  return new Paragraph({ children: [new TextRun({ text, size: 20, color: C.dark })], spacing: { before: spacing, after: spacing }, indent: { left: indent } });
}
function pb() { return new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }); }
function sp() { return new Paragraph({ children: [new TextRun({ text: '', size: 18 })], spacing: { before: 80, after: 40 } }); }

function noteBox(label, text, bg = C.amber) {
  return new Table({
    rows: [new TableRow({ children: [tc(`${label}   ${text}`, bg, false, C.dark, 18)] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80 },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function buildDoc() {
  const children = [];

  // ── COVER ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [tr('DETECTIVE QUERY', { bold: true, size: 52, color: C.navy })], alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 180 } }),
    new Paragraph({ children: [tr('DATABASE NORMALIZATION', { bold: true, size: 40, color: C.blue })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 180 } }),
    new Paragraph({ children: [tr('1NF  →  2NF  →  3NF', { size: 28, italic: true, color: '555555' })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 600 } }),
    fullTable(['Property', 'Value'], [
      ['System Name', 'Detective Query'],
      ['Document Type', 'Database Normalization'],
      ['Tables Demonstrated', 'users, student_enrollments, attempts'],
      ['Normal Forms Covered', '1NF → 2NF → 3NF'],
      ['Date Prepared', 'October 29, 2026'],
    ]),
    sp(), sp(),
  );

  // ── INTRO ──────────────────────────────────────────────────────────────────
  children.push(
    h1('What is Normalization?'),
    p('Normalization is the process of organizing a relational database to reduce data redundancy and improve data integrity. It applies a series of rules called Normal Forms, where each form builds upon the previous one.'),
    sp(),
    fullTable(['Normal Form', 'Rule Applied'], [
      ['1NF — First Normal Form',  'Every column must contain atomic (indivisible) values. No repeating groups. Each row must be uniquely identifiable by a primary key.'],
      ['2NF — Second Normal Form', 'Must be in 1NF AND every non-key attribute must fully depend on the entire primary key (eliminates partial dependencies).'],
      ['3NF — Third Normal Form',  'Must be in 2NF AND there are no transitive dependencies (no non-key attribute depends on another non-key attribute).'],
    ]),
    sp(),
    p('The three tables selected for demonstration are: users (most complex entity), student_enrollments (3NF output of normalizing users), and attempts (central transactional table).'),
    pb(),
  );

  // ══════════════════════════════════════════════════
  //  TABLE 1: users
  // ══════════════════════════════════════════════════
  children.push(h1('Table 1: users'));

  // UNF
  children.push(h2('Step 0 — Unnormalized Form (UNF)'));
  children.push(p('In the original design, a single flat table mixed personal information, authentication, role, and academic enrollment data all together. This caused significant redundancy.'));
  children.push(sp());
  children.push(h3('Original Flat Table (UNF):'));
  children.push(fullTable(
    ['user_id', 'first_name', 'last_name', 'email', 'role', 'course_code', 'course_name', 'year_level', 'section', 'semester'],
    [
      ['1','Juan','Dela Cruz','juan@gmail.com','Student','BSIT','BS Information Technology','3','IT3A','2025-2026 1st'],
      ['2','Maria','Santos','maria@gmail.com','Teacher','BSIT','BS Information Technology','—','—','2025-2026 1st'],
      ['3','Pedro','Reyes','pedro@gmail.com','Student','BSCS','BS Computer Science','2','CS2B','2025-2026 1st'],
    ]
  ));
  children.push(sp());
  children.push(h3('Problems in UNF:'));
  children.push(fullTable(['#', 'Problem'], [
    ['1', 'course_code, course_name, section, semester are repeated for every user in the same class — massive redundancy.'],
    ['2', 'If a course name changes (e.g., "BSIT" renamed), hundreds of rows must be updated — update anomaly.'],
    ['3', 'A teacher or admin has NULL across many enrollment columns that do not apply to them.'],
    ['4', 'Deleting a student would lose enrollment history — deletion anomaly.'],
  ], [C.red, C.red, C.red, C.red]));

  // 1NF
  children.push(sp(), h2('Step 1 — First Normal Form (1NF)'));
  children.push(noteBox('RULE:', 'Every column must contain atomic (indivisible) values. No repeating groups. Each row must be uniquely identifiable.'));
  children.push(sp());
  children.push(h3('Changes Applied:'));
  children.push(fullTable(['#', 'Change Made'], [
    ['1', 'Replaced the role text column with role_id (FK → roles table) — eliminates storing full role name on every user row.'],
    ['2', 'Ensured all fields are single-valued and atomic.'],
    ['3', 'Assigned user_id as the Primary Key.'],
  ], [C.green, C.green, C.green]));
  children.push(sp());
  children.push(h3('After 1NF — users table:'));
  children.push(fullTable(
    ['user_id (PK)', 'first_name', 'last_name', 'email', 'password_hash', 'role_id (FK)', 'course_code', 'section', 'year_level', 'semester'],
    [
      ['1','Juan','Dela Cruz','juan@gmail.com','hash1','1','BSIT','IT3A','3','2025-2026 1st'],
      ['2','Maria','Santos','maria@gmail.com','hash2','2','—','—','—','—'],
    ]
  ));
  children.push(sp());
  children.push(h3('Separate roles table (created in 1NF):'));
  children.push(fullTable(['role_id (PK)', 'role_name'], [['1','Student'],['2','Teacher'],['3','Admin']]));
  children.push(sp());
  children.push(noteBox('Remaining Issues:', 'course_code determines course_name (transitive). Enrollment data (section, year_level, semester) belongs to the relationship between a user and an academic period — not to the user entity itself.', C.amber));

  // 2NF
  children.push(sp(), h2('Step 2 — Second Normal Form (2NF)'));
  children.push(noteBox('RULE:', 'Must be in 1NF AND every non-key attribute must depend on the entire primary key (eliminate partial dependencies and group dependencies).'));
  children.push(sp());
  children.push(h3('Changes Applied:'));
  children.push(fullTable(['#', 'Change Made'], [
    ['1', 'Removed course_code, course_name, section, year_level, semester from users — they describe enrollment, not the user.'],
    ['2', 'Created separate courses table. enrollment stores only course_id (FK).'],
    ['3', 'Created separate sections table. enrollment stores only section_id (FK).'],
    ['4', 'Created separate semesters table. enrollment stores only semester_id (FK).'],
  ], [C.green, C.green, C.green, C.green]));
  children.push(sp());
  children.push(h3('After 2NF — users table (cleaner):'));
  children.push(fullTable(
    ['user_id (PK)', 'first_name', 'middle_name', 'last_name', 'extension_name', 'gender', 'civil_status', 'birthday', 'email', 'password_hash', 'role_id (FK)'],
    [
      ['1','Juan','—','Dela Cruz','—','Male','Single','2005-03-12','juan@gmail.com','hash1','1'],
      ['2','Maria','—','Santos','—','Female','Single','1990-07-22','maria@gmail.com','hash2','2'],
    ]
  ));

  // 3NF users
  children.push(sp(), h2('Step 3 — Third Normal Form (3NF)'));
  children.push(noteBox('RULE:', 'Must be in 2NF AND no non-key attribute should depend on another non-key attribute (eliminate transitive dependencies).'));
  children.push(sp());
  children.push(h3('Transitive Dependency Check:'));
  children.push(fullTable(['Attribute', 'Depends On', 'Transitive?'], [
    ['first_name, last_name, email, etc.', 'user_id (PK)', '✅  No — directly describes the user'],
    ['password_hash', 'user_id (PK)', '✅  No — credential belongs to this user'],
    ['role_id', 'user_id (PK)', '✅  No — role belongs to this user; role_name is in roles table'],
    ['gender, civil_status, birthday', 'user_id (PK)', '✅  No — personal attributes of this user'],
    ['created_at', 'user_id (PK)', '✅  No — timestamp of account creation'],
  ], [C.green, C.green, C.green, C.green, C.green]));
  children.push(sp());
  children.push(h3('Final 3NF users table:'));
  children.push(fullTable(
    ['user_id (PK)', 'first_name', 'middle_name', 'last_name', 'extension_name', 'gender', 'civil_status', 'birthday', 'email', 'password_hash', 'role_id (FK → roles)', 'created_at'],
    [
      ['1','Juan','—','Dela Cruz','—','Male','Single','2005-03-12','juan@gmail.com','[hashed]','1','2026-08-01 09:00:00'],
      ['2','Maria','—','Santos','—','Female','Single','1990-07-22','maria@gmail.com','[hashed]','2','2026-08-01 10:15:00'],
    ]
  ));
  children.push(sp());
  children.push(noteBox('Result:', 'The users table is in 3NF. Every non-key attribute describes the user and only the user. Enrollment data has been moved to student_enrollments. No redundant or transitive dependencies exist.', C.green));
  children.push(pb());

  // ══════════════════════════════════════════════════
  //  TABLE 2: student_enrollments
  // ══════════════════════════════════════════════════
  children.push(h1('Table 2: student_enrollments'));
  children.push(p('This table is the direct result of normalizing users. Enrollment data was extracted from users because it belongs to the relationship between a user and their academic period — not to the user entity itself.'));

  // UNF
  children.push(sp(), h2('Step 0 — Unnormalized Form (UNF)'));
  children.push(p('Before normalization, enrollment was embedded in the users table alongside personal data.'));
  children.push(sp());
  children.push(fullTable(
    ['user_id', 'name', 'email', 'role', 'course_code', 'course_name', 'section', 'year_level', 'school_year', 'term'],
    [
      ['1','Juan Dela Cruz','juan@gmail.com','Student','BSIT','BS Info Tech','IT3A','3','2025-2026','1st'],
      ['1','Juan Dela Cruz','juan@gmail.com','Student','BSIT','BS Info Tech','IT3B','3','2025-2026','2nd'],
    ]
  ));
  children.push(sp());
  children.push(fullTable(['#', 'Problem'], [
    ['1','If Juan transfers section, his entire user row is duplicated — insertion anomaly.'],
    ['2','course_name depends on course_code, not on user_id — transitive dependency.'],
    ['3','A student enrolled in two semesters needs two near-identical user rows.'],
  ], [C.red, C.red, C.red]));

  // 1NF
  children.push(sp(), h2('Step 1 — First Normal Form (1NF)'));
  children.push(fullTable(['#', 'Change Made'], [
    ['1','Separate each enrollment as an individual row (one row per user per semester per section).'],
    ['2','Split compound semester "2025-2026 1st" into separate school_year and term columns — now atomic.'],
    ['3','Assign enrollment_id as Primary Key.'],
  ], [C.green, C.green, C.green]));
  children.push(sp());
  children.push(fullTable(
    ['enrollment_id (PK)', 'user_id', 'course_code', 'section', 'year_level', 'school_year', 'term'],
    [
      ['1','1','BSIT','IT3A','3','2025-2026','1st'],
      ['2','1','BSIT','IT3B','3','2025-2026','2nd'],
      ['3','3','BSCS','CS2B','2','2025-2026','1st'],
    ]
  ));
  children.push(sp());
  children.push(noteBox('Remaining Issues:', 'course_code → course_name (transitive). school_year + term should be a FK to semesters table, not raw strings.', C.amber));

  // 2NF
  children.push(sp(), h2('Step 2 — Second Normal Form (2NF)'));
  children.push(fullTable(['#', 'Change Made'], [
    ['1','Move course_code + course_name to the courses table. Enrollment stores only course_id (FK).'],
    ['2','Move section to the sections table. Enrollment stores only section_id (FK).'],
    ['3','Move school_year + term to the semesters table. Enrollment stores only semester_id (FK).'],
  ], [C.green, C.green, C.green]));
  children.push(sp());
  children.push(fullTable(
    ['enrollment_id (PK)', 'user_id (FK)', 'course_id (FK)', 'section_id (FK)', 'year_level', 'semester_id (FK)'],
    [['1','1','1','1','3','1'],['2','1','1','2','3','2'],['3','3','2','3','2','1']]
  ));

  // 3NF
  children.push(sp(), h2('Step 3 — Third Normal Form (3NF)'));
  children.push(fullTable(['Attribute', 'Depends On', 'Transitive?'], [
    ['user_id',     'enrollment_id (PK)', '✅  No — identifies who is enrolled'],
    ['course_id',   'enrollment_id (PK)', '✅  No — course data lives in courses table'],
    ['section_id',  'enrollment_id (PK)', '✅  No — section data lives in sections table'],
    ['semester_id', 'enrollment_id (PK)', '✅  No — semester data lives in semesters table'],
    ['year_level',  'enrollment_id (PK)', '✅  No — describes this enrollment context'],
  ], [C.green, C.green, C.green, C.green, C.green]));
  children.push(sp());
  children.push(h3('Final 3NF student_enrollments table:'));
  children.push(fullTable(
    ['enrollment_id (PK)', 'user_id (FK → users)', 'course_id (FK → courses)', 'year_level', 'section_id (FK → sections)', 'semester_id (FK → semesters)', 'created_at'],
    [
      ['1','1','1','3','1','1','2026-08-01'],
      ['2','1','1','3','2','2','2026-01-05'],
      ['3','3','2','2','3','1','2026-08-01'],
    ]
  ));
  children.push(sp());
  children.push(noteBox('Result:', 'student_enrollments is in 3NF. Each attribute depends solely on enrollment_id. All referenced data lives in its own normalized lookup table.', C.green));
  children.push(pb());

  // ══════════════════════════════════════════════════
  //  TABLE 3: attempts
  // ══════════════════════════════════════════════════
  children.push(h1('Table 3: attempts'));
  children.push(p('The attempts table records every SQL query submission made by a student. It is the central transactional table used for evaluation, scoring, and analytics.'));

  // UNF
  children.push(sp(), h2('Step 0 — Unnormalized Form (UNF)'));
  children.push(p('Before normalization, submission logs were stored as a combined flat record including user name, case title, room name, and evaluation results all together.'));
  children.push(sp());
  children.push(fullTable(
    ['attempt_id', 'student_name', 'student_email', 'case_title', 'sql_type', 'room_name', 'room_code', 'submitted_query', 'is_correct', 'score', 'accuracy', 'stars'],
    [
      ['1','Juan Dela Cruz','juan@gmail.com','The Full Roster','DQL','IT3A Room','ABC123','SELECT * FROM ...','1','100','100.00','3'],
      ['2','Juan Dela Cruz','juan@gmail.com','Criminal Scan','DQL','IT3A Room','ABC123','SELECT * FROM ...','0','0','45.00','0'],
    ]
  ));
  children.push(sp());
  children.push(fullTable(['#', 'Problem'], [
    ['1','Student name and email repeat on every attempt row — redundancy.'],
    ['2','Case title and sql_type repeat on every attempt for that case.'],
    ['3','Room name and room_code repeat for every student in the same room.'],
    ['4','Changing a room name requires updating thousands of attempt rows — update anomaly.'],
  ], [C.red, C.red, C.red, C.red]));

  // 1NF
  children.push(sp(), h2('Step 1 — First Normal Form (1NF)'));
  children.push(fullTable(['#', 'Change Made'], [
    ['1','Replace student_name + student_email with user_id (FK → users).'],
    ['2','Replace case_title + sql_type with case_id (FK → cases).'],
    ['3','Replace room_name + room_code with room_id (FK → rooms).'],
    ['4','Each column holds a single atomic value. attempt_id is the Primary Key.'],
  ], [C.green, C.green, C.green, C.green]));
  children.push(sp());
  children.push(fullTable(
    ['attempt_id (PK)', 'user_id', 'case_id', 'room_id', 'submitted_query', 'is_correct', 'score', 'accuracy', 'stars'],
    [
      ['1','1','101','5','SELECT * FROM ...','1','100','100.00','3'],
      ['2','1','102','5','SELECT * FROM ...','0','0','45.00','0'],
    ]
  ));
  children.push(sp());
  children.push(noteBox('Remaining Issues:', 'case_id → case_title, sql_type (these are attributes of a case, not of the attempt). room_id → room_name, room_code (attributes of a room). Need to add session context and attempt numbering.', C.amber));

  // 2NF
  children.push(sp(), h2('Step 2 — Second Normal Form (2NF)'));
  children.push(fullTable(['#', 'Change Made'], [
    ['1','Case data (title, sql_type, base_points) stays in the cases table — case_id FK links to it.'],
    ['2','Room data (room_name, room_code) stays in the rooms table — room_id FK links to it.'],
    ['3','Session context extracted to session_id (FK → game_sessions) for Rank mode context.'],
    ['4','Added attempt_number (sequential count per user per case).'],
  ], [C.green, C.green, C.green, C.green]));
  children.push(sp());
  children.push(fullTable(
    ['attempt_id (PK)', 'user_id (FK)', 'case_id (FK)', 'room_id (FK)', 'session_id (FK)', 'submitted_query', 'is_correct', 'score', 'accuracy', 'stars', 'attempt_number', 'submitted_at'],
    [
      ['1','1','101','5','3','SELECT * FROM persons','1','100','100.00','3','1','2026-09-01 08:15:00'],
      ['2','1','102','5','3','SELECT * FROM evidence','0','0','45.00','0','1','2026-09-01 08:22:00'],
    ]
  ));

  // 3NF
  children.push(sp(), h2('Step 3 — Third Normal Form (3NF)'));
  children.push(h3('Transitive Dependency Check:'));
  children.push(fullTable(['Attribute', 'Depends On', 'Transitive?'], [
    ['user_id',         'attempt_id (PK)', '✅  No — identifies who submitted'],
    ['case_id',         'attempt_id (PK)', '✅  No — identifies what was attempted'],
    ['room_id',         'attempt_id (PK)', '✅  No — context of the attempt'],
    ['session_id',      'attempt_id (PK)', '✅  No — game session context'],
    ['submitted_query', 'attempt_id (PK)', '✅  No — the exact SQL submitted in this attempt'],
    ['is_correct',      'attempt_id (PK)', '✅  No — result of this specific evaluation'],
    ['score',           'attempt_id (PK)', '✅  No — score computed and stored at submission time (snapshot)'],
    ['accuracy',        'attempt_id (PK)', '✅  No — accuracy percentage of this submission'],
    ['stars',           'attempt_id (PK)', '✅  No — star rating awarded for this submission'],
    ['attempt_number',  'attempt_id (PK)', '✅  No — sequential count for this user+case combination'],
    ['submitted_at',    'attempt_id (PK)', '✅  No — timestamp of this submission event'],
  ], Array(11).fill(C.green)));
  children.push(sp());
  children.push(h3('Special Note on score:'));
  children.push(noteBox('Design Decision:', 'score is computed at submission time from cases.base_points x accuracy. It is stored as a snapshot in attempts. This is intentional — even if base_points is later updated for a case, the historical score of past attempts is preserved accurately. This is correct 3NF behavior.', C.lblue));
  children.push(sp());
  children.push(h3('Final 3NF attempts table:'));
  children.push(fullTable(
    ['attempt_id (PK)', 'user_id (FK → users)', 'case_id (FK → cases)', 'room_id (FK → rooms)', 'session_id (FK → game_sessions)', 'submitted_query', 'is_correct', 'score', 'accuracy', 'stars', 'attempt_number', 'submitted_at'],
    [
      ['1','1','101','5','3','SELECT * FROM persons','1','100','100.00','3','1','2026-09-01 08:15:00'],
      ['2','1','102','5','3','SELECT * FROM evidence','0','0','45.00','0','1','2026-09-01 08:22:00'],
    ]
  ));
  children.push(sp());
  children.push(noteBox('Result:', 'attempts is in 3NF. Every attribute describes the specific submission event and only that event. No transitive dependencies exist.', C.green));
  children.push(pb());

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  children.push(h1('Normalization Summary'));
  children.push(fullTable(
    ['Table', 'UNF Issues', 'After 1NF', 'After 2NF', 'After 3NF'],
    [
      ['users',                 'Role text + enrollment data mixed with personal info', 'Atomic values, role_id FK added', 'Enrollment columns removed to separate table', 'No transitive dependencies ✅'],
      ['student_enrollments',   'Embedded in users, composite semester strings, course name with code', 'Separate rows per enrollment, atomic values', 'course_id, section_id, semester_id as FKs', 'All attributes depend only on enrollment_id ✅'],
      ['attempts',              'All fields flat — names, titles, codes repeated on every row', 'All entities replaced with FK IDs', 'Score/accuracy stored as snapshots; session_id added', 'No transitive dependencies ✅'],
    ]
  ));

  children.push(sp(), sp());
  children.push(h1('Key Normalization Decisions'));
  children.push(fullTable(
    ['Decision', 'Explanation'],
    [
      ['Why course_name was NOT kept in student_enrollments', 'In UNF, course_code and course_name co-existed in the users/enrollment row. Since course_name depends on course_code (not on the enrollment), this is a transitive dependency. Both are moved to the courses table; enrollment only stores course_id.'],
      ['Why score is stored in attempts instead of being recalculated', 'score is computed at submission time from cases.base_points × accuracy. Storing it as a snapshot in attempts is intentional — even if base_points is updated for a case, historical scores of past attempts are preserved accurately.'],
      ['Why allowed_student_numbers is a separate table (not in users)', 'The pre-approved student number list belongs to an admin process, not to the user entity. A student number may exist in allowed_student_numbers without a corresponding users row (before registration). This correctly models the registration flow in 3NF.'],
      ['Why roles is a separate table (not an ENUM on users)', 'Storing role as role_id (FK → roles) ensures role descriptions and metadata can be extended without altering the users table. It also allows referential integrity enforcement at the database level.'],
    ]
  ));

  children.push(sp(), sp());
  children.push(new Paragraph({
    children: [tr('End of Normalization Document — Detective Query System', { size: 18, italic: true, color: '888888' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
  }));
  children.push(new Paragraph({
    children: [tr('Tables demonstrated: users, student_enrollments, attempts  |  Normal Forms: 1NF → 2NF → 3NF', { size: 18, italic: true, color: '888888' })],
    alignment: AlignmentType.CENTER,
  }));

  // ── BUILD ──────────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 20, color: C.dark } } } },
    sections: [{
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1), right: convertInchesToTwip(0.75) },
        },
      },
      children,
    }],
  });

  const outPath = path.join('c:\\Users\\PC\\Documents\\4th Year Project', 'NORMALIZATION.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('✅ DOCX saved to:', outPath);
  console.log('   File size:', (buffer.length / 1024).toFixed(1), 'KB');
}

buildDoc().catch(err => { console.error('❌ Error:', err); process.exit(1); });

