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

  // Manager
  insert.run('Nampally Sirish Kumar', 'manager@demo.com', 'manager', 'VPM', hash('manager123'));

  // VPM members
  const vpmMembers = [
    ['Himanshu',   'himanshu@nissan.com'],
    ['Malik',      'malik@nissan.com'],
    ['Sachin',     'sachin@nissan.com'],
    ['Ramana',     'ramana@nissan.com'],
    ['Aishwarya',  'aishwarya@nissan.com'],
    ['Venkat',     'venkat@nissan.com'],
    ['Bharat',     'bharat@nissan.com'],
    ['Shiv',       'shiv@nissan.com'],
    ['Anusha',     'anusha@nissan.com'],
    ['Samir',      'samir@nissan.com'],
    ['Naresh',     'naresh@nissan.com'],
  ];
  for (const [name, email] of vpmMembers) {
    insert.run(name, email, 'member', 'VPM', hash('member123'));
  }

  // CWGW members
  const cwgwMembers = [
    ['Sagar',      'sagar@nissan.com'],
    ['Syed',       'syed@nissan.com'],
    ['Lohtih',     'lohtih@nissan.com'],
    ['Arjun',      'arjun@nissan.com'],
    ['Hari',       'hari@nissan.com'],
    ['Sai Videla', 'saividela@nissan.com'],
    ['Raju',       'raju@nissan.com'],
    ['Mohan',      'mohan@nissan.com'],
    ['Santhosh',   'santhosh@nissan.com'],
    ['Sushma',     'sushma@nissan.com'],
  ];
  for (const [name, email] of cwgwMembers) {
    insert.run(name, email, 'member', 'CWGW', hash('member123'));
  }

  // Seed a few demo tasks for Himanshu
  const himanshu = db.prepare("SELECT id FROM users WHERE email='himanshu@nissan.com'").get();
  const taskInsert = db.prepare(`
    INSERT INTO tasks (user_id, week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const week = '2026-05-19';
  taskInsert.run(himanshu.id, week, 'VPM weekly status report',    'Compile and share team progress update',        'High',   'Completed',  4,  4, '');
  taskInsert.run(himanshu.id, week, 'Review change requests',      'Assess and prioritise incoming CRs for sprint', 'Medium', 'In Progress', 6, 3, '');
}

module.exports = db;
