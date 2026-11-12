/**
 * generate_erd.js
 * Generates a Draw.io XML ERD for the Detective Query system.
 * Run: node scripts/generate_erd.js
 * Output: C:\Users\PC\Documents\4th Year Project\ERD_DetectiveQuery.drawio
 */

const fs = require('fs');
const path = require('path');

// ─── COLORS BY DOMAIN ───────────────────────────────────────────────────────
const COLORS = {
  auth:       { header: '#1e4d8c', headerFont: '#ffffff', body: '#DAE8FC', border: '#6c8ebf' },
  academic:   { header: '#2d6a2d', headerFont: '#ffffff', body: '#D5E8D4', border: '#82b366' },
  curriculum: { header: '#a0522d', headerFont: '#ffffff', body: '#FFE6CC', border: '#d6b656' },
  rooms:      { header: '#5b2d8e', headerFont: '#ffffff', body: '#E1D5E7', border: '#9673a6' },
  progress:   { header: '#7a6000', headerFont: '#ffffff', body: '#FFF2CC', border: '#d6b656' },
  gamify:     { header: '#8b1a1a', headerFont: '#ffffff', body: '#F8CECC', border: '#b85450' },
  playground: { header: '#555555', headerFont: '#ffffff', body: '#F5F5F5', border: '#999999' },
};

let idCounter = 1;
const cells = [];
const edges = [];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function nextId() { return `cell_${idCounter++}`; }

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeTable(name, columns, x, y, domain) {
  const c = COLORS[domain];
  const ROW_H = 20;
  const TABLE_W = 200;
  const HEADER_H = 28;
  const tableH = HEADER_H + columns.length * ROW_H;
  const tableId = nextId();

  // Header cell (swimlane parent)
  cells.push(`
    <mxCell id="${tableId}" value="${esc(name)}" style="shape=table;startSize=${HEADER_H};container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;fillColor=${c.body};strokeColor=${c.border};fontColor=#000000;swimlaneLine=1;swimlaneHead=0;labelBackgroundColor=${c.header};labelBorderColor=none;" vertex="1" parent="1">
      <mxGeometry x="${x}" y="${y}" width="${TABLE_W}" height="${tableH}" as="geometry"/>
    </mxCell>`);

  columns.forEach((col, i) => {
    const colId = nextId();
    let label = col.name;
    let style = `shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=${c.body};collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=11;top=0;left=0;right=0;bottom=${i < columns.length - 1 ? 1 : 0};strokeColor=${c.border};`;

    if (col.pk) {
      label = '🔑 ' + label;
      style += 'fontStyle=1;';
    } else if (col.fk) {
      label = '🔗 ' + label;
    } else if (col.uq) {
      label = '◆ ' + label;
    }

    const typeLabel = col.type ? ` : ${col.type}` : '';

    cells.push(`
    <mxCell id="${colId}" value="${esc(label + typeLabel)}" style="${style}" vertex="1" parent="${tableId}">
      <mxGeometry y="${HEADER_H + i * ROW_H}" width="${TABLE_W}" height="${ROW_H}" as="geometry"/>
    </mxCell>`);

    // Store column id for edge references
    col._cellId = colId;
    col._tableId = tableId;
  });

  return { id: tableId, x, y, w: TABLE_W, h: tableH };
}

function addEdge(sourceTableId, targetTableId, label, isDashed, sourceCard, targetCard) {
  const edgeId = nextId();
  const dashed = isDashed ? 'dashed=1;' : '';
  const sourceStyle = sourceCard === 'one' ? 'ERone' : 'ERmany';
  const targetStyle = targetCard === 'one' ? 'ERone' : 'ERmanyToOne';
  edges.push(`
    <mxCell id="${edgeId}" value="${esc(label || '')}" style="edgeStyle=entityRelationEdgeStyle;${dashed}endArrow=${targetStyle};startArrow=${sourceStyle};exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;fontSize=9;strokeColor=${isDashed ? '#999999' : '#23445d'};" edge="1" parent="1" source="${sourceTableId}" target="${targetTableId}">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>`);
}

// ─── DEFINE ALL TABLES ───────────────────────────────────────────────────────
// Layout: columns by domain, rows by table
// Domain A: x=20
// Domain B: x=260
// Domain C: x=500
// Domain D: x=740
// Domain E: x=980
// Domain F: x=1220
// Playground: x=1460

const tables = {};

// ── DOMAIN A: Auth (x=20) ────────────────────────────────────────────────────
tables.roles = makeTable('roles', [
  { name:'role_id', type:'INT', pk:true },
  { name:'role_name', type:'VARCHAR(50)', uq:true },
], 20, 20, 'auth');

tables.users = makeTable('users', [
  { name:'user_id', type:'INT', pk:true },
  { name:'full_name', type:'VARCHAR(100)' },
  { name:'email', type:'VARCHAR(150)', uq:true },
  { name:'password', type:'VARCHAR(255)' },
  { name:'avatar', type:'VARCHAR(255)' },
  { name:'role_id', type:'INT', fk:true },
  { name:'created_at', type:'TIMESTAMP' },
  { name:'total_points', type:'INT DEF=0' },
  { name:'current_level', type:'INT DEF=1' },
  { name:'first_name', type:'VARCHAR' },
  { name:'middle_name', type:'VARCHAR' },
  { name:'last_name', type:'VARCHAR' },
  { name:'extension_name', type:'VARCHAR' },
  { name:'sex', type:'VARCHAR(10) [legacy]' },
  { name:'section', type:'VARCHAR(50) [legacy]' },
  { name:'student_id', type:'VARCHAR(50) [legacy]' },
  { name:'teacher_id', type:'VARCHAR(50) [legacy]' },
  { name:'gender', type:'ENUM' },
  { name:'civil_status', type:'ENUM' },
  { name:'birthday', type:'DATE' },
], 20, 100, 'auth');

tables.registration_requests = makeTable('registration_requests', [
  { name:'request_id', type:'INT', pk:true },
  { name:'first_name / middle_name', type:'VARCHAR' },
  { name:'last_name / extension_name', type:'VARCHAR' },
  { name:'full_name', type:'VARCHAR(200)' },
  { name:'email', type:'VARCHAR(150)', uq:true },
  { name:'password_hash', type:'TEXT' },
  { name:'role_id', type:'INT [logical FK]' },
  { name:'sex / section / student_id', type:'[legacy]' },
  { name:'status', type:'ENUM(pending/approved/rejected)' },
  { name:'reject_reason', type:'TEXT' },
  { name:'requested_at', type:'TIMESTAMP' },
  { name:'reviewed_at', type:'TIMESTAMP' },
  { name:'gender', type:'ENUM' },
  { name:'civil_status', type:'ENUM' },
  { name:'birthday', type:'DATE' },
  { name:'class_code', type:'VARCHAR(20)' },
  { name:'student_number', type:'VARCHAR(50)' },
  { name:'section_id [logical FK]', type:'INT' },
  { name:'course_id [logical FK]', type:'INT' },
  { name:'year_level', type:'TINYINT' },
  { name:'semester_id [logical FK]', type:'INT' },
], 20, 600, 'auth');

tables.student_invitations = makeTable('student_invitations', [
  { name:'invitation_id', type:'INT UNSIGNED', pk:true },
  { name:'email', type:'VARCHAR(191)' },
  { name:'first_name / middle_name', type:'VARCHAR' },
  { name:'last_name / extension_name', type:'VARCHAR' },
  { name:'student_number', type:'VARCHAR(100)' },
  { name:'section_id [logical FK]', type:'INT' },
  { name:'course_id [logical FK]', type:'INT' },
  { name:'year_level', type:'TINYINT' },
  { name:'semester_id [logical FK]', type:'INT' },
  { name:'invite_token', type:'VARCHAR(128)' },
  { name:'token_expires_at', type:'DATETIME' },
  { name:'status', type:'ENUM(pending/completed/expired/cancelled)' },
  { name:'import_batch_id', type:'VARCHAR(64)' },
  { name:'imported_by [logical FK]', type:'INT' },
  { name:'invited_at / completed_at', type:'DATETIME' },
  { name:'resent_at', type:'DATETIME' },
  { name:'user_id [logical FK]', type:'INT' },
  { name:'role_id [logical FK]', type:'TINYINT' },
], 20, 1080, 'auth');

tables.otp_verifications = makeTable('otp_verifications', [
  { name:'id', type:'INT', pk:true },
  { name:'otp_key', type:'VARCHAR(255)' },
  { name:'otp_code', type:'VARCHAR(10)' },
  { name:'expires_at', type:'BIGINT' },
  { name:'created_at', type:'TIMESTAMP' },
], 20, 1460, 'auth');

tables.refresh_tokens = makeTable('refresh_tokens', [
  { name:'id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'token', type:'VARCHAR(512)' },
  { name:'expires_at', type:'DATETIME' },
  { name:'created_at', type:'DATETIME' },
], 20, 1600, 'auth');

tables.account_change_requests = makeTable('account_change_requests', [
  { name:'request_id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'request_type', type:'VARCHAR(50)' },
  { name:'old_value', type:'VARCHAR(255)' },
  { name:'new_value', type:'VARCHAR(255)' },
  { name:'reason', type:'TEXT' },
  { name:'status', type:'ENUM(pending/approved/rejected)' },
  { name:'reject_reason', type:'TEXT' },
  { name:'created_at', type:'TIMESTAMP' },
  { name:'reviewed_at', type:'TIMESTAMP' },
], 20, 1730, 'auth');

tables.user_avatars = makeTable('user_avatars', [
  { name:'user_id', type:'INT (PK+FK)', pk:true, fk:true },
  { name:'file_name', type:'VARCHAR(255)' },
  { name:'mime_type', type:'VARCHAR(100)' },
  { name:'file_size', type:'INT' },
  { name:'file_data', type:'LONGBLOB' },
  { name:'created_at', type:'TIMESTAMP' },
  { name:'updated_at', type:'TIMESTAMP' },
], 20, 1940, 'auth');

// ── DOMAIN B: Academic (x=270) ───────────────────────────────────────────────
tables.semesters = makeTable('semesters', [
  { name:'semester_id', type:'INT', pk:true },
  { name:'school_year', type:'VARCHAR(20)' },
  { name:'term', type:'ENUM(1st/2nd/Summer)' },
  { name:'is_active', type:'TINYINT' },
  { name:'created_at', type:'DATETIME' },
  { name:'is_archived', type:'TINYINT' },
], 270, 20, 'academic');

tables.courses = makeTable('courses', [
  { name:'course_id', type:'INT', pk:true },
  { name:'course_code', type:'VARCHAR(20)' },
  { name:'course_name', type:'VARCHAR(100)' },
  { name:'created_at', type:'DATETIME' },
  { name:'is_archived', type:'TINYINT' },
], 270, 200, 'academic');

tables.sections = makeTable('sections', [
  { name:'section_id', type:'INT', pk:true },
  { name:'section_name', type:'VARCHAR(20)', uq:true },
  { name:'created_at', type:'DATETIME' },
  { name:'is_archived', type:'TINYINT' },
], 270, 360, 'academic');

tables.student_enrollments = makeTable('student_enrollments', [
  { name:'enrollment_id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'course_id', type:'INT (nullable)', fk:true },
  { name:'year_level', type:'TINYINT' },
  { name:'section_id', type:'INT', fk:true },
  { name:'semester_id', type:'INT', fk:true },
  { name:'created_at', type:'DATETIME' },
], 270, 500, 'academic');

tables.teacher_section_assignments = makeTable('teacher_section_assignments', [
  { name:'assignment_id', type:'INT', pk:true },
  { name:'teacher_id', type:'INT', fk:true },
  { name:'section_id', type:'INT', fk:true },
  { name:'course_id', type:'INT', fk:true },
  { name:'year_level', type:'TINYINT' },
  { name:'semester_id', type:'INT', fk:true },
  { name:'subject_name', type:'VARCHAR(100)' },
  { name:'created_at', type:'DATETIME' },
  { name:'is_archived', type:'TINYINT' },
], 270, 670, 'academic');

tables.allowed_student_numbers = makeTable('allowed_student_numbers', [
  { name:'id', type:'INT', pk:true },
  { name:'student_number', type:'VARCHAR(50)', uq:true },
  { name:'email_hint', type:'VARCHAR(255)' },
  { name:'section_id', type:'INT (nullable)', fk:true },
  { name:'course_id', type:'INT (nullable)', fk:true },
  { name:'year_level', type:'TINYINT' },
  { name:'semester_id', type:'INT (nullable)', fk:true },
  { name:'is_used', type:'TINYINT DEF=0' },
  { name:'created_at', type:'DATETIME' },
  { name:'is_archived', type:'TINYINT' },
], 270, 870, 'academic');

tables.class_codes = makeTable('class_codes', [
  { name:'code_id', type:'INT', pk:true },
  { name:'code', type:'VARCHAR(20)', uq:true },
  { name:'section_id', type:'INT (nullable)', fk:true },
  { name:'semester_id', type:'INT (nullable)', fk:true },
  { name:'is_active', type:'TINYINT DEF=1' },
  { name:'expires_at', type:'DATETIME (nullable)' },
  { name:'created_by', type:'INT (nullable)', fk:true },
  { name:'created_at', type:'DATETIME' },
  { name:'is_archived', type:'TINYINT' },
], 270, 1080, 'academic');

// ── DOMAIN C: Curriculum (x=520) ─────────────────────────────────────────────
tables.difficulty = makeTable('difficulty', [
  { name:'difficulty_id', type:'INT', pk:true },
  { name:'difficulty_name', type:'VARCHAR(50)' },
  { name:'multiplier', type:'DECIMAL(5,2)' },
], 520, 20, 'curriculum');

tables.datasets = makeTable('datasets', [
  { name:'dataset_id', type:'INT', pk:true },
  { name:'dataset_name', type:'VARCHAR(150)' },
  { name:'schema_definition', type:'TEXT' },
  { name:'sample_data', type:'TEXT' },
], 520, 130, 'curriculum');

tables.cases = makeTable('cases', [
  { name:'case_id', type:'INT', pk:true },
  { name:'title', type:'VARCHAR(200)' },
  { name:'description', type:'TEXT' },
  { name:'objectives', type:'TEXT [legacy]' },
  { name:'dataset_id', type:'INT (nullable)', fk:true },
  { name:'difficulty_id', type:'INT', fk:true },
  { name:'correct_query', type:'TEXT' },
  { name:'base_points', type:'INT DEF=100' },
  { name:'is_active', type:'TINYINT' },
  { name:'unlock_xp_required', type:'INT DEF=0' },
  { name:'correct_suspect_id', type:'INT [logical FK]' },
  { name:'mode', type:'ENUM(Practice/Rank)' },
  { name:'sql_type', type:'ENUM(DQL/DML/DDL)' },
  { name:'setup_sql', type:'TEXT' },
  { name:'expected_result_sql', type:'TEXT' },
  { name:'module_order', type:'TINYINT' },
], 520, 270, 'curriculum');

tables.case_objectives = makeTable('case_objectives', [
  { name:'objective_id', type:'INT', pk:true },
  { name:'case_id', type:'INT', fk:true },
  { name:'objective_order', type:'INT (1/2/3)' },
  { name:'objective_text', type:'VARCHAR(500)' },
  { name:'expected_query', type:'TEXT' },
  { name:'validation_type', type:'ENUM(result/pattern)' },
  { name:'required_keyword', type:'VARCHAR(100)' },
  { name:'points', type:'INT DEF=10' },
], 520, 700, 'curriculum');

tables.case_study_materials = makeTable('case_study_materials', [
  { name:'case_id', type:'INT (PK+FK)', pk:true, fk:true },
  { name:'file_name', type:'VARCHAR(255)' },
  { name:'mime_type', type:'VARCHAR(100)' },
  { name:'file_size', type:'INT' },
  { name:'file_data', type:'LONGBLOB' },
  { name:'uploaded_by [logical FK]', type:'INT' },
  { name:'created_at', type:'TIMESTAMP' },
  { name:'updated_at', type:'TIMESTAMP' },
], 520, 900, 'curriculum');

tables.case_notes = makeTable('case_notes', [
  { name:'note_id', type:'INT', pk:true },
  { name:'user_id [logical FK]', type:'INT' },
  { name:'case_id [logical FK]', type:'INT' },
  { name:'note_text', type:'TEXT' },
  { name:'created_at', type:'DATETIME' },
], 520, 1080, 'curriculum');

// ── DOMAIN D: Rooms & Sessions (x=770) ───────────────────────────────────────
tables.rooms = makeTable('rooms', [
  { name:'room_id', type:'INT', pk:true },
  { name:'teacher_id', type:'INT', fk:true },
  { name:'room_name', type:'VARCHAR(100)' },
  { name:'room_code', type:'VARCHAR(10)', uq:true },
  { name:'created_at', type:'TIMESTAMP' },
  { name:'is_archived', type:'TINYINT' },
  { name:'archived_at', type:'DATETIME' },
  { name:'section_id [logical FK]', type:'INT' },
  { name:'semester_id [logical FK]', type:'INT' },
  { name:'course_id [logical FK]', type:'INT' },
  { name:'year_level', type:'TINYINT' },
  { name:'sql_type', type:'ENUM(DDL/DML/DQL)' },
], 770, 20, 'rooms');

tables.room_students = makeTable('room_students', [
  { name:'room_students_id', type:'INT', pk:true },
  { name:'room_id', type:'INT', fk:true },
  { name:'student_id', type:'INT', fk:true },
  { name:'status', type:'ENUM(Pending/Approved/Rejected)' },
  { name:'requested_at', type:'TIMESTAMP' },
], 770, 320, 'rooms');

tables.game_sessions = makeTable('game_sessions', [
  { name:'session_id', type:'INT', pk:true },
  { name:'room_id', type:'INT', fk:true },
  { name:'case_id', type:'INT', fk:true },
  { name:'difficulty_id', type:'INT', fk:true },
  { name:'start_time', type:'DATETIME' },
  { name:'end_time', type:'DATETIME' },
  { name:'is_active [legacy]', type:'TINYINT DEF=1' },
  { name:'personal_time_limit', type:'INT DEF=10' },
  { name:'status', type:'ENUM(Scheduled/Active/Ended)' },
  { name:'is_paused', type:'TINYINT DEF=0' },
  { name:'paused_at', type:'DATETIME' },
  { name:'paused_seconds', type:'INT DEF=0' },
], 770, 490, 'rooms');

tables.session_objectives = makeTable('session_objectives', [
  { name:'id', type:'INT', pk:true },
  { name:'session_id [logical FK]', type:'INT' },
  { name:'user_id [logical FK]', type:'INT' },
  { name:'objective_id [logical FK]', type:'INT' },
  { name:'objective_text [snapshot]', type:'VARCHAR(500)' },
  { name:'points_awarded', type:'INT DEF=0' },
  { name:'is_completed', type:'TINYINT DEF=0' },
  { name:'completed_at', type:'DATETIME' },
], 770, 760, 'rooms');

// ── DOMAIN E: Progress (x=1020) ──────────────────────────────────────────────
tables.attempts = makeTable('attempts', [
  { name:'attempt_id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'case_id', type:'INT', fk:true },
  { name:'sql_query', type:'TEXT' },
  { name:'final_answer', type:'VARCHAR(255)' },
  { name:'is_correct', type:'TINYINT' },
  { name:'score_awarded', type:'INT' },
  { name:'time_taken', type:'INT (seconds)' },
  { name:'execution_time_ms', type:'FLOAT (reserved)' },
  { name:'attempt_number', type:'INT (reserved)' },
  { name:'attempt_date', type:'TIMESTAMP' },
  { name:'room_id [logical FK]', type:'INT (nullable)' },
  { name:'session_id [logical FK]', type:'INT (nullable)' },
  { name:'mode', type:'ENUM(Practice/Rank)' },
], 1020, 20, 'progress');

tables.user_case_progress = makeTable('user_case_progress', [
  { name:'progress_id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'case_id', type:'INT', fk:true },
  { name:'status', type:'ENUM(Locked/Unlocked/Completed)' },
  { name:'highest_score', type:'INT' },
  { name:'is_unlocked [legacy]', type:'TINYINT DEF=0' },
  { name:'completed_at', type:'DATETIME' },
  { name:'investigation_score', type:'INT DEF=0' },
], 1020, 360, 'progress');

// ── DOMAIN F: Gamification (x=1270) ──────────────────────────────────────────
tables.achievements = makeTable('achievements', [
  { name:'achievement_id', type:'INT', pk:true },
  { name:'title', type:'VARCHAR(150)' },
  { name:'description', type:'TEXT' },
  { name:'points_required', type:'INT (nullable)' },
], 1270, 20, 'gamify');

tables.user_achievements = makeTable('user_achievements', [
  { name:'user_achievement_id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'achievement_id', type:'INT', fk:true },
  { name:'date_earned', type:'DATETIME' },
], 1270, 160, 'gamify');

tables.user_badges = makeTable('user_badges', [
  { name:'badge_id', type:'VARCHAR(50)', pk:true },
  { name:'user_id', type:'INT (PK+FK)', pk:true, fk:true },
  { name:'unlocked_at', type:'DATETIME' },
], 1270, 300, 'gamify');

tables.user_streaks = makeTable('user_streaks', [
  { name:'user_id', type:'INT (PK+FK)', pk:true, fk:true },
  { name:'current_streak', type:'INT DEF=0' },
  { name:'last_solved_date', type:'DATE' },
], 1270, 400, 'gamify');

tables.notifications = makeTable('notifications', [
  { name:'notification_id', type:'INT', pk:true },
  { name:'user_id', type:'INT', fk:true },
  { name:'sender_id [logical FK]', type:'INT' },
  { name:'message', type:'TEXT' },
  { name:'is_read', type:'TINYINT DEF=0' },
  { name:'created_at', type:'TIMESTAMP' },
  { name:'notification_type', type:'VARCHAR(50)' },
], 1270, 490, 'gamify');

// ── PLAYGROUND DB (x=1520) ───────────────────────────────────────────────────
tables.suspects = makeTable('suspects', [
  { name:'suspect_id', type:'INT', pk:true },
  { name:'name', type:'VARCHAR(100)' },
  { name:'age', type:'INT' },
  { name:'status', type:'VARCHAR(50)' },
], 1520, 20, 'playground');

tables.evidence = makeTable('evidence', [
  { name:'evidence_id', type:'INT', pk:true },
  { name:'item_name', type:'VARCHAR(100)' },
  { name:'severity', type:'INT DEF=1' },
  { name:'location_id', type:'INT', fk:true },
  { name:'collected_at', type:'DATETIME' },
], 1520, 180, 'playground');

tables.locations = makeTable('locations', [
  { name:'location_id', type:'INT', pk:true },
  { name:'place_name', type:'VARCHAR(100)' },
  { name:'district', type:'VARCHAR(100)' },
  { name:'is_active', type:'TINYINT' },
], 1520, 360, 'playground');

tables.officers = makeTable('officers', [
  { name:'officer_id', type:'INT', pk:true },
  { name:'badge_number', type:'VARCHAR(20)', uq:true },
  { name:'name', type:'VARCHAR(100)' },
  { name:'rank_level', type:'VARCHAR(50)' },
], 1520, 510, 'playground');

tables.witnesses = makeTable('witnesses', [
  { name:'witness_id', type:'INT', pk:true },
  { name:'full_name', type:'VARCHAR(100)' },
  { name:'contact_number', type:'VARCHAR(20)' },
], 1520, 660, 'playground');

// ─── ENFORCED FK EDGES (solid) ────────────────────────────────────────────────
// Format: addEdge(sourceId, targetId, label, isDashed, sourceCard, targetCard)
// source = FK side (many), target = PK side (one)

addEdge(tables.users.id,                       tables.roles.id,              'role_id',   false, 'many', 'one');
addEdge(tables.refresh_tokens.id,              tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.account_change_requests.id,     tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.user_avatars.id,                tables.users.id,              '1:1 CASCADE', false, 'one', 'one');
addEdge(tables.user_streaks.id,                tables.users.id,              '1:1 CASCADE', false, 'one', 'one');
addEdge(tables.user_badges.id,                 tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.user_achievements.id,           tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.user_achievements.id,           tables.achievements.id,       'CASCADE',   false, 'many', 'one');
addEdge(tables.notifications.id,               tables.users.id,              'CASCADE',   false, 'many', 'one');

addEdge(tables.student_enrollments.id,         tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.student_enrollments.id,         tables.courses.id,            'RESTRICT',  false, 'many', 'one');
addEdge(tables.student_enrollments.id,         tables.sections.id,           'RESTRICT',  false, 'many', 'one');
addEdge(tables.student_enrollments.id,         tables.semesters.id,          'RESTRICT',  false, 'many', 'one');

addEdge(tables.teacher_section_assignments.id, tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.teacher_section_assignments.id, tables.sections.id,           'RESTRICT',  false, 'many', 'one');
addEdge(tables.teacher_section_assignments.id, tables.courses.id,            'RESTRICT',  false, 'many', 'one');
addEdge(tables.teacher_section_assignments.id, tables.semesters.id,          'RESTRICT',  false, 'many', 'one');

addEdge(tables.allowed_student_numbers.id,     tables.sections.id,           'SET NULL',  false, 'many', 'one');
addEdge(tables.allowed_student_numbers.id,     tables.courses.id,            'SET NULL',  false, 'many', 'one');
addEdge(tables.allowed_student_numbers.id,     tables.semesters.id,          'SET NULL',  false, 'many', 'one');

addEdge(tables.class_codes.id,                 tables.sections.id,           'SET NULL',  false, 'many', 'one');
addEdge(tables.class_codes.id,                 tables.semesters.id,          'SET NULL',  false, 'many', 'one');
addEdge(tables.class_codes.id,                 tables.users.id,              'SET NULL',  false, 'many', 'one');

addEdge(tables.cases.id,                       tables.datasets.id,           'RESTRICT',  false, 'many', 'one');
addEdge(tables.cases.id,                       tables.difficulty.id,         'RESTRICT',  false, 'many', 'one');
addEdge(tables.case_objectives.id,             tables.cases.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.case_study_materials.id,        tables.cases.id,              '1:1 CASCADE', false, 'one', 'one');

addEdge(tables.rooms.id,                       tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.room_students.id,               tables.rooms.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.room_students.id,               tables.users.id,              'CASCADE',   false, 'many', 'one');

addEdge(tables.game_sessions.id,               tables.rooms.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.game_sessions.id,               tables.cases.id,              'RESTRICT',  false, 'many', 'one');
addEdge(tables.game_sessions.id,               tables.difficulty.id,         'RESTRICT',  false, 'many', 'one');

addEdge(tables.attempts.id,                    tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.attempts.id,                    tables.cases.id,              'CASCADE',   false, 'many', 'one');

addEdge(tables.user_case_progress.id,          tables.users.id,              'CASCADE',   false, 'many', 'one');
addEdge(tables.user_case_progress.id,          tables.cases.id,              'CASCADE',   false, 'many', 'one');

// Playground enforced FK
addEdge(tables.evidence.id,                    tables.locations.id,          'RESTRICT',  false, 'many', 'one');

// ─── LOGICAL FK EDGES (dashed) ────────────────────────────────────────────────
addEdge(tables.registration_requests.id,       tables.roles.id,              'logical',   true,  'many', 'one');
addEdge(tables.registration_requests.id,       tables.sections.id,           'logical',   true,  'many', 'one');
addEdge(tables.registration_requests.id,       tables.courses.id,            'logical',   true,  'many', 'one');
addEdge(tables.registration_requests.id,       tables.semesters.id,          'logical',   true,  'many', 'one');

addEdge(tables.student_invitations.id,         tables.sections.id,           'logical',   true,  'many', 'one');
addEdge(tables.student_invitations.id,         tables.courses.id,            'logical',   true,  'many', 'one');
addEdge(tables.student_invitations.id,         tables.semesters.id,          'logical',   true,  'many', 'one');
addEdge(tables.student_invitations.id,         tables.users.id,              'logical',   true,  'many', 'one');

addEdge(tables.cases.id,                       tables.suspects.id,           'cross-DB logical', true, 'many', 'one');
addEdge(tables.case_notes.id,                  tables.users.id,              'logical',   true,  'many', 'one');
addEdge(tables.case_notes.id,                  tables.cases.id,              'logical',   true,  'many', 'one');
addEdge(tables.case_study_materials.id,        tables.users.id,              'logical uploaded_by', true, 'many', 'one');

addEdge(tables.rooms.id,                       tables.sections.id,           'logical',   true,  'many', 'one');
addEdge(tables.rooms.id,                       tables.semesters.id,          'logical',   true,  'many', 'one');
addEdge(tables.rooms.id,                       tables.courses.id,            'logical',   true,  'many', 'one');

addEdge(tables.attempts.id,                    tables.rooms.id,              'logical',   true,  'many', 'one');
addEdge(tables.attempts.id,                    tables.game_sessions.id,      'logical',   true,  'many', 'one');

addEdge(tables.session_objectives.id,          tables.game_sessions.id,      'logical',   true,  'many', 'one');
addEdge(tables.session_objectives.id,          tables.users.id,              'logical',   true,  'many', 'one');
addEdge(tables.session_objectives.id,          tables.case_objectives.id,    'logical',   true,  'many', 'one');

addEdge(tables.notifications.id,               tables.users.id,              'logical sender_id', true, 'many', 'one');

// ─── LEGEND ───────────────────────────────────────────────────────────────────
const legendId = nextId();
cells.push(`
  <mxCell id="${legendId}" value="LEGEND" style="text;html=1;strokeColor=#000000;fillColor=#f5f5f5;align=left;verticalAlign=top;spacingLeft=5;fontStyle=1;fontSize=13;" vertex="1" parent="1">
    <mxGeometry x="20" y="2100" width="700" height="200" as="geometry"/>
  </mxCell>`);

const legendTextId = nextId();
cells.push(`
  <mxCell id="${legendTextId}" value="🔑 PK = Primary Key  |  🔗 FK = Foreign Key  |  ◆ UQ = Unique Constraint&#xa;&#xa;━━━ Solid line = Enforced FK (database-level constraint)&#xa;- - - Dashed line = Logical FK (application-enforced, no DB constraint)&#xa;&#xa;Crow&#39;s Foot:  ─|  = exactly one (mandatory)  |  ─O = zero or one (optional)  |  ─&lt; = many&#xa;&#xa;1:1 = one-to-one  |  1:M = one-to-many  |  M:M = many-to-many (resolved via bridge table)&#xa;&#xa;Domain Colors:  🔵 Auth  🟢 Academic  🟠 Curriculum  🟣 Rooms/Sessions  🟡 Progress  🔴 Gamification  ⚪ Playground DB" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=5;fontSize=11;" vertex="1" parent="1">
    <mxGeometry x="20" y="2130" width="1700" height="160" as="geometry"/>
  </mxCell>`);

// Playground DB boundary
const playgroundBoxId = nextId();
cells.push(`
  <mxCell id="${playgroundBoxId}" value="detective_query_playground (Sandbox DB)" style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];shape=mxgraph.lean_mapping.electronic_info_flow_edge;dashed=1;strokeColor=#999999;fillColor=none;fontSize=13;fontStyle=1;verticalAlign=top;" vertex="1" parent="1">
    <mxGeometry x="1500" y="0" width="240" height="780" as="geometry"/>
  </mxCell>`);

// ─── BUILD XML ────────────────────────────────────────────────────────────────
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel dx="2000" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="3300" pageHeight="2340" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    ${cells.join('\n')}
    ${edges.join('\n')}
  </root>
</mxGraphModel>`;

const outPath = path.join(__dirname, '..', '..', 'ERD_DetectiveQuery.drawio');
fs.writeFileSync(outPath, xml, 'utf8');
console.log('✅ ERD generated successfully!');
console.log('📄 File saved to:', outPath);
console.log('📊 Tables:', Object.keys(tables).length);
console.log('🔗 Edges (enforced + logical):', edges.length);

