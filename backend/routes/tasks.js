const express = require('express');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// Get tasks — members see only their own, managers see all (with optional filters)
router.get('/', authenticate, (req, res) => {
  const { week, user_id, status, priority } = req.query;
  const isManager = req.user.role === 'manager';

  let query = `
    SELECT t.*, u.name as member_name, u.email as member_email
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (!isManager) {
    query += ' AND t.user_id = ?';
    params.push(req.user.id);
  } else if (user_id) {
    query += ' AND t.user_id = ?';
    params.push(user_id);
  }

  if (week) {
    query += ' AND t.week_start_date = ?';
    params.push(week);
  }
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }

  query += ' ORDER BY t.week_start_date DESC, t.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// Get single task
router.get('/:id', authenticate, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as member_name FROM tasks t JOIN users u ON t.user_id = u.id WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'manager' && task.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(task);
});

// Create task
router.post('/', authenticate, (req, res) => {
  const { week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes } = req.body;
  if (!title || !week_start_date) {
    return res.status(400).json({ error: 'title and week_start_date are required' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (user_id, week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, week_start_date, title,
    description || '', priority || 'Medium', status || 'Not Started',
    estimated_hours || 0, actual_hours || 0, notes || ''
  );

  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Update task
router.put('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'manager' && task.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { title, description, priority, status, estimated_hours, actual_hours, notes, week_start_date } = req.body;

  db.prepare(`
    UPDATE tasks SET
      title = ?, description = ?, priority = ?, status = ?,
      estimated_hours = ?, actual_hours = ?, notes = ?,
      week_start_date = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? task.title,
    description ?? task.description,
    priority ?? task.priority,
    status ?? task.status,
    estimated_hours ?? task.estimated_hours,
    actual_hours ?? task.actual_hours,
    notes ?? task.notes,
    week_start_date ?? task.week_start_date,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// Delete task
router.delete('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'manager' && task.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
