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

// Snap any date (string or Excel serial) to its Sunday
function toSunday(raw) {
  let dateStr = String(raw ?? '').trim();
  if (!dateStr) return null;
  if (!isNaN(dateStr) && Number(dateStr) > 1000) {
    const d = XLSX.SSF.parse_date_code(Number(dateStr));
    dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d)) return null;
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

// Return every Sunday between startRaw's week and endRaw's week (inclusive)
function getWeeksBetween(startRaw, endRaw) {
  const s = toSunday(startRaw);
  const e = toSunday(endRaw) || s;
  if (!s) return [];
  const weeks = [];
  const cur = new Date(s + 'T00:00:00Z');
  const last = new Date(e + 'T00:00:00Z');
  while (cur <= last) {
    weeks.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return weeks;
}

function currentSunday() {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - now.getUTCDay());
  return now.toISOString().slice(0, 10);
}

function parseUploadRows(rows, selfUserId, isManager, emailToId) {
  const valid = [], errors = [];

  for (const [i, raw] of rows.entries()) {
    const r = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), String(v ?? '').trim()])
    );

    const title = r['task title'] || r['title'] || r['task'] || '';
    if (!title) { errors.push(`Row ${i + 2}: Task Title is required`); continue; }

    // Accept either Start Date + End Date  OR  Week Start Date (legacy)
    const startRaw = r['start date'] || r['start'] || r['week start date'] || r['week start'] || r['week'] || '';
    const endRaw   = r['end date']   || r['end']   || '';

    const weeks = endRaw
      ? getWeeksBetween(startRaw, endRaw)
      : [toSunday(startRaw) || currentSunday()];

    if (weeks.length === 0) {
      errors.push(`Row ${i + 2}: Invalid Start Date "${startRaw}" — skipped`); continue;
    }

    // User assignment
    let userId = selfUserId;
    if (isManager) {
      const email = (r['member email'] || r['email'] || '').toLowerCase();
      if (email) {
        if (!emailToId[email]) { errors.push(`Row ${i + 2}: Unknown member "${email}" — skipped`); continue; }
        userId = emailToId[email];
      }
    }

    const totalEst = parseFloat(r['total estimated hours'] || r['estimated hours'] || r['est hours'] || r['est. hours'] || 0) || 0;
    const totalAct = parseFloat(r['total actual hours']    || r['actual hours']    || r['act hours'] || r['act. hours'] || 0) || 0;
    const estPerWk = weeks.length > 1 ? parseFloat((totalEst / weeks.length).toFixed(2)) : totalEst;
    const actPerWk = weeks.length > 1 ? parseFloat((totalAct / weeks.length).toFixed(2)) : totalAct;

    const base = {
      user_id:         userId,
      title,
      description:     r['description'] || r['desc'] || '',
      priority:        VALID_PRIORITIES.includes(r['priority']) ? r['priority'] : 'Medium',
      status:          VALID_STATUSES.includes(r['status'])     ? r['status']   : 'Not Started',
      task_type:       r['task type']  || '',
      requester:       r['requester']  || '',
      owner:           r['owner']      || '',
      team_type:       r['team type']  || '',
      notes:           r['notes']      || '',
      // Carry originals for preview display
      _startDate:      toSunday(startRaw) || currentSunday(),
      _endDate:        toSunday(endRaw)   || toSunday(startRaw) || currentSunday(),
      _totalWeeks:     weeks.length,
    };

    weeks.forEach((weekStart, wi) => {
      valid.push({
        ...base,
        week_start_date: weekStart,
        estimated_hours: estPerWk,
        actual_hours:    actPerWk,
        _weekIndex:      wi + 1,   // for preview label "Week 1 of 3"
      });
    });
  }
  return { valid, errors };
}

// ── GET /api/tasks/upload-template  (must be before /:id) ────────────────────
router.get('/upload-template', authenticate, (req, res) => {
  const isManager = req.user.role === 'manager';
  const wb  = XLSX.utils.book_new();
  const sun = currentSunday();

  // For a sample two-week span
  const twoWeekEnd = (() => {
    const d = new Date(sun + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 13); // 2 weeks later (Saturday)
    return d.toISOString().slice(0, 10);
  })();

  let rows, colWidths;

  if (isManager) {
    // Manager template: Start Date + End Date (spans map to multiple weeks)
    rows = [
      {
        'Member Email': 'himanshu@nissan.com',
        'Task Title': 'VPM sprint planning',
        'Start Date': sun, 'End Date': sun,
        'Description': 'Single-week task',
        'Priority': 'High', 'Status': 'In Progress',
        'Task Type': 'Regular', 'Requester': 'Manager', 'Owner': 'Himanshu',
        'Team Type': 'VPM', 'Total Estimated Hours': 8, 'Total Actual Hours': 5, 'Notes': '',
      },
      {
        'Member Email': 'malik@nissan.com',
        'Task Title': 'CR review & implementation',
        'Start Date': sun, 'End Date': twoWeekEnd,
        'Description': 'Spans two weeks — hours split evenly',
        'Priority': 'Medium', 'Status': 'Not Started',
        'Task Type': 'Irregular', 'Requester': 'TL', 'Owner': 'Malik',
        'Team Type': 'VPM', 'Total Estimated Hours': 16, 'Total Actual Hours': 0, 'Notes': '',
      },
      {
        'Member Email': 'sagar@nissan.com',
        'Task Title': 'CWGW infra health check',
        'Start Date': sun, 'End Date': sun,
        'Description': '',
        'Priority': 'High', 'Status': 'Not Started',
        'Task Type': 'Monitoring', 'Requester': 'Manager', 'Owner': 'Sagar',
        'Team Type': 'CWGW', 'Total Estimated Hours': 6, 'Total Actual Hours': 0, 'Notes': '',
      },
    ];
    colWidths = [
      { wch: 26 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 20 },
    ];
  } else {
    // Member template: Week Start Date (single-week, assigned to self)
    rows = [
      {
        'Week Start Date': sun, 'Task Title': 'My task this week',
        'Description': 'Brief description', 'Priority': 'High', 'Status': 'In Progress',
        'Task Type': 'Regular', 'Requester': 'Manager', 'Owner': req.user.name,
        'Team Type': req.user.team || '', 'Estimated Hours': 4, 'Actual Hours': 2, 'Notes': '',
      },
      {
        'Week Start Date': sun, 'Task Title': 'Second task',
        'Description': '', 'Priority': 'Medium', 'Status': 'Not Started',
        'Task Type': 'Monitoring', 'Requester': 'TL', 'Owner': req.user.name,
        'Team Type': req.user.team || '', 'Estimated Hours': 8, 'Actual Hours': 0, 'Notes': '',
      },
    ];
    colWidths = [
      { wch: 16 }, { wch: 32 }, { wch: 30 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
    ];
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

  // Reference sheet
  const ref = [
    { Column: 'Priority',   'Valid Values': 'High | Medium | Low',                                     Default: 'Medium' },
    { Column: 'Status',     'Valid Values': 'Not Started | In Progress | Completed | Blocked',          Default: 'Not Started' },
    { Column: 'Task Type',  'Valid Values': 'Regular | Monitoring | Enhancement | Support | Irregular', Default: '' },
    { Column: 'Start Date / End Date (admin)', 'Valid Values': 'YYYY-MM-DD — auto-snapped to Sunday; tasks spanning multiple weeks create one entry per week', Default: 'current week' },
    { Column: 'Week Start Date (member)',       'Valid Values': 'YYYY-MM-DD — auto-snapped to Sunday',  Default: 'current week' },
    { Column: 'Total Estimated Hours (admin)',  'Valid Values': 'Total hours — split evenly across all spanned weeks', Default: '0' },
  ];
  if (isManager) ref.unshift({ Column: 'Member Email', 'Valid Values': 'Member login email (himanshu@nissan.com, etc.)', Default: '(required)' });
  const refWs = XLSX.utils.json_to_sheet(ref);
  refWs['!cols'] = [{ wch: 36 }, { wch: 64 }, { wch: 22 }];
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
