/**
 * generate_indexes_fkeys_docx.js
 * Generates the thesis manuscript section for Database Indexes, Default Values,
 * and Foreign Key Constraints with Figure 81 and Figure 82 tables.
 */
const {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
} = require('docx');
const fs = require('fs');
const path = require('path');

const data = require('../../db_index_fkey_data.json');

function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: convertInchesToTwip(0.5) },
    spacing: { after: convertInchesToTwip(6 / 72), before: 0, line: 276 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 24, // 12pt
      }),
    ],
  });
}

function captionPara(figureText) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: convertInchesToTwip(6 / 72), after: convertInchesToTwip(10 / 72) },
    children: [
      new TextRun({
        text: figureText,
        bold: true,
        italics: true,
        font: 'Times New Roman',
        size: 22, // 11pt
      }),
    ],
  });
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
  insideH: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
  insideV: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
};

function createHeaderCell(text, widthPercent) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: 'F0F0F0', fill: 'F0F0F0' },
    margins: {
      top: convertInchesToTwip(0.04),
      bottom: convertInchesToTwip(0.04),
      left: convertInchesToTwip(0.06),
      right: convertInchesToTwip(0.06),
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: true,
            font: 'Times New Roman',
            size: 19, // ~9.5pt
          }),
        ],
      }),
    ],
  });
}

function createDataCell(text, widthPercent, align = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    margins: {
      top: convertInchesToTwip(0.03),
      bottom: convertInchesToTwip(0.03),
      left: convertInchesToTwip(0.06),
      right: convertInchesToTwip(0.06),
    },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text ?? ''),
            font: 'Times New Roman',
            size: 18, // 9pt
          }),
        ],
      }),
    ],
  });
}

// ── Build Figure 81 Table (Indexes) ─────────────────────────────────────────
function buildIndexesTable(indexes) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell('#', 6),
      createHeaderCell('TableName', 28),
      createHeaderCell('IndexName', 32),
      createHeaderCell('type_desc', 18),
      createHeaderCell('is_primary_key', 8),
      createHeaderCell('is_unique', 8),
    ],
  });

  const dataRows = indexes.map((idx, i) => {
    return new TableRow({
      children: [
        createDataCell(i + 1, 6, AlignmentType.CENTER),
        createDataCell(idx.TableName, 28),
        createDataCell(idx.IndexName, 32),
        createDataCell(idx.type_desc, 18),
        createDataCell(idx.is_primary_key, 8, AlignmentType.CENTER),
        createDataCell(idx.is_unique, 8, AlignmentType.CENTER),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows],
  });
}

// ── Build Figure 82 Table (Foreign Keys) ────────────────────────────────────
function buildFKeysTable(fkeys) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell('#', 6),
      createHeaderCell('Foreign Key', 26),
      createHeaderCell('Table', 22),
      createHeaderCell('Column', 16),
      createHeaderCell('References Table', 16),
      createHeaderCell('References Column', 14),
    ],
  });

  const dataRows = fkeys.map((fk, i) => {
    return new TableRow({
      children: [
        createDataCell(i + 1, 6, AlignmentType.CENTER),
        createDataCell(fk.ForeignKey, 26),
        createDataCell(fk.Table, 22),
        createDataCell(fk.Column, 16),
        createDataCell(fk.ReferencesTable, 16),
        createDataCell(fk.ReferencesColumn, 14),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows],
  });
}

// ── Document Definition ─────────────────────────────────────────────────────
const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.5),
            right: convertInchesToTwip(1),
          },
        },
      },
      children: [
        // Heading
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: convertInchesToTwip(10 / 72) },
          children: [
            new TextRun({
              text: '3.4.3 Database Indexes, Default Values, and Foreign Key Constraints',
              bold: true,
              italics: true,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        }),

        // Paragraph 1: Indexes
        bodyPara(
          'The primary key of every table is a clustered index, and, as stated in the Data Dictionary, ' +
          'each primary key is an auto-incrementing (AUTO_INCREMENT) integer column. In addition to these ' +
          'thirty-two (32) primary key indexes, fifty-six (56) nonclustered indexes were created, as shown in Figure 81. ' +
          'Several nonclustered indexes are dedicated to accelerating high-frequency queries and performance-critical operations: ' +
          'idx_attempts_case, idx_attempts_rank, and user_id on the attempts table—which grows rapidly with every SQL submission from ' +
          'learners—support fast retrieval, execution filtering, and real-time score ranking. On game_sessions, the composite index ' +
          'idx_game_sessions_active optimizes real-time room monitoring and matchmaking for multiplayer sessions. ' +
          'On refresh_tokens, the indexes idx_token and idx_user_id accelerate authentication lookups and token validation without full ' +
          'table scans. Furthermore, multiple unique nonclustered indexes enforce domain integrity rules: uq_student_number prevents duplicate ' +
          'student registrations, uq_class_code and room_code guarantee that classroom and session codes remain distinct, uq_room_student ' +
          'prevents duplicate room enrollments, unique_session_objective ensures that objective progress is not awarded redundantly within ' +
          'a single match, and unique_user_case ensures consistent tracking of user case progression.'
        ),

        // Caption Figure 81
        captionPara('Figure 81. List of Database Indexes in Detective Query'),

        // Table Figure 81
        buildIndexesTable(data.indexes),

        new Paragraph({ spacing: { before: convertInchesToTwip(14 / 72), after: 0 }, children: [] }),

        // Paragraph 2: Default Values
        bodyPara(
          'Some columns also have default values. For example, in cases the mode column defaults to "Practice", base_points defaults ' +
          'to 100, is_active defaults to 1, and sql_type defaults to "DQL". In attempts, attempt_date defaults to the current date and ' +
          'time (CURRENT_TIMESTAMP), and mode defaults to "Practice", ensuring that execution attempts are timestamped and categorized ' +
          'even if not explicitly passed by the client. In room_students, status defaults to "Pending" and requested_at defaults to ' +
          'CURRENT_TIMESTAMP so that newly joined students await teacher authorization. Similarly, in registration_requests and ' +
          'account_change_requests, status defaults to "pending". Across systemic audit and archiving columns (such as is_archived in ' +
          'allowed_student_numbers, class_codes, courses, sections, and semesters), values default to 0 (active/unarchived), ' +
          'guaranteeing data completeness and preventing unintended null states across the application lifecycle.'
        ),

        // Paragraph 3: Foreign Key Constraints
        bodyPara(
          'The foreign key constraints of the database are listed in Figure 82, which shows for each constraint the child table ' +
          'and column and the parent table and column it references. The result has thirty-seven (37) rows, establishing comprehensive ' +
          'referential integrity across all entities in the relational model. These relationships enforce strict cascading and linkage ' +
          'rules between the central authentication entity (users) and its associated activities (attempts, room_students, user_achievements, ' +
          'user_badges, user_streaks, and refresh_tokens), between educational scenarios (cases) and their investigative components ' +
          '(case_objectives, case_study_materials, and game_sessions), and between institutional structures (courses, sections, and ' +
          'semesters) and student cohort registrations (student_enrollments, class_codes, and teacher_section_assignments).'
        ),

        // Caption Figure 82
        captionPara('Figure 82. List of Foreign Key Constraints in Detective Query'),

        // Table Figure 82
        buildFKeysTable(data.fkeys),
      ],
    },
  ],
});

const outputPath = path.join(__dirname, '..', '..', 'Section_3_4_3_Database_Indexes_and_Constraints.docx');

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ Word document created at:', outputPath);
  })
  .catch((err) => {
    console.error('❌ Error creating docx:', err);
    process.exit(1);
  });

