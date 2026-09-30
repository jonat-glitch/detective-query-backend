const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const artifactDir = 'C:/Users/PC/.gemini/antigravity-ide/brain/ce6f099e-70c8-4c48-b2a0-a910fc699479';
const outputDir = 'C:/Users/PC/Documents/4th Year Project';

// Load images as base64
function imgBase64(filename) {
  const buf = fs.readFileSync(path.join(artifactDir, filename));
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

const ctx   = imgBase64('context_diagram_1790158464733.jpg');
const uc    = imgBase64('use_case_diagram_1790158489520.jpg');
const dfd   = imgBase64('dfd_level1_1790158517638.jpg');
const erd   = imgBase64('erd_diagram_1790158618954.jpg');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Detective Query — Diagrams Guide & Samples</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #1a1a2e; font-size: 11pt; line-height: 1.6; }

  /* ── COVER PAGE ── */
  .cover {
    width: 100%; height: 100vh;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: white; text-align: center; page-break-after: always;
    padding: 60px;
  }
  .cover .badge {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
    padding: 6px 20px; border-radius: 50px; font-size: 10pt; letter-spacing: 2px;
    text-transform: uppercase; margin-bottom: 30px; color: #e94560;
  }
  .cover h1 { font-size: 36pt; font-weight: 900; line-height: 1.2; margin-bottom: 16px; }
  .cover h1 span { color: #e94560; }
  .cover .sub { font-size: 14pt; color: rgba(255,255,255,0.7); margin-bottom: 40px; }
  .cover .divider { width: 80px; height: 3px; background: #e94560; margin: 0 auto 40px; border-radius: 2px; }
  .cover .meta { font-size: 10pt; color: rgba(255,255,255,0.5); }
  .cover .diagrams-list {
    display: flex; gap: 16px; margin-top: 40px; flex-wrap: wrap; justify-content: center;
  }
  .cover .diagrams-list .chip {
    background: rgba(233,69,96,0.2); border: 1px solid #e94560;
    padding: 8px 18px; border-radius: 8px; font-size: 10pt; color: #e94560;
  }

  /* ── SECTION HEADERS ── */
  .section-divider {
    page-break-before: always;
    background: linear-gradient(135deg, #1a1a2e, #0f3460);
    color: white; padding: 50px 60px;
    margin-bottom: 0;
  }
  .section-divider .part { font-size: 9pt; color: #e94560; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
  .section-divider h2 { font-size: 26pt; font-weight: 900; margin-bottom: 8px; }
  .section-divider p { font-size: 11pt; color: rgba(255,255,255,0.6); }

  /* ── PAGE ── */
  .page { padding: 40px 60px; page-break-before: always; }
  .page:first-of-type { page-break-before: auto; }

  /* ── HEADINGS ── */
  h2.diag-title {
    font-size: 18pt; font-weight: 800; color: #0f3460;
    border-left: 5px solid #e94560; padding-left: 14px;
    margin-bottom: 20px; margin-top: 0;
  }
  h3 { font-size: 13pt; font-weight: 700; color: #16213e; margin: 22px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  h4 { font-size: 11pt; font-weight: 600; color: #0f3460; margin: 16px 0 6px; }

  /* ── DIAGRAM IMAGE CARD ── */
  .diagram-card {
    border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden;
    margin-bottom: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  }
  .diagram-card .card-header {
    background: linear-gradient(90deg, #1a1a2e, #0f3460);
    color: white; padding: 12px 20px;
    font-weight: 700; font-size: 11pt; display: flex; align-items: center; gap: 10px;
  }
  .diagram-card .card-header .num {
    background: #e94560; border-radius: 50%; width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 900;
    flex-shrink: 0;
  }
  .diagram-card img { width: 100%; display: block; }

  /* ── INFO BOXES ── */
  .info-box {
    border-radius: 10px; padding: 16px 20px; margin: 14px 0;
    border-left: 4px solid;
  }
  .info-box.blue { background: #eff6ff; border-color: #3b82f6; }
  .info-box.green { background: #f0fdf4; border-color: #22c55e; }
  .info-box.yellow { background: #fffbeb; border-color: #f59e0b; }
  .info-box.red { background: #fff1f2; border-color: #e94560; }
  .info-box strong { display: block; margin-bottom: 4px; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt; }
  th { background: #1a1a2e; color: white; padding: 10px 14px; text-align: left; font-weight: 700; }
  td { padding: 9px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .pk { color: #e94560; font-weight: 700; }
  .fk { color: #3b82f6; font-weight: 600; }

  /* ── CODE ── */
  code { background: #f1f5f9; border-radius: 4px; padding: 2px 6px; font-size: 9.5pt; font-family: monospace; color: #e94560; }
  pre { background: #1a1a2e; color: #e2e8f0; border-radius: 10px; padding: 16px 20px; font-size: 9pt; line-height: 1.8; overflow: auto; margin: 12px 0; font-family: monospace; }

  /* ── LIST ── */
  ul, ol { padding-left: 22px; margin: 8px 0; }
  li { margin: 5px 0; }
  li::marker { color: #e94560; }

  /* ── FLOW ARROW ── */
  .flow { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
  .flow-row { display: flex; align-items: center; gap: 10px; font-size: 10pt; }
  .flow-row .from { background: #eff6ff; border: 1px solid #3b82f6; padding: 4px 10px; border-radius: 6px; white-space: nowrap; }
  .flow-row .arrow { color: #e94560; font-size: 13pt; }
  .flow-row .label { color: #475569; font-style: italic; font-size: 9.5pt; }
  .flow-row .to { background: #f0fdf4; border: 1px solid #22c55e; padding: 4px 10px; border-radius: 6px; white-space: nowrap; }

  /* ── ACTOR CHIP ── */
  .actor-row { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
  .actor { background: #0f3460; color: white; padding: 5px 14px; border-radius: 20px; font-size: 10pt; }

  /* ── FOOTER ── */
  @media print {
    @page { margin: 0; size: A4; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ════════════ COVER PAGE ════════════ -->
<div class="cover">
  <div class="badge">4th Year Capstone Project</div>
  <h1>🕵️ Detective<br/><span>Query</span></h1>
  <div class="sub">System Diagrams — Complete Guide & Visual Samples</div>
  <div class="divider"></div>
  <div class="diagrams-list">
    <div class="chip">📌 Context Diagram</div>
    <div class="chip">🎭 Use Case Diagram</div>
    <div class="chip">🔄 DFD Level 1</div>
    <div class="chip">🗄️ ERD</div>
  </div>
  <div class="meta" style="margin-top:50px;">Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} &nbsp;|&nbsp; Detective Query System &nbsp;|&nbsp; Node.js · React/Ionic · MySQL · TiDB Cloud</div>
</div>

<!-- ════════════ PART 1: VISUAL SAMPLES ════════════ -->
<div class="section-divider">
  <div class="part">Part 1</div>
  <h2>📸 Visual Diagram Samples</h2>
  <p>Reference images showing the expected layout and style for each diagram.</p>
</div>

<div class="page">
  <h2 class="diag-title">Diagram 1 — Context Diagram</h2>
  <div class="info-box blue">
    <strong>What it shows</strong>
    The entire system as one box. External entities around it with labeled data flow arrows. This is the simplest, highest-level view of the system.
  </div>
  <div class="diagram-card">
    <div class="card-header"><div class="num">1</div> Context Diagram (Level 0 DFD)</div>
    <img src="${ctx}" alt="Context Diagram"/>
  </div>
</div>

<div class="page">
  <h2 class="diag-title">Diagram 2 — Use Case Diagram</h2>
  <div class="info-box blue">
    <strong>What it shows</strong>
    Actors (Student, Teacher, Admin) outside a system boundary, with ovals representing use cases inside. Lines show who does what. Dashed lines show &lt;&lt;include&gt;&gt; relationships.
  </div>
  <div class="diagram-card">
    <div class="card-header"><div class="num">2</div> Use Case Diagram</div>
    <img src="${uc}" alt="Use Case Diagram"/>
  </div>
</div>

<div class="page">
  <h2 class="diag-title">Diagram 3 — DFD Level 1</h2>
  <div class="info-box blue">
    <strong>What it shows</strong>
    3-column layout: External entities on the left, numbered processes in the center, data stores (database tables) on the right. Arrows with labels show exactly what data is flowing and where.
  </div>
  <div class="diagram-card">
    <div class="card-header"><div class="num">3</div> Data Flow Diagram — Level 1</div>
    <img src="${dfd}" alt="DFD Level 1"/>
  </div>
</div>

<div class="page">
  <h2 class="diag-title">Diagram 4 — ERD (Entity Relationship Diagram)</h2>
  <div class="info-box blue">
    <strong>What it shows</strong>
    All database tables as entity boxes with columns listed. PK (Primary Key) and FK (Foreign Key) marked. Crow's Foot notation lines show 1-to-Many and 1-to-1 relationships between tables.
  </div>
  <div class="diagram-card">
    <div class="card-header"><div class="num">4</div> Entity Relationship Diagram (Crow's Foot Notation)</div>
    <img src="${erd}" alt="ERD Diagram"/>
  </div>
</div>

<!-- ════════════ PART 2: FULL GUIDE ════════════ -->
<div class="section-divider">
  <div class="part">Part 2</div>
  <h2>📋 Complete Lucidchart Drawing Guide</h2>
  <p>Step-by-step instructions, positioning, content, and relationships for each diagram.</p>
</div>

<!-- ────── Lucidchart Setup ────── -->
<div class="page">
  <h2 class="diag-title">⚙️ Lucidchart Setup (Do This First)</h2>
  <ol>
    <li>Open <strong>lucidchart.com</strong> → Click <strong>+ New Document</strong></li>
    <li>Rename document: <strong>"Detective Query — System Diagrams"</strong></li>
    <li>Create <strong>4 separate pages</strong> (click "+" at the bottom tab bar)</li>
    <li>Rename each tab:
      <ul>
        <li>Page 1 → <code>Context Diagram</code></li>
        <li>Page 2 → <code>Use Case Diagram</code></li>
        <li>Page 3 → <code>DFD Level 1</code></li>
        <li>Page 4 → <code>ERD</code></li>
      </ul>
    </li>
    <li>For the ERD page: Go to <strong>Insert → Entity Relationship → Crow's Foot</strong></li>
  </ol>

  <h3>Shape Color Legend</h3>
  <table>
    <tr><th>Shape</th><th>Used For</th><th>Color</th></tr>
    <tr><td>Rectangle</td><td>External Entities</td><td>Light Blue <code>#D6E4F0</code></td></tr>
    <tr><td>Large Rounded Rectangle</td><td>System / Processes</td><td>Light Green <code>#D5F5E3</code></td></tr>
    <tr><td>Oval / Ellipse</td><td>Use Cases</td><td>White with black border</td></tr>
    <tr><td>Open Rectangle (2 lines)</td><td>Data Stores</td><td>White with lines</td></tr>
    <tr><td>Table card (ERD)</td><td>Database Entities</td><td>Dark blue header, white rows</td></tr>
  </table>
</div>

<!-- ────── Context Diagram Guide ────── -->
<div class="page">
  <h2 class="diag-title">📌 Page 1: Context Diagram — Drawing Guide</h2>

  <h3>Step 1 — Draw the System (Center)</h3>
  <div class="info-box green">Place a large <strong>rounded rectangle</strong> in the exact center of the page. Label it: <strong>DETECTIVE QUERY SYSTEM</strong>. Fill: Light green.</div>

  <h3>Step 2 — Place 6 External Entity Boxes</h3>
  <table>
    <tr><th>Entity</th><th>Position</th></tr>
    <tr><td><strong>Student</strong></td><td>Far LEFT, upper half</td></tr>
    <tr><td><strong>Teacher</strong></td><td>Far LEFT, lower half</td></tr>
    <tr><td><strong>Admin</strong></td><td>TOP CENTER, above system</td></tr>
    <tr><td><strong>Email System (Brevo)</strong></td><td>Far RIGHT, upper</td></tr>
    <tr><td><strong>Firebase</strong></td><td>Far RIGHT, lower</td></tr>
    <tr><td><strong>TiDB Cloud Database</strong></td><td>BOTTOM CENTER, below system</td></tr>
  </table>

  <h3>Step 3 — Draw Labeled Arrows</h3>
  <table>
    <tr><th>From → To</th><th>Arrow Direction</th><th>Label</th></tr>
    <tr><td>Student ↔ System</td><td>Two-way</td><td>IN: "Login Credentials, SQL Queries" / OUT: "Case List, Scores, Feedback"</td></tr>
    <tr><td>Teacher ↔ System</td><td>Two-way</td><td>IN: "Room Control, Session Commands" / OUT: "Analytics, Student Data"</td></tr>
    <tr><td>Admin ↔ System</td><td>Two-way</td><td>IN: "Approvals, User Management" / OUT: "Platform Stats, User Records"</td></tr>
    <tr><td>System → Email System</td><td>One-way (out)</td><td>"OTP &amp; Approval Emails"</td></tr>
    <tr><td>Firebase → System</td><td>One-way (in)</td><td>"Google Auth Token"</td></tr>
    <tr><td>System ↔ TiDB Cloud</td><td>Two-way</td><td>"All Data Read/Write"</td></tr>
  </table>
</div>

<!-- ────── Use Case Guide ────── -->
<div class="page">
  <h2 class="diag-title">📌 Page 2: Use Case Diagram — Drawing Guide</h2>

  <h3>Step 1 — Draw System Boundary</h3>
  <div class="info-box green">One <strong>large rectangle</strong> filling most of the page. Label at the top: <strong>Detective Query System</strong>. No fill, visible border.</div>

  <h3>Step 2 — Place Actors OUTSIDE the boundary</h3>
  <div class="actor-row">
    <div class="actor">🧍 Student — Left, upper</div>
    <div class="actor">🧍 Teacher — Left, middle</div>
    <div class="actor">🛡️ Admin — Left, lower</div>
    <div class="actor">📧 Email System — Right, upper</div>
    <div class="actor">🔥 Firebase — Right, lower</div>
  </div>

  <h3>Step 3 — Draw Use Case Ovals INSIDE boundary</h3>

  <h4>🔝 TOP Section — Authentication (shared by all)</h4>
  <pre>(Register Account)  (Verify Email/OTP)  (Login)  (Logout)  (Refresh Session)  (Google Sign-In)</pre>

  <h4>⬅️ LEFT Section — Student Use Cases</h4>
  <pre>Row 1: (Browse Cases)      (View Case Details)    (View Study Material)
Row 2: (Submit SQL Query)  (View Query Feedback)  (Earn Points &amp; Level Up)
Row 3: (View Profile)      (View Leaderboard)     (View Achievements)
Row 4: (Join Room)         (Take Case Notes)      (View Notifications)
Row 5: (Change Settings)   (Request Acct Change)  (Export Results)</pre>

  <h4>🔄 CENTER Section — Teacher Use Cases</h4>
  <pre>Row 1: (Create Room)         (Manage Room)       (Assign Cases to Room)
Row 2: (Approve/Reject Req)  (Start Session)     (Pause/Resume Session)
Row 3: (End Session)         (Broadcast Message) (Send Notifications)
Row 4: (View Analytics)      (View Student Performance)</pre>

  <h4>➡️ RIGHT Section — Admin Use Cases</h4>
  <pre>Row 1: (View Platform Stats)        (Approve/Reject Registration)
Row 2: (Approve Account Changes)    (Manage All Users)
Row 3: (Create/Edit Cases)          (Manage Difficulty Levels)
Row 4: (View All Rooms)</pre>

  <h3>Step 4 — Draw Relationship Lines</h3>
  <table>
    <tr><th>From</th><th>Line Type</th><th>To</th><th>Label</th></tr>
    <tr><td>Student/Teacher/Admin</td><td>Solid line</td><td>Their use cases</td><td>(no label)</td></tr>
    <tr><td>Register Account</td><td>Dashed line</td><td>Verify Email/OTP</td><td>&lt;&lt;include&gt;&gt;</td></tr>
    <tr><td>Login</td><td>Dashed line</td><td>Refresh Session</td><td>&lt;&lt;include&gt;&gt;</td></tr>
    <tr><td>Submit SQL Query</td><td>Dashed line</td><td>View Query Feedback</td><td>&lt;&lt;include&gt;&gt;</td></tr>
    <tr><td>Submit SQL Query</td><td>Dashed line</td><td>Earn Points &amp; Level Up</td><td>&lt;&lt;extend&gt;&gt;</td></tr>
    <tr><td>Approve Registration</td><td>Dashed line</td><td>Email System (external)</td><td>&lt;&lt;include&gt;&gt;</td></tr>
    <tr><td>Google Sign-In</td><td>Solid line</td><td>Firebase (external)</td><td>(no label)</td></tr>
  </table>
</div>

<!-- ────── DFD Guide ────── -->
<div class="page">
  <h2 class="diag-title">📌 Page 3: DFD Level 1 — Drawing Guide</h2>

  <div class="info-box yellow"><strong>Layout Rule:</strong> Use a strict 3-column layout. Entities on LEFT, Processes in CENTER, Data Stores on RIGHT. All arrows go horizontally between columns.</div>

  <h3>Step 1 — Left Column: External Entities</h3>
  <pre>TOP:       [ Student ]
MIDDLE:    [ Teacher ]
LOWER:     [ Admin ]
FAR RIGHT: [ Email System ]  [ Firebase ]</pre>

  <h3>Step 2 — Center Column: 9 Numbered Processes</h3>
  <table>
    <tr><th>#</th><th>Process Name</th><th>Fill Color</th></tr>
    <tr><td>1.0</td><td>User Authentication &amp; Registration</td><td>Light Yellow</td></tr>
    <tr><td>2.0</td><td>Case Management &amp; Browsing</td><td>Light Yellow</td></tr>
    <tr><td>3.0</td><td>SQL Submission &amp; Validation</td><td>Light Yellow</td></tr>
    <tr><td>4.0</td><td>Room &amp; Session Management</td><td>Light Yellow</td></tr>
    <tr><td>5.0</td><td>Progress &amp; Achievement Tracking</td><td>Light Yellow</td></tr>
    <tr><td>6.0</td><td>Notifications &amp; Communication</td><td>Light Yellow</td></tr>
    <tr><td>7.0</td><td>Analytics &amp; Reporting</td><td>Light Yellow</td></tr>
    <tr><td>8.0</td><td>Admin Management</td><td>Light Yellow</td></tr>
    <tr><td>9.0</td><td>File Management</td><td>Light Yellow</td></tr>
  </table>

  <h3>Step 3 — Right Column: Data Stores (beside their process)</h3>
  <table>
    <tr><th>Process</th><th>Data Stores Beside It</th></tr>
    <tr><td>1.0 Auth</td><td>D1 users, D13 registration_requests, D14 account_change_requests, D15 refresh_tokens</td></tr>
    <tr><td>2.0 Cases</td><td>D2 cases, D3 difficulty, D5 user_case_progress</td></tr>
    <tr><td>3.0 SQL</td><td>D4 attempts, D18 case_objectives, D2 cases</td></tr>
    <tr><td>4.0 Rooms</td><td>D6 rooms, D7 room_students, D8 game_sessions, D9 session_objectives</td></tr>
    <tr><td>5.0 Progress</td><td>D1 users, D10 achievements, D11 user_streaks</td></tr>
    <tr><td>6.0 Notifs</td><td>D12 notifications</td></tr>
    <tr><td>7.0 Analytics</td><td>D1, D2, D3, D4, D5 (shared)</td></tr>
    <tr><td>8.0 Admin</td><td>D1, D2, D3, D13 (shared)</td></tr>
    <tr><td>9.0 Files</td><td>D16 case_study_materials, D17 user_avatars</td></tr>
  </table>
</div>

<!-- ────── ERD Guide ────── -->
<div class="page">
  <h2 class="diag-title">📌 Page 4: ERD — Drawing Guide</h2>

  <div class="info-box green"><strong>Lucidchart Setting:</strong> Insert → Entity Relationship → Crow's Foot (IE Notation). Each table = one entity card with header + column rows.</div>

  <h3>Zone Layout</h3>
  <table>
    <tr><th>Zone</th><th>Position</th><th>Tables</th></tr>
    <tr><td>Zone A — User &amp; Auth</td><td>Top Left</td><td>roles, users, account_change_requests, user_streaks, refresh_tokens, user_avatars</td></tr>
    <tr><td>Zone B — Cases &amp; Content</td><td>Top Right</td><td>difficulty, cases, datasets, case_objectives, case_study_materials, case_notes</td></tr>
    <tr><td>Zone C — Progress</td><td>Bottom Left</td><td>user_case_progress, attempts, achievements, user_achievements</td></tr>
    <tr><td>Zone D — Rooms &amp; Sessions</td><td>Bottom Right</td><td>rooms, room_students, game_sessions, session_objectives</td></tr>
    <tr><td>Zone E — Communication</td><td>Far Right Strip</td><td>notifications, registration_requests</td></tr>
  </table>

  <h3>All Relationships (Crow's Foot Lines)</h3>
  <table>
    <tr><th>From Table</th><th>Cardinality</th><th>To Table</th></tr>
    <tr><td>roles</td><td>1 → Many</td><td>users</td></tr>
    <tr><td>users</td><td>1 → 1</td><td>user_streaks</td></tr>
    <tr><td>users</td><td>1 → 1</td><td>user_avatars</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>attempts</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>user_case_progress</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>user_achievements</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>case_notes</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>refresh_tokens</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>notifications (as recipient)</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>notifications (as sender)</td></tr>
    <tr><td>users</td><td>1 → Many</td><td>account_change_requests</td></tr>
    <tr><td>users (teacher)</td><td>1 → Many</td><td>rooms</td></tr>
    <tr><td>achievements</td><td>1 → Many</td><td>user_achievements</td></tr>
    <tr><td>difficulty</td><td>1 → Many</td><td>cases</td></tr>
    <tr><td>difficulty</td><td>1 → Many</td><td>game_sessions</td></tr>
    <tr><td>datasets</td><td>1 → Many</td><td>cases</td></tr>
    <tr><td>cases</td><td>1 → Many</td><td>case_objectives</td></tr>
    <tr><td>cases</td><td>1 → 1</td><td>case_study_materials</td></tr>
    <tr><td>cases</td><td>1 → Many</td><td>attempts</td></tr>
    <tr><td>cases</td><td>1 → Many</td><td>user_case_progress</td></tr>
    <tr><td>cases</td><td>1 → Many</td><td>game_sessions</td></tr>
    <tr><td>rooms</td><td>1 → Many</td><td>room_students</td></tr>
    <tr><td>rooms</td><td>1 → Many</td><td>game_sessions</td></tr>
    <tr><td>game_sessions</td><td>1 → Many</td><td>session_objectives</td></tr>
    <tr><td>case_objectives</td><td>1 → Many</td><td>session_objectives</td></tr>
  </table>
</div>

</body>
</html>`;

// Write HTML
const htmlPath = path.join(outputDir, 'Detective_Query_Diagrams.html');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✅ HTML written to:', htmlPath);

// Use Chrome headless to generate PDF
const pdfPath = path.join(outputDir, 'Detective_Query_Diagrams.pdf');
console.log('🔄 Generating PDF via Chrome headless...');

try {
  execSync(
    `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-pdf-header-footer --print-to-pdf-no-header "${htmlPath}"`,
    { stdio: 'inherit', timeout: 60000 }
  );
  const stat = require('fs').statSync(pdfPath);
  console.log(`\n✅ PDF generated successfully!`);
  console.log(`   📄 File: ${pdfPath}`);
  console.log(`   📦 Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  console.error('❌ Chrome headless failed:', err.message);
  console.log('✅ HTML file is ready — open it in your browser and press Ctrl+P → Save as PDF');
  console.log('   📄 File:', htmlPath);
}
