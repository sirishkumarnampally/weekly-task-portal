const express = require('express');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

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
