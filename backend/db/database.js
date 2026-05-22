const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/tasks.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('manager', 'member')),
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT NOT NULL CHECK(priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    status TEXT NOT NULL CHECK(status IN ('Not Started', 'In Progress', 'Completed', 'Blocked')) DEFAULT 'Not Started',
    estimated_hours REAL DEFAULT 0,
    actual_hours REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed demo users if table is empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const insert = db.prepare(
    'INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)'
  );
  insert.run('Alice Manager', 'manager@demo.com', 'manager', hash('manager123'));
  insert.run('Bob Smith', 'bob@demo.com', 'member', hash('member123'));
  insert.run('Carol Jones', 'carol@demo.com', 'member', hash('member123'));
  insert.run('David Lee', 'david@demo.com', 'member', hash('member123'));

  // Seed some sample tasks
  const taskInsert = db.prepare(`
    INSERT INTO tasks (user_id, week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  taskInsert.run(2, '2026-05-19', 'Setup CI/CD pipeline', 'Configure GitHub Actions for automated testing', 'High', 'Completed', 8, 10, 'Ran into Docker issues, resolved with workaround');
  taskInsert.run(2, '2026-05-19', 'Write unit tests for auth module', '', 'Medium', 'In Progress', 6, 4, '');
  taskInsert.run(3, '2026-05-19', 'Design new landing page mockups', 'Use Figma to create 3 variants', 'High', 'Completed', 12, 11, 'Client approved variant 2');
  taskInsert.run(3, '2026-05-19', 'Implement dark mode toggle', '', 'Low', 'Not Started', 4, 0, '');
  taskInsert.run(4, '2026-05-19', 'Database schema review', 'Review and optimize existing queries', 'High', 'Blocked', 6, 2, 'Waiting for DBA approval');
}

module.exports = db;
