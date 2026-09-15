const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const TIDB = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4AjTs4MyTKCrsiP.root',
  password: 'Xkoew4eyG3Wlu5ZS',
  database: 'detective_query',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const conn = await mysql.createConnection(TIDB);
  const [rows] = await conn.query(`
    SELECT c.case_id, c.title, c.description, c.objectives, c.sql_type, c.difficulty_id,
           d.difficulty_name, c.base_points, c.correct_query, c.expected_result_sql
    FROM cases c
    JOIN difficulty d ON c.difficulty_id = d.difficulty_id
    WHERE c.is_active = 1 AND c.mode = 'Practice'
    ORDER BY FIELD(c.sql_type, 'DQL', 'DML', 'DDL'), c.difficulty_id, c.case_id
  `);

  let md = '# 🕵️ Detective Query — Master Answer Key\n\n';
  md += '> Complete official solutions and objectives for all **45 Practice Cases** across **DQL**, **DML**, and **DDL**.\n';
  md += '> Categorized into **Beginner (5)**, **Intermediate (5)**, and **Expert (5)** per SQL type.\n\n';
  md += '---\n\n';

  md += '## 📑 Quick Navigation\n\n';
  md += '- [DQL (Data Query Language)](#-dql-data-query-language)\n';
  md += '  - [Beginner (5 Cases)](#dql--beginner-easy--100-xp)\n';
  md += '  - [Intermediate (5 Cases)](#dql--intermediate-medium--150-xp)\n';
  md += '  - [Expert (5 Cases)](#dql--expert-hard--250-xp)\n';
  md += '- [DML (Data Manipulation Language)](#-dml-data-manipulation-language)\n';
  md += '  - [Beginner (5 Cases)](#dml--beginner-easy--100-xp)\n';
  md += '  - [Intermediate (5 Cases)](#dml--intermediate-medium--150-xp)\n';
  md += '  - [Expert (5 Cases)](#dml--expert-hard--250-xp)\n';
  md += '- [DDL (Data Definition Language)](#-ddl-data-definition-language)\n';
  md += '  - [Beginner (5 Cases)](#ddl--beginner-easy--100-xp)\n';
  md += '  - [Intermediate (5 Cases)](#ddl--intermediate-medium--150-xp)\n';
  md += '  - [Expert (5 Cases)](#ddl--expert-hard--250-xp)\n\n';
  md += '---\n\n';

  const diffLabels = { 1: 'Beginner (Easy)', 2: 'Intermediate (Medium)', 3: 'Expert (Hard)' };
  const typeIcons = { DQL: '🔍', DML: '📝', DDL: '🏗️' };
  const typeFull = {
    DQL: 'DQL (Data Query Language)',
    DML: 'DML (Data Manipulation Language)',
    DDL: 'DDL (Data Definition Language)'
  };

  let currentType = '';
  let currentDiff = null;
  let caseIndex = 1;

  for (const r of rows) {
    if (r.sql_type !== currentType) {
      currentType = r.sql_type;
      md += `## ${typeIcons[currentType]} ${typeFull[currentType]}\n\n`;
      caseIndex = 1;
      currentDiff = null;
    }

    if (r.difficulty_id !== currentDiff) {
      currentDiff = r.difficulty_id;
      md += `### ${currentType} — ${diffLabels[r.difficulty_id]} (+${r.base_points} XP)\n\n`;
    }

    md += `#### Case #${caseIndex}: ${r.title} (Case ID: ${r.case_id})\n\n`;
    md += `**Description:**  \n${r.description}\n\n`;

    if (r.objectives) {
      md += `**Objectives:**  \n`;
      const lines = r.objectives.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        md += `- ${line}\n`;
      }
      md += '\n';
    }

    md += `**Correct SQL Answer:**\n\`\`\`sql\n${r.correct_query}\n\`\`\`\n\n`;

    if (r.expected_result_sql && r.expected_result_sql !== r.correct_query) {
      md += `**Validation State Query (Backend Comparison):**\n\`\`\`sql\n${r.expected_result_sql}\n\`\`\`\n\n`;
    }

    md += '---\n\n';
    caseIndex++;
  }

  const outputPath = path.resolve(__dirname, '../../PRACTICE_CASES_ANSWER_KEY.md');
  fs.writeFileSync(outputPath, md, 'utf-8');
  console.log(`✅ Successfully generated: ${outputPath}`);
  console.log(`Total cases documented: ${rows.length}`);
  await conn.end();
}

main().catch(err => {
  console.error('Error generating answer key:', err.message);
  process.exit(1);
});
