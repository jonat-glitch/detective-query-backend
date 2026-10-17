const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
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
  if (clean.includes(';')) {
    const parts = clean
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    return parts.join(';\n\n') + ';';
  }
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

function formatObjectivesText(objText) {
  if (!objText) return '';
  const lines = objText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let html = '<div class="obj-list">';
  lines.forEach((line, idx) => {
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

const rankDetectiveNotes = {
  60104: {
    suspect_id: 4,
    name: 'Diana Cruz',
    role: 'Detained Syndicate Operative',
    finding: 'Diana Cruz was apprehended fleeing the perimeter fence with an encrypted radio transceiver. The query filter `WHERE status = \'Arrested\'` isolates her as the only operative currently in physical precinct custody.'
  },
  60105: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind / Procurement Lead',
    finding: 'Recovered high-severity evidence items (severity >= 4, including the EMP Device and Laser Cutter) were traced to corporate bank accounts and front companies controlled directly by Marcus Webb.'
  },
  60106: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Active crime scene perimeters established at City Hall and Central Warehouse enclose the primary coordinated infiltration vector orchestrated by Marcus Webb.'
  },
  60107: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Civilian witness testimonies provide matching physical descriptions of a tall male in a dark coat fleeing the municipal substation in a black luxury sedan registered to Webb.'
  },
  60108: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Senior detectives on the active duty roster were specifically assigned to prepare and lead the federal interrogation of Marcus Webb.'
  },
  60109: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Evidence aggregation confirms a critical cluster of contraband at Central Warehouse, establishing it as Marcus Webb\'s covert weapons depot.'
  },
  60110: {
    suspect_id: 2,
    name: 'Lena Torres',
    role: 'Youth Syndicate Infiltrator',
    finding: 'Surveillance footage captured an agile operative scaling the municipal fire escape ladder. Filtering `WHERE age < 30` identifies Lena Torres (Age 28) as the prime agile infiltrator.'
  },
  60111: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Maximum severity rating analysis (MAX(severity) = 5) identifies the military-grade EMP device recovered at the power substation, requisitioned under Marcus Webb\'s forged municipal contractor credentials.'
  },
  60112: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'The executive custody status breakdown proves Marcus Webb remains the active ringleader operating while still under open investigation.'
  },
  60113: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Forensic lab prioritization places the customized laser cutter and decrypted flash drive at the top of the queue, both holding Webb\'s biometric touch DNA.'
  },
  60114: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Outer join confirms Harbor Pier is a cold scene with zero evidence, corroborating Ethan Ford\'s alibi and refocusing full prosecutorial resources on Marcus Webb.'
  },
  60115: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'The HAVING clause isolates Central Warehouse as the sole hot zone holding multiple high-threat items, leased under Marcus Webb\'s corporate front.'
  },
  60116: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'Central Warehouse is conclusively isolated as the #1 epicentre of the syndicate\'s conspiracy with the highest evidence count, confirming it as Webb\'s primary base of operations.'
  },
  60117: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind',
    finding: 'The unified UNION report combines the suspect roster and evidence catalog into an ironclad District Attorney indictment packet against Marcus Webb.'
  },
  60118: {
    suspect_id: 1,
    name: 'Marcus Webb',
    role: 'Syndicate Mastermind (Convicted)',
    finding: 'The final join cross-matching high-severity contraband with active operational zones establishes conclusive probable cause, securing the federal warrant and arrest of Marcus Webb.'
  }
};

async function main() {
  console.log('Connecting to TiDB database for Rank Mode Cases...');
  const conn = await mysql.createConnection({ ...TIDB, database: 'detective_query' });

  // 1. Fetch suspects table from playgroundDB
  const pConn = await mysql.createConnection({ ...TIDB, database: 'detective_query_playground' });
  const [suspectsList] = await pConn.query('SELECT suspect_id, name, age, status FROM suspects');
  await pConn.end();

  const suspectMap = {};
  suspectsList.forEach(s => { suspectMap[s.suspect_id] = s; });

  // 2. Fetch all case objectives with expected queries
  const [allObjectives] = await conn.query(`
    SELECT objective_id, case_id, objective_order, objective_text, expected_query, points
    FROM case_objectives
    ORDER BY case_id, objective_order
  `);

  const caseObjectivesMap = {};
  allObjectives.forEach(obj => {
    if (!caseObjectivesMap[obj.case_id]) {
      caseObjectivesMap[obj.case_id] = [];
    }
    caseObjectivesMap[obj.case_id].push(obj);
  });

  // 3. Fetch all 45 Rank mode cases ordered logically: DQL -> DML -> DDL, then by difficulty (1,2,3), then case_id
  const [rows] = await conn.query(`
    SELECT c.case_id, c.title, c.description, c.objectives, c.sql_type, c.difficulty_id,
           d.difficulty_name, c.base_points, c.correct_query, c.expected_result_sql, c.setup_sql, c.correct_suspect_id
    FROM cases c
    JOIN difficulty d ON c.difficulty_id = d.difficulty_id
    WHERE c.is_active = 1 AND c.mode = 'Rank'
    ORDER BY FIELD(c.sql_type, 'DQL', 'DML', 'DDL'), c.difficulty_id, c.case_id
  `);

  console.log(`Loaded ${rows.length} Rank cases from database.`);

  const diffLabels = { 1: 'Beginner', 2: 'Intermediate', 3: 'Expert' };
  const diffColors = { 1: '#059669', 2: '#d97706', 3: '#dc2626' };
  const typeColors = { DQL: '#0284c7', DML: '#f59e0b', DDL: '#8b5cf6' };
  const typeIcons = { DQL: '🔍', DML: '📝', DDL: '🏗️' };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Detective Query - Rank Mode Cases Master Answer Key</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.4;
      font-size: 10.5px;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    /* ── COVER / HEADER BANNER ── */
    .document-banner {
      background: linear-gradient(135deg, #090d16 0%, #1e1b4b 100%);
      color: #ffffff;
      padding: 20px 22px;
      border-radius: 10px;
      margin-bottom: 16px;
      border-left: 6px solid #818cf8;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }
    .document-banner h1 {
      font-size: 21px;
      font-weight: 800;
      margin: 0 0 5px 0;
      letter-spacing: -0.3px;
      color: #f8fafc;
    }
    .document-banner .subtitle {
      font-size: 11.5px;
      color: #cbd5e1;
      margin: 0 0 12px 0;
      line-height: 1.4;
    }
    .banner-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .meta-pill {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #e0e7ff;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 9.5px;
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
      padding: 12px 16px;
      margin-bottom: 20px;
      page-break-after: avoid;
    }
    .toc-title {
      font-size: 12px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .toc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .toc-table th {
      background: #e2e8f0;
      color: #334155;
      text-align: left;
      padding: 5px 8px;
      font-weight: 700;
      border: 1px solid #cbd5e1;
    }
    .toc-table td {
      padding: 4px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    .toc-table tr:nth-child(even) td {
      background: #f1f5f9;
    }

    /* ── CATEGORY SECTION HEADER ── */
    .category-header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 18px;
      margin-bottom: 12px;
      page-break-before: always;
      page-break-after: avoid;
    }
    .category-header:first-of-type {
      page-break-before: auto;
    }
    .category-header h2 {
      margin: 0 0 3px 0;
      font-size: 16px;
      font-weight: 800;
    }
    .category-header p {
      margin: 0;
      font-size: 10.5px;
      opacity: 0.95;
    }

    /* ── DIFFICULTY GROUP HEADER ── */
    .diff-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
      page-break-after: avoid;
    }
    .diff-group-header h3 {
      margin: 0;
      font-size: 12.5px;
      font-weight: 800;
      color: #1e293b;
    }
    .diff-badge {
      font-size: 9px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* ── CASE CARD ── */
    .case-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .case-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .case-title-wrap {
      flex: 1;
    }
    .case-title {
      font-size: 13px;
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
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-family: Consolas, monospace;
    }

    /* Description */
    .desc-box {
      color: #334155;
      font-size: 10.5px;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .desc-para {
      margin: 0 0 4px 0;
    }
    .desc-list {
      margin: 4px 0 6px 14px;
      padding: 0;
    }
    .desc-list li {
      margin-bottom: 2px;
      color: #1e293b;
      font-family: Consolas, monospace;
      font-size: 10px;
    }

    /* Step Container */
    .steps-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
      margin-bottom: 8px;
    }
    .step-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3.5px solid #0284c7;
      border-radius: 5px;
      padding: 7px 10px;
    }
    .step-card.final-step {
      border-left-color: #10b981;
      background: #f0fdf4;
    }
    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }
    .step-badge {
      font-size: 9px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .step-card.final-step .step-badge {
      color: #047857;
    }
    .step-xp {
      font-size: 8.5px;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 1px 5px;
      border-radius: 3px;
    }
    .step-card.final-step .step-xp {
      background: #d1fae5;
      color: #065f46;
    }
    .step-instruction {
      font-size: 10px;
      color: #334155;
      margin-bottom: 5px;
      line-height: 1.35;
    }

    /* Code Solution Box */
    .sql-card {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 4px;
      padding: 7px 9px;
      margin-top: 4px;
    }
    .sql-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
      padding-bottom: 2px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sql-label {
      font-size: 8.5px;
      font-weight: 800;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .step-card.final-step .sql-label {
      color: #4ade80;
    }
    .sql-tag {
      font-size: 8px;
      font-weight: 700;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.08);
      padding: 1px 5px;
      border-radius: 3px;
    }
    .sql-code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 10px;
      color: #38bdf8;
      line-height: 1.4;
      margin: 0;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    .step-card.final-step .sql-code {
      color: #86efac;
    }

    /* Suspect / Verdict Card */
    .verdict-card {
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      border: 1.5px solid #6366f1;
      border-radius: 6px;
      padding: 9px 12px;
      margin-top: 8px;
      color: #ffffff;
    }
    .verdict-tag {
      font-size: 8.5px;
      font-weight: 800;
      color: #a5b4fc;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .suspect-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .suspect-name-row {
      font-size: 12px;
      font-weight: 800;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .suspect-id-pill {
      font-size: 8.5px;
      font-weight: 800;
      background: #4338ca;
      color: #e0e7ff;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .suspect-meta-row {
      font-size: 9.5px;
      color: #cbd5e1;
      margin-top: 1px;
    }
    .suspect-meta-tag {
      font-weight: 700;
      color: #fbbf24;
    }
    .suspect-lore {
      font-size: 9.5px;
      color: #e2e8f0;
      margin-top: 4px;
      line-height: 1.35;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 4px;
    }

    /* Objectives Box for DDL/DML */
    .objectives-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 3.5px solid #16a34a;
      border-radius: 4px;
      padding: 7px 10px;
      margin-bottom: 8px;
    }
    .obj-heading {
      font-size: 9px;
      font-weight: 800;
      color: #15803d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .obj-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .obj-step {
      display: flex;
      align-items: baseline;
      gap: 5px;
      font-size: 10px;
    }
    .step-num {
      font-size: 8.5px;
      font-weight: 800;
      color: #166534;
      background: #dcfce7;
      padding: 1px 4px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .step-text {
      color: #14532d;
      line-height: 1.3;
    }

    /* Expected Result Box */
    .expected-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #64748b;
      border-radius: 4px;
      padding: 5px 8px;
      margin-top: 5px;
    }
    .expected-label {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .expected-code {
      font-family: Consolas, monospace;
      font-size: 9.5px;
      color: #334155;
      margin: 0;
      white-space: pre-wrap;
    }

    .page-footer {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>

  <!-- BANNER -->
  <div class="document-banner">
    <h1>🏆 Detective Query — Rank Mode Master Answer Key</h1>
    <div class="subtitle">Official Faculty &amp; Evaluator Dossier • Complete Step-by-Step Progressive Objective Queries &amp; Phase 3 Accused Suspect Verdicts across all 45 Rank Cases</div>
    <div class="banner-meta">
      <span class="meta-pill">📁 45 Total Cases (15 DQL • 15 DML • 15 DDL)</span>
      <span class="meta-pill">🎯 3 Progressive Step Queries per Case</span>
      <span class="meta-pill">⚖️ Complete Phase 3 Accused Suspect Dossiers</span>
      <span class="meta-pill">⚡ TiDB Cloud Production Verified</span>
    </div>
  </div>

  <!-- TOC -->
  <div class="toc-card">
    <div class="toc-title">📋 Curriculum &amp; Category Breakdown</div>
    <table class="toc-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Case Numbers</th>
          <th>Difficulty Distribution</th>
          <th>Points / Case</th>
          <th>Phase 3 Target / Verification</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>🔍 Part I: DQL (Data Query Language)</strong></td>
          <td>Cases #1 – #15 (IDs: 60104–60118)</td>
          <td>Beginner (1–5), Intermediate (6–10), Expert (11–15)</td>
          <td>100 XP / 200 XP / 300 XP</td>
          <td>3 Progressive Steps + Suspect Accusation</td>
        </tr>
        <tr>
          <td><strong>📝 Part II: DML (Data Manipulation Language)</strong></td>
          <td>Cases #16 – #30 (IDs: 60089–60103)</td>
          <td>Beginner (16–20), Intermediate (21–25), Expert (26–30)</td>
          <td>100 XP / 200 XP / 300 XP</td>
          <td>Intelligence Ingestion &amp; Row Verification</td>
        </tr>
        <tr>
          <td><strong>🏗️ Part III: DDL (Data Definition Language)</strong></td>
          <td>Cases #31 – #45 (IDs: 60074–60088)</td>
          <td>Beginner (31–35), Intermediate (36–40), Expert (41–45)</td>
          <td>100 XP / 200 XP / 300 XP</td>
          <td>Schema Setup &amp; Constraint Deployment</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

  let currentType = '';
  let currentDiff = null;
  let globalIndex = 1;

  for (const r of rows) {
    if (r.sql_type !== currentType) {
      currentType = r.sql_type;
      html += `
  <div class="category-header">
    <h2>${typeIcons[currentType]} Part ${currentType === 'DQL' ? 'I' : currentType === 'DML' ? 'II' : 'III'}: ${currentType} (${currentType === 'DQL' ? 'Data Query Language' : currentType === 'DML' ? 'Data Manipulation Language' : 'Data Definition Language'})</h2>
    <p>${currentType === 'DQL' ? 'Act III: The Tribunal Evidence Trial — Step-by-step query forensics isolating the true culprit.' : currentType === 'DML' ? 'Act II: Forensic Intelligence Ingestion — Data modifications and activity logging.' : 'Act I: Rebuilding the Compromised Grid — Schema infrastructure, constraints, and audit tables.'}</p>
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

    const caseObjs = caseObjectivesMap[r.case_id] || [];
    const hasProgressiveObjs = caseObjs.length > 0;
    const suspectInfo = rankDetectiveNotes[r.case_id] || (r.correct_suspect_id && suspectMap[r.correct_suspect_id] ? {
      suspect_id: r.correct_suspect_id,
      name: suspectMap[r.correct_suspect_id].name,
      role: 'Prime Person of Interest',
      finding: `Identified through relational forensics as suspect #${r.correct_suspect_id}.`
    } : null);

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
    </div>`;

    if (hasProgressiveObjs) {
      html += `
    <!-- 3 STEP-BY-STEP PROGRESSIVE OBJECTIVES & QUERIES -->
    <div class="steps-container">`;
      caseObjs.forEach((obj, idx) => {
        const isFinal = idx === caseObjs.length - 1;
        html += `
      <div class="step-card ${isFinal ? 'final-step' : ''}">
        <div class="step-header">
          <span class="step-badge">${isFinal ? '🎯 Step 3 (Final Target Solution)' : `🎯 Step ${idx + 1}`}</span>
          <span class="step-xp">+${obj.points} XP</span>
        </div>
        <div class="step-instruction">${escapeHtml(obj.objective_text)}</div>
        <div class="sql-card">
          <div class="sql-label-row">
            <span class="sql-label">✔ Expected SQL Query ${isFinal ? '(Final Indictment Query)' : `(Step ${idx + 1})`}</span>
            <span class="sql-tag">${r.sql_type}</span>
          </div>
          <pre class="sql-code">${escapeHtml(formatSql(obj.expected_query))}</pre>
        </div>
      </div>`;
      });
      html += `
    </div>`;
    } else {
      // DDL / DML Cases
      if (r.objectives) {
        html += `
    <div class="objectives-card">
      <div class="obj-heading">🎯 Case Objectives &amp; Required Criteria:</div>
      ${formatObjectivesText(r.objectives)}
    </div>`;
      }

      html += `
    <div class="sql-card">
      <div class="sql-label-row">
        <span class="sql-label">✔ Official Solution Query</span>
        <span class="sql-tag">${r.sql_type}</span>
      </div>
      <pre class="sql-code">${escapeHtml(formattedQuery)}</pre>
    </div>`;
    }

    if (hasDiffExpected) {
      html += `
    <div class="expected-card">
      <div class="expected-label">🔍 Backend Automated Verification Query:</div>
      <pre class="expected-code">${escapeHtml(r.expected_result_sql)}</pre>
    </div>`;
    }

    // ⚖️ PHASE 3 VERDICT / SUSPECT ACCUSATION
    if (suspectInfo) {
      const pSuspect = suspectMap[suspectInfo.suspect_id] || {};
      html += `
    <div class="verdict-card">
      <div class="verdict-tag">⚖️ Phase 3 Verdict • Accused Suspect</div>
      <div class="suspect-details">
        <div class="suspect-name-row">
          <span>👤 Accused: <strong>${escapeHtml(suspectInfo.name)}</strong></span>
          <span class="suspect-id-pill">Suspect ID #${suspectInfo.suspect_id}</span>
        </div>
        <div class="suspect-meta-row">
          <span>Role: <span class="suspect-meta-tag">${escapeHtml(suspectInfo.role)}</span></span> &bull; 
          <span>Status: <strong>${escapeHtml(pSuspect.status || 'Under Investigation')}</strong></span> &bull; 
          <span>Age: <strong>${pSuspect.age || 'Unknown'}</strong></span>
        </div>
        <div class="suspect-lore">
          🔍 <strong>Detective Finding:</strong> ${escapeHtml(suspectInfo.finding)}
        </div>
      </div>
    </div>`;
    } else if (r.sql_type !== 'DQL') {
      html += `
    <div class="verdict-card" style="border-color: #059669; background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);">
      <div class="verdict-tag" style="color: #6ee7b7;">⚖️ Phase 3 Case Outcome • Infrastructure Status</div>
      <div class="suspect-details">
        <div class="suspect-name-row">
          <span>🏗️ Status: <strong>${r.sql_type === 'DDL' ? 'Relational Schema Deployed & Constraints Enforced' : 'Intelligence Records Ingested & Synchronized'}</strong></span>
        </div>
        <div class="suspect-lore">
          🛡️ <strong>Investigation Impact:</strong> ${r.sql_type === 'DDL' ? 'Precinct tables are created with strict primary/foreign key integrity, providing a bulletproof database structure for high-profile cyber forensics.' : 'Evidence manifests, dispatch logs, and suspect records are accurately populated, eliminating forensic data gaps.'}
        </div>
      </div>
    </div>`;
    }

    html += `
  </div>`;

    globalIndex++;
  }

  html += `
  <div class="page-footer">
    Detective Query • Rank Mode Master Answer Key • Verified by Automated Evaluation Engine
  </div>
</body>
</html>`;

  const tempHtmlPath = path.resolve(__dirname, 'temp_rank_answer_key_clean.html');
  const targetPdfPath = path.resolve(__dirname, '../../RANK_CASES_ANSWER_KEY.pdf');
  const outputMdPath = path.resolve(__dirname, '../../RANK_CASES_ANSWER_KEY.md');

  fs.writeFileSync(tempHtmlPath, html, 'utf-8');
  console.log(`Clean HTML generated at: ${tempHtmlPath}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cmd = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf="${targetPdfPath}" "${tempHtmlPath}"`;
  console.log('Rendering PDF via Microsoft Edge...');
  execSync(cmd);

  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }

  const pdfStats = fs.statSync(targetPdfPath);
  console.log(`✅ Rank PDF successfully generated: ${targetPdfPath} (${(pdfStats.size / 1024).toFixed(1)} KB)`);

  // Write Markdown version for Rank Mode cases
  let md = `# 🏆 Detective Query — Rank Mode Master Answer Key

> Complete official solutions, 3 step-by-step progressive objective queries, and Phase 3 accused suspect dossiers for all **45 Rank Mode Cases** across **DQL**, **DML**, and **DDL**.

---

## 📑 Quick Navigation
- [🔍 Part I: DQL (Data Query Language)](#-part-i-dql-data-query-language)
  - [Beginner (Cases 1–5)](#dql--beginner-cases-15--100-xp)
  - [Intermediate (Cases 6–10)](#dql--intermediate-cases-610--200-xp)
  - [Expert (Cases 11–15)](#dql--expert-cases-1115--300-xp)
- [📝 Part II: DML (Data Manipulation Language)](#-part-ii-dml-data-manipulation-language)
  - [Beginner (Cases 16–20)](#dml--beginner-cases-1620--100-xp)
  - [Intermediate (Cases 21–25)](#dml--intermediate-cases-2125--200-xp)
  - [Expert (Cases 26–30)](#dml--expert-cases-2630--300-xp)
- [🏗️ Part III: DDL (Data Definition Language)](#-part-iii-ddl-data-definition-language)
  - [Beginner (Cases 31–35)](#ddl--beginner-cases-3135--100-xp)
  - [Intermediate (Cases 36–40)](#ddl--intermediate-cases-3640--200-xp)
  - [Expert (Cases 41–45)](#ddl--expert-cases-4145--300-xp)

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
      md += `## ${currentType} — ${diffLabels[r.difficulty_id]} (Cases ${diffLabels[r.difficulty_id] === 'Beginner' ? (currentType === 'DQL' ? '1–5' : currentType === 'DML' ? '16–20' : '31–35') : diffLabels[r.difficulty_id] === 'Intermediate' ? (currentType === 'DQL' ? '6–10' : currentType === 'DML' ? '21–25' : '36–40') : (currentType === 'DQL' ? '11–15' : currentType === 'DML' ? '26–30' : '41–45')}) • +${r.base_points} XP\n\n`;
    }

    const caseObjs = caseObjectivesMap[r.case_id] || [];
    const hasProgressiveObjs = caseObjs.length > 0;
    const suspectInfo = rankDetectiveNotes[r.case_id] || (r.correct_suspect_id && suspectMap[r.correct_suspect_id] ? {
      suspect_id: r.correct_suspect_id,
      name: suspectMap[r.correct_suspect_id].name,
      role: 'Prime Person of Interest',
      finding: `Identified through relational forensics as suspect #${r.correct_suspect_id}.`
    } : null);

    md += `### Case #${globalIndex}: ${r.title}\n`;
    md += `**Case ID**: \`#${r.case_id}\` | **Category**: \`${r.sql_type}\` | **Difficulty**: \`${diffLabels[r.difficulty_id]}\` | **Base Award**: \`+${r.base_points} XP\`\n\n`;
    md += `#### 📁 Case Briefing & Narrative:\n${r.description}\n\n`;

    if (hasProgressiveObjs) {
      md += `#### 🎯 Step-by-Step Progressive Objectives & Queries:\n\n`;
      caseObjs.forEach((obj, idx) => {
        const isFinal = idx === caseObjs.length - 1;
        md += `##### ${isFinal ? `Step 3 (Final Target Solution)` : `Step ${idx + 1}`}: ${obj.objective_text}\n`;
        md += `- **XP Reward**: \`+${obj.points} XP\`\n`;
        md += `\`\`\`sql\n${obj.expected_query}\n\`\`\`\n\n`;
      });
    } else {
      if (r.objectives) {
        md += `#### 🎯 Case Objectives:\n`;
        const lines = r.objectives.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        lines.forEach((line, idx) => {
          md += `${idx + 1}. ${line.replace(/^\d+[\.\)]\s*/, '')}\n`;
        });
        md += `\n`;
      }
      md += `#### ✔ Official Solution SQL:\n\`\`\`sql\n${formatSql(r.correct_query)}\n\`\`\`\n\n`;
    }

    if (r.expected_result_sql && r.expected_result_sql.trim() !== r.correct_query.trim()) {
      md += `#### 🔍 Automated Verification Query:\n\`\`\`sql\n${r.expected_result_sql}\n\`\`\`\n\n`;
    }

    if (suspectInfo) {
      const pSuspect = suspectMap[suspectInfo.suspect_id] || {};
      md += `#### ⚖️ Phase 3 Verdict • Accused Suspect:\n`;
      md += `- **Accused Suspect**: **${suspectInfo.name}** (\`Suspect ID #${suspectInfo.suspect_id}\`)\n`;
      md += `- **Role & Demographics**: \`${suspectInfo.role}\` | Status: \`${pSuspect.status || 'Under Investigation'}\` | Age: \`${pSuspect.age || 'Unknown'}\`\n`;
      md += `- **Detective Finding**: ${suspectInfo.finding}\n\n`;
    } else if (r.sql_type !== 'DQL') {
      md += `#### ⚖️ Phase 3 Case Outcome:\n`;
      md += `- **Outcome**: \`${r.sql_type === 'DDL' ? 'Relational Schema Deployed & Constraints Enforced' : 'Intelligence Records Ingested & Synchronized'}\`\n`;
      md += `- **Investigation Impact**: ${r.sql_type === 'DDL' ? 'Precinct tables are created with strict primary/foreign key integrity, providing a bulletproof database structure for cyber forensics.' : 'Evidence manifests, dispatch logs, and suspect records are accurately populated, eliminating forensic data gaps.'}\n\n`;
    }

    md += `---\n\n`;
    globalIndex++;
  }

  fs.writeFileSync(outputMdPath, md, 'utf-8');
  console.log(`✅ Rank Markdown successfully written: ${outputMdPath}`);

  await conn.end();
}

main().catch(console.error);
