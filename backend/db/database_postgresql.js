const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ─── Connection Configuration ────────────────────────────────────────────────
// Option A: single connection string (recommended for Railway / Render / Supabase)
//   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
//
// Option B: individual fields (useful for local dev)
//   DB_HOST=localhost
//   DB_PORT=5432
//   DB_NAME=weekly_task_portal
//   DB_USER=postgres
//   DB_PASSWORD=your_password
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'weekly_task_portal',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'your_password',
      }
);

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        UNIQUE NOT NULL,
    role          TEXT        NOT NULL CHECK (role IN ('manager', 'member')),
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date  DATE        NOT NULL,
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL DEFAULT '',
    priority         TEXT        NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
    status           TEXT        NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Blocked')) DEFAULT 'Not Started',
    estimated_hours  NUMERIC(5,1) NOT NULL DEFAULT 0,
    actual_hours     NUMERIC(5,1) NOT NULL DEFAULT 0,
    notes            TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Thin wrapper so routes can call db.query() identically to the SQLite version.
const db = {
  query: (text, params) => pool.query(text, params),

  // Returns the first row or undefined (mirrors better-sqlite3 .get())
  async get(text, params) {
    const { rows } = await pool.query(text, params);
    return rows[0];
  },

  // Returns all rows (mirrors better-sqlite3 .all())
  async all(text, params) {
    const { rows } = await pool.query(text, params);
    return rows;
  },

  // Returns lastInsertRowid-style object (mirrors better-sqlite3 .run())
  async run(text, params) {
    const { rows } = await pool.query(text + ' RETURNING id', params);
    return { lastInsertRowid: rows[0]?.id };
  },

  pool, // expose pool for transactions if needed
};

// ─── Initialise schema + seed ─────────────────────────────────────────────────

async function init() {
  // Create tables
  await pool.query(SCHEMA_SQL);

  // Seed demo users only if the table is empty
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (parseInt(rows[0].count) > 0) return;

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const insertUser = `
    INSERT INTO users (name, email, role, password_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;

  const [mgr, bob, carol, david] = await Promise.all([
    pool.query(insertUser, ['Alice Manager', 'manager@demo.com', 'manager', hash('manager123')]),
    pool.query(insertUser, ['Bob Smith',     'bob@demo.com',     'member',  hash('member123')]),
    pool.query(insertUser, ['Carol Jones',   'carol@demo.com',   'member',  hash('member123')]),
    pool.query(insertUser, ['David Lee',     'david@demo.com',   'member',  hash('member123')]),
  ]);

  const bobId   = bob.rows[0].id;
  const carolId = carol.rows[0].id;
  const davidId = david.rows[0].id;

  const insertTask = `
    INSERT INTO tasks
      (user_id, week_start_date, title, description, priority, status, estimated_hours, actual_hours, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;

  await Promise.all([
    pool.query(insertTask, [bobId,   '2026-05-19', 'Setup CI/CD pipeline',             'Configure GitHub Actions for automated testing', 'High',   'Completed',   8, 10, 'Ran into Docker issues, resolved with workaround']),
    pool.query(insertTask, [bobId,   '2026-05-19', 'Write unit tests for auth module',  '',                                              'Medium', 'In Progress', 6,  4, '']),
    pool.query(insertTask, [carolId, '2026-05-19', 'Design new landing page mockups',   'Use Figma to create 3 variants',                'High',   'Completed',  12, 11, 'Client approved variant 2']),
    pool.query(insertTask, [carolId, '2026-05-19', 'Implement dark mode toggle',        '',                                              'Low',    'Not Started', 4,  0, '']),
    pool.query(insertTask, [davidId, '2026-05-19', 'Database schema review',            'Review and optimize existing queries',           'High',   'Blocked',     6,  2, 'Waiting for DBA approval']),
  ]);

  console.log('Database seeded with demo users and tasks.');
}

init().catch((err) => {
  console.error('Database initialisation failed:', err.message);
  process.exit(1);
});

module.exports = db;
