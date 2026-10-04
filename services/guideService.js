// services/guideService.js
// Generates polished PDF guides for Detective Query — Student & Teacher versions.
// Uses PDFKit to create in-memory buffers (no disk I/O) for email attachment.

'use strict';

const PDFDocument = require('pdfkit');

// ─── Color Palette ──────────────────────────────────────────────────────────
const C = {
  bg:           '#0a1226',
  surface:      '#0d1a38',
  accent:       '#00f0ff',
  accentGreen:  '#00ff66',
  accentPurple: '#a855f7',
  white:        '#ffffff',
  muted:        '#64748b',
  bodyText:     '#94a3b8',
  warn:         '#fbbf24',
};

/** Convert hex color string to [r,g,b] array for PDFKit */
function hex(color) {
  const c = color.replace('#', '');
  return [parseInt(c.substring(0,2),16), parseInt(c.substring(2,4),16), parseInt(c.substring(4,6),16)];
}

/** Collect PDFDocument output chunks into a Buffer */
function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// ─── Shared Drawing Helpers ───────────────────────────────────────────────────

function drawBg(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(hex(C.bg));
}

function drawHeader(doc, title, subtitle, accent) {
  accent = accent || C.accent;
  const W = doc.page.width;
  doc.rect(0, 0, W, 110).fill(hex(C.surface));
  doc.rect(0, 0, W, 4).fill(hex(accent));
  doc.fontSize(9).font('Helvetica-Bold').fillColor(hex(accent)).text('DETECTIVE QUERY', 40, 22);
  doc.fontSize(20).font('Helvetica-Bold').fillColor(hex(C.white)).text(title, 40, 38);
  doc.fontSize(10).font('Helvetica').fillColor(hex(C.bodyText)).text(subtitle, 40, 64, { width: W - 80 });
  doc.save().rect(0, 108, W, 1).fillOpacity(0.2).fill(hex(accent)).restore();
}

function secHeader(doc, text, accent) {
  accent = accent || C.accent;
  const y = doc.y + 12;
  doc.rect(40, y, 4, 18).fill(hex(accent));
  doc.fontSize(12).font('Helvetica-Bold').fillColor(hex(accent)).text(text, 52, y + 3, { width: doc.page.width - 92 });
  doc.moveDown(0.2);
}

function bodyText(doc, text, opts) {
  doc.fontSize(10).font('Helvetica').fillColor(hex(C.bodyText)).fillOpacity(1)
     .text(text, 40, doc.y, Object.assign({ width: doc.page.width - 80, lineGap: 2 }, opts || {}));
  doc.moveDown(0.4);
}

function infoBox(doc, lines, accent) {
  accent = accent || C.accent;
  const W = doc.page.width;
  const bx = 40, bw = W - 80, pad = 12, lh = 17;
  const bh = lines.length * lh + pad * 2;
  const y = doc.y + 6;
  doc.save().roundedRect(bx, y, bw, bh, 6).fillOpacity(0.06).fill(hex(accent)).restore();
  doc.roundedRect(bx, y, bw, bh, 6).strokeColor(hex(accent)).strokeOpacity(0.25).lineWidth(1).stroke();
  lines.forEach(function(line, i) {
    const lbl = line[0], val = line[1];
    const ly = y + pad + i * lh;
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(hex(C.muted)).fillOpacity(1)
       .text(lbl + (val ? '  ' : ''), bx + 12, ly, { continued: !!val, width: bw - 24 });
    if (val) doc.font('Helvetica').fillColor(hex(C.white)).text(val);
  });
  doc.y = y + bh + 10;
}

function stepBox(doc, steps, accent) {
  accent = accent || C.accent;
  const W = doc.page.width;
  const bx = 40, bw = W - 80, pad = 12, lh = 22;
  const bh = steps.length * lh + pad * 2;
  const y = doc.y + 6;
  doc.save().roundedRect(bx, y, bw, bh, 6).fillOpacity(0.04).fill(hex(C.white)).restore();
  doc.roundedRect(bx, y, bw, bh, 6).strokeColor(hex(C.white)).strokeOpacity(0.08).lineWidth(1).stroke();
  steps.forEach(function(step, i) {
    const sy = y + pad + i * lh;
    doc.save().circle(bx + 22, sy + 8, 9).fillOpacity(0.15).fill(hex(accent)).restore();
    doc.circle(bx + 22, sy + 8, 9).strokeColor(hex(accent)).strokeOpacity(0.5).lineWidth(0.8).stroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(hex(accent)).fillOpacity(1)
       .text(String(i + 1), bx + 18, sy + 4, { width: 8, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor(hex(C.bodyText)).fillOpacity(1)
       .text(step, bx + 40, sy + 3, { width: bw - 55, lineBreak: false });
  });
  doc.y = y + bh + 14;
}

function featureRow(doc, icon, title, desc, accent) {
  accent = accent || C.accent;
  const W = doc.page.width;
  const y = doc.y;
  doc.save().circle(60, y + 10, 10).fillOpacity(0.12).fill(hex(accent)).restore();
  doc.fontSize(8).font('Helvetica-Bold').fillColor(hex(accent)).fillOpacity(1)
     .text(icon, 54, y + 6, { width: 12, align: 'center', lineBreak: false });
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(hex(C.white)).text(title, 80, y, { width: W - 120 });
  doc.fontSize(9.5).font('Helvetica').fillColor(hex(C.bodyText)).text(desc, 80, doc.y + 2, { width: W - 120 });
  doc.moveDown(0.7);
}

function tipBox(doc, text) {
  const W = doc.page.width;
  const y = doc.y + 4, bw = W - 80;
  doc.save().roundedRect(40, y, bw, 34, 5).fillOpacity(0.08).fill(hex(C.warn)).restore();
  doc.roundedRect(40, y, bw, 34, 5).strokeColor(hex(C.warn)).strokeOpacity(0.4).lineWidth(1).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(hex(C.warn)).fillOpacity(1)
     .text('NOTE  ', 52, y + 7, { continued: true });
  doc.font('Helvetica').fillColor(hex(C.bodyText)).text(text, { width: bw - 24, lineBreak: false });
  doc.y = y + 44;
}

function newPage(doc, title, sub, accent) {
  accent = accent || C.accent;
  doc.addPage();
  drawBg(doc);
  drawHeader(doc, title, sub, accent);
  doc.y = 128;
}

// ════════════════════════════════════════════════════════════════════════════
//  STUDENT GUIDE
// ════════════════════════════════════════════════════════════════════════════
async function generateStudentGuide() {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
  const bufP = streamToBuffer(doc);
  const W = 595, H = 842;

  // Cover
  doc.addPage(); drawBg(doc);
  doc.rect(0,0,W,6).fill(hex(C.accent));
  doc.rect(0,0,W,190).fillOpacity(0.55).fill(hex(C.surface)); doc.fillOpacity(1);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(hex(C.accent)).text('DETECTIVE QUERY',0,52,{align:'center'});
  doc.fontSize(32).font('Helvetica-Bold').fillColor(hex(C.white)).text('Student',0,76,{align:'center'});
  doc.fontSize(28).font('Helvetica-Bold').fillColor(hex(C.accent)).text('Getting Started Guide',0,112,{align:'center'});
  doc.fontSize(11).font('Helvetica').fillColor(hex(C.bodyText)).text('Complete tutorial for new students',0,154,{align:'center'});
  doc.save().rect(W/2-50,188,100,1).fillOpacity(0.3).fill(hex(C.accent)).restore();
  doc.fontSize(12).font('Helvetica-Bold').fillColor(hex(C.white)).text('Welcome, Detective!',0,210,{align:'center'});
  doc.fontSize(10).font('Helvetica').fillColor(hex(C.bodyText))
     .text('Detective Query is an interactive SQL learning platform where you solve real database mysteries.\nThis guide walks you through every feature so you can hit the ground running from day one.',
           70,230,{width:W-140,align:'center',lineGap:3});
  const tocY = 296;
  doc.save().roundedRect(60, tocY, W - 120, 206, 8).fillOpacity(0.05).fill(hex(C.white)).restore();
  doc.roundedRect(60, tocY, W - 120, 206, 8).strokeColor(hex(C.accent)).strokeOpacity(0.2).lineWidth(1).stroke();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(hex(C.accent)).text('TABLE OF CONTENTS', 85, tocY + 16);
  [
    ['1.', 'Logging In & Account Setup'],
    ['2.', 'Your Dashboard'],
    ['3.', 'Joining a Room'],
    ['4.', 'Practice Mode'],
    ['5.', 'Rank Mode'],
    ['6.', 'DQL Lab'],
    ['7.', 'SQL Workshop'],
    ['8.', 'Profile & Progress'],
    ['9.', 'Tips & FAQ']
  ].forEach(function(item, i) {
    const itemY = tocY + 38 + i * 17;
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(hex(C.accent)).text(item[0], 85, itemY);
    doc.fontSize(9.5).font('Helvetica').fillColor(hex(C.white)).text(item[1], 115, itemY, { width: W - 200 });
  });
  doc.fontSize(8).font('Helvetica').fillColor(hex(C.muted)).text('For enrolled students only. Do not redistribute.',0,H-36,{align:'center'});

  // 1. Login
  newPage(doc,'1. Login & Account Setup','How to access Detective Query for the first time');
  bodyText(doc,'Your school administrator imported your account via CSV. You received this guide alongside a private invitation email. Here is how to get started:');
  secHeader(doc,'Open Your Invitation Email');
  bodyText(doc,'Check your email inbox for a message from "Detective Query" with subject "You\'ve Been Invited". Click the "SETUP MY ACCOUNT" button.');
  tipBox(doc,'The setup link expires in 7 days. Complete setup as soon as possible.');
  doc.moveDown(0.3);
  secHeader(doc,'Complete Account Setup');
  stepBox(doc,['Verify your pre-filled details (name, student ID)','Enter gender, birthday, and other personal info','Create a strong password (minimum 6 characters)','Click "Complete Setup" — logged in automatically!']);
  secHeader(doc,'Future Logins');
  bodyText(doc,'Visit detective-query.vercel.app, click Login, and enter your email and password.');
  infoBox(doc,[['Login URL:','https://detective-query.vercel.app/login'],['Username:','Your school email address'],['Password:','The one you created during setup']]);

  // 2. Dashboard
  newPage(doc,'2. Your Dashboard','Your command center for all activities');
  bodyText(doc,'After logging in, you land on your Student Dashboard — the hub for accessing all learning modes, profile, and notifications.');
  secHeader(doc,'Dashboard Elements');
  featureRow(doc,'H','Home / Lobby','Tap a room card to enter a classroom with SQL challenges from your teacher.',C.accent);
  featureRow(doc,'P','Progress Overview','See your completion percentage, badges, and current rank at a glance.',C.accentGreen);
  featureRow(doc,'N','Notifications','The bell icon shows unread notifications — new rooms, deadlines, rank changes.',C.warn);
  featureRow(doc,'U','Profile Tab','Access your profile, academic info, and badges via the profile icon.',C.accentPurple);
  tipBox(doc,'The app is optimized for landscape (horizontal) orientation. Rotate your device for the best experience.');

  // 3. Rooms
  newPage(doc,'3. Joining a Room','Your virtual classroom in Detective Query');
  bodyText(doc,'A Room is your virtual classroom. If enrolled via CSV, you are auto-added to your section\'s rooms. You can also join manually with a Room Code from your teacher.');
  secHeader(doc,'Entering a Room');
  stepBox(doc,['From the Dashboard, tap any room card','Review the room description and teacher name','Tap "Enter Room" to go inside','Browse available Cases, Difficulties, and contests']);
  secHeader(doc,'Room Features');
  featureRow(doc,'F','Case Categories','SQL cases organized by topic: SELECT, JOIN, GROUP BY, and more.',C.accent);
  featureRow(doc,'D','Difficulty Levels','Easy, Medium, and Hard tiers. Complete Easy first to unlock harder ones.',C.accentGreen);
  featureRow(doc,'L','Leaderboard','See how you rank against classmates inside the room in real time.',C.warn);
  featureRow(doc,'T','Deadlines','Some assignments have due dates shown on the room page.',C.accentPurple);
  tipBox(doc,'Ask your teacher for the Room Code if you need to join a room you were not auto-enrolled in.');

  // 4. Practice Mode
  newPage(doc,'4. Practice Mode','Solo training — learn at your own pace');
  bodyText(doc,'Practice Mode lets you solve SQL challenges one by one with no timer and no competition. Perfect for learning and reviewing concepts.');
  secHeader(doc,'How to Start Practicing');
  stepBox(doc,['Enter a Room from your Dashboard','Tap "Practice Mode"','Choose a Difficulty (Easy, Medium, Hard)','Select a case from the list','Read the mystery scenario and write your SQL solution','Tap "Run Query" for instant feedback','Tap "Submit" when your query returns correct results']);
  secHeader(doc,'SQL Editor Features');
  featureRow(doc,'E','Write SQL','Code editor with syntax highlighting to help spot errors.',C.accent);
  featureRow(doc,'R','Run Query','Execute your query — results appear as a table.',C.accentGreen);
  featureRow(doc,'H','Hints','Tap Hints for guided tips without revealing the full answer.',C.warn);
  featureRow(doc,'S','Submit','Mark the case as solved when output matches the expected result.',C.accentGreen);
  tipBox(doc,'Your practice progress saves automatically. Pick up where you left off anytime.');

  // 5. Rank Mode
  newPage(doc,'5. Rank Mode','Compete with your classmates in real time!');
  bodyText(doc,'Rank Mode is a timed competition where you and your classmates race to solve SQL challenges. The faster and more accurately you answer, the higher you climb the leaderboard.');
  secHeader(doc,'How Rank Mode Works');
  stepBox(doc,['Wait for your teacher to start a Rank Mode session','You\'ll receive a notification — tap it or go to the room','Everyone starts at the same time','Solve as many SQL cases as possible before the timer ends','Score = correctness + speed bonus','View the live leaderboard during and after the session']);
  secHeader(doc,'Scoring');
  infoBox(doc,[['Correct Answer:','Full points for the case'],['Speed Bonus:','Faster submission = extra points'],['Wrong Answer:','No penalty — try again!'],['Final Rank:','Determined by total score at session end']],C.warn);
  secHeader(doc,'Tips for Rank Mode');
  featureRow(doc,'F','Be Fast','Practice in Practice Mode first so you\'re fluent during competitions.',C.accentGreen);
  featureRow(doc,'R','Read Carefully','Read the scenario thoroughly before writing SQL.',C.accent);
  featureRow(doc,'M','Keep Moving','Submit your best answer and move to the next case.',C.warn);

  // 6. DQL Lab
  newPage(doc,'6. DQL Lab','Advanced SQL scenarios — deep dive queries');
  bodyText(doc,'DQL Lab focuses on advanced SELECT-based cases: JOINs, subqueries, and aggregations. Detective story scenarios requiring deep SQL knowledge.');
  secHeader(doc,'Features');
  featureRow(doc,'S','Complex Scenarios','Rich detective stories with a database schema to investigate.',C.accent);
  featureRow(doc,'V','Schema Viewer','Visual diagram of all tables and relationships — plan your JOINs here.',C.accentGreen);
  featureRow(doc,'Q','Multi-Query Support','Write and test multiple queries before submitting your final answer.',C.accent);
  featureRow(doc,'B','Achievements','Completing DQL cases earns special badges on your profile.',C.warn);
  secHeader(doc,'Concepts Covered');
  stepBox(doc,['SELECT with WHERE, ORDER BY, and LIMIT','INNER JOIN, LEFT JOIN, RIGHT JOIN','GROUP BY with HAVING clauses','Subqueries and nested SELECT statements','Aggregate functions: COUNT, SUM, AVG, MIN, MAX','String functions and date operations'],C.accentPurple);
  tipBox(doc,'Use the Schema Viewer! Understanding table relationships is the key to writing correct JOINs.');

  // 7. Workshop
  newPage(doc,'7. SQL Workshop','Free-form practice — experiment without limits');
  bodyText(doc,'SQL Workshop is your sandbox environment with no graded cases — a free-form editor for writing any SQL query against the practice database to experiment and learn.');
  secHeader(doc,'Workshop Features');
  featureRow(doc,'E','Free SQL Editor','Write any valid SQL SELECT query against the system sample database.',C.accent);
  featureRow(doc,'D','Sample Database','Realistic tables: students, grades, courses, departments, and more.',C.accentGreen);
  featureRow(doc,'H','Query History','Recent queries are saved so you can revisit and improve them.',C.accent);
  featureRow(doc,'R','Instant Results','Query results appear immediately — no waiting, no submissions.',C.accentGreen);
  secHeader(doc,'When to Use Workshop');
  stepBox(doc,['Practice SQL syntax before a Rank Mode competition','Explore table relationships using SELECT and JOIN','Test query logic before submitting in graded cases','Review database concepts freely at your own pace']);
  tipBox(doc,'Workshop queries are NOT graded. Use it freely to experiment and build confidence!');

  // 8. Profile
  newPage(doc,'8. Your Profile & Progress','Track your growth as a SQL detective');
  bodyText(doc,'The Profile section shows your personal information, badges earned, and overall progress statistics.');
  secHeader(doc,'Profile Sections');
  featureRow(doc,'I','Personal Info','Your name, student ID, section, course, and year level.',C.accent);
  featureRow(doc,'B','Badges & Achievements','Badges appear as you complete challenges, win rank sessions, and hit milestones.',C.warn);
  featureRow(doc,'P','Progress Statistics','Cases solved, accuracy rate, and total points earned.',C.accentGreen);
  featureRow(doc,'S','Account Settings','Update profile picture, request section change, or update password.',C.accentPurple);
  secHeader(doc,'Understanding Your Stats');
  infoBox(doc,[['Cases Solved:','Total SQL cases successfully completed'],['Accuracy Rate:','Percentage of correct first-attempt submissions'],['Total Points:','Cumulative score from all graded activities'],['Rank Badge:','Your standing within your section/course'],['Streak:','Consecutive days you have practiced on the platform']],C.accentGreen);

  // 9. FAQ
  newPage(doc,'9. Notifications, Tips & FAQ','Everything else you need to know');
  secHeader(doc,'Notifications');
  bodyText(doc,'Tap the bell icon in the Dashboard to view notifications:');
  stepBox(doc,['New Rank Mode sessions started by your teacher','Assignment deadlines approaching','Badges and achievements earned','Account changes (section, password, email)']);
  secHeader(doc,'Top Tips');
  featureRow(doc,'D','Practice Daily','Even 15 min of SQL Workshop per day improves your speed dramatically.',C.accentGreen);
  featureRow(doc,'S','Read the Schema','Always check the Schema Viewer before writing JOINs.',C.accent);
  featureRow(doc,'E','Start Easy','Always attempt Easy difficulty first — builds fundamentals.',C.warn);
  featureRow(doc,'H','Use Hints Wisely','Use hints when stuck, but try independently first.',C.accentPurple);
  secHeader(doc,'FAQ');
  infoBox(doc,[['Forgot password?','Use "Forgot Password" on the login page or contact your teacher.'],['Wrong section?','Request a section change from your Profile page.'],["Can't join a room?",'Ask your teacher for the Room Code.'],['Quiz not starting?','Rank Mode must be launched by your teacher. Wait for their signal.'],['Lost progress?','Progress is cloud-saved. Log in from any device to restore it.']],C.accent);

  // Back cover
  doc.addPage(); drawBg(doc);
  doc.rect(0,0,W,6).fill(hex(C.accent));
  doc.fontSize(22).font('Helvetica-Bold').fillColor(hex(C.white)).text("You're Ready to Investigate!",0,H/2-60,{align:'center'});
  doc.fontSize(12).font('Helvetica').fillColor(hex(C.bodyText)).text('Start your first SQL mystery and climb the leaderboard.',0,H/2-20,{align:'center'});
  doc.fontSize(13).font('Helvetica-Bold').fillColor(hex(C.accent)).text('detective-query.vercel.app',0,H/2+20,{align:'center'});
  doc.fontSize(8).font('Helvetica').fillColor(hex(C.muted)).text('For enrolled students only.',0,H-36,{align:'center'});
  doc.end();
  return bufP;
}

// ════════════════════════════════════════════════════════════════════════════
//  TEACHER GUIDE
// ════════════════════════════════════════════════════════════════════════════
async function generateTeacherGuide() {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
  const bufP = streamToBuffer(doc);
  const W = 595, H = 842;
  const AC = C.accentPurple;

  // Cover
  doc.addPage(); drawBg(doc);
  doc.rect(0,0,W,6).fill(hex(AC));
  doc.rect(0,0,W,190).fillOpacity(0.55).fill(hex(C.surface)); doc.fillOpacity(1);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(hex(AC)).text('DETECTIVE QUERY',0,52,{align:'center'});
  doc.fontSize(28).font('Helvetica-Bold').fillColor(hex(C.white)).text('Instructor / Teacher',0,76,{align:'center'});
  doc.fontSize(26).font('Helvetica-Bold').fillColor(hex(AC)).text('Complete Admin Guide',0,112,{align:'center'});
  doc.fontSize(11).font('Helvetica').fillColor(hex(C.bodyText)).text('Full walkthrough for teachers managing classrooms on Detective Query',0,152,{align:'center'});
  doc.save().rect(W/2-50,188,100,1).fillOpacity(0.3).fill(hex(AC)).restore();
  doc.fontSize(12).font('Helvetica-Bold').fillColor(hex(C.white)).text('Welcome, Instructor!',0,210,{align:'center'});
  doc.fontSize(10).font('Helvetica').fillColor(hex(C.bodyText))
     .text('Detective Query gives you complete control over your students learning journey.\nCreate rooms, assign cases, run competitions, track analytics, and manage your classroom\nall from a single, intuitive dashboard.',70,230,{width:W-140,align:'center',lineGap:3});
  const tocY = 296;
  doc.save().roundedRect(60, tocY, W - 120, 226, 8).fillOpacity(0.05).fill(hex(C.white)).restore();
  doc.roundedRect(60, tocY, W - 120, 226, 8).strokeColor(hex(AC)).strokeOpacity(0.25).lineWidth(1).stroke();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(hex(AC)).text('TABLE OF CONTENTS', 85, tocY + 16);
  [
    ['1.', 'Account Setup & First Login'],
    ['2.', 'Teacher Dashboard Overview'],
    ['3.', 'Creating & Managing Rooms'],
    ['4.', 'Setting Up Cases & Difficulties'],
    ['5.', 'Running Rank Mode Sessions'],
    ['6.', 'Progress & Analytics'],
    ['7.', 'Student Management'],
    ['8.', 'Notifications & Communication'],
    ['9.', 'CSV Import — Bulk Enrollment'],
    ['10.', 'Tips & FAQ']
  ].forEach(function(item, i) {
    const itemY = tocY + 38 + i * 17;
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(hex(AC)).text(item[0], 85, itemY);
    doc.fontSize(9.5).font('Helvetica').fillColor(hex(C.white)).text(item[1], 115, itemY, { width: W - 200 });
  });
  doc.fontSize(8).font('Helvetica').fillColor(hex(C.muted)).text('Instructor Guide. For authorized teaching staff only.',0,H-36,{align:'center'});

  // 1. Login
  newPage(doc,'1. Account Setup & First Login','Getting your instructor account ready',AC);
  bodyText(doc,'As a teacher, your account is pre-registered by the system administrator. You receive a private invitation email with a secure setup link.');
  secHeader(doc,'First-Time Setup',AC);
  stepBox(doc,['Check your email for the Detective Query invitation','Click "SETUP MY ACCOUNT" — unique link, expires in 7 days','Verify your pre-filled name and employee ID','Fill in your personal information (gender, birthday)','Create a strong password and complete setup','You will be logged in as Teacher automatically!'],AC);
  secHeader(doc,'Future Logins',AC);
  bodyText(doc,'Visit the login page and enter your credentials. Teachers land on the Teacher Dashboard automatically.');
  infoBox(doc,[['Login URL:','https://detective-query.vercel.app/login'],['Username:','Your institutional email address'],['Role:','Teacher (auto-detected, no selection needed)']],AC);
  tipBox(doc,'Keep your credentials secure. You have full access to student progress data and graded content.');

  // 2. Dashboard
  newPage(doc,'2. Teacher Dashboard Overview','Your control center for classroom management',AC);
  bodyText(doc,'The Teacher Dashboard is divided into four main sections accessible via tabs at the top of the screen.');
  secHeader(doc,'Main Navigation Tabs',AC);
  featureRow(doc,'R','Rooms Tab','View and manage all your classrooms. Create rooms, configure settings, add students, and start sessions.',AC);
  featureRow(doc,'A','Analytics Tab','Deep-dive into student performance — individual scores, completion rates, and class-wide statistics.',C.accentGreen);
  featureRow(doc,'N','Notifications Tab','View and send notifications. See pending student requests.',C.warn);
  featureRow(doc,'P','Profile Tab','Manage your account, update password, and view teaching credentials.',C.accent);
  secHeader(doc,'Quick Actions',AC);
  stepBox(doc,['Create a new Room with one click','Start a Rank Mode session for an existing room','View pending student account change requests','Download analytics reports as CSV or Excel','Manage student enrollments and room assignments'],AC);

  // 3. Rooms
  newPage(doc,'3. Creating & Managing Rooms','Set up your virtual classrooms',AC);
  bodyText(doc,'Rooms are the core unit of Detective Query — each represents a classroom or course section. Create multiple rooms for different sections, topics, or semesters.');
  secHeader(doc,'Creating a Room',AC);
  stepBox(doc,['Go to the Rooms tab','Click the + (Create Room) button','Enter a Room Name (e.g., BSIT 3J SQL Fundamentals)','Select the Section and Semester','Add an optional Room Description','Click Create — your room is ready instantly!'],AC);
  secHeader(doc,'Room Settings',AC);
  featureRow(doc,'C','Room Code','Each room has a unique code students use to join manually.',C.accent);
  featureRow(doc,'A','Case Assignment','Add SQL cases from the library or create custom challenges.',AC);
  featureRow(doc,'D','Deadlines','Set due dates for case sets — students see countdown timers.',C.warn);
  featureRow(doc,'S','Student List','View all enrolled students, progress, and submission status.',C.accentGreen);
  featureRow(doc,'X','Archive','Archive completed rooms at end of semester to keep dashboard clean.',C.muted);
  tipBox(doc,'Create one room per section per semester. Students in the same section share the same room.');

  // 4. Cases
  newPage(doc,'4. Setting Up Cases & Difficulties','Curate the SQL challenges your students solve',AC);
  bodyText(doc,'Cases are individual SQL challenges in Difficulty tiers. Add pre-built cases from the library or author your own custom ones.');
  secHeader(doc,'Difficulty Tiers',AC);
  infoBox(doc,[['Easy:','Basic SELECT queries, WHERE clauses, simple ORDER BY'],['Medium:','JOINs, aggregate functions, GROUP BY with HAVING'],['Hard:','Subqueries, complex JOINs, multi-step data analysis']],AC);
  secHeader(doc,'Adding Cases to a Room',AC);
  stepBox(doc,['Open a Room from the Rooms tab','Click "Manage Cases"','Browse the Case Library by category and difficulty','Select cases to add — appear in room immediately','Optionally set a deadline for each case set'],AC);
  secHeader(doc,'Available Case Modes',AC);
  featureRow(doc,'P','Practice Mode','Students solve cases solo with no time pressure.',C.accent);
  featureRow(doc,'R','Rank Mode','Teacher-activated timed competition. All students solve simultaneously.',C.warn);
  featureRow(doc,'D','DQL Lab','Advanced data querying with schema diagrams. Best for upper-year students.',AC);
  featureRow(doc,'W','SQL Workshop','Free-form sandbox. Students explore without graded submissions.',C.accentGreen);

  // 5. Rank Mode
  newPage(doc,'5. Running Rank Mode Sessions','Facilitate real-time SQL competitions',AC);
  bodyText(doc,'Rank Mode turns SQL practice into a live classroom competition. You control when it starts, what cases are included, and how long it runs.');
  secHeader(doc,'Launching a Session',AC);
  stepBox(doc,['Open the room for the competition','Click "Start Rank Mode" from the room controls','Select cases and set the timer duration','Click "Launch Session" — students are notified instantly','Monitor live progress as students submit answers','Click "End Session" when time is up or all finish','Final results and rankings are visible immediately'],AC);
  secHeader(doc,'During a Session',AC);
  featureRow(doc,'L','Live Leaderboard','Real-time rankings update as students submit answers.',C.warn);
  featureRow(doc,'S','Student Status','See who is connected, who has submitted, and who has not joined.',C.accent);
  featureRow(doc,'T','Timer Control','Extend or end the session early at any time.',AC);
  tipBox(doc,'Announce the session verbally AND via the notification system so all students are ready simultaneously.');
  secHeader(doc,'After the Session',AC);
  bodyText(doc,'Final rankings are locked and visible to all participants. Download results as CSV or Excel from the Analytics tab. Review submissions to identify knowledge gaps.');

  // 6. Analytics
  newPage(doc,'6. Monitoring Progress & Analytics','Data-driven insights into student performance',AC);
  bodyText(doc,'The Analytics tab is your performance intelligence center. Track individual progress, identify struggling learners, and measure class-wide performance.');
  secHeader(doc,'Analytics Sections',AC);
  featureRow(doc,'C','Class Overview','Average scores, completion rates, and engagement metrics for all students.',C.accentGreen);
  featureRow(doc,'I','Individual Student','Drill into a single student submissions, accuracy, and progress over time.',C.accent);
  featureRow(doc,'A','Case Analytics','See which cases are hardest to adjust your teaching focus.',C.warn);
  featureRow(doc,'H','Rank History','Review past Rank Mode sessions with full leaderboard snapshots.',AC);
  featureRow(doc,'E','Export','Download any analytics view as CSV or Excel for your records.',C.muted);
  secHeader(doc,'Key Metrics',AC);
  infoBox(doc,[['Completion Rate:','Percentage of assigned cases each student has finished'],['Accuracy Rate:','First-try correct submissions vs. total attempts'],['Time on Task:','Average time per case — engagement indicator'],['Rank Score:','Points earned in timed Rank Mode sessions'],['Inactive Students:','Students who have not logged in or submitted recently']],C.accentGreen);

  // 7. Student Management
  newPage(doc,'7. Student Management & Enrollments','Manage who is in your rooms',AC);
  bodyText(doc,'Manage student enrollment directly from the Teacher Dashboard — add or remove students, approve account change requests, and reset access.');
  secHeader(doc,'Managing Enrollments',AC);
  stepBox(doc,['Open a Room and go to the Students tab','View all enrolled students with their status','Click "Add Student" to manually add by email','Click the trash icon to remove a student from the room','Removed students previous submissions are preserved in analytics'],AC);
  secHeader(doc,'Approving Student Requests',AC);
  bodyText(doc,'Students can request section changes, password resets, and email updates. These appear in your Notifications tab as pending approval items.');
  featureRow(doc,'S','Section Change','Approve to move the student to the correct room.',AC);
  featureRow(doc,'P','Password Reset','Approve — student receives a reset link via email automatically.',C.accent);
  featureRow(doc,'E','Email Change','Approve email updates — verification sent to new email.',C.warn);
  tipBox(doc,'Handle student change requests promptly. Pending requests can block students from using updated credentials.');

  // 8. Notifications
  newPage(doc,'8. Notifications & Communication','Keep your students informed',AC);
  bodyText(doc,'The Notifications system lets you communicate with students through the platform. Students see notifications in their Dashboard bell icon.');
  secHeader(doc,'Sending Notifications',AC);
  stepBox(doc,['Go to the Notifications tab','Click "Send Notification" or "Broadcast to Room"','Select the target (all students, specific room, or individual)','Write your message','Click Send — students receive it instantly in their notification feed'],AC);
  secHeader(doc,'Notification Types',AC);
  featureRow(doc,'B','Broadcast','Send an announcement to all students in a specific room.',AC);
  featureRow(doc,'I','Individual','Send a personal message or reminder to a specific student.',C.accent);
  featureRow(doc,'A','Auto Notifications','System auto-sends: Rank Mode launch, deadline reminders, badge awards.',C.accentGreen);
  tipBox(doc,'Use notifications to remind students 30 minutes before a Rank Mode session or upcoming deadline.');

  // 9. CSV Import
  newPage(doc,'9. CSV Import — Bulk Student Enrollment','Enroll entire classes in one click',AC);
  bodyText(doc,'The CSV Import feature bulk-enrolls students by uploading a spreadsheet. Each person receives an automated invitation email with their private setup link and a guide PDF automatically attached!');
  secHeader(doc,'CSV File Format',AC);
  infoBox(doc,[['email','(REQUIRED) Active email address'],['first_name','(REQUIRED) Given name'],['last_name','(REQUIRED) Surname / Family name'],['middle_name','Middle name or initial (optional)'],['extension_name','Suffix: Jr., Sr., III (optional)'],['student_number','Official school ID number'],['section','Section name — must match Academic Setup'],['course_code','Program code e.g., BSIT — must match Academic Setup'],['year_level','Year level: 1, 2, 3, or 4'],['role','"student" (default) or "teacher"']],AC);
  secHeader(doc,'Running an Import',AC);
  stepBox(doc,['Go to Admin then Import Students','Download the template to see the required format','Fill in your student data following the template columns','Upload the completed file (.csv or .xlsx)','Select the correct Semester','Click Import — invitation emails and guides are sent automatically','Review results: Success / Skipped / Errors'],AC);
  tipBox(doc,'Already-registered students are automatically skipped. Only new accounts are created.');
  secHeader(doc,'Managing Import Batches',AC);
  featureRow(doc,'V','View Batch','See all invitations with status: pending, completed, or expired.',C.accent);
  featureRow(doc,'R','Resend','Resend individual or all pending invitations with a fresh 7-day token.',C.accentGreen);
  featureRow(doc,'X','Cancel','Cancel a specific invitation to prevent setup completion.',C.warn);

  // 10. FAQ
  newPage(doc,'10. Tips, Best Practices & FAQ','Expert advice for effective use',AC);
  secHeader(doc,'Best Practices',AC);
  featureRow(doc,'P','Plan Your Semester','Create all rooms at semester start and assign cases with deadlines upfront.',C.accentGreen);
  featureRow(doc,'R','Weekly Rank Mode','Run a Rank Mode session weekly to keep students engaged.',C.warn);
  featureRow(doc,'A','Weekly Analytics Check','Review Analytics weekly to identify students needing extra help.',C.accent);
  featureRow(doc,'N','Use Notifications','Send reminders before deadlines and Rank Mode sessions.',AC);
  featureRow(doc,'E','Export Grades','Export analytics data at end of each grading period for official records.',C.accentGreen);
  secHeader(doc,'FAQ',AC);
  infoBox(doc,[["Student can't log in?",'Check if their invitation is pending. Resend from Import Batches.'],['Wrong section?','Approve their Section Change Request from the Notifications tab.'],['Rank Mode not showing?','You must click "Launch Session" — it must be actively started.'],['How to archive a room?','Room > Settings > Archive Room at end of semester.'],['Export not working?','Ensure popups are allowed in your browser for downloads to trigger.'],["Student lost their link?",'Use "Resend" in Import Batches to generate a fresh invitation link.']],AC);

  // Back cover
  doc.addPage(); drawBg(doc);
  doc.rect(0,0,W,6).fill(hex(AC));
  doc.fontSize(22).font('Helvetica-Bold').fillColor(hex(C.white)).text('Ready to Lead Your Class!',0,H/2-60,{align:'center'});
  doc.fontSize(12).font('Helvetica').fillColor(hex(C.bodyText)).text('Build rooms, run competitions, and watch your students master SQL.',0,H/2-20,{align:'center'});
  doc.fontSize(13).font('Helvetica-Bold').fillColor(hex(AC)).text('detective-query.vercel.app',0,H/2+20,{align:'center'});
  doc.fontSize(8).font('Helvetica').fillColor(hex(C.muted)).text('For authorized instructors only.',0,H-36,{align:'center'});
  doc.end();
  return bufP;
}

module.exports = { generateStudentGuide, generateTeacherGuide };
