const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, team: user.team || '' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, team: u.team || '' });

// ── Login ────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// ── Self-registration ─────────────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { name, email, password, team } = req.body;

  if (!name || !email || !password || !team)
    return res.status(400).json({ error: 'name, email, password and team are required' });

  if (!['VPM', 'CWGW'].includes(team))
    return res.status(400).json({ error: 'team must be VPM or CWGW' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const result = db.prepare(
    'INSERT INTO users (name, email, role, team, password_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), email.toLowerCase().trim(), 'member', team, bcrypt.hashSync(password, 10));

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

module.exports = router;
