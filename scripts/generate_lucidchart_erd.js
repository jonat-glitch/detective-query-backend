/**
 * generate_lucidchart_erd.js
 * Generates two files for Lucidchart ERD:
 *   1. ERD_Lucidchart.csv  — importable via Lucidchart CSV entity import
 *   2. ERD_TextFormat.txt  — human-readable copy-paste reference
 *
 * Run: node scripts/generate_lucidchart_erd.js
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..'); // 4th Year Project folder

// ─── ALL 37 TABLES ────────────────────────────────────────────────────────────
// Format: { table, domain, columns: [{ name, type, key, note }] }
// key: 'PK' | 'FK' | 'PK,FK' | 'UQ' | 'FK(logical)' | ''

const SCHEMA = [
  // ── DOMAIN A: Identity & Auth ─────────────────────────────────────────────
  {
    table: 'roles', domain: 'A - Identity & Auth',
    columns: [
      { name: 'role_id',   type: 'INT',         key: 'PK',  note: 'Auto Increment' },
      { name: 'role_name', type: 'VARCHAR(50)',  key: 'UQ',  note: 'Student / Teacher / Admin' },
    ]
  },
  {
    table: 'users', domain: 'A - Identity & Auth',
    columns: [
      { name: 'user_id',        type: 'INT',          key: 'PK',  note: 'Auto Increment' },
      { name: 'full_name',      type: 'VARCHAR(100)',  key: '',    note: 'Display cache (legacy)' },
      { name: 'email',          type: 'VARCHAR(150)',  key: 'UQ',  note: '' },
      { name: 'password',       type: 'VARCHAR(255)',  key: '',    note: 'bcrypt hashed' },
      { name: 'avatar',         type: 'VARCHAR(255)',  key: '',    note: 'Legacy URL field' },
      { name: 'role_id',        type: 'INT',          key: 'FK',  note: '→ roles.role_id RESTRICT' },
      { name: 'created_at',     type: 'TIMESTAMP',    key: '',    note: 'DEF=NOW()' },
      { name: 'total_points',   type: 'INT',          key: '',    note: 'XP cache DEF=0' },
      { name: 'current_level',  type: 'INT',          key: '',    note: 'Level cache DEF=1' },
      { name: 'first_name',     type: 'VARCHAR',      key: '',    note: '' },
      { name: 'middle_name',    type: 'VARCHAR',      key: '',    note: '' },
      { name: 'last_name',      type: 'VARCHAR',      key: '',    note: '' },
      { name: 'extension_name', type: 'VARCHAR',      key: '',    note: '' },
      { name: 'sex',            type: 'VARCHAR(10)',  key: '',    note: '[legacy]' },
      { name: 'section',        type: 'VARCHAR(50)',  key: '',    note: '[legacy]' },
      { name: 'student_id',     type: 'VARCHAR(50)',  key: '',    note: '[legacy]' },
      { name: 'teacher_id',     type: 'VARCHAR(50)',  key: '',    note: '[legacy]' },
      { name: 'gender',         type: 'ENUM',         key: '',    note: 'Male/Female/Other/Prefer not to say' },
      { name: 'civil_status',   type: 'ENUM',         key: '',    note: 'Single/Married/Widowed/Separated' },
      { name: 'birthday',       type: 'DATE',         key: '',    note: '' },
    ]
  },
  {
    table: 'registration_requests', domain: 'A - Identity & Auth',
    columns: [
      { name: 'request_id',      type: 'INT',          key: 'PK',  note: 'Auto Increment' },
      { name: 'first_name',      type: 'VARCHAR',      key: '',    note: '' },
      { name: 'middle_name',     type: 'VARCHAR',      key: '',    note: '' },
      { name: 'last_name',       type: 'VARCHAR',      key: '',    note: '' },
      { name: 'extension_name',  type: 'VARCHAR',      key: '',    note: '' },
      { name: 'full_name',       type: 'VARCHAR(200)', key: '',    note: 'Generated' },
      { name: 'email',           type: 'VARCHAR(150)', key: 'UQ',  note: '' },
      { name: 'password_hash',   type: 'TEXT',         key: '',    note: '' },
      { name: 'role_id',         type: 'INT',          key: 'FK(logical)', note: '→ roles.role_id (app-enforced)' },
      { name: 'sex',             type: 'VARCHAR(10)',  key: '',    note: '[legacy]' },
      { name: 'section',         type: 'VARCHAR(20)',  key: '',    note: '[legacy]' },
      { name: 'student_id',      type: 'VARCHAR(50)',  key: '',    note: '[legacy]' },
      { name: 'teacher_id',      type: 'VARCHAR(50)',  key: '',    note: '[legacy]' },
      { name: 'status',          type: 'ENUM',         key: '',    note: 'pending/approved/rejected DEF=pending' },
      { name: 'reject_reason',   type: 'TEXT',         key: '',    note: '' },
      { name: 'requested_at',    type: 'TIMESTAMP',    key: '',    note: 'DEF=NOW()' },
      { name: 'reviewed_at',     type: 'TIMESTAMP',    key: '',    note: '' },
      { name: 'gender',          type: 'ENUM',         key: '',    note: '' },
      { name: 'civil_status',    type: 'ENUM',         key: '',    note: '' },
      { name: 'birthday',        type: 'DATE',         key: '',    note: '' },
      { name: 'class_code',      type: 'VARCHAR(20)',  key: '',    note: '' },
      { name: 'student_number',  type: 'VARCHAR(50)',  key: '',    note: '' },
      { name: 'section_id',      type: 'INT',          key: 'FK(logical)', note: '→ sections.section_id' },
      { name: 'course_id',       type: 'INT',          key: 'FK(logical)', note: '→ courses.course_id' },
      { name: 'year_level',      type: 'TINYINT',      key: '',    note: '' },
      { name: 'semester_id',     type: 'INT',          key: 'FK(logical)', note: '→ semesters.semester_id' },
    ]
  },
  {
    table: 'student_invitations', domain: 'A - Identity & Auth',
    columns: [
      { name: 'invitation_id',    type: 'INT UNSIGNED',  key: 'PK',  note: 'Auto Increment' },
      { name: 'email',            type: 'VARCHAR(191)',  key: '',    note: '' },
      { name: 'first_name',       type: 'VARCHAR',       key: '',    note: '' },
      { name: 'middle_name',      type: 'VARCHAR',       key: '',    note: '' },
      { name: 'last_name',        type: 'VARCHAR',       key: '',    note: '' },
      { name: 'extension_name',   type: 'VARCHAR',       key: '',    note: '' },
      { name: 'student_number',   type: 'VARCHAR(100)',  key: '',    note: '' },
      { name: 'section_id',       type: 'INT UNSIGNED',  key: 'FK(logical)', note: '→ sections' },
      { name: 'course_id',        type: 'INT UNSIGNED',  key: 'FK(logical)', note: '→ courses' },
      { name: 'year_level',       type: 'TINYINT UNSIGNED', key: '', note: '' },
      { name: 'semester_id',      type: 'INT UNSIGNED',  key: 'FK(logical)', note: '→ semesters' },
      { name: 'invite_token',     type: 'VARCHAR(128)',  key: '',    note: 'Indexed' },
      { name: 'token_expires_at', type: 'DATETIME',      key: '',    note: '7-day expiry' },
      { name: 'status',           type: 'ENUM',          key: '',    note: 'pending/completed/expired/cancelled' },
      { name: 'import_batch_id',  type: 'VARCHAR(64)',   key: '',    note: '' },
      { name: 'imported_by',      type: 'INT UNSIGNED',  key: 'FK(logical)', note: '→ users.user_id' },
      { name: 'invited_at',       type: 'DATETIME',      key: '',    note: '' },
      { name: 'completed_at',     type: 'DATETIME',      key: '',    note: '' },
      { name: 'resent_at',        type: 'DATETIME',      key: '',    note: '' },
      { name: 'user_id',          type: 'INT UNSIGNED',  key: 'FK(logical)', note: '→ users (set on completion)' },
      { name: 'role_id',          type: 'TINYINT UNSIGNED', key: 'FK(logical)', note: '→ roles DEF=1' },
    ]
  },
  {
    table: 'otp_verifications', domain: 'A - Identity & Auth',
    columns: [
      { name: 'id',         type: 'INT',          key: 'PK',  note: 'Auto Increment' },
      { name: 'otp_key',    type: 'VARCHAR(255)',  key: '',    note: 'Usually email; indexed' },
      { name: 'otp_code',   type: 'VARCHAR(10)',   key: '',    note: '' },
      { name: 'expires_at', type: 'BIGINT',        key: '',    note: 'Unix ms timestamp; 10-min expiry' },
      { name: 'created_at', type: 'TIMESTAMP',     key: '',    note: 'DEF=NOW()' },
    ]
  },
  {
    table: 'refresh_tokens', domain: 'A - Identity & Auth',
    columns: [
      { name: 'id',         type: 'INT',          key: 'PK',  note: 'Auto Increment' },
      { name: 'user_id',    type: 'INT',          key: 'FK',  note: '→ users.user_id CASCADE' },
      { name: 'token',      type: 'VARCHAR(512)',  key: '',    note: 'Indexed' },
      { name: 'expires_at', type: 'DATETIME',      key: '',    note: '' },
      { name: 'created_at', type: 'DATETIME',      key: '',    note: 'DEF=NOW()' },
    ]
  },
  {
    table: 'account_change_requests', domain: 'A - Identity & Auth',
    columns: [
      { name: 'request_id',    type: 'INT',          key: 'PK',  note: 'Auto Increment' },
      { name: 'user_id',       type: 'INT',          key: 'FK',  note: '→ users.user_id CASCADE' },
      { name: 'request_type',  type: 'VARCHAR(50)',  key: '',    note: 'change_section/change_password/change_email' },
      { name: 'old_value',     type: 'VARCHAR(255)', key: '',    note: '' },
      { name: 'new_value',     type: 'VARCHAR(255)', key: '',    note: '' },
      { name: 'reason',        type: 'TEXT',         key: '',    note: '' },
      { name: 'status',        type: 'ENUM',         key: '',    note: 'pending/approved/rejected DEF=pending' },
      { name: 'reject_reason', type: 'TEXT',         key: '',    note: '' },
      { name: 'created_at',    type: 'TIMESTAMP',    key: '',    note: 'DEF=NOW()' },
      { name: 'reviewed_at',   type: 'TIMESTAMP',    key: '',    note: '' },
    ]
  },
  {
    table: 'user_avatars', domain: 'A - Identity & Auth',
    columns: [
      { name: 'user_id',    type: 'INT',          key: 'PK,FK', note: '→ users.user_id CASCADE | 1:1' },
      { name: 'file_name',  type: 'VARCHAR(255)', key: '',      note: '' },
      { name: 'mime_type',  type: 'VARCHAR(100)', key: '',      note: "DEF='image/png'" },
      { name: 'file_size',  type: 'INT',          key: '',      note: 'DEF=0' },
      { name: 'file_data',  type: 'LONGBLOB',     key: '',      note: 'Binary image data' },
      { name: 'created_at', type: 'TIMESTAMP',    key: '',      note: 'DEF=NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP',    key: '',      note: 'Auto-updated' },
    ]
  },

  // ── DOMAIN B: Academic Structure ──────────────────────────────────────────
  {
    table: 'semesters', domain: 'B - Academic Structure',
    columns: [
      { name: 'semester_id',  type: 'INT',         key: 'PK',  note: 'Auto Increment' },
      { name: 'school_year',  type: 'VARCHAR(20)', key: '',    note: 'e.g. 2025-2026; UNIQUE with term' },
      { name: 'term',         type: 'ENUM',        key: '',    note: '1st / 2nd / Summer; UNIQUE with school_year' },
      { name: 'is_active',    type: 'TINYINT',     key: '',    note: 'DEF=0; only one active at a time' },
      { name: 'created_at',   type: 'DATETIME',    key: '',    note: 'DEF=NOW()' },
      { name: 'is_archived',  type: 'TINYINT',     key: '',    note: 'DEF=0' },
    ]
  },
  {
    table: 'courses', domain: 'B - Academic Structure',
    columns: [
      { name: 'course_id',    type: 'INT',          key: 'PK',  note: 'Auto Increment' },
      { name: 'course_code',  type: 'VARCHAR(20)',  key: '',    note: 'e.g. BSIT; UNIQUE with course_name' },
      { name: 'course_name',  type: 'VARCHAR(100)', key: '',    note: 'e.g. BS Information Technology' },
      { name: 'created_at',   type: 'DATETIME',     key: '',    note: 'DEF=NOW()' },
      { name: 'is_archived',  type: 'TINYINT',      key: '',    note: 'DEF=0' },
    ]
  },
  {
    table: 'sections', domain: 'B - Academic Structure',
    columns: [
      { name: 'section_id',    type: 'INT',         key: 'PK', note: 'Auto Increment' },
      { name: 'section_name',  type: 'VARCHAR(20)', key: 'UQ', note: 'e.g. IT3A' },
      { name: 'created_at',    type: 'DATETIME',    key: '',   note: 'DEF=NOW()' },
      { name: 'is_archived',   type: 'TINYINT',     key: '',   note: 'DEF=0' },
    ]
  },
  {
    table: 'student_enrollments', domain: 'B - Academic Structure',
    columns: [
      { name: 'enrollment_id', type: 'INT',     key: 'PK', note: 'Auto Increment' },
      { name: 'user_id',       type: 'INT',     key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'course_id',     type: 'INT',     key: 'FK', note: '→ courses.course_id RESTRICT; nullable' },
      { name: 'year_level',    type: 'TINYINT', key: '',   note: '1/2/3/4' },
      { name: 'section_id',    type: 'INT',     key: 'FK', note: '→ sections.section_id RESTRICT' },
      { name: 'semester_id',   type: 'INT',     key: 'FK', note: '→ semesters.semester_id RESTRICT' },
      { name: 'created_at',    type: 'DATETIME',key: '',   note: 'DEF=NOW(); UNIQUE(user_id, semester_id)' },
    ]
  },
  {
    table: 'teacher_section_assignments', domain: 'B - Academic Structure',
    columns: [
      { name: 'assignment_id', type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'teacher_id',    type: 'INT',          key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'section_id',    type: 'INT',          key: 'FK', note: '→ sections.section_id RESTRICT' },
      { name: 'course_id',     type: 'INT',          key: 'FK', note: '→ courses.course_id RESTRICT' },
      { name: 'year_level',    type: 'TINYINT',      key: '',   note: '' },
      { name: 'semester_id',   type: 'INT',          key: 'FK', note: '→ semesters.semester_id RESTRICT' },
      { name: 'subject_name',  type: 'VARCHAR(100)', key: '',   note: 'e.g. Database Management Systems' },
      { name: 'created_at',    type: 'DATETIME',     key: '',   note: 'DEF=NOW()' },
      { name: 'is_archived',   type: 'TINYINT',      key: '',   note: 'UNIQUE(teacher_id, section_id, semester_id)' },
    ]
  },
  {
    table: 'allowed_student_numbers', domain: 'B - Academic Structure',
    columns: [
      { name: 'id',             type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'student_number', type: 'VARCHAR(50)',  key: 'UQ', note: '' },
      { name: 'email_hint',     type: 'VARCHAR(255)', key: '',   note: '' },
      { name: 'section_id',     type: 'INT',          key: 'FK', note: '→ sections SET NULL; nullable' },
      { name: 'course_id',      type: 'INT',          key: 'FK', note: '→ courses SET NULL; nullable' },
      { name: 'year_level',     type: 'TINYINT',      key: '',   note: 'nullable' },
      { name: 'semester_id',    type: 'INT',          key: 'FK', note: '→ semesters SET NULL; nullable' },
      { name: 'is_used',        type: 'TINYINT',      key: '',   note: 'DEF=0; set to 1 on approval' },
      { name: 'created_at',     type: 'DATETIME',     key: '',   note: 'DEF=NOW()' },
      { name: 'is_archived',    type: 'TINYINT',      key: '',   note: 'DEF=0' },
    ]
  },
  {
    table: 'class_codes', domain: 'B - Academic Structure',
    columns: [
      { name: 'code_id',     type: 'INT',         key: 'PK', note: 'Auto Increment' },
      { name: 'code',        type: 'VARCHAR(20)', key: 'UQ', note: 'Class join code' },
      { name: 'section_id',  type: 'INT',         key: 'FK', note: '→ sections SET NULL; nullable' },
      { name: 'semester_id', type: 'INT',         key: 'FK', note: '→ semesters SET NULL; nullable' },
      { name: 'is_active',   type: 'TINYINT',     key: '',   note: 'DEF=1' },
      { name: 'expires_at',  type: 'DATETIME',    key: '',   note: 'NULL = no expiry' },
      { name: 'created_by',  type: 'INT',         key: 'FK', note: '→ users SET NULL; nullable' },
      { name: 'created_at',  type: 'DATETIME',    key: '',   note: 'DEF=NOW()' },
      { name: 'is_archived', type: 'TINYINT',     key: '',   note: 'DEF=0' },
    ]
  },

  // ── DOMAIN C: Curriculum & Cases ─────────────────────────────────────────
  {
    table: 'difficulty', domain: 'C - Curriculum & Cases',
    columns: [
      { name: 'difficulty_id',   type: 'INT',           key: 'PK', note: 'Auto Increment' },
      { name: 'difficulty_name', type: 'VARCHAR(50)',   key: '',   note: 'Beginner/Intermediate/Advanced/Expert/Master' },
      { name: 'multiplier',      type: 'DECIMAL(5,2)', key: '',   note: 'DEF=1.00 | Cases use tiers 1–3 only' },
    ]
  },
  {
    table: 'datasets', domain: 'C - Curriculum & Cases',
    columns: [
      { name: 'dataset_id',          type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'dataset_name',        type: 'VARCHAR(150)', key: '',   note: '' },
      { name: 'schema_definition',   type: 'TEXT',         key: '',   note: 'SQL CREATE statements' },
      { name: 'sample_data',         type: 'TEXT',         key: '',   note: 'SQL INSERT statements' },
    ]
  },
  {
    table: 'cases', domain: 'C - Curriculum & Cases',
    columns: [
      { name: 'case_id',              type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'title',                type: 'VARCHAR(200)', key: '',   note: '' },
      { name: 'description',          type: 'TEXT',         key: '',   note: '' },
      { name: 'objectives',           type: 'TEXT',         key: '',   note: '[legacy] narrative text; real data in case_objectives' },
      { name: 'dataset_id',           type: 'INT',          key: 'FK', note: '→ datasets RESTRICT; NULL for DDL/DML cases' },
      { name: 'difficulty_id',        type: 'INT',          key: 'FK', note: '→ difficulty RESTRICT' },
      { name: 'correct_query',        type: 'TEXT',         key: '',   note: '' },
      { name: 'base_points',          type: 'INT',          key: '',   note: 'DEF=100' },
      { name: 'is_active',            type: 'TINYINT',      key: '',   note: 'DEF=1' },
      { name: 'unlock_xp_required',   type: 'INT',          key: '',   note: 'DEF=0' },
      { name: 'correct_suspect_id',   type: 'INT',          key: 'FK(logical)', note: '→ playground.suspects (cross-DB)' },
      { name: 'mode',                 type: 'ENUM',         key: '',   note: 'Practice / Rank DEF=Practice' },
      { name: 'sql_type',             type: 'ENUM',         key: '',   note: 'DQL / DML / DDL DEF=DQL' },
      { name: 'setup_sql',            type: 'TEXT',         key: '',   note: 'Sandbox setup for DDL/DML' },
      { name: 'expected_result_sql',  type: 'TEXT',         key: '',   note: '' },
      { name: 'module_order',         type: 'TINYINT',      key: '',   note: '1=DDL 2=DML 3=DQL' },
    ]
  },
  {
    table: 'case_objectives', domain: 'C - Curriculum & Cases',
    columns: [
      { name: 'objective_id',       type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'case_id',            type: 'INT',          key: 'FK', note: '→ cases.case_id CASCADE' },
      { name: 'objective_order',    type: 'INT',          key: '',   note: '1, 2, or 3' },
      { name: 'objective_text',     type: 'VARCHAR(500)', key: '',   note: '' },
      { name: 'expected_query',     type: 'TEXT',         key: '',   note: '' },
      { name: 'validation_type',    type: 'ENUM',         key: '',   note: 'result / pattern DEF=result' },
      { name: 'required_keyword',   type: 'VARCHAR(100)', key: '',   note: 'For pattern validation e.g. JOIN' },
      { name: 'points',             type: 'INT',          key: '',   note: 'DEF=10' },
    ]
  },
  {
    table: 'case_study_materials', domain: 'C - Curriculum & Cases',
    columns: [
      { name: 'case_id',      type: 'INT',          key: 'PK,FK', note: '→ cases.case_id CASCADE | 1:1 (1 PDF per case)' },
      { name: 'file_name',    type: 'VARCHAR(255)', key: '',      note: '' },
      { name: 'mime_type',    type: 'VARCHAR(100)', key: '',      note: "DEF='application/pdf'" },
      { name: 'file_size',    type: 'INT',          key: '',      note: 'DEF=0' },
      { name: 'file_data',    type: 'LONGBLOB',     key: '',      note: 'Binary PDF data' },
      { name: 'uploaded_by',  type: 'INT',          key: 'FK(logical)', note: '→ users.user_id' },
      { name: 'created_at',   type: 'TIMESTAMP',    key: '',      note: 'DEF=NOW()' },
      { name: 'updated_at',   type: 'TIMESTAMP',    key: '',      note: 'Auto-updated' },
    ]
  },
  {
    table: 'case_notes', domain: 'C - Curriculum & Cases',
    columns: [
      { name: 'note_id',    type: 'INT',      key: 'PK',          note: 'Auto Increment' },
      { name: 'user_id',    type: 'INT',      key: 'FK(logical)', note: '→ users.user_id' },
      { name: 'case_id',    type: 'INT',      key: 'FK(logical)', note: '→ cases.case_id' },
      { name: 'note_text',  type: 'TEXT',     key: '',            note: '' },
      { name: 'created_at', type: 'DATETIME', key: '',            note: 'DEF=NOW()' },
    ]
  },

  // ── DOMAIN D: Rooms & Game Sessions ──────────────────────────────────────
  {
    table: 'rooms', domain: 'D - Rooms & Game Sessions',
    columns: [
      { name: 'room_id',     type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'teacher_id',  type: 'INT',          key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'room_name',   type: 'VARCHAR(100)', key: '',   note: '' },
      { name: 'room_code',   type: 'VARCHAR(10)',  key: 'UQ', note: 'Student join code e.g. DBMS2026' },
      { name: 'created_at',  type: 'TIMESTAMP',    key: '',   note: 'DEF=NOW()' },
      { name: 'is_archived', type: 'TINYINT',      key: '',   note: 'DEF=0' },
      { name: 'archived_at', type: 'DATETIME',     key: '',   note: 'Only rooms table has archived_at' },
      { name: 'section_id',  type: 'INT',          key: 'FK(logical)', note: '→ sections (app-enforced)' },
      { name: 'semester_id', type: 'INT',          key: 'FK(logical)', note: '→ semesters (app-enforced)' },
      { name: 'course_id',   type: 'INT',          key: 'FK(logical)', note: '→ courses (app-enforced)' },
      { name: 'year_level',  type: 'TINYINT',      key: '',   note: '' },
      { name: 'sql_type',    type: 'ENUM',         key: '',   note: 'DDL / DML / DQL DEF=DQL' },
    ]
  },
  {
    table: 'room_students', domain: 'D - Rooms & Game Sessions',
    columns: [
      { name: 'room_students_id', type: 'INT',       key: 'PK', note: 'Auto Increment' },
      { name: 'room_id',          type: 'INT',       key: 'FK', note: '→ rooms.room_id CASCADE' },
      { name: 'student_id',       type: 'INT',       key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'status',           type: 'ENUM',      key: '',   note: 'Pending/Approved/Rejected DEF=Pending' },
      { name: 'requested_at',     type: 'TIMESTAMP', key: '',   note: 'DEF=NOW(); UNIQUE(room_id, student_id)' },
    ]
  },
  {
    table: 'game_sessions', domain: 'D - Rooms & Game Sessions',
    columns: [
      { name: 'session_id',           type: 'INT',      key: 'PK', note: 'Auto Increment' },
      { name: 'room_id',              type: 'INT',      key: 'FK', note: '→ rooms.room_id CASCADE' },
      { name: 'case_id',              type: 'INT',      key: 'FK', note: '→ cases.case_id RESTRICT' },
      { name: 'difficulty_id',        type: 'INT',      key: 'FK', note: '→ difficulty.difficulty_id RESTRICT' },
      { name: 'start_time',           type: 'DATETIME', key: '',   note: '' },
      { name: 'end_time',             type: 'DATETIME', key: '',   note: '' },
      { name: 'is_active',            type: 'TINYINT',  key: '',   note: '[legacy] DEF=1; use status instead' },
      { name: 'personal_time_limit',  type: 'INT',      key: '',   note: 'Minutes per student DEF=10' },
      { name: 'status',               type: 'ENUM',     key: '',   note: 'Scheduled/Active/Ended DEF=Scheduled' },
      { name: 'is_paused',            type: 'TINYINT',  key: '',   note: 'DEF=0' },
      { name: 'paused_at',            type: 'DATETIME', key: '',   note: '' },
      { name: 'paused_seconds',       type: 'INT',      key: '',   note: 'DEF=0; accumulated pause time' },
    ]
  },
  {
    table: 'session_objectives', domain: 'D - Rooms & Game Sessions',
    columns: [
      { name: 'id',              type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'session_id',      type: 'INT',          key: 'FK(logical)', note: '→ game_sessions.session_id' },
      { name: 'user_id',         type: 'INT',          key: 'FK(logical)', note: '→ users.user_id' },
      { name: 'objective_id',    type: 'INT',          key: 'FK(logical)', note: '→ case_objectives.objective_id' },
      { name: 'objective_text',  type: 'VARCHAR(500)', key: '',            note: 'Snapshot at match time' },
      { name: 'points_awarded',  type: 'INT',          key: '',            note: 'DEF=0' },
      { name: 'is_completed',    type: 'TINYINT',      key: '',            note: 'DEF=0' },
      { name: 'completed_at',    type: 'DATETIME',     key: '',            note: 'UNIQUE(session_id, user_id, objective_id)' },
    ]
  },

  // ── DOMAIN E: Submissions & Progress ─────────────────────────────────────
  {
    table: 'attempts', domain: 'E - Submissions & Progress',
    columns: [
      { name: 'attempt_id',        type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'user_id',           type: 'INT',          key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'case_id',           type: 'INT',          key: 'FK', note: '→ cases.case_id CASCADE' },
      { name: 'sql_query',         type: 'TEXT',         key: '',   note: 'Student submitted SQL' },
      { name: 'final_answer',      type: 'VARCHAR(255)', key: '',   note: '' },
      { name: 'is_correct',        type: 'TINYINT',      key: '',   note: '1=correct 0=incorrect' },
      { name: 'score_awarded',     type: 'INT',          key: '',   note: 'Snapshot: base_points × multiplier' },
      { name: 'time_taken',        type: 'INT',          key: '',   note: 'Seconds' },
      { name: 'execution_time_ms', type: 'FLOAT',        key: '',   note: '[reserved] all NULL currently' },
      { name: 'attempt_number',    type: 'INT',          key: '',   note: '[reserved] all NULL currently' },
      { name: 'attempt_date',      type: 'TIMESTAMP',    key: '',   note: 'DEF=NOW()' },
      { name: 'room_id',           type: 'INT',          key: 'FK(logical)', note: '→ rooms; NULL for Practice' },
      { name: 'session_id',        type: 'INT',          key: 'FK(logical)', note: '→ game_sessions; NULL for Practice' },
      { name: 'mode',              type: 'ENUM',         key: '',   note: 'Practice / Rank DEF=Practice' },
    ]
  },
  {
    table: 'user_case_progress', domain: 'E - Submissions & Progress',
    columns: [
      { name: 'progress_id',          type: 'INT',      key: 'PK', note: 'Auto Increment' },
      { name: 'user_id',              type: 'INT',      key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'case_id',              type: 'INT',      key: 'FK', note: '→ cases.case_id CASCADE' },
      { name: 'status',               type: 'ENUM',     key: '',   note: 'Locked/Unlocked/Completed DEF=Locked' },
      { name: 'highest_score',        type: 'INT',      key: '',   note: '' },
      { name: 'is_unlocked',          type: 'TINYINT',  key: '',   note: '[legacy] overlaps with status DEF=0' },
      { name: 'completed_at',         type: 'DATETIME', key: '',   note: '' },
      { name: 'investigation_score',  type: 'INT',      key: '',   note: 'DEF=0; UNIQUE(user_id, case_id)' },
    ]
  },

  // ── DOMAIN F: Gamification ────────────────────────────────────────────────
  {
    table: 'achievements', domain: 'F - Gamification',
    columns: [
      { name: 'achievement_id',    type: 'INT',          key: 'PK', note: 'Auto Increment' },
      { name: 'title',             type: 'VARCHAR(150)', key: '',   note: '' },
      { name: 'description',       type: 'TEXT',         key: '',   note: '' },
      { name: 'points_required',   type: 'INT',          key: '',   note: 'NULL for event-based achievements' },
    ]
  },
  {
    table: 'user_achievements', domain: 'F - Gamification',
    columns: [
      { name: 'user_achievement_id', type: 'INT',      key: 'PK', note: 'Auto Increment' },
      { name: 'user_id',             type: 'INT',      key: 'FK', note: '→ users.user_id CASCADE' },
      { name: 'achievement_id',      type: 'INT',      key: 'FK', note: '→ achievements.achievement_id CASCADE' },
      { name: 'date_earned',         type: 'DATETIME', key: '',   note: 'DEF=NOW(); NOTE: no UNIQUE(user_id,achievement_id)' },
    ]
  },
  {
    table: 'user_badges', domain: 'F - Gamification',
    columns: [
      { name: 'badge_id',     type: 'VARCHAR(50)', key: 'PK',    note: 'Composite PK part 1 e.g. first_case / xp_500' },
      { name: 'user_id',      type: 'INT',         key: 'PK,FK', note: 'Composite PK part 2 → users CASCADE/UPDATE CASCADE' },
      { name: 'unlocked_at',  type: 'DATETIME',    key: '',      note: 'DEF=NOW()' },
    ]
  },
  {
    table: 'user_streaks', domain: 'F - Gamification',
    columns: [
      { name: 'user_id',           type: 'INT',  key: 'PK,FK', note: '→ users.user_id CASCADE | 1:1' },
      { name: 'current_streak',    type: 'INT',  key: '',      note: 'DEF=0; consecutive days solved' },
      { name: 'last_solved_date',  type: 'DATE', key: '',      note: '' },
    ]
  },
  {
    table: 'notifications', domain: 'F - Gamification',
    columns: [
      { name: 'notification_id',    type: 'INT',         key: 'PK', note: 'Auto Increment' },
      { name: 'user_id',            type: 'INT',         key: 'FK', note: '→ users.user_id CASCADE (recipient)' },
      { name: 'sender_id',          type: 'INT',         key: 'FK(logical)', note: '→ users.user_id; NULL for system notifications' },
      { name: 'message',            type: 'TEXT',        key: '',   note: '' },
      { name: 'is_read',            type: 'TINYINT',     key: '',   note: 'DEF=0' },
      { name: 'created_at',         type: 'TIMESTAMP',   key: '',   note: 'DEF=NOW()' },
      { name: 'notification_type',  type: 'VARCHAR(50)', key: '',   note: "DEF='announcement'" },
    ]
  },

  // ── PLAYGROUND DB ─────────────────────────────────────────────────────────
  {
    table: 'suspects', domain: 'Playground DB (detective_query_playground)',
    columns: [
      { name: 'suspect_id', type: 'INT',          key: 'PK', note: 'Auto Increment; 5 rows' },
      { name: 'name',       type: 'VARCHAR(100)', key: '',   note: '' },
      { name: 'age',        type: 'INT',          key: '',   note: '' },
      { name: 'status',     type: 'VARCHAR(50)',  key: '',   note: "DEF='Under Investigation' | Cleared | Arrested" },
    ]
  },
  {
    table: 'evidence', domain: 'Playground DB (detective_query_playground)',
    columns: [
      { name: 'evidence_id',  type: 'INT',          key: 'PK', note: 'Auto Increment; 6 rows' },
      { name: 'item_name',    type: 'VARCHAR(100)', key: '',   note: '' },
      { name: 'severity',     type: 'INT',          key: '',   note: 'DEF=1 | 1=Low 5=Critical' },
      { name: 'location_id',  type: 'INT',          key: 'FK', note: '→ locations.location_id RESTRICT (only enforced FK in playground)' },
      { name: 'collected_at', type: 'DATETIME',     key: '',   note: 'DEF=NOW()' },
    ]
  },
  {
    table: 'locations', domain: 'Playground DB (detective_query_playground)',
    columns: [
      { name: 'location_id', type: 'INT',          key: 'PK', note: 'Auto Increment; 6 rows' },
      { name: 'place_name',  type: 'VARCHAR(100)', key: '',   note: '' },
      { name: 'district',    type: 'VARCHAR(100)', key: '',   note: '' },
      { name: 'is_active',   type: 'TINYINT',      key: '',   note: 'DEF=1' },
    ]
  },
  {
    table: 'officers', domain: 'Playground DB (detective_query_playground)',
    columns: [
      { name: 'officer_id',    type: 'INT',         key: 'PK', note: 'Auto Increment; 3 rows' },
      { name: 'badge_number',  type: 'VARCHAR(20)', key: 'UQ', note: '' },
      { name: 'name',          type: 'VARCHAR(100)',key: '',   note: '' },
      { name: 'rank_level',    type: 'VARCHAR(50)', key: '',   note: 'Detective / Sergeant / Junior Officer' },
    ]
  },
  {
    table: 'witnesses', domain: 'Playground DB (detective_query_playground)',
    columns: [
      { name: 'witness_id',       type: 'INT',         key: 'PK', note: 'Auto Increment; 3 rows' },
      { name: 'full_name',        type: 'VARCHAR(100)',key: '',   note: '' },
      { name: 'contact_number',   type: 'VARCHAR(20)', key: '',   note: '' },
    ]
  },
];

// ─── ALL RELATIONSHIPS ────────────────────────────────────────────────────────
const RELATIONSHIPS = [
  // ENFORCED FKs
  { from:'users',                        to:'roles',              fk:'role_id',         type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'users=optional, roles=mandatory' },
  { from:'refresh_tokens',               to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'account_change_requests',      to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'user_avatars',                 to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'1:1', modality:'user mandatory, avatar optional' },
  { from:'user_streaks',                 to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'1:1', modality:'user mandatory, streak optional' },
  { from:'user_badges',                  to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'user_achievements',            to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'user_achievements',            to:'achievements',       fk:'achievement_id',  type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'notifications',                to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'student_enrollments',          to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'student_enrollments',          to:'courses',            fk:'course_id',       type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'course optional (nullable), enrollment mandatory' },
  { from:'student_enrollments',          to:'sections',           fk:'section_id',      type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'student_enrollments',          to:'semesters',          fk:'semester_id',     type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'teacher_section_assignments',  to:'users',              fk:'teacher_id',      type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'teacher_section_assignments',  to:'sections',           fk:'section_id',      type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'teacher_section_assignments',  to:'courses',            fk:'course_id',       type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'teacher_section_assignments',  to:'semesters',          fk:'semester_id',     type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'allowed_student_numbers',      to:'sections',           fk:'section_id',      type:'enforced', onDelete:'SET NULL',   cardinality:'M:1', modality:'section optional (nullable)' },
  { from:'allowed_student_numbers',      to:'courses',            fk:'course_id',       type:'enforced', onDelete:'SET NULL',   cardinality:'M:1', modality:'course optional (nullable)' },
  { from:'allowed_student_numbers',      to:'semesters',          fk:'semester_id',     type:'enforced', onDelete:'SET NULL',   cardinality:'M:1', modality:'semester optional (nullable)' },
  { from:'class_codes',                  to:'sections',           fk:'section_id',      type:'enforced', onDelete:'SET NULL',   cardinality:'M:1', modality:'section optional (nullable)' },
  { from:'class_codes',                  to:'semesters',          fk:'semester_id',     type:'enforced', onDelete:'SET NULL',   cardinality:'M:1', modality:'semester optional (nullable)' },
  { from:'class_codes',                  to:'users',              fk:'created_by',      type:'enforced', onDelete:'SET NULL',   cardinality:'M:1', modality:'creator optional (nullable)' },
  { from:'cases',                        to:'datasets',           fk:'dataset_id',      type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'dataset optional (nullable for DDL/DML)' },
  { from:'cases',                        to:'difficulty',         fk:'difficulty_id',   type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'case_objectives',              to:'cases',              fk:'case_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory; exactly 3 per case' },
  { from:'case_study_materials',         to:'cases',              fk:'case_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'1:1', modality:'case mandatory, material optional' },
  { from:'rooms',                        to:'users',              fk:'teacher_id',      type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'room_students',                to:'rooms',              fk:'room_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'room_students',                to:'users',              fk:'student_id',      type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'game_sessions',                to:'rooms',              fk:'room_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'game_sessions',                to:'cases',              fk:'case_id',         type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'game_sessions',                to:'difficulty',         fk:'difficulty_id',   type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory' },
  { from:'attempts',                     to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'attempts',                     to:'cases',              fk:'case_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'user_case_progress',           to:'users',              fk:'user_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'user_case_progress',           to:'cases',              fk:'case_id',         type:'enforced', onDelete:'CASCADE',    cardinality:'M:1', modality:'both mandatory' },
  { from:'evidence',                     to:'locations',          fk:'location_id',     type:'enforced', onDelete:'RESTRICT',   cardinality:'M:1', modality:'both mandatory (playground DB)' },
  // LOGICAL FKs
  { from:'registration_requests',  to:'roles',          fk:'role_id',      type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'registration_requests',  to:'sections',       fk:'section_id',   type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'registration_requests',  to:'courses',        fk:'course_id',    type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'registration_requests',  to:'semesters',      fk:'semester_id',  type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'student_invitations',    to:'sections',       fk:'section_id',   type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'student_invitations',    to:'courses',        fk:'course_id',    type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'student_invitations',    to:'semesters',      fk:'semester_id',  type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'student_invitations',    to:'users',          fk:'imported_by',  type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'student_invitations',    to:'users',          fk:'user_id',      type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'set after completion' },
  { from:'cases',                  to:'suspects',       fk:'correct_suspect_id', type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'cross-database reference' },
  { from:'case_study_materials',   to:'users',          fk:'uploaded_by',  type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'case_notes',             to:'users',          fk:'user_id',      type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'case_notes',             to:'cases',          fk:'case_id',      type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'rooms',                  to:'sections',       fk:'section_id',   type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'rooms',                  to:'semesters',      fk:'semester_id',  type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'rooms',                  to:'courses',        fk:'course_id',    type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'attempts',               to:'rooms',          fk:'room_id',      type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'NULL for Practice mode' },
  { from:'attempts',               to:'game_sessions',  fk:'session_id',   type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'NULL for Practice mode' },
  { from:'session_objectives',     to:'game_sessions',  fk:'session_id',   type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'session_objectives',     to:'users',          fk:'user_id',      type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'session_objectives',     to:'case_objectives',fk:'objective_id', type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'app-enforced only' },
  { from:'notifications',          to:'users',          fk:'sender_id',    type:'logical', onDelete:'n/a', cardinality:'M:1', modality:'NULL for system notifications' },
];

// ─── GENERATE LUCIDCHART CSV ──────────────────────────────────────────────────
// Lucidchart ERD CSV format:
// Entity Name, Attribute, Data Type, Key (PK/FK/UQ/blank)
let csvLines = ['Entity Name,Attribute,Data Type,Key'];
SCHEMA.forEach(({ table, columns }) => {
  columns.forEach(col => {
    const keyVal = col.key.includes('PK') ? 'PK' : col.key.includes('FK') ? 'FK' : col.key === 'UQ' ? 'UQ' : '';
    const noteInType = col.note ? `${col.type} [${col.note}]` : col.type;
    csvLines.push(`"${table}","${col.name}","${noteInType}","${keyVal}"`);
  });
});

const csvPath = path.join(OUT_DIR, 'ERD_Lucidchart.csv');
fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
console.log('✅ CSV written:', csvPath);

// ─── GENERATE PLAIN TEXT FORMAT ──────────────────────────────────────────────
let txt = [];
txt.push('='.repeat(80));
txt.push('DETECTIVE QUERY — ERD TEXT FORMAT');
txt.push('For use in Lucidchart, dbdiagram.io, or any manual ERD tool');
txt.push('='.repeat(80));
txt.push('');
txt.push('LEGEND:');
txt.push('  PK     = Primary Key');
txt.push('  FK     = Foreign Key (enforced at DB level)');
txt.push('  FK*    = Foreign Key (logical, app-enforced only — dashed line in ERD)');
txt.push('  PK+FK  = Column is both PK and FK (1:1 relationship)');
txt.push('  UQ     = Unique Constraint');
txt.push('  [leg]  = Legacy column (kept for backward compatibility)');
txt.push('');

let currentDomain = '';
SCHEMA.forEach(({ table, domain, columns }) => {
  if (domain !== currentDomain) {
    currentDomain = domain;
    txt.push('');
    txt.push('─'.repeat(80));
    txt.push(`  DOMAIN: ${domain}`);
    txt.push('─'.repeat(80));
  }
  txt.push('');
  txt.push(`┌─ TABLE: ${table.toUpperCase()} (${columns.length} columns)`);
  txt.push('│');
  columns.forEach((col, i) => {
    const isLast = i === columns.length - 1;
    const prefix = isLast ? '└──' : '├──';
    const keyTag = col.key ? ` [${col.key}]` : '';
    const noteTag = col.note ? `  // ${col.note}` : '';
    txt.push(`│${prefix} ${col.name.padEnd(30)} ${col.type.padEnd(20)}${keyTag}${noteTag}`);
  });
});

txt.push('');
txt.push('');
txt.push('='.repeat(80));
txt.push('ALL RELATIONSHIPS — Draw as connector lines in Lucidchart');
txt.push('='.repeat(80));
txt.push('');
txt.push('━━━ SOLID LINE  = Enforced FK (database-level constraint)');
txt.push('- - DASHED LINE = Logical FK (application-enforced, no DB constraint)');
txt.push('');
txt.push('Format: [FROM table] ──(FK column)──> [TO table]  |  Cardinality  |  On Delete  |  Modality');
txt.push('');

const enforced = RELATIONSHIPS.filter(r => r.type === 'enforced');
const logical  = RELATIONSHIPS.filter(r => r.type === 'logical');

txt.push('── ENFORCED FKs (SOLID LINES) ────────────────────────────────────────────────');
enforced.forEach(r => {
  txt.push(`  ${r.from.padEnd(35)} ──[${r.fk}]──> ${r.to.padEnd(25)} | ${r.cardinality.padEnd(5)} | ON DELETE ${r.onDelete.padEnd(9)} | ${r.modality}`);
});

txt.push('');
txt.push('── LOGICAL FKs (DASHED LINES) ────────────────────────────────────────────────');
logical.forEach(r => {
  txt.push(`  ${r.from.padEnd(35)} --[${r.fk}]--> ${r.to.padEnd(25)} | ${r.cardinality.padEnd(5)} | (app-enforced)    | ${r.modality}`);
});

txt.push('');
txt.push('');
txt.push('='.repeat(80));
txt.push('SPECIAL RELATIONSHIPS SUMMARY');
txt.push('='.repeat(80));
txt.push('');
txt.push('1:1 RELATIONSHIPS (same PK on both sides — show as single line, no crow\'s foot):');
txt.push('  users (user_id) ←1:1→ user_avatars (user_id)');
txt.push('  users (user_id) ←1:1→ user_streaks (user_id)');
txt.push('  cases (case_id) ←1:1→ case_study_materials (case_id)');
txt.push('');
txt.push('M:M RESOLUTIONS (bridge/junction tables):');
txt.push('  users ←M:M→ cases            resolved via: user_case_progress  (UNIQUE: user_id, case_id)');
txt.push('  rooms ←M:M→ users(students)  resolved via: room_students        (UNIQUE: room_id, student_id)');
txt.push('  users ←M:M→ achievements     resolved via: user_achievements    (NO unique constraint — known limitation)');
txt.push('  game_sessions + users + case_objectives → session_objectives    (UNIQUE: session_id, user_id, objective_id)');
txt.push('');
txt.push('SELF-REFERENCING RELATIONSHIP:');
txt.push('  notifications.sender_id → users.user_id  (logical; a user sends notifications to another user)');
txt.push('');
txt.push('CROSS-DATABASE REFERENCE:');
txt.push('  cases.correct_suspect_id → detective_query_playground.suspects.suspect_id');
txt.push('  (logical only — playground DB is modified by students, DB-level FK is not safe)');
txt.push('');
txt.push('PLAYGROUND DB BOUNDARY:');
txt.push('  The 5 playground tables belong to a SEPARATE database: detective_query_playground');
txt.push('  Show them inside a dashed-border box labeled "detective_query_playground (Sandbox DB)"');
txt.push('  Only 1 enforced FK inside playground: evidence.location_id → locations.location_id');
txt.push('');
txt.push('='.repeat(80));
txt.push('HOW TO USE THIS IN LUCIDCHART');
txt.push('='.repeat(80));
txt.push('');
txt.push('OPTION A — CSV Import (recommended for speed):');
txt.push('  1. Open Lucidchart → New Document → choose "Entity Relationship Diagram"');
txt.push('  2. Click Import → CSV Import');
txt.push('  3. Upload ERD_Lucidchart.csv');
txt.push('  4. Lucidchart will auto-create all 37 entity boxes with columns');
txt.push('  5. Manually draw the connector lines using the Relationships list above');
txt.push('  6. Set line style: solid = enforced FK, dashed = logical FK');
txt.push('  7. Set crow\'s foot ends: one-side = single bar, many-side = crow\'s foot');
txt.push('');
txt.push('OPTION B — Manual (for full control):');
txt.push('  1. Open Lucidchart → New ERD diagram');
txt.push('  2. Create entity boxes using the TABLE list above');
txt.push('  3. Add attributes (columns) one by one');
txt.push('  4. Draw relationships using the RELATIONSHIPS list above');
txt.push('');
txt.push('COLOR CODING (match to domain):');
txt.push('  A - Identity & Auth         → Light Blue   #DAE8FC');
txt.push('  B - Academic Structure      → Light Green  #D5E8D4');
txt.push('  C - Curriculum & Cases      → Light Orange #FFE6CC');
txt.push('  D - Rooms & Game Sessions   → Light Purple #E1D5E7');
txt.push('  E - Submissions & Progress  → Light Yellow #FFF2CC');
txt.push('  F - Gamification            → Light Pink   #F8CECC');
txt.push('  Playground DB               → Light Gray   #F5F5F5  (dashed border box)');
txt.push('');
txt.push('='.repeat(80));
txt.push('End of ERD Text Format — Detective Query');
txt.push('='.repeat(80));

const txtPath = path.join(OUT_DIR, 'ERD_TextFormat.txt');
fs.writeFileSync(txtPath, txt.join('\n'), 'utf8');
console.log('✅ Text format written:', txtPath);
console.log('');
console.log('Summary:');
console.log(`  Tables:              ${SCHEMA.length}`);
console.log(`  Enforced FKs:        ${enforced.length}`);
console.log(`  Logical FKs:         ${logical.length}`);
console.log(`  Total relationships: ${RELATIONSHIPS.length}`);

