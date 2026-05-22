const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// List all users (manager only)
router.get('/', authenticate, requireManager, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// Create user (manager only)
router.post('/', authenticate, requireManager, (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role || !password) {
    return res.status(400).json({ error: 'name, email, role and password are required' });
  }
  if (!['manager', 'member'].includes(role)) {
    return res.status(400).json({ error: 'role must be manager or member' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const result = db.prepare(
    'INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)'
  ).run(name, email.toLowerCase().trim(), role, bcrypt.hashSync(password, 10));

  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// Update user (manager only)
router.put('/:id', authenticate, requireManager, (req, res) => {
  const { name, email, role, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const passwordHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare(
    'UPDATE users SET name = ?, email = ?, role = ?, password_hash = ? WHERE id = ?'
  ).run(
    name ?? user.name,
    email ? email.toLowerCase().trim() : user.email,
    role ?? user.role,
    passwordHash,
    req.params.id
  );

  res.json(db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id));
});

// Delete user (manager only)
router.delete('/:id', authenticate, requireManager, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

module.exports = router;
