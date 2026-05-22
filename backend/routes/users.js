const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// Import users from Excel (manager only)
// Expected columns (case-insensitive): Name, Email, Role, Password
// Role defaults to 'member'; Password defaults to 'Welcome@123'
router.post('/import', authenticate, requireManager, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch {
    return res.status(400).json({ error: 'Invalid Excel file' });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) return res.status(400).json({ error: 'Excel sheet is empty' });

  // Normalize header keys to lowercase for flexible column naming
  const normalize = (obj) => Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase().trim(), String(v).trim()])
  );

  const insert = db.prepare(
    'INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)'
  );

  const results = { created: [], skipped: [], errors: [] };

  for (const rawRow of rows) {
    const row = normalize(rawRow);
    const name  = row['name']  || row['full name'] || row['member name'] || '';
    const email = (row['email'] || row['email address'] || '').toLowerCase();
    const role  = ['manager', 'member'].includes(row['role']) ? row['role'] : 'member';
    const password = row['password'] || 'Welcome@123';

    if (!name || !email) {
      results.errors.push({ row: rawRow, reason: 'Missing name or email' });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.errors.push({ row: rawRow, reason: `Invalid email: ${email}` });
      continue;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      results.skipped.push({ name, email, reason: 'Email already exists' });
      continue;
    }

    try {
      const result = insert.run(name, email, role, bcrypt.hashSync(password, 10));
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
      results.created.push(user);
    } catch (err) {
      results.errors.push({ row: rawRow, reason: err.message });
    }
  }

  res.status(201).json({
    message: `Import complete: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`,
    ...results,
  });
});

// Download the user import template
router.get('/import/template', authenticate, requireManager, (req, res) => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Email', 'Role', 'Password'],
    ['Alice Smith', 'alice@company.com', 'member', 'Welcome@123'],
    ['Bob Jones',   'bob@company.com',   'member', 'Welcome@123'],
    ['Carol White', 'carol@company.com', 'manager', 'Welcome@123'],
  ]);
  ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="user_import_template.xlsx"');
  res.send(buf);
});

module.exports = router;
