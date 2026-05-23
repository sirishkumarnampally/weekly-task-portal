const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const VALID_TEAMS    = ['VPM', 'CWGW'];
const VALID_STATUSES = ['In Progress', 'Completed'];

function parseSheet(wb, name) {
  const sheet = wb.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function norm(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase().trim(), String(v ?? '').trim()])
  );
}

function parseUsers(rows) {
  const valid = [], errors = [];
  for (const [i, raw] of rows.entries()) {
    const r     = norm(raw);
    const name  = r['name'] || r['full name'] || '';
    const email = (r['email'] || r['email address'] || '').toLowerCase();
    const team  = (r['team'] || '').toUpperCase();
    const dept  = r['dept'] || r['department'] || '';
    const role  = r['role'] === 'manager' ? 'manager' : 'member';
    const pass  = r['password'] || 'member123';

    if (!name || !email) { errors.push(`Row ${i + 2}: Name and Email are required`); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push(`Row ${i + 2}: Invalid email "${email}"`); continue; }
    if (!VALID_TEAMS.includes(team)) { errors.push(`Row ${i + 2}: Team must be VPM or CWGW (got "${team}")`); continue; }

    valid.push({ name, email, team, dept, role, password: pass });
  }
  return { valid, errors };
}

function parseTasks(rows, userEmails) {
  const valid = [], warnings = [];
  const emailSet = new Set(userEmails);

  for (const [i, raw] of rows.entries()) {
    const r     = norm(raw);
    const email = (r['member email'] || r['email'] || '').toLowerCase();
    const title = r['task'] || r['title'] || r['task title'] || '';
    if (!title) continue;

    if (email && !emailSet.has(email)) {
      warnings.push(`Row ${i + 2}: Unknown member email "${email}" — task skipped`);
      continue;
    }

    const rawDate = r['week start'] || r['week start date'] || r['week'] || '';
    let weekStart = '';
    if (rawDate) {
      // Handle Excel numeric dates
      if (!isNaN(rawDate) && Number(rawDate) > 1000) {
        const d = XLSX.SSF.parse_date_code(Number(rawDate));
        weekStart = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      } else {
        weekStart = rawDate;
      }
    }
    if (!weekStart) {
      // Default to current Sunday
      const now = new Date();
      now.setDate(now.getDate() - now.getDay());
      weekStart = now.toISOString().slice(0, 10);
    }

    const status = VALID_STATUSES.includes(r['status']) ? r['status'] : 'In Progress';
    const hours  = parseFloat(r['hours'] || r['actual hours'] || 0) || 0;

    valid.push({
      memberEmail: email,
      title,
      status,
      actual_hours:    hours,
      estimated_hours: hours,
      task_type:  r['task type'] || '',
      requester:  r['requester'] || '',
      owner:      r['owner'] || '',
      team_type:  r['team type'] || '',
      week_start_date: weekStart,
    });
  }
  return { valid, warnings };
}

// ─── GET /api/import/template ──────────────────────────────────────────────
router.get('/template', authenticate, requireManager, (req, res) => {
  const wb = XLSX.utils.book_new();

  // Users sheet
  const usersRows = [
    { Name: 'Alice Smith', Email: 'alice@company.com', Password: 'member123', Team: 'VPM',  Dept: 'AMO',   Role: 'member' },
    { Name: 'Bob Jones',   Email: 'bob@company.com',   Password: 'member123', Team: 'VPM',  Dept: 'PJ',    Role: 'member' },
    { Name: 'Carol Lee',   Email: 'carol@company.com', Password: 'member123', Team: 'CWGW', Dept: 'Infra', Role: 'member' },
    { Name: 'Dan Park',    Email: 'dan@company.com',   Password: 'member123', Team: 'CWGW', Dept: 'AMO',   Role: 'member' },
  ];
  const usersWs = XLSX.utils.json_to_sheet(usersRows);
  usersWs['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, usersWs, 'Users');

  // Tasks sheet
  const today = new Date();
  today.setDate(today.getDate() - today.getDay()); // Sunday
  const weekStr = today.toISOString().slice(0, 10);
  const tasksRows = [
    { 'Member Email': 'alice@company.com', 'Week Start': weekStr, 'Task': 'Profile sync job',    'Status': 'Completed',   'Hours': 8, 'Task Type': 'Regular',  'Requester': 'PM Team', 'Owner': 'Alice', 'Team Type': 'AMO' },
    { 'Member Email': 'alice@company.com', 'Week Start': weekStr, 'Task': 'Schema migration',    'Status': 'In Progress', 'Hours': 4, 'Task Type': 'Irregular', 'Requester': 'TL',      'Owner': 'Alice', 'Team Type': 'AMO' },
    { 'Member Email': 'bob@company.com',   'Week Start': weekStr, 'Task': 'PJ module review',    'Status': 'In Progress', 'Hours': 6, 'Task Type': 'Regular',  'Requester': 'Manager', 'Owner': 'Bob',   'Team Type': 'PJ'  },
    { 'Member Email': 'carol@company.com', 'Week Start': weekStr, 'Task': 'Infra health checks', 'Status': 'Completed',   'Hours': 5, 'Task Type': 'Regular',  'Requester': 'Ops',     'Owner': 'Carol', 'Team Type': 'Infra' },
  ];
  const tasksWs = XLSX.utils.json_to_sheet(tasksRows);
  tasksWs['!cols'] = [
    { wch: 26 }, { wch: 14 }, { wch: 30 }, { wch: 14 },
    { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, tasksWs, 'Tasks');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.xlsx"');
  res.send(buf);
});

// ─── POST /api/import/preview ─────────────────────────────────────────────
// Parse Excel and return what would be imported, without touching the DB.
router.post('/preview', authenticate, requireManager, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let wb;
  try { wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false }); }
  catch { return res.status(400).json({ error: 'Invalid or corrupt Excel file' }); }

  const userRows = parseSheet(wb, 'Users') || parseSheet(wb, wb.SheetNames[0]) || [];
  const taskRows = parseSheet(wb, 'Tasks') || (wb.SheetNames[1] ? parseSheet(wb, wb.SheetNames[1]) : []);

  const { valid: users, errors: userErrors } = parseUsers(userRows);
  const { valid: tasks, warnings: taskWarnings } = parseTasks(taskRows, users.map(u => u.email));

  // Count existing members that will be removed
  const existingMembers = db.prepare(`SELECT COUNT(*) as n FROM users WHERE role = 'member'`).get().n;

  res.json({
    users,
    tasks,
    userErrors,
    taskWarnings,
    existingMembersCount: existingMembers,
  });
});

// ─── POST /api/import/execute ─────────────────────────────────────────────
// Parse Excel, wipe all members + tasks, re-import from file.
router.post('/execute', authenticate, requireManager, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let wb;
  try { wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false }); }
  catch { return res.status(400).json({ error: 'Invalid or corrupt Excel file' }); }

  const userRows = parseSheet(wb, 'Users') || parseSheet(wb, wb.SheetNames[0]) || [];
  const taskRows = parseSheet(wb, 'Tasks') || (wb.SheetNames[1] ? parseSheet(wb, wb.SheetNames[1]) : []);

  const { valid: users, errors: userErrors } = parseUsers(userRows);
  if (users.length === 0) {
    return res.status(400).json({ error: 'No valid users found in Excel', details: userErrors });
  }

  const { valid: tasks, warnings: taskWarnings } = parseTasks(taskRows, users.map(u => u.email));

  let usersImported = 0, tasksImported = 0;

  db.transaction(() => {
    // Delete all tasks belonging to members, then members themselves
    db.prepare(`DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE role = 'member')`).run();
    db.prepare(`DELETE FROM capacity WHERE user_id IN (SELECT id FROM users WHERE role = 'member')`).run();
    db.prepare(`DELETE FROM users WHERE role = 'member'`).run();

    const insertUser = db.prepare(
      `INSERT INTO users (name, email, role, team, dept, password_hash) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertTask = db.prepare(`
      INSERT INTO tasks
        (user_id, title, status, actual_hours, estimated_hours, task_type, requester, owner, team_type, week_start_date, priority, description, week_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Medium', '', 0)
    `);

    const emailToId = {};
    for (const u of users) {
      const r = insertUser.run(u.name, u.email, u.role, u.team, u.dept, bcrypt.hashSync(u.password, 10));
      emailToId[u.email] = r.lastInsertRowid;
      usersImported++;
    }

    for (const t of tasks) {
      const uid = emailToId[t.memberEmail];
      if (!uid) continue;
      insertTask.run(uid, t.title, t.status, t.actual_hours, t.estimated_hours,
        t.task_type, t.requester, t.owner, t.team_type, t.week_start_date);
      tasksImported++;
    }
  })();

  res.json({
    ok: true,
    usersImported,
    tasksImported,
    userErrors,
    taskWarnings,
  });
});

module.exports = router;
