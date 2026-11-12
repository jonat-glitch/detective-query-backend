const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, PageBreak
} = require('docx');

const mdPath = path.join(__dirname, '..', '..', 'DEFENSE_STUDY_GUIDE.md');
const outPath = path.join(__dirname, '..', '..', 'DEFENSE_STUDY_GUIDE.docx');

const C = {
  navy:    '1B3A5C',
  blue:    '2E5C99',
  lblue:   'D6E4F7',
  altRow:  'F0F4F8',
  white:   'FFFFFF',
  green:   '2E7D32',
  lgreen:  'E8F5E9',
  amber:   'E65100',
  lamber:  'FFF3E0',
  red:     'C62828',
  lred:    'FFEBEE',
  gray:    'F5F5F5',
  border:  'B0BEC5',
  dark:    '212121',
  muted:   '546E7A',
};

const borders = {
  top:    { style: BorderStyle.SINGLE, size: 1, color: C.border },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border },
  left:   { style: BorderStyle.SINGLE, size: 1, color: C.border },
  right:  { style: BorderStyle.SINGLE, size: 1, color: C.border }
};

function parseInlineRuns(text, baseOpts = {}) {
  // Simple inline parser for **bold**, `code`, and regular text
  const runs = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|[^*`]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      runs.push(new TextRun({
        text: chunk.slice(2, -2),
        bold: true,
        size: baseOpts.size || 20,
        color: baseOpts.color || C.dark,
        font: baseOpts.font || 'Calibri'
      }));
    } else if (chunk.startsWith('`') && chunk.endsWith('`')) {
      runs.push(new TextRun({
        text: chunk.slice(1, -1),
        font: 'Consolas',
        size: (baseOpts.size || 20) - 2,
        color: C.navy,
        bold: true
      }));
    } else {
      runs.push(new TextRun({
        text: chunk,
        size: baseOpts.size || 20,
        bold: baseOpts.bold || false,
        italics: baseOpts.italics || false,
        color: baseOpts.color || C.dark,
        font: baseOpts.font || 'Calibri'
      }));
    }
  }
  return runs.length ? runs : [new TextRun({ text, size: baseOpts.size || 20, color: baseOpts.color || C.dark })];
}

function makeCell(content, bg = C.white, isHeader = false) {
  let runs;
  if (typeof content === 'string') {
    runs = parseInlineRuns(content.trim(), {
      size: isHeader ? 19 : 18,
      bold: isHeader,
      color: isHeader ? C.white : C.dark
    });
  } else {
    runs = content;
  }

  return new TableCell({
    children: [new Paragraph({
      children: runs,
      spacing: { before: 60, after: 60 }
    })],
    shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 80, bottom: 80, left: 140, right: 100 },
    borders,
  });
}

function parseMarkdownToDocx(mdText) {
  const lines = mdText.split(/\r?\n/);
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    const docxRows = [];
    tableRows.forEach((r, rowIdx) => {
      const isHeader = rowIdx === 0;
      const bg = isHeader ? C.navy : (rowIdx % 2 === 0 ? C.white : C.altRow);
      const cells = r.map(c => makeCell(c, bg, isHeader));
      docxRows.push(new TableRow({
        children: cells,
        tableHeader: isHeader
      }));
    });
    elements.push(new Table({
      rows: docxRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }));
    elements.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    tableRows = [];
    inTable = false;
  }

  function flushCodeBlock() {
    if (codeBlockLines.length === 0) return;
    const pChildren = codeBlockLines.map(l => new TextRun({
      text: l + '\n',
      font: 'Consolas',
      size: 17,
      color: '263238'
    }));

    elements.push(new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: pChildren, spacing: { before: 80, after: 80 } })],
              shading: { fill: 'ECEFF1', type: ShadingType.CLEAR, color: 'auto' },
              margins: { top: 100, bottom: 100, left: 150, right: 150 },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2, color: 'CFD8DC' },
                bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CFD8DC' },
                left: { style: BorderStyle.SINGLE, size: 6, color: C.blue },
                right: { style: BorderStyle.SINGLE, size: 2, color: 'CFD8DC' }
              }
            })
          ]
        })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      spacing: { after: 150 }
    }));
    codeBlockLines = [];
    inCodeBlock = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        if (inTable) flushTable();
        inCodeBlock = true;
        codeBlockLines = [];
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const parts = line.split('|').slice(1, -1);
      // Check if separator line
      const isSep = parts.every(p => /^[:\s-]+$/.test(p));
      if (isSep) {
        // separator, skip
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(parts.map(p => p.trim()));
      continue;
    } else {
      if (inTable) flushTable();
    }

    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Horizontal rule
    if (trimmed === '---') {
      elements.push(new Paragraph({
        text: '',
        border: { bottom: { color: C.border, size: 6, style: BorderStyle.SINGLE } },
        spacing: { before: 100, after: 150 }
      }));
      continue;
    }

    // Title / Headings
    if (trimmed.startsWith('# ')) {
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: trimmed.slice(2),
            bold: true,
            size: 36,
            color: C.navy,
            font: 'Calibri'
          })
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 140 }
      }));
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: trimmed.slice(3),
            bold: true,
            size: 28,
            color: C.navy,
            font: 'Calibri'
          })
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 }
      }));
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: trimmed.slice(4),
            bold: true,
            size: 24,
            color: C.blue,
            font: 'Calibri'
          })
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 }
      }));
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(new Paragraph({
        children: [
          new TextRun({
            text: trimmed.slice(5),
            bold: true,
            size: 21,
            color: C.muted,
            font: 'Calibri'
          })
        ],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 140, after: 60 }
      }));
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(new Paragraph({
        children: parseInlineRuns(trimmed.slice(2), { size: 19, italics: true, color: '37474F' }),
        spacing: { before: 80, after: 80 },
        indent: { left: 400 },
        border: { left: { color: C.amber, size: 12, style: BorderStyle.SINGLE } }
      }));
      continue;
    }

    // Q&A highlighting
    if (trimmed.startsWith('**Q:')) {
      elements.push(new Paragraph({
        children: parseInlineRuns(trimmed, { size: 21, bold: true, color: C.navy }),
        spacing: { before: 160, after: 40 }
      }));
      continue;
    }
    if (trimmed.startsWith('A:')) {
      elements.push(new Paragraph({
        children: [
          new TextRun({ text: 'A: ', bold: true, color: C.green, size: 20 }),
          ...parseInlineRuns(trimmed.slice(2).trim(), { size: 20, color: C.dark })
        ],
        spacing: { before: 40, after: 120 },
        indent: { left: 240 }
      }));
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(new Paragraph({
        children: parseInlineRuns(trimmed.slice(2), { size: 20 }),
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 }
      }));
      continue;
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(new Paragraph({
        children: [
          new TextRun({ text: numMatch[1] + '. ', bold: true, color: C.blue, size: 20 }),
          ...parseInlineRuns(numMatch[2], { size: 20 })
        ],
        spacing: { before: 40, after: 40 },
        indent: { left: 280 }
      }));
      continue;
    }

    // Regular paragraph
    elements.push(new Paragraph({
      children: parseInlineRuns(trimmed, { size: 20 }),
      spacing: { before: 60, after: 80 }
    }));
  }

  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();

  return elements;
}

async function run() {
  console.log('Reading MD from:', mdPath);
  const mdText = fs.readFileSync(mdPath, 'utf8');

  console.log('Parsing markdown to docx elements...');
  const docElements = parseMarkdownToDocx(mdText);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1200,
              right: 1200
            }
          }
        },
        children: docElements
      }
    ]
  });

  console.log('Packing docx...');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Generated DOCX successfully at:', outPath);
}

run().catch(err => {
  console.error('Error generating DOCX:', err);
  process.exit(1);
});

