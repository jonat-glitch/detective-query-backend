/**
 * generate_data_dictionary_docx.js
 * Generates a properly formatted DOCX Data Dictionary for Detective Query.
 * Run: node scripts/generate_data_dictionary_docx.js
 * Output: c:\Users\PC\Documents\4th Year Project\DATA_DICTIONARY.docx
 */

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType, convertInchesToTwip, PageBreak,
  Header, Footer, PageNumber, NumberFormat
} = require('docx');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  headerBg:    '1B3A5C',  // Dark navy — table header background
  headerText:  'FFFFFF',  // White text on header
  rowAlt:      'EBF2FA',  // Light blue alternate row
  rowNorm:     'FFFFFF',  // White normal row
  sectionBg:   '2E5C99',  // Medium blue — section heading bar
  accentGold:  'C9A84C',  // Gold accent
  borderColor: 'AEC6E0',  // Light steel blue border
  pkColor:     'D4EDDA',  // Light green — PK rows
  fkColor:     'FFF3CD',  // Light amber — FK rows
  gray:        'F2F2F2',  // Light gray
  textDark:    '1A1A2E',  // Near-black body text
  subHeadBg:   'D6E4F7',  // Light blue — sub-section bar
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Bold text run
// ─────────────────────────────────────────────────────────────────────────────
function bold(text, size = 20, color = COLORS.textDark) {
  return new TextRun({ text: String(text ?? ''), bold: true, size, color });
}

function normal(text, size = 20, color = COLORS.textDark) {
  return new TextRun({ text: String(text ?? ''), size, color });
}

function italic(text, size = 19, color = '555555') {
  return new TextRun({ text: String(text ?? ''), italics: true, size, color });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Styled paragraph
// ─────────────────────────────────────────────────────────────────────────────
function para(runs, spacing = 80, alignment = AlignmentType.LEFT) {
  return new Paragraph({
    children: Array.isArray(runs) ? runs : [runs],
    spacing: { before: spacing, after: spacing },
    alignment,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Cell with background colour and optional bold
// ─────────────────────────────────────────────────────────────────────────────
function cell(text, bgColor = COLORS.rowNorm, isBold = false, textColor = COLORS.textDark, fontSize = 19, colSpan = 1) {
  const run = isBold
    ? new TextRun({ text: String(text ?? '—'), bold: true, size: fontSize, color: textColor })
    : new TextRun({ text: String(text ?? '—'), size: fontSize, color: textColor });

  return new TableCell({
    children: [new Paragraph({
      children: [run],
      spacing: { before: 40, after: 40 },
    })],
    shading: { fill: bgColor, type: ShadingType.CLEAR, color: 'auto' },
    columnSpan: colSpan,
    margins: { top: 60, bottom: 60, left: 120, right: 80 },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor },
      left:   { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor },
      right:  { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Table header row (dark navy bg, white bold text)
// ─────────────────────────────────────────────────────────────────────────────
function headerRow(labels) {
  return new TableRow({
    children: labels.map(label => cell(label, COLORS.headerBg, true, COLORS.headerText, 19)),
    tableHeader: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Data row (alternating bg; highlight PK and FK rows)
// ─────────────────────────────────────────────────────────────────────────────
function dataRow(values, rowIndex, constraints = '') {
  let bg = rowIndex % 2 === 0 ? COLORS.rowNorm : COLORS.rowAlt;
  if (constraints.includes('PK')) bg = COLORS.pkColor;
  else if (constraints.includes('FK')) bg = COLORS.fkColor;

  return new TableRow({
    children: values.map((v, i) => cell(v, bg, false, COLORS.textDark, 18)),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Section heading (colored bar paragraph)
// ─────────────────────────────────────────────────────────────────────────────
function dbHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: COLORS.headerText })],
    heading: HeadingLevel.HEADING_1,
    shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR, color: 'auto' },
    spacing: { before: 300, after: 120 },
    indent: { left: 120 },
  });
}

function tableHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: COLORS.headerText })],
    heading: HeadingLevel.HEADING_2,
    shading: { fill: COLORS.sectionBg, type: ShadingType.CLEAR, color: 'auto' },
    spacing: { before: 240, after: 80 },
    indent: { left: 120 },
  });
}

function subLabel(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20, color: '2E5C99' })],
    spacing: { before: 100, after: 40 },
  });
}

function descPara(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: COLORS.textDark })],
    spacing: { before: 40, after: 100 },
    indent: { left: 120 },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Build a column definition table for one DB table
// ─────────────────────────────────────────────────────────────────────────────
function buildColumnTable(columns) {
  // columns: array of { no, field, type, size, constraints, default: d, description }
  const WIDTHS = [360, 1440, 1080, 600, 1560, 900, 2520]; // twips, total ~8460
  
  const rows = [
    headerRow(['#', 'Field Name', 'Data Type', 'Size', 'Constraints', 'Default', 'Description']),
    ...columns.map((col, i) =>
      dataRow(
        [col.no, col.field, col.type, col.size, col.constraints, col.default ?? '—', col.description],
        i,
        col.constraints
      )
    )
  ];

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: WIDTHS,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Simple 2-column note table (key → value)
// ─────────────────────────────────────────────────────────────────────────────
function buildNoteTable(pairs) {
  return new Table({
    rows: pairs.map(([k, v], i) => new TableRow({
      children: [
        cell(k, COLORS.subHeadBg, true, COLORS.textDark, 18),
        cell(v, i % 2 === 0 ? COLORS.rowNorm : COLORS.rowAlt, false, COLORS.textDark, 18),
      ],
    })),
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE DATA — All 37 tables
// ─────────────────────────────────────────────────────────────────────────────

const TABLES = [

  // ══════════════════════════════════════════════════
  //  GROUP: System DB
  // ══════════════════════════════════════════════════

  {
    group: 'DATABASE: detective_query (System DB)',
    name: 'Table 1 — roles',
    desc: 'Lookup table defining the three system roles. Every user must belong to one role.',
    relationships: 'Referenced by: users.role_id',
    columns: [
      { no:'1', field:'role_id',   type:'INT',     size:'—',  constraints:'PK, NN, AI', default:'—',                  description:'Unique role identifier' },
      { no:'2', field:'role_name', type:'VARCHAR', size:'50', constraints:'NN, UQ',     default:'—',                  description:'Role label (Student, Teacher, Admin)' },
    ],
  },
  {
    name: 'Table 2 — users',
    desc: 'Master user account table. Stores all registered system users (Students, Teachers, Admins).',
    relationships: 'role_id → roles.role_id. Referenced by: student_enrollments, teacher_section_assignments, room_students, game_sessions, attempts, user_case_progress, notifications, refresh_tokens, user_badges, user_avatars, user_streaks, account_change_requests',
    columns: [
      { no:'1',  field:'user_id',        type:'INT',      size:'—',   constraints:'PK, NN, AI',            default:'—',                  description:'Unique user identifier' },
      { no:'2',  field:'first_name',     type:'VARCHAR',  size:'100', constraints:'NN',                    default:'—',                  description:"User's first name" },
      { no:'3',  field:'middle_name',    type:'VARCHAR',  size:'100', constraints:'NULL',                  default:'NULL',               description:"User's middle name" },
      { no:'4',  field:'last_name',      type:'VARCHAR',  size:'100', constraints:'NN',                    default:'—',                  description:"User's last name" },
      { no:'5',  field:'extension_name', type:'VARCHAR',  size:'20',  constraints:'NULL',                  default:'NULL',               description:'Name suffix (Jr., Sr., III)' },
      { no:'6',  field:'gender',         type:'ENUM',     size:'—',   constraints:'NULL',                  default:'NULL',               description:'Male / Female / Other / Prefer not to say' },
      { no:'7',  field:'civil_status',   type:'ENUM',     size:'—',   constraints:'NULL',                  default:'NULL',               description:'Single / Married / Widowed / Separated' },
      { no:'8',  field:'birthday',       type:'DATE',     size:'—',   constraints:'NULL',                  default:'NULL',               description:'Date of birth' },
      { no:'9',  field:'email',          type:'VARCHAR',  size:'191', constraints:'NN, UQ',                default:'—',                  description:'Gmail address used for login' },
      { no:'10', field:'password_hash',  type:'VARCHAR',  size:'255', constraints:'NN',                    default:'—',                  description:'Bcrypt-hashed password' },
      { no:'11', field:'role_id',        type:'INT',      size:'—',   constraints:'FK → roles.role_id, NN',default:'—',                 description:"User's system role (1=Student, 2=Teacher, 3=Admin)" },
      { no:'12', field:'student_id',     type:'VARCHAR',  size:'100', constraints:'NULL',                  default:'NULL',               description:'Legacy student ID field' },
      { no:'13', field:'created_at',     type:'DATETIME', size:'—',   constraints:'NN, DEF',               default:'CURRENT_TIMESTAMP',  description:'Account creation timestamp' },
    ],
  },
  {
    name: 'Table 3 — registration_requests',
    desc: 'Staging table for self-registered users awaiting admin approval. Students use this pathway alongside class code + student number + email OTP verification.',
    relationships: 'Stand-alone staging table. On admin approval, a new row is created in users.',
    columns: [
      { no:'1',  field:'request_id',     type:'INT',      size:'—',   constraints:'PK, NN, AI',  default:'—',                 description:'Unique request identifier' },
      { no:'2',  field:'first_name',     type:'VARCHAR',  size:'100', constraints:'NN',           default:'—',                 description:"Applicant's first name" },
      { no:'3',  field:'middle_name',    type:'VARCHAR',  size:'100', constraints:'NULL',         default:'NULL',              description:"Applicant's middle name" },
      { no:'4',  field:'last_name',      type:'VARCHAR',  size:'100', constraints:'NN',           default:'—',                 description:"Applicant's last name" },
      { no:'5',  field:'extension_name', type:'VARCHAR',  size:'20',  constraints:'NULL',         default:'NULL',              description:'Name suffix' },
      { no:'6',  field:'gender',         type:'ENUM',     size:'—',   constraints:'NULL',         default:'NULL',              description:'Male / Female / Other / Prefer not to say' },
      { no:'7',  field:'civil_status',   type:'ENUM',     size:'—',   constraints:'NULL',         default:'NULL',              description:'Single / Married / Widowed / Separated' },
      { no:'8',  field:'birthday',       type:'DATE',     size:'—',   constraints:'NULL',         default:'NULL',              description:'Date of birth' },
      { no:'9',  field:'email',          type:'VARCHAR',  size:'191', constraints:'NN',           default:'—',                 description:'Gmail address of applicant' },
      { no:'10', field:'password_hash',  type:'VARCHAR',  size:'255', constraints:'NN',           default:'—',                 description:'Bcrypt-hashed password (pre-set before approval)' },
      { no:'11', field:'role_id',        type:'INT',      size:'—',   constraints:'NN',           default:'1',                 description:'Requested role (1=Student, 2=Teacher)' },
      { no:'12', field:'sex',            type:'VARCHAR',  size:'20',  constraints:'NULL',         default:'NULL',              description:'Legacy sex field' },
      { no:'13', field:'student_id',     type:'VARCHAR',  size:'100', constraints:'NULL',         default:'NULL',              description:'Legacy student ID field' },
      { no:'14', field:'student_number', type:'VARCHAR',  size:'50',  constraints:'NULL',         default:'NULL',              description:'Student number provided during registration' },
      { no:'15', field:'teacher_id',     type:'INT',      size:'—',   constraints:'NULL',         default:'NULL',              description:'Legacy teacher reference field' },
      { no:'16', field:'class_code',     type:'VARCHAR',  size:'20',  constraints:'NULL',         default:'NULL',              description:'Class code used during registration' },
      { no:'17', field:'section_id',     type:'INT',      size:'—',   constraints:'NULL',         default:'NULL',              description:'Section identified from class code' },
      { no:'18', field:'course_id',      type:'INT',      size:'—',   constraints:'NULL',         default:'NULL',              description:'Course identified from class code' },
      { no:'19', field:'year_level',     type:'TINYINT',  size:'—',   constraints:'NULL',         default:'NULL',              description:'Year level (1–4)' },
      { no:'20', field:'semester_id',    type:'INT',      size:'—',   constraints:'NULL',         default:'NULL',              description:'Semester at time of registration' },
      { no:'21', field:'status',         type:'ENUM',     size:'—',   constraints:'NN',           default:"'pending'",         description:'pending / approved / rejected' },
      { no:'22', field:'created_at',     type:'TIMESTAMP',size:'—',   constraints:'DEF',          default:'CURRENT_TIMESTAMP', description:'Request submission timestamp' },
    ],
  },
  {
    name: 'Table 4 — student_invitations',
    desc: 'Tracks CSV-imported student/teacher invitations sent via Brevo email. Contains the invite token that grants access to the token-based account setup flow.',
    relationships: 'imported_by → users.user_id; user_id → users.user_id (set after completion)',
    columns: [
      { no:'1',  field:'invitation_id',   type:'INT UNSIGNED', size:'—',   constraints:'PK, NN, AI', default:'—',                description:'Unique invitation identifier' },
      { no:'2',  field:'email',           type:'VARCHAR',      size:'191', constraints:'NN',          default:'—',                description:"Invitee's email address" },
      { no:'3',  field:'first_name',      type:'VARCHAR',      size:'100', constraints:'NULL',        default:'NULL',             description:'First name from CSV import' },
      { no:'4',  field:'middle_name',     type:'VARCHAR',      size:'100', constraints:'NULL',        default:'NULL',             description:'Middle name from CSV import' },
      { no:'5',  field:'last_name',       type:'VARCHAR',      size:'100', constraints:'NULL',        default:'NULL',             description:'Last name from CSV import' },
      { no:'6',  field:'extension_name',  type:'VARCHAR',      size:'50',  constraints:'NULL',        default:'NULL',             description:'Name suffix from CSV import' },
      { no:'7',  field:'student_number',  type:'VARCHAR',      size:'100', constraints:'NULL',        default:'NULL',             description:'Student number from CSV import' },
      { no:'8',  field:'section_id',      type:'INT UNSIGNED', size:'—',   constraints:'NULL',        default:'NULL',             description:'Pre-assigned section from import' },
      { no:'9',  field:'course_id',       type:'INT UNSIGNED', size:'—',   constraints:'NULL',        default:'NULL',             description:'Pre-assigned course from import' },
      { no:'10', field:'year_level',      type:'TINYINT UNSIGNED', size:'—', constraints:'NULL',      default:'NULL',             description:'Pre-assigned year level' },
      { no:'11', field:'semester_id',     type:'INT UNSIGNED', size:'—',   constraints:'NULL',        default:'NULL',             description:'Semester at time of import' },
      { no:'12', field:'invite_token',    type:'VARCHAR',      size:'128', constraints:'NN',          default:'—',                description:'Unique 7-day crypto token for setup link' },
      { no:'13', field:'token_expires_at',type:'DATETIME',     size:'—',   constraints:'NN',          default:'—',                description:'Token expiration timestamp' },
      { no:'14', field:'status',          type:'ENUM',         size:'—',   constraints:'NN',          default:"'pending'",        description:'pending / completed / expired / cancelled' },
      { no:'15', field:'import_batch_id', type:'VARCHAR',      size:'64',  constraints:'NULL',        default:'NULL',             description:'Batch ID grouping one CSV import session' },
      { no:'16', field:'imported_by',     type:'INT UNSIGNED', size:'—',   constraints:'FK → users.user_id, NULL', default:'NULL', description:'user_id of Admin who uploaded the CSV' },
      { no:'17', field:'invited_at',      type:'DATETIME',     size:'—',   constraints:'DEF',         default:'NOW()',            description:'Date/time invitation was dispatched' },
      { no:'18', field:'completed_at',    type:'DATETIME',     size:'—',   constraints:'NULL',        default:'NULL',             description:'Date/time invitee completed account setup' },
      { no:'19', field:'resent_at',       type:'DATETIME',     size:'—',   constraints:'NULL',        default:'NULL',             description:'Date/time token was regenerated and resent' },
      { no:'20', field:'user_id',         type:'INT UNSIGNED', size:'—',   constraints:'FK → users.user_id, NULL', default:'NULL', description:'user_id created after setup completion' },
    ],
  },
  {
    name: 'Table 5 — otp_verifications',
    desc: 'Stores email OTP codes for student self-registration email verification. Codes expire after 10 minutes.',
    relationships: 'Stand-alone verification table.',
    columns: [
      { no:'1', field:'id',         type:'INT',       size:'—',   constraints:'PK, NN, AI', default:'—',                 description:'Unique OTP record identifier' },
      { no:'2', field:'otp_key',    type:'VARCHAR',   size:'255', constraints:'NN, INDEX',  default:'—',                 description:'Key used to look up the OTP (typically the email)' },
      { no:'3', field:'otp_code',   type:'VARCHAR',   size:'10',  constraints:'NN',          default:'—',                 description:'6-digit one-time verification code' },
      { no:'4', field:'expires_at', type:'BIGINT',    size:'—',   constraints:'NN',          default:'—',                 description:'UNIX timestamp (ms) when the OTP expires' },
      { no:'5', field:'created_at', type:'TIMESTAMP', size:'—',   constraints:'DEF',         default:'CURRENT_TIMESTAMP', description:'When the OTP was generated' },
    ],
  },
  {
    name: 'Table 6 — refresh_tokens',
    desc: 'Persists JWT refresh tokens for each authenticated session. Used by the auth system to issue new access tokens without re-login.',
    relationships: 'user_id → users.user_id ON DELETE CASCADE',
    columns: [
      { no:'1', field:'id',         type:'INT',      size:'—',   constraints:'PK, NN, AI',              default:'—',                 description:'Unique token record identifier' },
      { no:'2', field:'user_id',    type:'INT',      size:'—',   constraints:'FK → users.user_id (CASCADE), NN', default:'—',       description:'Owner of the refresh token' },
      { no:'3', field:'token',      type:'VARCHAR',  size:'512', constraints:'NN, INDEX',               default:'—',                 description:'Signed JWT refresh token string' },
      { no:'4', field:'expires_at', type:'DATETIME', size:'—',   constraints:'NN',                      default:'—',                 description:'Token expiration date/time' },
      { no:'5', field:'created_at', type:'DATETIME', size:'—',   constraints:'DEF',                     default:'CURRENT_TIMESTAMP', description:'Token issuance timestamp' },
    ],
  },
  {
    name: 'Table 7 — semesters',
    desc: 'Academic semester lookup table. Controls which semester is currently active across the system.',
    relationships: 'Referenced by: student_enrollments, teacher_section_assignments, allowed_student_numbers, class_codes',
    columns: [
      { no:'1', field:'semester_id', type:'INT',        size:'—',  constraints:'PK, NN, AI', default:'—',                 description:'Unique semester identifier' },
      { no:'2', field:'school_year', type:'VARCHAR',    size:'20', constraints:'NN',          default:'—',                 description:"Academic year string (e.g., 2025-2026)" },
      { no:'3', field:'term',        type:'ENUM',       size:'—',  constraints:'NN',          default:'—',                 description:'1st / 2nd / Summer' },
      { no:'4', field:'is_active',   type:'TINYINT(1)', size:'—',  constraints:'NN',          default:'0',                 description:'1 = currently active semester' },
      { no:'5', field:'is_archived', type:'TINYINT(1)', size:'—',  constraints:'NN',          default:'0',                 description:'1 = semester has been archived' },
      { no:'6', field:'archived_at', type:'DATETIME',   size:'—',  constraints:'NULL',        default:'NULL',              description:'Timestamp when archived' },
      { no:'7', field:'created_at',  type:'DATETIME',   size:'—',  constraints:'NN, DEF',     default:'CURRENT_TIMESTAMP', description:'Creation timestamp' },
    ],
  },
  {
    name: 'Table 8 — courses',
    desc: 'Academic course lookup table (e.g., BS Information Technology). Normalized out of the users table per 3NF.',
    relationships: 'Referenced by: student_enrollments, teacher_section_assignments, allowed_student_numbers, class_codes, rooms',
    columns: [
      { no:'1', field:'course_id',   type:'INT',        size:'—',   constraints:'PK, NN, AI', default:'—',                 description:'Unique course identifier' },
      { no:'2', field:'course_code', type:'VARCHAR',    size:'20',  constraints:'NN',          default:'—',                 description:'Course abbreviation (e.g., BSIT, BSCS)' },
      { no:'3', field:'course_name', type:'VARCHAR',    size:'100', constraints:'NN',          default:'—',                 description:'Full course name' },
      { no:'4', field:'is_archived', type:'TINYINT(1)', size:'—',   constraints:'NN',          default:'0',                 description:'1 = course has been archived' },
      { no:'5', field:'archived_at', type:'DATETIME',   size:'—',   constraints:'NULL',        default:'NULL',              description:'Timestamp when archived' },
      { no:'6', field:'created_at',  type:'DATETIME',   size:'—',   constraints:'NN, DEF',     default:'CURRENT_TIMESTAMP', description:'Creation timestamp' },
    ],
  },
  {
    name: 'Table 9 — sections',
    desc: 'Academic section lookup table (e.g., IT3A, CS2B). Normalized out of the users table per 3NF.',
    relationships: 'Referenced by: student_enrollments, teacher_section_assignments, allowed_student_numbers, class_codes, rooms',
    columns: [
      { no:'1', field:'section_id',   type:'INT',        size:'—',  constraints:'PK, NN, AI', default:'—',                 description:'Unique section identifier' },
      { no:'2', field:'section_name', type:'VARCHAR',    size:'20', constraints:'NN, UQ',      default:'—',                 description:'Section label (e.g., IT3A)' },
      { no:'3', field:'is_archived',  type:'TINYINT(1)', size:'—',  constraints:'NN',          default:'0',                 description:'1 = section has been archived' },
      { no:'4', field:'archived_at',  type:'DATETIME',   size:'—',  constraints:'NULL',        default:'NULL',              description:'Timestamp when archived' },
      { no:'5', field:'created_at',   type:'DATETIME',   size:'—',  constraints:'NN, DEF',     default:'CURRENT_TIMESTAMP', description:'Creation timestamp' },
    ],
  },
  {
    name: 'Table 10 — student_enrollments',
    desc: 'Bridge table linking students to their course, section, year level, and semester. Enforces one enrollment per student per section per semester.',
    relationships: 'user_id → users.user_id (CASCADE) | course_id → courses.course_id | section_id → sections.section_id | semester_id → semesters.semester_id',
    columns: [
      { no:'1', field:'enrollment_id', type:'INT',      size:'—',  constraints:'PK, NN, AI',               default:'—',                 description:'Unique enrollment record identifier' },
      { no:'2', field:'user_id',       type:'INT',      size:'—',  constraints:'FK → users.user_id (CASCADE), NN', default:'—',         description:"Enrolled student's user ID" },
      { no:'3', field:'course_id',     type:'INT',      size:'—',  constraints:'FK → courses.course_id, NULL', default:'NULL',         description:"Student's enrolled course" },
      { no:'4', field:'year_level',    type:'TINYINT',  size:'—',  constraints:'NULL',                     default:'NULL',              description:'1=1st year, 2=2nd year, 3=3rd year, 4=4th year' },
      { no:'5', field:'section_id',    type:'INT',      size:'—',  constraints:'FK → sections.section_id, NN', default:'—',            description:'Enrolled section' },
      { no:'6', field:'semester_id',   type:'INT',      size:'—',  constraints:'FK → semesters.semester_id, NN', default:'—',          description:'Semester of enrollment' },
      { no:'7', field:'created_at',    type:'DATETIME', size:'—',  constraints:'NN, DEF',                  default:'CURRENT_TIMESTAMP', description:'Enrollment creation timestamp' },
    ],
  },
  {
    name: 'Table 11 — teacher_section_assignments',
    desc: 'Assigns teachers to a specific section+course+semester. Defines which teacher handles which class for analytics and room scoping.',
    relationships: 'teacher_id → users.user_id (CASCADE) | section_id → sections.section_id | course_id → courses.course_id | semester_id → semesters.semester_id',
    columns: [
      { no:'1',  field:'assignment_id', type:'INT',        size:'—',   constraints:'PK, NN, AI',                  default:'—',                 description:'Unique assignment identifier' },
      { no:'2',  field:'teacher_id',    type:'INT',        size:'—',   constraints:'FK → users.user_id (CASCADE), NN', default:'—',            description:"Teacher's user ID" },
      { no:'3',  field:'section_id',    type:'INT',        size:'—',   constraints:'FK → sections.section_id, NN', default:'—',               description:'Assigned section' },
      { no:'4',  field:'course_id',     type:'INT',        size:'—',   constraints:'FK → courses.course_id, NN',  default:'—',                description:'Assigned course' },
      { no:'5',  field:'year_level',    type:'TINYINT',    size:'—',   constraints:'NN',                          default:'—',                 description:'Year level of the section' },
      { no:'6',  field:'semester_id',   type:'INT',        size:'—',   constraints:'FK → semesters.semester_id, NN', default:'—',             description:'Semester of the assignment' },
      { no:'7',  field:'subject_name',  type:'VARCHAR',    size:'100', constraints:'NN',                          default:'—',                 description:'Subject name (e.g., Database Management Systems)' },
      { no:'8',  field:'is_archived',   type:'TINYINT(1)', size:'—',   constraints:'NN',                          default:'0',                 description:'1 = assignment has been archived' },
      { no:'9',  field:'archived_at',   type:'DATETIME',   size:'—',   constraints:'NULL',                        default:'NULL',              description:'Timestamp when archived' },
      { no:'10', field:'created_at',    type:'DATETIME',   size:'—',   constraints:'NN, DEF',                     default:'CURRENT_TIMESTAMP', description:'Assignment creation timestamp' },
    ],
  },
  {
    name: 'Table 12 — allowed_student_numbers',
    desc: 'Admin pre-loads this table before a semester begins. Student self-registration is blocked unless the student\'s number exists here. Acts as a whitelist gate.',
    relationships: 'section_id → sections.section_id (SET NULL) | course_id → courses.course_id (SET NULL) | semester_id → semesters.semester_id (SET NULL)',
    columns: [
      { no:'1',  field:'id',             type:'INT',        size:'—',   constraints:'PK, NN, AI',                    default:'—',                 description:'Unique record identifier' },
      { no:'2',  field:'student_number', type:'VARCHAR',    size:'50',  constraints:'NN, UQ',                        default:'—',                 description:'Pre-approved student identification number' },
      { no:'3',  field:'email_hint',     type:'VARCHAR',    size:'255', constraints:'NULL',                          default:'NULL',              description:'Expected email address (optional hint)' },
      { no:'4',  field:'section_id',     type:'INT',        size:'—',   constraints:'FK → sections.section_id (SET NULL), NULL', default:'NULL', description:'Pre-assigned section' },
      { no:'5',  field:'course_id',      type:'INT',        size:'—',   constraints:'FK → courses.course_id (SET NULL), NULL',  default:'NULL', description:'Pre-assigned course' },
      { no:'6',  field:'year_level',     type:'TINYINT',    size:'—',   constraints:'NULL',                          default:'NULL',              description:'Pre-assigned year level' },
      { no:'7',  field:'semester_id',    type:'INT',        size:'—',   constraints:'FK → semesters.semester_id (SET NULL), NULL', default:'NULL', description:'Semester this number is valid for' },
      { no:'8',  field:'is_used',        type:'TINYINT(1)', size:'—',   constraints:'NN',                            default:'0',                 description:'1 = student number already used for registration' },
      { no:'9',  field:'is_archived',    type:'TINYINT(1)', size:'—',   constraints:'NN',                            default:'0',                 description:'1 = record has been archived' },
      { no:'10', field:'archived_at',    type:'DATETIME',   size:'—',   constraints:'NULL',                          default:'NULL',              description:'Timestamp when archived' },
      { no:'11', field:'created_at',     type:'DATETIME',   size:'—',   constraints:'NN, DEF',                       default:'CURRENT_TIMESTAMP', description:'When the record was uploaded' },
    ],
  },
  {
    name: 'Table 13 — class_codes',
    desc: 'Stores unique class codes generated by teachers or admins. Students enter this code during self-registration to identify their section.',
    relationships: 'section_id → sections.section_id (SET NULL) | semester_id → semesters.semester_id (SET NULL) | created_by → users.user_id (SET NULL)',
    columns: [
      { no:'1',  field:'code_id',     type:'INT',        size:'—',  constraints:'PK, NN, AI',                      default:'—',                 description:'Unique class code record identifier' },
      { no:'2',  field:'code',        type:'VARCHAR',    size:'20', constraints:'NN, UQ',                          default:'—',                 description:'The actual class code string (uppercased)' },
      { no:'3',  field:'section_id',  type:'INT',        size:'—',  constraints:'FK → sections.section_id (SET NULL), NULL', default:'NULL',   description:'Section this code belongs to' },
      { no:'4',  field:'semester_id', type:'INT',        size:'—',  constraints:'FK → semesters.semester_id (SET NULL), NULL', default:'NULL', description:'Semester this code is valid for' },
      { no:'5',  field:'is_active',   type:'TINYINT(1)', size:'—',  constraints:'NN',                              default:'1',                 description:'1 = code is currently active' },
      { no:'6',  field:'expires_at',  type:'DATETIME',   size:'—',  constraints:'NULL',                            default:'NULL',              description:'Optional expiration date/time' },
      { no:'7',  field:'created_by',  type:'INT',        size:'—',  constraints:'FK → users.user_id (SET NULL), NULL', default:'NULL',         description:'user_id of admin/teacher who created it' },
      { no:'8',  field:'is_archived', type:'TINYINT(1)', size:'—',  constraints:'NN',                              default:'0',                 description:'1 = code has been archived' },
      { no:'9',  field:'archived_at', type:'DATETIME',   size:'—',  constraints:'NULL',                            default:'NULL',              description:'Timestamp when archived' },
      { no:'10', field:'created_at',  type:'DATETIME',   size:'—',  constraints:'NN, DEF',                         default:'CURRENT_TIMESTAMP', description:'Code creation timestamp' },
    ],
  },
  {
    name: 'Table 14 — difficulty',
    desc: 'Lookup table defining the three difficulty levels used in cases. Values: 1=Beginner, 2=Intermediate, 3=Advanced.',
    relationships: 'Referenced by: cases.difficulty_id',
    columns: [
      { no:'1', field:'difficulty_id',   type:'INT',     size:'—',  constraints:'PK, NN, AI', default:'—',   description:'Unique difficulty identifier' },
      { no:'2', field:'difficulty_name', type:'VARCHAR', size:'50', constraints:'NN, UQ',      default:'—',   description:'Label: Beginner / Intermediate / Advanced' },
      { no:'3', field:'description',     type:'TEXT',    size:'—',  constraints:'NULL',        default:'NULL',description:'Explanation of this difficulty tier' },
    ],
  },
  {
    name: 'Table 15 — datasets',
    desc: 'Stores schema definitions and sample data for DQL investigation datasets used in Practice mode.',
    relationships: 'Referenced by: cases.dataset_id',
    columns: [
      { no:'1', field:'dataset_id',        type:'INT',      size:'—',   constraints:'PK, NN, AI', default:'—',                 description:'Unique dataset identifier' },
      { no:'2', field:'dataset_name',      type:'VARCHAR',  size:'100', constraints:'NN',          default:'—',                 description:'Dataset display name' },
      { no:'3', field:'schema_definition', type:'TEXT',     size:'—',   constraints:'NULL',        default:'NULL',              description:'SQL CREATE TABLE statements for this dataset' },
      { no:'4', field:'sample_data',       type:'TEXT',     size:'—',   constraints:'NULL',        default:'NULL',              description:'SQL INSERT statements to populate tables' },
      { no:'5', field:'created_at',        type:'DATETIME', size:'—',   constraints:'DEF',         default:'CURRENT_TIMESTAMP', description:'Dataset creation timestamp' },
    ],
  },
  {
    name: 'Table 16 — cases',
    desc: 'Core content table. Stores all 90 SQL investigation cases (45 Practice + 45 Rank) across DDL, DML, and DQL types.',
    relationships: 'difficulty_id → difficulty.difficulty_id | dataset_id → datasets.dataset_id (SET NULL). Referenced by: case_objectives, room_students, game_sessions, attempts, user_case_progress',
    columns: [
      { no:'1',  field:'case_id',            type:'INT',        size:'—',   constraints:'PK, NN, AI',               default:'—',                 description:'Unique case identifier' },
      { no:'2',  field:'title',              type:'VARCHAR',    size:'255', constraints:'NN',                        default:'—',                 description:'Case display title' },
      { no:'3',  field:'description',        type:'TEXT',       size:'—',   constraints:'NULL',                     default:'NULL',              description:'Short case description' },
      { no:'4',  field:'objectives',         type:'TEXT',       size:'—',   constraints:'NULL',                     default:'NULL',              description:'Legacy objectives text field' },
      { no:'5',  field:'difficulty_id',      type:'INT',        size:'—',   constraints:'FK → difficulty.difficulty_id, NULL', default:'NULL',  description:'1=Beginner, 2=Intermediate, 3=Advanced' },
      { no:'6',  field:'sql_type',           type:'ENUM',       size:'—',   constraints:'NN',                       default:'—',                 description:'DDL / DML / DQL' },
      { no:'7',  field:'mode',               type:'ENUM',       size:'—',   constraints:'NN',                       default:'—',                 description:'Practice / Rank' },
      { no:'8',  field:'base_points',        type:'INT',        size:'—',   constraints:'NN',                       default:'100',               description:'Points awarded for correct answer' },
      { no:'9',  field:'setup_sql',          type:'TEXT',       size:'—',   constraints:'NULL',                     default:'NULL',              description:'SQL run before the case to set up sandbox tables' },
      { no:'10', field:'correct_query',      type:'TEXT',       size:'—',   constraints:'NULL',                     default:'NULL',              description:'The correct SQL solution' },
      { no:'11', field:'expected_result_sql',type:'TEXT',       size:'—',   constraints:'NULL',                     default:'NULL',              description:'SQL query used to generate the expected result' },
      { no:'12', field:'dataset_id',         type:'INT',        size:'—',   constraints:'FK → datasets.dataset_id (SET NULL), NULL', default:'NULL', description:'Linked dataset for DQL cases' },
      { no:'13', field:'module_order',       type:'TINYINT',    size:'—',   constraints:'NN',                       default:'3',                 description:'Display order: 1=DDL, 2=DML, 3=DQL' },
      { no:'14', field:'briefing',           type:'TEXT',       size:'—',   constraints:'NULL',                     default:'NULL',              description:'Narrative case briefing shown to student' },
      { no:'15', field:'is_active',          type:'TINYINT(1)', size:'—',   constraints:'NN',                       default:'1',                 description:'1 = case is published and visible' },
      { no:'16', field:'created_at',         type:'DATETIME',   size:'—',   constraints:'DEF',                      default:'CURRENT_TIMESTAMP', description:'Case creation timestamp' },
    ],
  },
  {
    name: 'Table 17 — case_objectives',
    desc: 'Stores the 3 structured learning objectives per case (270 total). Each objective is a step-by-step SQL challenge with its own query and point value.',
    relationships: 'case_id → cases.case_id ON DELETE CASCADE',
    columns: [
      { no:'1', field:'objective_id',   type:'INT',  size:'—',  constraints:'PK, NN, AI',             default:'—',   description:'Unique objective identifier' },
      { no:'2', field:'case_id',        type:'INT',  size:'—',  constraints:'FK → cases.case_id (CASCADE), NN', default:'—', description:'Parent case this objective belongs to' },
      { no:'3', field:'order_num',      type:'INT',  size:'—',  constraints:'NN',                     default:'—',   description:'Objective order within the case (1, 2, or 3)' },
      { no:'4', field:'objective_text', type:'TEXT', size:'—',  constraints:'NN',                     default:'—',   description:'Description of the learning objective' },
      { no:'5', field:'query',          type:'TEXT', size:'—',  constraints:'NULL',                   default:'NULL',description:'The SQL query that achieves this objective' },
      { no:'6', field:'points',         type:'INT',  size:'—',  constraints:'NN',                     default:'33',  description:'Points awarded for completing this objective' },
    ],
  },
  {
    name: 'Table 18 — case_study_materials',
    desc: 'Stores teacher-uploaded PDF reference materials (e.g., SQL cheat sheets, lecture notes) that students can download within a room.',
    relationships: 'room_id → rooms.room_id (CASCADE) | uploader_id → users.user_id (SET NULL)',
    columns: [
      { no:'1', field:'material_id',  type:'INT',      size:'—',   constraints:'PK, NN, AI',             default:'—',                 description:'Unique material identifier' },
      { no:'2', field:'room_id',      type:'INT',      size:'—',   constraints:'FK → rooms.room_id (CASCADE), NN', default:'—',      description:'Room this material is uploaded to' },
      { no:'3', field:'uploader_id',  type:'INT',      size:'—',   constraints:'FK → users.user_id (SET NULL), NULL', default:'NULL', description:'Teacher who uploaded the material' },
      { no:'4', field:'file_name',    type:'VARCHAR',  size:'255', constraints:'NN',                     default:'—',                 description:'Original filename of the uploaded PDF' },
      { no:'5', field:'mime_type',    type:'VARCHAR',  size:'100', constraints:'NULL',                   default:'NULL',              description:'MIME type (e.g., application/pdf)' },
      { no:'6', field:'file_data',    type:'LONGBLOB', size:'—',   constraints:'NULL',                   default:'NULL',              description:'Binary content of the uploaded file' },
      { no:'7', field:'uploaded_at',  type:'DATETIME', size:'—',   constraints:'DEF',                    default:'CURRENT_TIMESTAMP', description:'Upload timestamp' },
    ],
  },
  {
    name: 'Table 19 — case_notes',
    desc: 'Stores student-written notes attached to individual cases. Allows students to annotate their investigation progress.',
    relationships: 'user_id → users.user_id (CASCADE) | case_id → cases.case_id (CASCADE)',
    columns: [
      { no:'1', field:'note_id',   type:'INT',      size:'—',  constraints:'PK, NN, AI',               default:'—',                 description:'Unique note identifier' },
      { no:'2', field:'user_id',   type:'INT',      size:'—',  constraints:'FK → users.user_id (CASCADE), NN', default:'—',         description:'Student who wrote the note' },
      { no:'3', field:'case_id',   type:'INT',      size:'—',  constraints:'FK → cases.case_id (CASCADE), NN', default:'—',         description:'Case the note is attached to' },
      { no:'4', field:'note_text', type:'TEXT',     size:'—',  constraints:'NULL',                     default:'NULL',              description:"Student's written note content" },
      { no:'5', field:'created_at',type:'DATETIME', size:'—',  constraints:'DEF',                      default:'CURRENT_TIMESTAMP', description:'Note creation timestamp' },
      { no:'6', field:'updated_at',type:'DATETIME', size:'—',  constraints:'NULL',                     default:'NULL',              description:'Last edit timestamp' },
    ],
  },
  {
    name: 'Table 20 — rooms',
    desc: 'Classroom containers created by teachers. Each room has a unique code, is linked to a section and semester, and runs a specific SQL type (DDL/DML/DQL) in Rank mode.',
    relationships: 'teacher_id → users.user_id | section_id → sections.section_id (SET NULL) | semester_id → semesters.semester_id (SET NULL) | course_id → courses.course_id (SET NULL). Referenced by: room_students, game_sessions, case_study_materials',
    columns: [
      { no:'1',  field:'room_id',     type:'INT',        size:'—',   constraints:'PK, NN, AI',                    default:'—',                 description:'Unique room identifier' },
      { no:'2',  field:'teacher_id',  type:'INT',        size:'—',   constraints:'FK → users.user_id, NN',        default:'—',                 description:'Teacher who created the room' },
      { no:'3',  field:'room_name',   type:'VARCHAR',    size:'255', constraints:'NN',                            default:'—',                 description:'Display name of the room' },
      { no:'4',  field:'room_code',   type:'VARCHAR',    size:'20',  constraints:'NN, UQ',                        default:'—',                 description:'Unique join code (3–10 alphanumeric chars)' },
      { no:'5',  field:'sql_type',    type:'ENUM',       size:'—',   constraints:'NN',                            default:"'DQL'",             description:'DDL / DML / DQL — type of cases in this room' },
      { no:'6',  field:'section_id',  type:'INT',        size:'—',   constraints:'FK → sections.section_id (SET NULL), NULL', default:'NULL', description:'Section this room is linked to' },
      { no:'7',  field:'semester_id', type:'INT',        size:'—',   constraints:'FK → semesters.semester_id (SET NULL), NULL', default:'NULL', description:'Semester this room operates in' },
      { no:'8',  field:'course_id',   type:'INT',        size:'—',   constraints:'FK → courses.course_id (SET NULL), NULL',  default:'NULL',  description:'Course this room is for' },
      { no:'9',  field:'year_level',  type:'TINYINT',    size:'—',   constraints:'NULL',                          default:'NULL',              description:'Year level of students in this room' },
      { no:'10', field:'is_archived', type:'TINYINT(1)', size:'—',   constraints:'NN',                            default:'0',                 description:'1 = room has been archived' },
      { no:'11', field:'archived_at', type:'DATETIME',   size:'—',   constraints:'NULL',                          default:'NULL',              description:'Timestamp when room was archived' },
      { no:'12', field:'created_at',  type:'DATETIME',   size:'—',   constraints:'DEF',                           default:'CURRENT_TIMESTAMP', description:'Room creation timestamp' },
    ],
  },
  {
    name: 'Table 21 — room_students',
    desc: 'Bridge table enrolling students into rooms. Tracks join status (Pending / Approved / Rejected) and which case the student is currently working on.',
    relationships: 'room_id → rooms.room_id (CASCADE) | student_id → users.user_id (CASCADE) | current_case_id → cases.case_id (SET NULL)',
    columns: [
      { no:'1', field:'id',              type:'INT',      size:'—',  constraints:'PK, NN, AI',                       default:'—',                 description:'Unique record identifier' },
      { no:'2', field:'room_id',         type:'INT',      size:'—',  constraints:'FK → rooms.room_id (CASCADE), NN', default:'—',                 description:'Room the student is joining' },
      { no:'3', field:'student_id',      type:'INT',      size:'—',  constraints:'FK → users.user_id (CASCADE), NN', default:'—',                 description:"Student's user ID" },
      { no:'4', field:'status',          type:'ENUM',     size:'—',  constraints:'NN',                               default:"'Pending'",         description:'Pending / Approved / Rejected' },
      { no:'5', field:'current_case_id', type:'INT',      size:'—',  constraints:'FK → cases.case_id (SET NULL), NULL', default:'NULL',           description:'The case the student is currently working on' },
      { no:'6', field:'requested_at',    type:'DATETIME', size:'—',  constraints:'DEF',                              default:'CURRENT_TIMESTAMP', description:'Timestamp of join request' },
    ],
  },
  {
    name: 'Table 22 — game_sessions',
    desc: 'Represents a teacher-launched Rank session in a room. Tracks session state, timing, case assignments, and activity.',
    relationships: 'room_id → rooms.room_id (CASCADE) | teacher_id → users.user_id (SET NULL). Referenced by: attempts, session_objectives',
    columns: [
      { no:'1',  field:'session_id',     type:'INT',        size:'—',  constraints:'PK, NN, AI',                default:'—',                 description:'Unique session identifier' },
      { no:'2',  field:'room_id',        type:'INT',        size:'—',  constraints:'FK → rooms.room_id (CASCADE), NN', default:'—',           description:'Room this session belongs to' },
      { no:'3',  field:'teacher_id',     type:'INT',        size:'—',  constraints:'FK → users.user_id (SET NULL), NULL', default:'NULL',     description:'Teacher who launched the session' },
      { no:'4',  field:'started_at',     type:'DATETIME',   size:'—',  constraints:'NULL',                      default:'NULL',              description:'Session start timestamp' },
      { no:'5',  field:'ended_at',       type:'DATETIME',   size:'—',  constraints:'NULL',                      default:'NULL',              description:'Session end timestamp' },
      { no:'6',  field:'time_limit',     type:'INT',        size:'—',  constraints:'NULL',                      default:'NULL',              description:'Session duration in minutes' },
      { no:'7',  field:'status',         type:'ENUM',       size:'—',  constraints:'NN',                        default:"'waiting'",         description:'waiting / active / paused / ended' },
      { no:'8',  field:'is_active',      type:'TINYINT(1)', size:'—',  constraints:'NN',                        default:'1',                 description:'1 = session is currently running' },
      { no:'9',  field:'is_paused',      type:'TINYINT(1)', size:'—',  constraints:'NN',                        default:'0',                 description:'1 = session is currently paused' },
      { no:'10', field:'paused_at',      type:'DATETIME',   size:'—',  constraints:'NULL',                      default:'NULL',              description:'Timestamp when session was paused' },
      { no:'11', field:'paused_seconds', type:'INT',        size:'—',  constraints:'NN',                        default:'0',                 description:'Total accumulated pause time in seconds' },
      { no:'12', field:'created_at',     type:'DATETIME',   size:'—',  constraints:'DEF',                       default:'CURRENT_TIMESTAMP', description:'Session creation timestamp' },
    ],
  },
  {
    name: 'Table 23 — attempts',
    desc: 'Records every SQL query submission made by a student during a session or practice. Central table for evaluation scoring and analytics.',
    relationships: 'user_id → users.user_id (CASCADE) | room_id → rooms.room_id (SET NULL) | session_id → game_sessions.session_id (SET NULL) | case_id → cases.case_id (SET NULL)',
    columns: [
      { no:'1',  field:'attempt_id',      type:'INT',        size:'—',      constraints:'PK, NN, AI',                       default:'—',                 description:'Unique attempt identifier' },
      { no:'2',  field:'user_id',         type:'INT',        size:'—',      constraints:'FK → users.user_id (CASCADE), NN', default:'—',                 description:'Student who submitted the query' },
      { no:'3',  field:'room_id',         type:'INT',        size:'—',      constraints:'FK → rooms.room_id (SET NULL), NULL', default:'NULL',           description:'Room context (NULL for Practice mode)' },
      { no:'4',  field:'session_id',      type:'INT',        size:'—',      constraints:'FK → game_sessions.session_id (SET NULL), NULL', default:'NULL', description:'Session context (NULL for Practice mode)' },
      { no:'5',  field:'case_id',         type:'INT',        size:'—',      constraints:'FK → cases.case_id (SET NULL), NULL', default:'NULL',           description:'Case being attempted' },
      { no:'6',  field:'submitted_query', type:'TEXT',       size:'—',      constraints:'NULL',                             default:'NULL',              description:'The raw SQL query the student submitted' },
      { no:'7',  field:'is_correct',      type:'TINYINT(1)', size:'—',      constraints:'NN',                               default:'0',                 description:'1 = query was evaluated as correct' },
      { no:'8',  field:'score',           type:'INT',        size:'—',      constraints:'NULL',                             default:'NULL',              description:'Points awarded for this attempt' },
      { no:'9',  field:'accuracy',        type:'DECIMAL',    size:'(5,2)',   constraints:'NULL',                             default:'NULL',              description:'Percentage match against expected result' },
      { no:'10', field:'stars',           type:'TINYINT',    size:'—',      constraints:'NULL',                             default:'NULL',              description:'Star rating awarded (0–3 stars)' },
      { no:'11', field:'attempt_number',  type:'INT',        size:'—',      constraints:'NN',                               default:'1',                 description:'Sequential attempt count for this case' },
      { no:'12', field:'submitted_at',    type:'DATETIME',   size:'—',      constraints:'DEF',                              default:'CURRENT_TIMESTAMP', description:'Submission timestamp' },
    ],
  },
  {
    name: 'Table 24 — user_case_progress',
    desc: 'Tracks each student\'s completion status per case in Practice mode. Used for the Practice mode progress dashboard.',
    relationships: 'user_id → users.user_id (CASCADE) | case_id → cases.case_id (SET NULL)',
    columns: [
      { no:'1', field:'progress_id',  type:'INT',        size:'—',  constraints:'PK, NN, AI',               default:'—',                 description:'Unique progress record identifier' },
      { no:'2', field:'user_id',      type:'INT',        size:'—',  constraints:'FK → users.user_id (CASCADE), NN', default:'—',         description:"Student's user ID" },
      { no:'3', field:'case_id',      type:'INT',        size:'—',  constraints:'FK → cases.case_id (SET NULL), NULL', default:'NULL',    description:'The case being tracked' },
      { no:'4', field:'status',       type:'ENUM',       size:'—',  constraints:'NN',                       default:"'not_started'",     description:'not_started / in_progress / completed' },
      { no:'5', field:'score',        type:'INT',        size:'—',  constraints:'NULL',                     default:'NULL',              description:'Best score achieved on this case' },
      { no:'6', field:'stars',        type:'TINYINT',    size:'—',  constraints:'NULL',                     default:'NULL',              description:'Star rating (0–3) based on accuracy' },
      { no:'7', field:'completed_at', type:'DATETIME',   size:'—',  constraints:'NULL',                     default:'NULL',              description:'Timestamp of first correct submission' },
      { no:'8', field:'updated_at',   type:'DATETIME',   size:'—',  constraints:'DEF',                      default:'CURRENT_TIMESTAMP', description:'Last update timestamp' },
    ],
  },
  {
    name: 'Table 25 — session_objectives',
    desc: 'Tracks which case objectives were completed by a student within a specific session or practice run.',
    relationships: 'user_id → users.user_id',
    columns: [
      { no:'1', field:'id',         type:'INT',        size:'—',  constraints:'PK, NN, AI', default:'—',                 description:'Unique record identifier' },
      { no:'2', field:'user_id',    type:'INT',        size:'—',  constraints:'FK → users.user_id, NN', default:'—',     description:"Student's user ID" },
      { no:'3', field:'session_id', type:'INT',        size:'—',  constraints:'NULL',        default:'NULL',              description:'Game session ID (NULL for Practice mode)' },
      { no:'4', field:'case_id',    type:'INT',        size:'—',  constraints:'NULL',        default:'NULL',              description:'Case this objective belongs to' },
      { no:'5', field:'objective',  type:'TEXT',       size:'—',  constraints:'NULL',        default:'NULL',              description:'Objective text snapshot' },
      { no:'6', field:'is_met',     type:'TINYINT(1)', size:'—',  constraints:'NN',          default:'0',                 description:'1 = student has met this objective' },
      { no:'7', field:'created_at', type:'DATETIME',   size:'—',  constraints:'NN, DEF',     default:'CURRENT_TIMESTAMP', description:'Record creation timestamp' },
    ],
  },
  {
    name: 'Table 26 — notifications',
    desc: 'In-system notification messages sent to users (e.g., room announcements, approval notices, broadcast messages from teachers).',
    relationships: 'user_id → users.user_id (CASCADE) | sender_id → users.user_id (SET NULL)',
    columns: [
      { no:'1', field:'notification_id', type:'INT',        size:'—',  constraints:'PK, NN, AI',                  default:'—',                 description:'Unique notification identifier' },
      { no:'2', field:'user_id',         type:'INT',        size:'—',  constraints:'FK → users.user_id (CASCADE), NN', default:'—',           description:'Recipient user ID' },
      { no:'3', field:'sender_id',       type:'INT',        size:'—',  constraints:'FK → users.user_id (SET NULL), NULL', default:'NULL',     description:"Sender's user ID (NULL if system-generated)" },
      { no:'4', field:'message',         type:'TEXT',       size:'—',  constraints:'NN',                          default:'—',                 description:'Notification message content' },
      { no:'5', field:'is_read',         type:'TINYINT(1)', size:'—',  constraints:'NN',                          default:'0',                 description:'0 = unread, 1 = read' },
      { no:'6', field:'created_at',      type:'DATETIME',   size:'—',  constraints:'DEF',                         default:'CURRENT_TIMESTAMP', description:'Notification creation timestamp' },
    ],
  },
  {
    name: 'Table 27 — achievements',
    desc: 'Defines all available achievement badges in the gamification system. Each achievement has unlock criteria and a visual icon reference.',
    relationships: 'Referenced by: user_achievements.achievement_id',
    columns: [
      { no:'1', field:'achievement_id',   type:'INT',      size:'—',   constraints:'PK, NN, AI', default:'—',                 description:'Unique achievement identifier' },
      { no:'2', field:'achievement_name', type:'VARCHAR',  size:'100', constraints:'NN, UQ',      default:'—',                 description:'Display name of the achievement' },
      { no:'3', field:'description',      type:'TEXT',     size:'—',   constraints:'NULL',        default:'NULL',              description:'How to unlock this achievement' },
      { no:'4', field:'icon_url',         type:'VARCHAR',  size:'255', constraints:'NULL',        default:'NULL',              description:'URL or path to achievement badge image' },
      { no:'5', field:'criteria_type',    type:'VARCHAR',  size:'50',  constraints:'NULL',        default:'NULL',              description:'Type of criteria (e.g., cases_solved, xp_earned)' },
      { no:'6', field:'criteria_value',   type:'INT',      size:'—',   constraints:'NULL',        default:'NULL',              description:'Threshold value to unlock (e.g., 10 cases)' },
      { no:'7', field:'created_at',       type:'DATETIME', size:'—',   constraints:'DEF',         default:'CURRENT_TIMESTAMP', description:'Achievement creation timestamp' },
    ],
  },
  {
    name: 'Table 28 — user_achievements',
    desc: 'Bridge table recording which students have unlocked which achievements and when.',
    relationships: 'user_id → users.user_id (CASCADE) | achievement_id → achievements.achievement_id (CASCADE). UNIQUE on (user_id, achievement_id)',
    columns: [
      { no:'1', field:'id',             type:'INT',      size:'—',  constraints:'PK, NN, AI',                          default:'—',                 description:'Unique record identifier' },
      { no:'2', field:'user_id',        type:'INT',      size:'—',  constraints:'FK → users.user_id (CASCADE), NN',    default:'—',                 description:'Student who earned the achievement' },
      { no:'3', field:'achievement_id', type:'INT',      size:'—',  constraints:'FK → achievements.achievement_id (CASCADE), NN', default:'—',     description:'Achievement earned' },
      { no:'4', field:'unlocked_at',    type:'DATETIME', size:'—',  constraints:'DEF',                                 default:'CURRENT_TIMESTAMP', description:'Timestamp of achievement unlock' },
    ],
  },
  {
    name: 'Table 29 — user_badges',
    desc: 'Persistently stores badge IDs unlocked per student. Badges are synced server-side on every profile load.',
    relationships: 'user_id → users.user_id (CASCADE, UPDATE CASCADE). PRIMARY KEY on (badge_id, user_id)',
    columns: [
      { no:'1', field:'badge_id',    type:'VARCHAR',  size:'50', constraints:'PK (composite), NN', default:'—',                 description:'Unique badge identifier string (e.g., "first_solve")' },
      { no:'2', field:'user_id',     type:'INT',      size:'—',  constraints:'PK (composite), FK → users.user_id (CASCADE), NN', default:'—', description:'Student who unlocked the badge' },
      { no:'3', field:'unlocked_at', type:'DATETIME', size:'—',  constraints:'NN, DEF',            default:'CURRENT_TIMESTAMP', description:'Timestamp of badge unlock' },
    ],
  },
  {
    name: 'Table 30 — user_avatars',
    desc: 'Stores the profile avatar image uploaded by each user. Binary blob stored directly in the database.',
    relationships: 'user_id is UNIQUE — one avatar per user.',
    columns: [
      { no:'1', field:'id',         type:'INT',      size:'—',   constraints:'PK, NN, AI', default:'—',                 description:'Unique record identifier' },
      { no:'2', field:'user_id',    type:'INT',      size:'—',   constraints:'UQ, NN',      default:'—',                 description:'User this avatar belongs to' },
      { no:'3', field:'file_name',  type:'VARCHAR',  size:'255', constraints:'NULL',        default:'NULL',              description:'Original filename of the uploaded image' },
      { no:'4', field:'mime_type',  type:'VARCHAR',  size:'100', constraints:'NULL',        default:'NULL',              description:'MIME type (e.g., image/png, image/jpeg)' },
      { no:'5', field:'file_data',  type:'LONGBLOB', size:'—',   constraints:'NULL',        default:'NULL',              description:'Binary content of the image file' },
      { no:'6', field:'created_at', type:'DATETIME', size:'—',   constraints:'NN, DEF',     default:'CURRENT_TIMESTAMP', description:'Upload timestamp' },
    ],
  },
  {
    name: 'Table 31 — user_streaks',
    desc: 'Tracks daily login/activity streaks per student for gamification purposes.',
    relationships: 'user_id → users.user_id (CASCADE). UNIQUE on user_id — one streak record per student.',
    columns: [
      { no:'1', field:'streak_id',       type:'INT',      size:'—',  constraints:'PK, NN, AI',             default:'—',                 description:'Unique streak record identifier' },
      { no:'2', field:'user_id',         type:'INT',      size:'—',  constraints:'FK → users.user_id (CASCADE), UQ, NN', default:'—', description:'Student this streak belongs to' },
      { no:'3', field:'current_streak',  type:'INT',      size:'—',  constraints:'NN',                     default:'0',                 description:'Current consecutive active days' },
      { no:'4', field:'longest_streak',  type:'INT',      size:'—',  constraints:'NN',                     default:'0',                 description:'All-time longest streak' },
      { no:'5', field:'last_active_date',type:'DATE',     size:'—',  constraints:'NULL',                   default:'NULL',              description:'Most recent day the student was active' },
      { no:'6', field:'updated_at',      type:'DATETIME', size:'—',  constraints:'DEF',                    default:'CURRENT_TIMESTAMP', description:'Last streak update timestamp' },
    ],
  },
  {
    name: 'Table 32 — account_change_requests',
    desc: 'Stores student-submitted requests to change account details (e.g., section transfer or password change) requiring admin approval.',
    relationships: 'user_id → users.user_id (CASCADE)',
    columns: [
      { no:'1',  field:'request_id',   type:'INT',       size:'—',   constraints:'PK, NN, AI',              default:'—',                 description:'Unique change request identifier' },
      { no:'2',  field:'user_id',      type:'INT',       size:'—',   constraints:'FK → users.user_id (CASCADE), NN', default:'—',       description:'Student submitting the request' },
      { no:'3',  field:'request_type', type:'ENUM',      size:'—',   constraints:'NN',                      default:'—',                 description:'change_section / change_password' },
      { no:'4',  field:'old_value',    type:'VARCHAR',   size:'255', constraints:'NULL',                    default:'NULL',              description:'Current value before change' },
      { no:'5',  field:'new_value',    type:'VARCHAR',   size:'255', constraints:'NN',                      default:'—',                 description:'Requested new value' },
      { no:'6',  field:'reason',       type:'TEXT',      size:'—',   constraints:'NULL',                    default:'NULL',              description:"Student's reason for the change" },
      { no:'7',  field:'status',       type:'ENUM',      size:'—',   constraints:'DEF',                     default:"'pending'",         description:'pending / approved / rejected' },
      { no:'8',  field:'reject_reason',type:'TEXT',      size:'—',   constraints:'NULL',                    default:'NULL',              description:"Admin's rejection reason (if rejected)" },
      { no:'9',  field:'created_at',   type:'TIMESTAMP', size:'—',   constraints:'DEF',                     default:'CURRENT_TIMESTAMP', description:'Request submission timestamp' },
      { no:'10', field:'reviewed_at',  type:'TIMESTAMP', size:'—',   constraints:'NULL',                    default:'NULL',              description:'Timestamp when admin reviewed the request' },
    ],
  },

  // ══════════════════════════════════════════════════
  //  GROUP: Playground DB
  // ══════════════════════════════════════════════════

  {
    group: 'DATABASE: detective_query_playground (Sandbox DB)',
    name: 'Table PG-1 — suspects',
    desc: 'Registry of all persons of interest linked to the syndicate operation. Students query this table to isolate and identify criminal suspects in Rank Mode DQL cases.',
    relationships: 'linked_officer references officers.officer_id (informal)',
    columns: [
      { no:'1', field:'suspect_id',    type:'INT',     size:'—',  constraints:'PK, NN, AI', default:'—',   description:'Unique suspect identifier' },
      { no:'2', field:'name',          type:'VARCHAR', size:'100',constraints:'NN',          default:'—',   description:"Suspect's full name" },
      { no:'3', field:'age',           type:'INT',     size:'—',  constraints:'NULL',        default:'NULL',description:"Suspect's age" },
      { no:'4', field:'status',        type:'VARCHAR', size:'50', constraints:'NULL',        default:'NULL',description:'Custody status (Arrested / At Large / Cleared)' },
      { no:'5', field:'linked_officer',type:'INT',     size:'—',  constraints:'NULL',        default:'NULL',description:'officer_id of the assigned investigating officer' },
    ],
  },
  {
    name: 'Table PG-2 — evidence',
    desc: 'Catalog of all physical and digital evidence items recovered from crime scenes. Linked to locations by location_id.',
    relationships: 'location_id → locations.location_id (SET NULL)',
    columns: [
      { no:'1', field:'evidence_id', type:'INT',     size:'—',  constraints:'PK, NN, AI',                      default:'—',   description:'Unique evidence identifier' },
      { no:'2', field:'item_name',   type:'VARCHAR', size:'100',constraints:'NN',                               default:'—',   description:'Name/description of the evidence item' },
      { no:'3', field:'severity',    type:'INT',     size:'—',  constraints:'NULL',                            default:'NULL',description:'Severity rating (1=Low to 5=Critical)' },
      { no:'4', field:'location_id', type:'INT',     size:'—',  constraints:'FK → locations.location_id (SET NULL), NULL', default:'NULL', description:'Crime scene where evidence was collected' },
    ],
  },
  {
    name: 'Table PG-3 — locations',
    desc: 'Directory of all municipal crime scene locations in the city. Used for JOINs with evidence and suspect data.',
    relationships: 'Referenced by: evidence.location_id',
    columns: [
      { no:'1', field:'location_id', type:'INT',        size:'—',   constraints:'PK, NN, AI', default:'—',   description:'Unique location identifier' },
      { no:'2', field:'place_name',  type:'VARCHAR',    size:'100', constraints:'NN',          default:'—',   description:'Name of the location (e.g., City Hall)' },
      { no:'3', field:'district',    type:'VARCHAR',    size:'100', constraints:'NULL',        default:'NULL',description:'City district or sector the location is in' },
      { no:'4', field:'is_active',   type:'TINYINT(1)', size:'—',  constraints:'NN',          default:'1',   description:'1 = location is an active crime scene perimeter' },
    ],
  },
  {
    name: 'Table PG-4 — officers',
    desc: 'Roster of law enforcement officers available for assignment. Students query to identify officers by rank, badge number, and assignment.',
    relationships: 'Referenced by: suspects.linked_officer (informal)',
    columns: [
      { no:'1', field:'officer_id',   type:'INT',     size:'—',  constraints:'PK, NN, AI', default:'—',   description:'Unique officer identifier' },
      { no:'2', field:'name',         type:'VARCHAR', size:'100',constraints:'NN',          default:'—',   description:"Officer's full name" },
      { no:'3', field:'badge_number', type:'VARCHAR', size:'50', constraints:'UQ',          default:'—',   description:'Unique badge number' },
      { no:'4', field:'rank_level',   type:'VARCHAR', size:'50', constraints:'NULL',        default:'NULL',description:'Officer rank (Detective, Sergeant, Captain)' },
    ],
  },
  {
    name: 'Table PG-5 — witnesses',
    desc: 'Registry of civilian witnesses who reported observations related to the syndicate crimes. Students query to build contact directories.',
    relationships: 'Stand-alone table in Playground DB.',
    columns: [
      { no:'1', field:'witness_id',     type:'INT',     size:'—',  constraints:'PK, NN, AI', default:'—',   description:'Unique witness identifier' },
      { no:'2', field:'full_name',      type:'VARCHAR', size:'100',constraints:'NN',          default:'—',   description:"Witness's full name" },
      { no:'3', field:'contact_number', type:'VARCHAR', size:'20', constraints:'NULL',        default:'NULL',description:"Witness's phone/contact number" },
      { no:'4', field:'statement',      type:'TEXT',    size:'—',  constraints:'NULL',        default:'NULL',description:'Witness statement summary' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FK SUMMARY TABLE
// ─────────────────────────────────────────────────────────────────────────────
const FK_ROWS = [
  ['users','role_id','roles.role_id','RESTRICT'],
  ['refresh_tokens','user_id','users.user_id','CASCADE'],
  ['student_enrollments','user_id','users.user_id','CASCADE'],
  ['student_enrollments','course_id','courses.course_id','RESTRICT'],
  ['student_enrollments','section_id','sections.section_id','RESTRICT'],
  ['student_enrollments','semester_id','semesters.semester_id','RESTRICT'],
  ['teacher_section_assignments','teacher_id','users.user_id','CASCADE'],
  ['teacher_section_assignments','section_id','sections.section_id','RESTRICT'],
  ['teacher_section_assignments','course_id','courses.course_id','RESTRICT'],
  ['teacher_section_assignments','semester_id','semesters.semester_id','RESTRICT'],
  ['allowed_student_numbers','section_id','sections.section_id','SET NULL'],
  ['allowed_student_numbers','course_id','courses.course_id','SET NULL'],
  ['allowed_student_numbers','semester_id','semesters.semester_id','SET NULL'],
  ['class_codes','section_id','sections.section_id','SET NULL'],
  ['class_codes','semester_id','semesters.semester_id','SET NULL'],
  ['class_codes','created_by','users.user_id','SET NULL'],
  ['cases','difficulty_id','difficulty.difficulty_id','RESTRICT'],
  ['cases','dataset_id','datasets.dataset_id','SET NULL'],
  ['case_objectives','case_id','cases.case_id','CASCADE'],
  ['case_study_materials','room_id','rooms.room_id','CASCADE'],
  ['case_study_materials','uploader_id','users.user_id','SET NULL'],
  ['case_notes','user_id','users.user_id','CASCADE'],
  ['case_notes','case_id','cases.case_id','CASCADE'],
  ['rooms','teacher_id','users.user_id','RESTRICT'],
  ['rooms','section_id','sections.section_id','SET NULL'],
  ['rooms','semester_id','semesters.semester_id','SET NULL'],
  ['rooms','course_id','courses.course_id','SET NULL'],
  ['room_students','room_id','rooms.room_id','CASCADE'],
  ['room_students','student_id','users.user_id','CASCADE'],
  ['room_students','current_case_id','cases.case_id','SET NULL'],
  ['game_sessions','room_id','rooms.room_id','CASCADE'],
  ['game_sessions','teacher_id','users.user_id','SET NULL'],
  ['attempts','user_id','users.user_id','CASCADE'],
  ['attempts','room_id','rooms.room_id','SET NULL'],
  ['attempts','session_id','game_sessions.session_id','SET NULL'],
  ['attempts','case_id','cases.case_id','SET NULL'],
  ['user_case_progress','user_id','users.user_id','CASCADE'],
  ['user_case_progress','case_id','cases.case_id','SET NULL'],
  ['notifications','user_id','users.user_id','CASCADE'],
  ['notifications','sender_id','users.user_id','SET NULL'],
  ['user_achievements','user_id','users.user_id','CASCADE'],
  ['user_achievements','achievement_id','achievements.achievement_id','CASCADE'],
  ['user_badges','user_id','users.user_id','CASCADE'],
  ['user_streaks','user_id','users.user_id','CASCADE'],
  ['account_change_requests','user_id','users.user_id','CASCADE'],
  ['evidence (playground)','location_id','locations.location_id','SET NULL'],
];

// ─────────────────────────────────────────────────────────────────────────────
// BUILD DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
async function buildDoc() {
  const children = [];

  // ── COVER ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'DETECTIVE QUERY', bold: true, size: 48, color: COLORS.headerBg })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'DATA DICTIONARY', bold: true, size: 40, color: COLORS.sectionBg })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Gamified SQL Learning Platform', size: 26, italics: true, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
    }),
    buildNoteTable([
      ['System Name', 'Detective Query'],
      ['Document Type', 'Data Dictionary'],
      ['Total Tables', '37 (32 System DB + 5 Playground DB)'],
      ['Databases', 'detective_query  |  detective_query_playground'],
      ['Date Prepared', 'October 29, 2026'],
    ]),
    new Paragraph({
      children: [new TextRun({ text: '', size: 20 })],
      spacing: { before: 600, after: 0 },
    }),
  );

  // ── LEGEND ─────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Constraint Legend', bold: true, size: 24, color: COLORS.sectionBg })],
      spacing: { before: 400, after: 100 },
    }),
    buildNoteTable([
      ['PK', 'Primary Key — uniquely identifies each row'],
      ['FK', 'Foreign Key — references a column in another table'],
      ['NN', 'Not Null — field cannot be empty'],
      ['UQ', 'Unique — no two rows can have the same value'],
      ['AI', 'Auto Increment — value is generated automatically'],
      ['DEF', 'Has a Default Value — auto-assigned if not provided'],
      ['NULL', 'Nullable — field may be left empty'],
    ]),
    new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }),
  );

  // ── TABLES ─────────────────────────────────────────────────────────────────
  let currentGroup = '';

  for (const t of TABLES) {
    // Group heading (DB section)
    if (t.group && t.group !== currentGroup) {
      currentGroup = t.group;
      children.push(dbHeading(currentGroup));
    }

    // Table heading
    children.push(tableHeading(t.name));

    // Description
    children.push(descPara(t.desc));

    // Relationships
    if (t.relationships) {
      children.push(subLabel('Relationships:'));
      children.push(descPara(t.relationships));
    }

    // Column definition table
    children.push(subLabel('Column Definitions:'));
    children.push(buildColumnTable(t.columns));

    // Spacer
    children.push(new Paragraph({ children: [new TextRun({ text: '', size: 18 })], spacing: { before: 120, after: 60 } }));
  }

  // ── FK SUMMARY ─────────────────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));
  children.push(dbHeading('Foreign Key Summary'));
  children.push(new Paragraph({ children: [italic('Green rows = PK fields · Amber rows = FK fields · Total FK relationships: 46')], spacing: { before: 80, after: 120 } }));

  const fkHeader = headerRow(['Table', 'Column', 'References', 'On Delete']);
  const fkDataRows = FK_ROWS.map(([table, col, ref, del], i) =>
    new TableRow({
      children: [
        cell(table, i % 2 === 0 ? COLORS.rowNorm : COLORS.rowAlt, true, COLORS.textDark, 18),
        cell(col,   i % 2 === 0 ? COLORS.rowNorm : COLORS.rowAlt, false, COLORS.textDark, 18),
        cell(ref,   i % 2 === 0 ? COLORS.rowNorm : COLORS.rowAlt, false, COLORS.textDark, 18),
        cell(del,   i % 2 === 0 ? COLORS.rowNorm : COLORS.rowAlt, del === 'CASCADE' ? true : false, del === 'CASCADE' ? 'C0392B' : COLORS.textDark, 18),
      ],
    })
  );

  children.push(new Table({
    rows: [fkHeader, ...fkDataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // ── ASSEMBLE DOC ───────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: COLORS.textDark },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1),
            right:  convertInchesToTwip(0.75),
          },
        },
      },
      children,
    }],
  });

  const outPath = path.join('c:\\Users\\PC\\Documents\\4th Year Project', 'DATA_DICTIONARY.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('✅ DOCX saved to:', outPath);
  console.log('   File size:', (buffer.length / 1024).toFixed(1), 'KB');
}

buildDoc().catch(err => { console.error('❌ Error:', err); process.exit(1); });

