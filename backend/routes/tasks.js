const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const db      = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers for Excel task upload ─────────────────────────────────────────────

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_STATUSES   = ['Not Started', 'In Progress', 'Completed', 'Blocked'];

// Snap any date string to its Sunday (week_start_date key used throughout the app)
function toSunday(raw) {
  // Handle Excel serial numbers
  let dateStr = String(raw ?? '').trim();
  if (!isNaN(dateStr) && Number(dateStr) > 1000) {
    const d = XLSX.SSF.parse_date_code(Number(dateStr));
    dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d)) return null;
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return d.toISOString().slice(0, 10);
}

function parseUploadRows(rows, selfUserId, isManager, emailToId) {
  const valid = [], errors = [];

  for (const [i, raw] of rows.entries()) {
    const r = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), String(v ?? '').trim()])
    );

    const title = r['task title'] || r['title'] || r['task'] || '';
    if (!title) { errors.push(`Row ${i + 2}: Task Title is required`); continue; }

    // Week date — snap to Sunday
    const rawDate = r['week start date'] || r['week start'] || r['week'] || '';
    const weekStart = toSunday(rawDate) || (() => {
      const now = new Date();
      now.setUTCDate(now.getUTCDate() - now.getUTCDay());
      return now.toISOString().slice(0, 10);
    })();

    // User assignment
    let userId = selfUserId;
    if (isManager) {
      const email = (r['member email'] || r['email'] || '').toLowerCase();
      if (email) {
        if (!emailToId[email]) { errors.push(`Row ${i + 2}: Unknown member "${email}" — skipped`); continue; }
        userId = emailToId[email];
      }
    }

    valid.push({
      user_id:         userId,
      week_start_date: weekStart,
      title,
      description:     r['description'] || r['desc'] || '',
      priority:        VALID_PRIORITIES.includes(r['priority'])  ? r['priority'] : 'Medium',
      status:          VALID_STATUSES.includes(r['status'])      ? r['status']   : 'Not Started',
      task_type:       r['task type']  || '',
      requester:       r['requester']  || '',
      owner:           r['owner']      || '',
      team_type:       r['team type']  || '',
      estimated_hours: parseFloat(r['estimated hours'] || r['est hours'] || r['est. hours'] || 0) || 0,
      actual_hours:    parseFloat(r['actual hours']    || r['act hours'] || r['act. hours'] || 0) || 0,
      notes:           r['notes'] || '',
    });
  }
  return { valid, errors };
}

// ── GET /api/tasks/upload-template  (must be before /:id) ────────────────────
router.get('/upload-template', authenticate, (req, res) => {
  const isManager = req.user.role === 'manager';
  const wb  = XLSX.utils.book_new();
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - now.getUTCDay());
  const week = now.toISOString().slice(0, 10);

  const base = {
    'Week Start Date': week, 'Task Title': 'Example task', 'Description': 'Brief description',
    'Priority': 'High', 'Status': 'In Progress', 'Task Type': 'Regular',
    'Requester': 'Manager', 'Owner': req.user.name, 'Team Type': req.user.team || '',
    'Estimated Hours': 4, 'Actual Hours': 2, 'Notes': '',
  };
  const rows = isManager
    ? [
        { 'Member Email': 'himanshu@nissan.com', ...base, 'Task Title': 'VPM weekly report' },
        { 'Member Email': 'malik@nissan.com',    ...base, 'Task Title': 'CR review',  'Priority': 'Medium', 'Status': 'Not Started', 'Actual Hours': 0 },
      ]
    : [
        { ...base },
        { ...base, 'Task Title': 'Second task', 'Priority': 'Medium', 'Status': 'Not Started', 'Actual Hours': 0 },
      ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = (isManager ? [{ wch: 26 }] : []).concat([
    { wch: 16 }, { wch: 32 }, { wch: 30 }, { wch: 10 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

  // Reference sheet
  const ref = [
    { Column: 'Priority',        'Valid Values': 'High | Medium | Low',                                     Default: 'Medium' },
    { Column: 'Status',          'Valid Values': 'Not Started | In Progress | Completed | Blocked',          Default: 'Not Started' },
    { Column: 'Week Start Date', 'Valid Values': 'YYYY-MM-DD — snapped to Sunday automatically',             Default: 'current week' },
    { Column: 'Task Type',       'Valid Values': 'Regular | Monitoring | Enhancement | Support | Irregular', Default: '' },
  ];
  if (isManager) ref.unshift({ Column: 'Member Email', 'Valid Values': 'Member\'s login email', Default: '(required for manager)' });
  const refWs = XLSX.utils.json_to_sheet(ref);
  refWs['!cols'] = [{ wch: 20 }, { wch: 52 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, refWs, 'Field Reference');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="task_upload_template.xlsx"');
  res.send(buf);
});

// ── POST /api/tasks/upload/preview — parse file, return rows without saving ──
router.post('/upload/preview', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let wb;
  try { wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false }); }
  catch { return res.status(400).json({ error: 'Invalid or corrupt Excel file' }); }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return res.status(400).json({ error: 'Excel file has no sheets' });
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const isManager = req.user.role === 'manager';
  const emailToId = {};
  const idToName  = { [req.user.id]: req.user.name };

  if (isManager) {
    db.prepare(`SELECT id, email, name FROM users WHERE role = 'member'`).all()
      .forEach(m => { emailToId[m.email.toLowerCase()] = m.id; idToName[m.id] = m.name; });
  }

  const { valid, errors } = parseUploadRows(rows, req.user.id, isManager, emailToId);
  const tasks = valid.map(t => ({ ...t, member_name: idToName[t.user_id] || 'Unknown' }));
  res.json({ tasks, errors, count: valid.length });
});

// ── POST /api/tasks/upload — parse and persist ────────────────────────────────
router.post('/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let wb;
  try { wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false }); }
  catch { return res.status(400).json({ error: 'Invalid or corrupt Excel file' }); }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return res.status(400).json({ error: 'Excel file has no sheets' });
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const isManager = req.user.role === 'manager';
  const emailToId = {};
  if (isManager) {
    db.prepare(`SELECT id, email FROM users WHERE role = 'member'`).all()
      .forEach(m => { emailToId[m.email.toLowerCase()] = m.id; });
  }

  const { valid, errors } = parseUploadRows(rows, req.user.id, isManager, emailToId);
  if (valid.length === 0) return res.status(400).json({ error: 'No valid tasks found', details: errors });

  const stmt = db.prepare(`
    INSERT INTO tasks (user_id, week_start_date, title, description, priority, status,
                       task_type, requester, owner, team_type, estimated_hours, actual_hours, notes, week_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  let imported = 0;
  db.transaction(() => {
    for (const t of valid) {
      stmt.run(t.user_id, t.week_start_date, t.title, t.description, t.priority, t.status,
               t.task_type, t.requester, t.owner, t.team_type, t.estimated_hours, t.actual_hours, t.notes);
      imported++;
    }
  })();

  res.json({ ok: true, imported, errors });
});

// Get tasks
// - Manager: sees all tasks, optionally filtered by team/user/week/status/priority
// - Member:  sees ALL tasks within their own team (read), can edit/delete only their own
router.get('/', authenticate, (req, res) => {
  const { week, user_id, status, priority, team } = req.query;
  const isManager = req.user.role === 'manager';

  let query = `
    SELECT t.*, u.name as member_name, u.email as member_email, u.team as member_team
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (!isManager) {
    // Hard-scope to the member's team — cannot see the other team's data
    query += ' AND u.team = ?';
    params.push(req.user.team || '');

    // Optionally drill down to a specific member within the team
    if (user_id) {
      query += ' AND t.user_id = ?';
      params.push(user_id);
    }
  } else {
    // Manager: optional team / user filters
    if (team) {
      query += ' AND u.team = ?';
      params.push(team);
    }
    if (user_id) {
      query += ' AND t.user_id = ?';
      params.push(user_id);
    }
  }

  if (week)     { query += ' AND t.week_start_date = ?'; params.push(week); }
  if (status)   { query += ' AND t.status = ?';          params.push(status); }
  if (priority) { query += ' AND t.priority = ?';        params.push(priority); }

  query += ' ORDER BY t.week_start_date DESC, u.name, t.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// Get single task — member can only see tasks from their own team
router.get('/:id', authenticate, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as member_name, u.team as member_team
    FROM tasks t JOIN users u ON t.user_id = u.id WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const isManager = req.user.role === 'manager';
  const sameTeam  = task.member_team === req.user.team;
  if (!isManager && !sameTeam)
    return res.status(403).json({ error: 'Access denied' });

  res.json(task);
});

// Create task — always owned by the requesting user
router.post('/', authenticate, (req, res) => {
  const { week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes,
          task_type, requester, week_no, owner, team_type } = req.body;
  if (!title || !week_start_date)
    return res.status(400).json({ error: 'title and week_start_date are required' });

  // team_type: manager can set explicitly, member defaults to their team
  const resolvedTeamType = req.user.role === 'manager'
    ? (team_type || '')
    : (req.user.team || '');

  const result = db.prepare(`
    INSERT INTO tasks (user_id, week_start_date, title, description, priority, status,
                       estimated_hours, actual_hours, notes, task_type, requester, week_no, owner, team_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, week_start_date, title,
    description || '', priority || 'Medium', status || 'Not Started',
    estimated_hours || 0, actual_hours || 0, notes || '',
    task_type || '', requester || '', week_no || 0, owner || '', resolvedTeamType
  );

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
});

// Update task — member can only edit their OWN tasks (not teammates')
router.put('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'manager' && task.user_id !== req.user.id)
    return res.status(403).json({ error: 'You can only edit your own tasks' });

  const { title, description, priority, status, estimated_hours, actual_hours, notes, week_start_date,
          task_type, requester, week_no, owner, team_type } = req.body;

  db.prepare(`
    UPDATE tasks SET
      title = ?, description = ?, priority = ?, status = ?,
      estimated_hours = ?, actual_hours = ?, notes = ?,
      week_start_date = ?, task_type = ?, requester = ?,
      week_no = ?, owner = ?, team_type = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title           ?? task.title,
    description     ?? task.description,
    priority        ?? task.priority,
    status          ?? task.status,
    estimated_hours ?? task.estimated_hours,
    actual_hours    ?? task.actual_hours,
    notes           ?? task.notes,
    week_start_date ?? task.week_start_date,
    task_type       ?? task.task_type,
    requester       ?? task.requester,
    week_no         ?? task.week_no,
    owner           ?? task.owner,
    team_type       ?? task.team_type,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// Delete task — member can only delete their OWN tasks
router.delete('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'manager' && task.user_id !== req.user.id)
    return res.status(403).json({ error: 'You can only delete your own tasks' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
