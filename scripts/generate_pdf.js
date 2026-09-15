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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const SUSPECT_INTEL = {
  30029: {
    suspect: 'George Ramos (Janitor, ID #7) & Oscar Villanueva (Staff, ID #15)',
    clue: 'Initial roster scan reveals 15 individuals on campus. Objective 3 isolates staff/janitorial staff with criminal records (criminal_record = 1). George Ramos and Oscar Villanueva emerge as top persons of interest with physical key access.'
  },
  30030: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Filtering all persons where criminal_record = 1 returns 5 individuals. Objective 3 filters by role = "Janitor", isolating George Ramos as the ONLY janitorial worker on campus with a prior record and access to master storage keys.'
  },
  30031: {
    suspect: 'Ethan Cruz (Student, ID #5) & Lara Flores (Student, ID #12)',
    clue: 'Objective 3 filters students under age 25 with criminal records, isolating Ethan Cruz (Lab Equipment Theft suspect) and Lara Flores (Library Data Leak suspect). Confirms youth suspects for separate crime scenes.'
  },
  30032: {
    suspect: 'Carlos Mendoza (Security Guard, ID #3)',
    clue: 'Two guards are on campus, but Objective 3 exposes Carlos Mendoza as having a prior criminal record (criminal_record = 1), making him a potential accomplice or person of interest.'
  },
  30033: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Forensics classifies severity 5 as critical evidence. Objective 3 filters severity 5 evidence at the Warehouse (place_id = 5), revealing item #7 (Security Footage) directly linked to person_id = 7 (George Ramos)!'
  },
  30034: {
    suspect: 'Warehouse Break-in Scene (Prime Target: George Ramos)',
    clue: 'Counting evidence per location proves place_id 5 (Warehouse) holds the highest concentration of evidence (3+ items). Confirms the Warehouse as the primary crime scene where George Ramos was stationed.'
  },
  30035: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Objective 3 inspects visitors entering the Warehouse before 10:00 AM. George Ramos logged entry at 09:50:00 — well ahead of the 10:30 AM break-in — placing him alone inside the facility.'
  },
  30036: {
    suspect: 'Warehouse Break-in (Prime Target: George Ramos)',
    clue: 'Summarizing all campus crimes confirms the Warehouse Break-in occurred at 10:30 AM in Restricted storage (place_id = 5). Cross-referencing timestamps matches George Ramos\'s presence.'
  },
  30037: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Objective 3 cross-references suspects with criminal records against Warehouse-specific evidence. George Ramos is the ONLY flagged individual with multiple evidence pieces inside the Warehouse.'
  },
  30038: {
    suspect: 'Mark Dela Cruz (Guard, ID #13 - Alibi Witness)',
    clue: 'Objective 3 identifies Mark Dela Cruz — a security guard over 30 with a completely clean criminal record (criminal_record = 0). He serves as the primary credible eyewitness against George Ramos.'
  },
  30039: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Objective 3 isolates visitors present at the Warehouse before the break-in timestamp (10:30 AM) who also hold prior criminal records. Conclusively returns George Ramos (entered 09:50 AM)!'
  },
  30040: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Objective 3 pinpoints the maximum severity (5) evidence found at the Warehouse crime scene. Exposes Security Footage showing George Ramos disabling the alarm.'
  },
  30041: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Objective 3 filters non-security personnel with criminal records who trespassed in Restricted zones. George Ramos is the only janitor caught trespassing in restricted warehouse inventory.'
  },
  30042: {
    suspect: 'George Ramos (Janitor, ID #7)',
    clue: 'Objective 3 groups evidence by person_id for flagged offenders where place_id = 5. George Ramos has multiple pieces of forensic evidence recovered directly from the crime scene.'
  },
  30043: {
    suspect: '⚖️ FINAL VERDICT: GEORGE RAMOS (Janitor, ID #7)',
    clue: 'Objective 3 identifies persons with prior records caught inside the Warehouse within the 1-hour critical window before the crime. IRREFUTABLE PROOF: George Ramos is the perpetrator of the Warehouse Break-in!'
  }
};

async function main() {
  const conn = await mysql.createConnection(TIDB);
  console.log('Connected to TiDB...');

  // 1. Fetch cases
  const [rows] = await conn.query(`
    SELECT c.case_id, c.title, c.description, c.objectives, c.sql_type, c.difficulty_id,
           d.difficulty_name, c.base_points, c.correct_query, c.expected_result_sql
    FROM cases c
    JOIN difficulty d ON c.difficulty_id = d.difficulty_id
    WHERE c.is_active = 1 AND c.mode = 'Practice'
    ORDER BY FIELD(c.sql_type, 'DQL', 'DML', 'DDL'), c.difficulty_id, c.case_id
  `);

  // 2. Fetch all case_objectives
  const [coRows] = await conn.query(`
    SELECT case_id, objective_order, objective_text, expected_query, points
    FROM case_objectives
    ORDER BY case_id, objective_order
  `);

  const objectivesByCase = {};
  for (const obj of coRows) {
    if (!objectivesByCase[obj.case_id]) objectivesByCase[obj.case_id] = [];
    objectivesByCase[obj.case_id].push(obj);
  }

  const diffLabels = { 1: 'Beginner (Easy)', 2: 'Intermediate (Medium)', 3: 'Expert (Hard)' };
  const diffColors = { 1: '#16a34a', 2: '#d97706', 3: '#dc2626' };
  const typeColors = { DQL: '#0284c7', DML: '#d97706', DDL: '#7c3aed' };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Detective Query - Master Answer Key</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.45;
      font-size: 12.5px;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .cover {
      text-align: center;
      padding: 24px 10px 18px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .cover h1 {
      font-size: 24px;
      margin: 0 0 6px 0;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .cover .subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 10px 0;
    }
    .cover .meta {
      display: inline-flex;
      gap: 10px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      background: #f1f5f9;
      padding: 5px 12px;
      border-radius: 20px;
    }
    .section-header {
      color: white;
      padding: 10px 14px;
      border-radius: 6px;
      margin-top: 24px;
      margin-bottom: 14px;
      page-break-after: avoid;
    }
    .section-header h2 {
      margin: 0 0 2px 0;
      font-size: 16px;
    }
    .section-header p {
      margin: 0;
      font-size: 11px;
      opacity: 0.9;
    }
    .diff-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    .diff-group-header h3 {
      margin: 0;
      font-size: 13.5px;
      color: #0f172a;
    }
    .diff-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fff;
    }
    .case-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 14px;
      background: #ffffff;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .case-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .case-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .case-id-tag {
      font-size: 10px;
      color: #64748b;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
      font-family: monospace;
    }
    .case-desc {
      color: #475569;
      font-size: 11.5px;
      margin: 0 0 8px 0;
      line-height: 1.4;
    }
    .objectives-box {
      background: #f8fafc;
      border-left: 3px solid #3b82f6;
      border-radius: 0 4px 4px 0;
      padding: 8px 10px;
      margin-bottom: 8px;
    }
    .objectives-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #1d4ed8;
      margin-bottom: 6px;
    }
    .obj-item {
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .obj-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .obj-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      font-size: 11px;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .obj-pts {
      color: #0284c7;
      font-size: 10px;
      font-weight: 700;
    }
    .obj-query {
      background: #f1f5f9;
      color: #0f172a;
      padding: 3px 6px;
      border-radius: 3px;
      font-family: "Consolas", monospace;
      font-size: 10px;
      word-break: break-all;
      margin-top: 2px;
      display: block;
    }
    .suspect-box {
      background: #fef2f2;
      border-left: 3px solid #ef4444;
      border-radius: 0 4px 4px 0;
      padding: 8px 10px;
      margin-bottom: 8px;
      font-size: 11px;
    }
    .suspect-header {
      font-weight: 700;
      color: #991b1b;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .suspect-name {
      font-weight: 700;
      color: #b91c1c;
    }
    .suspect-desc {
      color: #450a0a;
      margin-top: 2px;
      line-height: 1.35;
    }
    .sql-box {
      background: #0f172a;
      color: #f8fafc;
      border-radius: 5px;
      padding: 8px 12px;
      font-family: "Consolas", monospace;
      font-size: 11px;
      line-height: 1.4;
      overflow-x: auto;
      margin-top: 6px;
    }
    .sql-box .sql-label {
      color: #94a3b8;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
      display: block;
      font-family: sans-serif;
      font-weight: 700;
    }
    .sql-box code {
      color: #38bdf8;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>

  <div class="cover">
    <h1>🕵️ DETECTIVE QUERY — MASTER ANSWER KEY</h1>
    <p class="subtitle">Complete Official Solutions, 3-Tier Objectives &amp; Suspect Pinpointing for All 45 Cases</p>
    <div class="meta">
      <span>📚 45 TOTAL CASES</span>
      <span>•</span>
      <span>🎯 3 OBJECTIVES PER DQL CASE</span>
      <span>•</span>
      <span>🕵️ SUSPECT PINPOINT INCLUDED</span>
      <span>•</span>
      <span>⭐ 5,000+ XP AVAILABLE</span>
    </div>
  </div>
`;

  let currentType = '';
  let currentDiff = null;
  let caseIndex = 1;

  for (const r of rows) {
    if (r.sql_type !== currentType) {
      currentType = r.sql_type;
      const typeDesc = currentType === 'DQL'
        ? 'Querying, filtering, aggregating, and joining forensic database tables using SELECT.'
        : currentType === 'DML'
        ? 'Manipulating crime data in real-time using INSERT, UPDATE, and DELETE operations.'
        : 'Designing, altering, and dropping table structures and relational schemas using CREATE, ALTER, and DROP.';

      html += `
  <div class="section-header" style="background: ${typeColors[currentType]};">
    <h2>${currentType} — ${currentType === 'DQL' ? 'Data Query Language' : currentType === 'DML' ? 'Data Manipulation Language' : 'Data Definition Language'}</h2>
    <p>${typeDesc}</p>
  </div>`;
      currentDiff = null;
    }

    if (r.difficulty_id !== currentDiff) {
      currentDiff = r.difficulty_id;
      html += `
  <div class="diff-group-header">
    <h3>${diffLabels[r.difficulty_id]} Tier</h3>
    <span class="diff-badge" style="background: ${diffColors[r.difficulty_id]};">+${r.base_points} XP</span>
  </div>`;
    }

    const caseObjs = objectivesByCase[r.case_id] || [];
    const suspectInfo = SUSPECT_INTEL[r.case_id];

    html += `
  <div class="case-card">
    <div class="case-header">
      <div class="case-title">Case #${caseIndex}: ${escapeHtml(r.title)} <span class="case-id-tag">ID #${r.case_id}</span></div>
      <span class="diff-badge" style="background: ${diffColors[r.difficulty_id]}; font-size: 9px;">${r.difficulty_name}</span>
    </div>
    <div class="case-desc">${escapeHtml(r.description)}</div>

    ${caseObjs.length > 0 ? `
    <div class="objectives-box">
      <div class="objectives-title">🎯 Investigation Objectives (${caseObjs.length} Steps)</div>
      ${caseObjs.map(obj => `
        <div class="obj-item">
          <div class="obj-header">
            <span>[Step ${obj.objective_order}] ${escapeHtml(obj.objective_text)}</span>
            <span class="obj-pts">+${obj.points} XP</span>
          </div>
          <span class="obj-query">Expected Query: ${escapeHtml(obj.expected_query)}</span>
        </div>
      `).join('')}
    </div>` : ''}

    ${suspectInfo ? `
    <div class="suspect-box">
      <div class="suspect-header">🕵️ Main Suspect Pinpoint &amp; Verdict Clue</div>
      <div class="suspect-name">${escapeHtml(suspectInfo.suspect)}</div>
      <div class="suspect-desc">${escapeHtml(suspectInfo.clue)}</div>
    </div>` : ''}

    <div class="sql-box">
      <span class="sql-label">✔ Final Solution Query</span>
      <code>${escapeHtml(r.correct_query)}</code>
    </div>
  </div>`;

    caseIndex++;
  }

  html += `
</body>
</html>`;

  const tempHtmlPath = path.resolve(__dirname, 'temp_answer_key.html');
  const outputPdfPath = path.resolve(__dirname, '../../PRACTICE_CASES_ANSWER_KEY.pdf');
  const outputMdPath = path.resolve(__dirname, '../../PRACTICE_CASES_ANSWER_KEY.md');

  // 3. Write HTML and generate PDF
  fs.writeFileSync(tempHtmlPath, html, 'utf-8');
  console.log(`HTML generated at ${tempHtmlPath}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${outputPdfPath}" "${tempHtmlPath}"`;
  console.log('Generating PDF via Microsoft Edge...');
  execSync(cmd);

  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }

  const stats = fs.statSync(outputPdfPath);
  console.log(`🎉 Successfully updated PDF: ${outputPdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  // 4. Also generate updated Markdown version
  let md = `# 🕵️ Detective Query — Master Answer Key (Updated)

> Complete official solutions, **3-Tier Progressive Objectives**, and **Suspect Pinpointing** for all **45 Practice Cases** across **DQL**, **DML**, and **DDL**.

---

`;

  currentType = '';
  currentDiff = null;
  caseIndex = 1;

  for (const r of rows) {
    if (r.sql_type !== currentType) {
      currentType = r.sql_type;
      md += `\n## 📁 ${currentType} (${currentType === 'DQL' ? 'Data Query Language' : currentType === 'DML' ? 'Data Manipulation Language' : 'Data Definition Language'})\n\n`;
      currentDiff = null;
    }

    if (r.difficulty_id !== currentDiff) {
      currentDiff = r.difficulty_id;
      md += `\n### ${currentType} — ${diffLabels[r.difficulty_id]} (+${r.base_points} XP)\n\n`;
    }

    const caseObjs = objectivesByCase[r.case_id] || [];
    const suspectInfo = SUSPECT_INTEL[r.case_id];

    md += `#### Case #${caseIndex}: ${r.title} (Case ID: ${r.case_id})\n\n`;
    md += `**Description:**  \n${r.description}\n\n`;

    if (caseObjs.length > 0) {
      md += `**🎯 Progressive Objectives:**  \n`;
      for (const obj of caseObjs) {
        md += `- **Step ${obj.objective_order} (+${obj.points} XP):** ${obj.objective_text}  \n`;
        md += `  \`\`\`sql\n  ${obj.expected_query}\n  \`\`\`\n`;
      }
      md += `\n`;
    }

    if (suspectInfo) {
      md += `**🕵️ Prime Suspect Pinpoint:**  \n`;
      md += `> **Suspect:** ${suspectInfo.suspect}  \n`;
      md += `> **Clue:** ${suspectInfo.clue}\n\n`;
    }

    md += `**✔ Final Solution SQL:**\n\`\`\`sql\n${r.correct_query}\n\`\`\`\n\n---\n\n`;
    caseIndex++;
  }

  fs.writeFileSync(outputMdPath, md, 'utf-8');
  console.log(`🎉 Successfully updated Markdown: ${outputMdPath}`);

  await conn.end();
}

main().catch(err => {
  console.error('Error generating answer keys:', err);
  process.exit(1);
});
