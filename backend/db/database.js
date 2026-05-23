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
    team TEXT NOT NULL DEFAULT '',
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

// Migrations — safe to run on existing DBs
try { db.exec(`ALTER TABLE users ADD COLUMN team TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN dept TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN requester TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN week_no INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN owner TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN team_type TEXT DEFAULT ''`); } catch {}

// Capacity table: available hours and leave per user per week
db.exec(`
  CREATE TABLE IF NOT EXISTS capacity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date TEXT NOT NULL,
    available_hours REAL DEFAULT 0,
    leave_hours REAL DEFAULT 0,
    UNIQUE(user_id, week_start_date)
  );
`);

// Seed demo users if table is empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const insert = db.prepare(
    'INSERT INTO users (name, email, role, team, password_hash) VALUES (?, ?, ?, ?, ?)'
  );

  // Managers
  insert.run('Alice Manager', 'manager@demo.com', 'manager', 'VPM',  hash('manager123'));

  // VPM team
  insert.run('Bob Smith',   'bob@demo.com',   'member', 'VPM',  hash('member123'));
  insert.run('Carol Jones', 'carol@demo.com', 'member', 'VPM',  hash('member123'));

  // CWGW team
  insert.run('David Lee',   'david@demo.com', 'member', 'CWGW', hash('member123'));
  insert.run('Eva Chen',    'eva@demo.com',   'member', 'CWGW', hash('member123'));

  // Get inserted IDs
  const bob   = db.prepare("SELECT id FROM users WHERE email='bob@demo.com'").get();
  const carol = db.prepare("SELECT id FROM users WHERE email='carol@demo.com'").get();
  const david = db.prepare("SELECT id FROM users WHERE email='david@demo.com'").get();
  const eva   = db.prepare("SELECT id FROM users WHERE email='eva@demo.com'").get();

  const taskInsert = db.prepare(`
    INSERT INTO tasks (user_id, week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const week = '2026-05-19';

  // VPM tasks
  taskInsert.run(bob.id,   week, 'Setup CI/CD pipeline',            'Configure GitHub Actions for automated testing', 'High',   'Completed',   8, 10, 'Ran into Docker issues, resolved with workaround');
  taskInsert.run(bob.id,   week, 'Write unit tests for auth module', '',                                              'Medium', 'In Progress', 6,  4, '');
  taskInsert.run(carol.id, week, 'Design new landing page mockups',  'Use Figma to create 3 variants',               'High',   'Completed',  12, 11, 'Client approved variant 2');
  taskInsert.run(carol.id, week, 'Implement dark mode toggle',       '',                                              'Low',    'Not Started', 4,  0, '');

  // CWGW tasks
  taskInsert.run(david.id, week, 'Database schema review',           'Review and optimize existing queries',          'High',   'Blocked',     6,  2, 'Waiting for DBA approval');
  taskInsert.run(david.id, week, 'API rate limiting implementation',  'Add throttle middleware to all endpoints',      'High',   'In Progress', 8,  5, '');
  taskInsert.run(eva.id,   week, 'QA regression test suite',         'Full regression for v2.1 release',             'Medium', 'Not Started', 10, 0, '');
  taskInsert.run(eva.id,   week, 'Update deployment runbook',        '',                                              'Low',    'Completed',   3,  3, 'Done, shared with team');
}

module.exports = db;
