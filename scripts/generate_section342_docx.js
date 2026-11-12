/**
 * generate_section342_docx.js
 * Generates Section 3.4.2 "Connection to the Application" in thesis manuscript format.
 * Run from: detective_query_backend directory
 *   node scripts/generate_section342_docx.js
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

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Body paragraph — Times New Roman 12pt, fully justified, first-line indent 0.5" */
function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: convertInchesToTwip(0.5) },
    spacing: { after: 0, before: 0, line: 276 }, // ~1.15 line spacing
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 24, // 12pt = 24 half-points
      }),
    ],
  });
}

/** Code line — Courier New 11pt, inside a table cell (shaded box) */
function codeLine(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 0, before: 0, line: 240 },
    children: [
      new TextRun({
        text: text === '' ? ' ' : text,
        font: 'Courier New',
        size: 20, // 10pt
      }),
    ],
  });
}

/** Build the shaded code block table */
function codeBlock(lines) {
  const rows = lines.map(
    (line) =>
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.SOLID,
              color: 'E8E8E8', // light gray
              fill: 'E8E8E8',
            },
            borders: {
              top:    { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left:   { style: BorderStyle.NONE, size: 0 },
              right:  { style: BorderStyle.NONE, size: 0 },
            },
            margins: {
              top:    convertInchesToTwip(0.04),
              bottom: convertInchesToTwip(0.04),
              left:   convertInchesToTwip(0.1),
              right:  convertInchesToTwip(0.1),
            },
            children: [codeLine(line)],
          }),
        ],
      })
  );

  return new Table({
    width: { size: 85, type: WidthType.PERCENTAGE },
    margins: {
      left: convertInchesToTwip(0.5),
    },
    borders: {
      top:          { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      bottom:       { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      left:         { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      right:        { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      insideH:      { style: BorderStyle.NONE, size: 0 },
      insideV:      { style: BorderStyle.NONE, size: 0 },
    },
    rows,
  });
}

/** Blank spacer paragraph */
function spacer(pts = 6) {
  return new Paragraph({
    spacing: { before: 0, after: convertInchesToTwip(pts / 72) },
    children: [],
  });
}

// ─── Code lines ────────────────────────────────────────────────────────────

const CODE_LINES = [
  `const mysql = require('mysql2');`,
  `require('dotenv').config();`,
  ``,
  `// Auto-detect remote host to enable TLS/SSL`,
  `const isRemoteHost =`,
  `  process.env.DB_HOST &&`,
  `  process.env.DB_HOST !== 'localhost' &&`,
  `  process.env.DB_HOST !== '127.0.0.1';`,
  ``,
  `const sslConfig =`,
  `  (process.env.DB_SSL === 'true' || isRemoteHost)`,
  `    ? { rejectUnauthorized: false }`,
  `    : undefined;`,
  ``,
  `const systemDB = mysql.createPool({`,
  `  host:            process.env.DB_HOST     || 'localhost',`,
  `  user:            process.env.DB_USER     || 'root',`,
  `  password:        process.env.DB_PASSWORD || '', // actual password omitted`,
  `  database:        process.env.DB_NAME     || 'detective_query',`,
  `  port:            parseInt(process.env.DB_PORT || '4000', 10),`,
  `  ssl:             sslConfig,`,
  `  connectionLimit: 10,`,
  `  enableKeepAlive: true,`,
  `  keepAliveInitialDelay: 0,`,
  `}).promise();`,
  ``,
  `const playgroundDB = mysql.createPool({`,
  `  host:               process.env.DB_HOST     || 'localhost',`,
  `  user:               process.env.DB_USER     || 'root',`,
  `  password:           process.env.DB_PASSWORD || '',`,
  `  database:           process.env.DB_PLAYGROUND_NAME || 'detective_query_playground',`,
  `  port:               parseInt(process.env.DB_PORT || '4000', 10),`,
  `  ssl:                sslConfig,`,
  `  connectionLimit:    10,`,
  `  enableKeepAlive:    true,`,
  `  multipleStatements: false,`,
  `}).promise();`,
  ``,
  `module.exports = { systemDB, playgroundDB };`,
];

// ─── Document ──────────────────────────────────────────────────────────────

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.5), // typical thesis left margin
            right:  convertInchesToTwip(1),
          },
        },
      },
      children: [
        // ── Heading ─────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: convertInchesToTwip(6 / 72) },
          children: [
            new TextRun({
              text: '3.4.2 Connection to the Application',
              bold: true,
              italics: true,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        }),

        // ── Paragraph 1 ─────────────────────────────────────────────────
        bodyPara(
          'The backend of Detective Query is built using Node.js with the Express framework ' +
          'and connects to two MySQL-compatible databases through the mysql2/promise library. ' +
          'Two connection pools are created: systemDB, which connects to the main ' +
          'detective_query database that stores user accounts, rooms, cases, and scoring ' +
          'data; and playgroundDB, which connects to the detective_query_playground database ' +
          'used exclusively for executing student-submitted SQL queries in an isolated ' +
          'environment. All sensitive credentials—including the host, username, password, ' +
          'database name, and port—are stored in a .env configuration file, which decouples ' +
          'environment-specific settings from the application source code and prevents ' +
          'hardcoded credentials from being exposed in version control. ' +
          'Furthermore, the connection module automatically detects whether the target host ' +
          'is a remote server and, if so, enables TLS/SSL encryption with ' +
          'rejectUnauthorized set to false to support cloud-hosted database providers ' +
          'such as TiDB Cloud.'
        ),

        spacer(6),

        // ── Transitional sentence ────────────────────────────────────────
        bodyPara(
          'The main parts of the connection code are shown below (the password is omitted).'
        ),

        spacer(8),

        // ── Code block ──────────────────────────────────────────────────
        codeBlock(CODE_LINES),

        spacer(8),

        // ── Paragraph 2 ─────────────────────────────────────────────────
        bodyPara(
          'Each connection pool is configured with a connectionLimit of ten concurrent ' +
          'connections, which prevents the application from overwhelming the database server ' +
          'during peak usage. The enableKeepAlive option is set to true for both pools to ' +
          'maintain persistent TCP connections and avoid timeout errors that frequently occur ' +
          'with cloud-hosted databases when connections remain idle for extended periods. ' +
          'For the playground pool specifically, the multipleStatements option is set to ' +
          'false to prevent SQL injection attacks that could otherwise be carried out by ' +
          'submitting multiple semicolon-separated statements in a single query. ' +
          'All routes that accept user-provided SQL input additionally use parameterized ' +
          'prepared statements when querying the system database, ensuring that user input ' +
          'is never directly interpolated into SQL strings.'
        ),
      ],
    },
  ],
});

// ─── Output ────────────────────────────────────────────────────────────────

const outputPath = path.join(
  __dirname,
  '..',
  '..',
  'Section_3_4_2_Connection_to_Application.docx'
);

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ Document written to:', outputPath);
  })
  .catch((err) => {
    console.error('❌ Failed to generate document:', err);
    process.exit(1);
  });

