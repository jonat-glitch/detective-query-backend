const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatSql(sql) {
  if (!sql) return '';
  let clean = sql.trim();
  // Multi-statement query (e.g. DDL schema setup with multiple CREATE TABLE or DROP statements)
  if (clean.includes(';')) {
    const parts = clean
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return parts.join(';\n\n') + ';';
  }
  // Single query: format main clauses onto new lines for readability
  if (clean.length > 50) {
    const clauses = [
      'FROM',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'JOIN',
      'WHERE',
      'GROUP BY',
      'HAVING',
      'ORDER BY',
      'LIMIT',
      'UNION ALL',
      'UNION',
      'SET',
      'VALUES'
    ];
    let formatted = clean;
    clauses.forEach(cl => {
      const reg = new RegExp(`\\s+(${cl})\\s+`, 'gi');
      formatted = formatted.replace(reg, '\n$1 ');
    });
    return formatted;
  }
  return clean;
}

function formatDescription(desc) {
  if (!desc) return '';
  const lines = desc.split('\n');
  let inList = false;
  let html = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        html += '<ul class="desc-list">';
        inList = true;
      }
      html += `<li>${escapeHtml(line.substring(2))}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (line.length > 0) {
        html += `<p class="desc-para">${escapeHtml(line)}</p>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function formatObjectives(objText) {
  if (!objText) return '';
  const lines = objText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let html = '<div class="obj-list">';
  lines.forEach((line, idx) => {
    // Strip leading number if present (e.g. "1. " -> "")
    const cleanText = line.replace(/^\d+[\.\)]\s*/, '');
    html += `
      <div class="obj-step">
        <span class="step-num">Step ${idx + 1}</span>
        <span class="step-text">${escapeHtml(cleanText)}</span>
      </div>`;
  });
  html += '</div>';
  return html;
}

async function main() {
  console.log('Connecting to TiDB database...');
  const conn = await mysql.createConnection(TIDB);

  // Fetch all 45 practice cases ordered logically: DQL -> DML -> DDL, then by difficulty (1,2,3), then case_id
  const [rows] = await conn.query(`
    SELECT c.case_id, c.title, c.description, c.objectives, c.sql_type, c.difficulty_id,
           d.difficulty_name, c.base_points, c.correct_query, c.expected_result_sql, c.setup_sql
    FROM cases c
    JOIN difficulty d ON c.difficulty_id = d.difficulty_id
    WHERE c.is_active = 1 AND c.mode = 'Practice'
    ORDER BY FIELD(c.sql_type, 'DQL', 'DML', 'DDL'), c.difficulty_id, c.case_id
  `);

  console.log(`Loaded ${rows.length} practice cases from database.`);

  const diffLabels = { 1: 'Beginner', 2: 'Intermediate', 3: 'Expert' };
  const diffColors = { 1: '#059669', 2: '#d97706', 3: '#dc2626' };
  const typeColors = { DQL: '#0284c7', DML: '#f59e0b', DDL: '#8b5cf6' };
  const typeIcons = { DQL: '🔍', DML: '📝', DDL: '🏗️' };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Detective Query - Master Practice Cases Answer Key</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.45;
      font-size: 11px;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    /* ── COVER / HEADER BANNER ── */
    .document-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 22px 24px;
      border-radius: 10px;
      margin-bottom: 20px;
      border-left: 6px solid #38bdf8;
    }
    .document-banner h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 6px 0;
      letter-spacing: -0.3px;
      color: #f8fafc;
    }
    .document-banner .subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin: 0 0 14px 0;
      line-height: 1.4;
    }
    .banner-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .meta-pill {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    /* ── QUICK SUMMARY TABLE ── */
    .toc-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 22px;
      page-break-after: always;
    }
    .toc-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 5px;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .toc-col h4 {
      margin: 0 0 6px 0;
      font-size: 11.5px;
      font-weight: 700;
      padding-bottom: 3px;
      border-bottom: 2px solid;
    }
    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 10px;
    }
    .toc-list li {
      padding: 3px 0;
      border-bottom: 1px dotted #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #334155;
    }
    .toc-list li .case-num {
      font-weight: 700;
      color: #64748b;
      margin-right: 6px;
    }

    /* ── SECTION HEADER ── */
    .category-header {
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      margin-top: 20px;
      margin-bottom: 14px;
      page-break-before: always;
      page-break-after: avoid;
    }
    .category-header:first-of-type {
      page-break-before: auto;
    }
    .category-header h2 {
      margin: 0 0 3px 0;
      font-size: 17px;
      font-weight: 800;
    }
    .category-header p {
      margin: 0;
      font-size: 11px;
      opacity: 0.95;
    }

    /* ── DIFFICULTY GROUP HEADER ── */
    .diff-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
      page-break-after: avoid;
    }
    .diff-group-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      color: #1e293b;
    }
    .diff-badge {
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* ── CASE CARD (NO CUTOFFS) ── */
    .case-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 14px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: visible !important;
    }
    .case-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .case-title-wrap {
      flex: 1;
    }
    .case-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .case-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .id-tag {
      font-size: 9.5px;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-family: Consolas, monospace;
    }

    /* Description */
    .desc-box {
      color: #334155;
      font-size: 11px;
      margin-bottom: 10px;
      line-height: 1.45;
    }
    .desc-para {
      margin: 0 0 4px 0;
    }
    .desc-list {
      margin: 4px 0 6px 16px;
      padding: 0;
    }
    .desc-list li {
      margin-bottom: 2px;
      color: #1e293b;
      font-family: Consolas, monospace;
      font-size: 10.5px;
    }

    /* Objectives Box */
    .objectives-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 3.5px solid #16a34a;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    .obj-heading {
      font-size: 9.5px;
      font-weight: 800;
      color: #15803d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .obj-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .obj-step {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 10.5px;
    }
    .step-num {
      font-size: 9px;
      font-weight: 800;
      color: #166534;
      background: #dcfce7;
      padding: 1px 5px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .step-text {
      color: #14532d;
      line-height: 1.35;
    }

    /* Code Solution Box */
    .sql-card {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 9px 12px;
      margin-top: 8px;
      overflow: visible !important;
    }
    .sql-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sql-label {
      font-size: 9px;
      font-weight: 800;
      color: #4ade80;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sql-tag {
      font-size: 8.5px;
      font-weight: 700;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.08);
      padding: 1px 6px;
      border-radius: 3px;
    }
    .sql-code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 10.5px;
      color: #38bdf8;
      line-height: 1.45;
      margin: 0;
      white-space: pre-wrap !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
    }

    /* Expected Result Box */
    .expected-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #64748b;
      border-radius: 4px;
      padding: 6px 10px;
      margin-top: 6px;
    }
    .expected-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .expected-code {
      font-family: Consolas, monospace;
      font-size: 9.5px;
      color: #1e293b;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Page footer */
    .page-footer {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>

  <!-- DOCUMENT BANNER -->
  <div class="document-banner">
    <h1>🕵️ DETECTIVE QUERY — PRACTICE CASES MASTER ANSWER KEY</h1>
    <div class="subtitle">
      Complete official solutions, step-by-step investigation objectives, and verified SQL statements for all 45 Practice Cases.
    </div>
    <div class="banner-meta">
      <span class="meta-pill">📚 45 Comprehensive Cases</span>
      <span class="meta-pill">🔍 15 DQL (Querying & Joins)</span>
      <span class="meta-pill">📝 15 DML (Inserts, Updates, Deletes)</span>
      <span class="meta-pill">🏗️ 15 DDL (Tables & Constraints)</span>
      <span class="meta-pill">⭐ 9,000 Total Practice XP</span>
    </div>
  </div>

  <!-- QUICK NAVIGATION TABLE -->
  <div class="toc-card">
    <div class="toc-title">📑 Master Case Directory &amp; Navigation</div>
    <div class="toc-grid">
      <!-- DQL Column -->
      <div class="toc-col">
        <h4 style="color: #0284c7; border-color: #0284c7;">🔍 DQL Cases (15)</h4>
        <ul class="toc-list">
          ${rows.filter(r => r.sql_type === 'DQL').map((r, i) => `
            <li>
              <span><span class="case-num">#${i + 1}</span>${escapeHtml(r.title)}</span>
              <span style="color: ${diffColors[r.difficulty_id]}; font-weight: 700;">${diffLabels[r.difficulty_id].slice(0, 3)}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- DML Column -->
      <div class="toc-col">
        <h4 style="color: #d97706; border-color: #d97706;">📝 DML Cases (15)</h4>
        <ul class="toc-list">
          ${rows.filter(r => r.sql_type === 'DML').map((r, i) => `
            <li>
              <span><span class="case-num">#${i + 16}</span>${escapeHtml(r.title)}</span>
              <span style="color: ${diffColors[r.difficulty_id]}; font-weight: 700;">${diffLabels[r.difficulty_id].slice(0, 3)}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- DDL Column -->
      <div class="toc-col">
        <h4 style="color: #8b5cf6; border-color: #8b5cf6;">🏗️ DDL Cases (15)</h4>
        <ul class="toc-list">
          ${rows.filter(r => r.sql_type === 'DDL').map((r, i) => `
            <li>
              <span><span class="case-num">#${i + 31}</span>${escapeHtml(r.title)}</span>
              <span style="color: ${diffColors[r.difficulty_id]}; font-weight: 700;">${diffLabels[r.difficulty_id].slice(0, 3)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  </div>
`;

  let currentType = '';
  let currentDiff = null;
  let globalIndex = 1;

  for (const r of rows) {
    if (r.sql_type !== currentType) {
      currentType = r.sql_type;
      const typeDesc = currentType === 'DQL'
        ? 'Data Query Language: Focuses on inspecting, filtering, grouping, aggregating, and joining police records using SELECT queries.'
        : currentType === 'DML'
        ? 'Data Manipulation Language: Focuses on modifying live case records using INSERT INTO, UPDATE SET, and DELETE operations.'
        : 'Data Definition Language: Focuses on designing database tables, defining relational foreign keys, schema constraints, and modifying columns using CREATE TABLE, ALTER TABLE, and DROP TABLE.';

      html += `
  <div class="category-header" style="background: ${typeColors[currentType]};">
    <h2>${typeIcons[currentType]} Part ${currentType === 'DQL' ? 'I' : currentType === 'DML' ? 'II' : 'III'}: ${currentType} (${currentType === 'DQL' ? 'Data Query Language' : currentType === 'DML' ? 'Data Manipulation Language' : 'Data Definition Language'})</h2>
    <p>${typeDesc}</p>
  </div>`;
      currentDiff = null;
    }

    if (r.difficulty_id !== currentDiff) {
      currentDiff = r.difficulty_id;
      html += `
  <div class="diff-group-header">
    <h3>${diffLabels[r.difficulty_id]} Difficulty (Cases ${diffLabels[r.difficulty_id] === 'Beginner' ? '1–5' : diffLabels[r.difficulty_id] === 'Intermediate' ? '6–10' : '11–15'})</h3>
    <span class="diff-badge" style="background: ${diffColors[r.difficulty_id]};">+${r.base_points} XP Awarded</span>
  </div>`;
    }

    const formattedQuery = formatSql(r.correct_query);
    const hasDiffExpected = r.expected_result_sql && r.expected_result_sql.trim() !== r.correct_query.trim();

    html += `
  <div class="case-card">
    <div class="case-top-row">
      <div class="case-title-wrap">
        <div class="case-title">Case #${globalIndex}: ${escapeHtml(r.title)}</div>
      </div>
      <div class="case-badges">
        <span class="id-tag">Case ID #${r.case_id}</span>
        <span class="diff-badge" style="background: ${diffColors[r.difficulty_id]};">${diffLabels[r.difficulty_id]}</span>
      </div>
    </div>

    <div class="desc-box">
      ${formatDescription(r.description)}
    </div>

    ${r.objectives ? `
    <div class="objectives-card">
      <div class="obj-heading">🎯 Case Objectives &amp; Required Criteria:</div>
      ${formatObjectives(r.objectives)}
    </div>` : ''}

    <div class="sql-card">
      <div class="sql-label-row">
        <span class="sql-label">✔ Official Solution Query</span>
        <span class="sql-tag">${r.sql_type}</span>
      </div>
      <pre class="sql-code">${escapeHtml(formattedQuery)}</pre>
    </div>

    ${hasDiffExpected ? `
    <div class="expected-card">
      <div class="expected-label">🔍 Backend Automated Verification Query:</div>
      <pre class="expected-code">${escapeHtml(r.expected_result_sql)}</pre>
    </div>` : ''}
  </div>`;

    globalIndex++;
  }

  html += `
  <div class="page-footer">
    Detective Query • Practice Cases Master Answer Key • Verified by Automated Evaluation Engine
  </div>
</body>
</html>`;

  const tempHtmlPath = path.resolve(__dirname, 'temp_answer_key_clean.html');
  const targetPdfPath = path.resolve(__dirname, '../../PRACTICE_CASES_ANSWER_KEY.pdf');
  const outputMdPath = path.resolve(__dirname, '../../PRACTICE_CASES_ANSWER_KEY.md');

  fs.writeFileSync(tempHtmlPath, html, 'utf-8');
  console.log(`Clean HTML generated at: ${tempHtmlPath}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cmd = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="${targetPdfPath}" "${tempHtmlPath}"`;
  console.log('Rendering PDF via Microsoft Edge...');
  execSync(cmd);

  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }

  const finalPath = targetPdfPath;
  console.log(`✅ Main PDF successfully updated: ${targetPdfPath}`);

  const pdfStats = fs.statSync(finalPath);
  console.log(`PDF Size: ${(pdfStats.size / 1024).toFixed(1)} KB`);

  // Also write the complete, clean Markdown version
  let md = `# 🕵️ Detective Query — Practice Cases Master Answer Key

> Complete official solutions, step-by-step objectives, and automated validation queries for all **45 Practice Cases** across **DQL**, **DML**, and **DDL**.

---

## 📑 Quick Navigation
- [🔍 Part I: DQL (Data Query Language)](#-part-i-dql-data-query-language)
  - [Beginner (Cases 1–5)](#dql--beginner-easy--100-xp)
  - [Intermediate (Cases 6–10)](#dql--intermediate-medium--200-xp)
  - [Expert (Cases 11–15)](#dql--expert-hard--300-xp)
- [📝 Part II: DML (Data Manipulation Language)](#-part-ii-dml-data-manipulation-language)
  - [Beginner (Cases 16–20)](#dml--beginner-easy--100-xp)
  - [Intermediate (Cases 21–25)](#dml--intermediate-medium--200-xp)
  - [Expert (Cases 26–30)](#dml--expert-hard--300-xp)
- [🏗️ Part III: DDL (Data Definition Language)](#-part-iii-ddl-data-definition-language)
  - [Beginner (Cases 31–35)](#ddl--beginner-easy--100-xp)
  - [Intermediate (Cases 36–40)](#ddl--intermediate-medium--200-xp)
  - [Expert (Cases 41–45)](#ddl--expert-hard--300-xp)

---

`;

  currentType = '';
  currentDiff = null;
  globalIndex = 1;

  for (const r of rows) {
    if (r.sql_type !== currentType) {
      currentType = r.sql_type;
      md += `\n# ${typeIcons[currentType]} Part ${currentType === 'DQL' ? 'I' : currentType === 'DML' ? 'II' : 'III'}: ${currentType} (${currentType === 'DQL' ? 'Data Query Language' : currentType === 'DML' ? 'Data Manipulation Language' : 'Data Definition Language'})\n\n`;
      currentDiff = null;
    }

    if (r.difficulty_id !== currentDiff) {
      currentDiff = r.difficulty_id;
      md += `\n## ${currentType} — ${diffLabels[r.difficulty_id]} (${diffLabels[r.difficulty_id] === 'Beginner' ? 'Cases 1–5' : diffLabels[r.difficulty_id] === 'Intermediate' ? 'Cases 6–10' : 'Cases 11–15'} • +${r.base_points} XP)\n\n`;
    }

    md += `### Case #${globalIndex}: ${r.title} (Case ID: ${r.case_id})\n\n`;
    md += `**Difficulty:** \`${diffLabels[r.difficulty_id]}\` | **Reward:** \`+${r.base_points} XP\` | **Type:** \`${r.sql_type}\`\n\n`;
    md += `**Description:**  \n${r.description}\n\n`;

    if (r.objectives) {
      md += `**🎯 Investigation Objectives:**  \n`;
      const lines = r.objectives.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const line of lines) {
        md += `- ${line}\n`;
      }
      md += `\n`;
    }

    md += `**✔ Official Solution Query:**\n\`\`\`sql\n${r.correct_query}\n\`\`\`\n\n`;

    if (r.expected_result_sql && r.expected_result_sql.trim() !== r.correct_query.trim()) {
      md += `**🔍 Automated Verification Query:**\n\`\`\`sql\n${r.expected_result_sql}\n\`\`\`\n\n`;
    }

    md += `---\n\n`;
    globalIndex++;
  }

  fs.writeFileSync(outputMdPath, md, 'utf-8');
  console.log(`✅ Markdown successfully updated: ${outputMdPath}`);

  await conn.end();
  console.log('Done!');
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
