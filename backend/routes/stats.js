const express = require('express');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

const TEAM_CONFIG = {
  VPM:  ['AMO', 'PJ', 'Infra'],
  CWGW: ['AMO', 'Infra'],
};

function zero() {
  return { total: 0, total_hours: 0, completed: 0, in_progress: 0 };
}

// GET /api/stats?week=YYYY-MM-DD&month=YYYY-MM&team=VPM
router.get('/', authenticate, requireManager, (req, res) => {
  const { week, month, team } = req.query;

  // Build time filter
  const timeParts = [];
  const timeParams = [];
  if (week)  { timeParts.push(`t.week_start_date = ?`);                        timeParams.push(week); }
  if (month) { timeParts.push(`strftime('%Y-%m', t.week_start_date) = ?`);     timeParams.push(month); }
  const timeWhere = timeParts.length ? `AND ${timeParts.join(' AND ')}` : '';

  // Teams to query
  const teams = team ? [team] : ['VPM', 'CWGW'];

  const result = {};

  for (const t of teams) {
    const subtypes    = TEAM_CONFIG[t];
    const inClause    = subtypes.map(() => '?').join(',');
    const baseParams  = [...subtypes, t, ...timeParams];

    // ── Sub-type totals ────────────────────────────────────────────────────
    const rows = db.prepare(`
      SELECT
        tk.team_type,
        COUNT(*)                                                     AS total,
        COALESCE(SUM(tk.actual_hours), 0)                           AS total_hours,
        SUM(CASE WHEN tk.status = 'Completed'   THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN tk.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress
      FROM tasks tk
      JOIN users u ON tk.user_id = u.id
      WHERE tk.team_type IN (${inClause})
        AND u.team = ?
        ${timeWhere}
      GROUP BY tk.team_type
    `).all(...baseParams);

    const subtypeMap = {};
    for (const st of subtypes) subtypeMap[st] = { ...zero(), team_type: st };
    for (const r of rows) {
      if (subtypeMap[r.team_type]) subtypeMap[r.team_type] = r;
    }

    // ── Member breakdown ───────────────────────────────────────────────────
    const members = db.prepare(`
      SELECT
        tk.team_type,
        u.name                                                       AS member_name,
        u.team                                                       AS member_team,
        COUNT(*)                                                     AS total,
        COALESCE(SUM(tk.actual_hours), 0)                           AS total_hours,
        SUM(CASE WHEN tk.status = 'Completed'   THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN tk.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress
      FROM tasks tk
      JOIN users u ON tk.user_id = u.id
      WHERE tk.team_type IN (${inClause})
        AND u.team = ?
        ${timeWhere}
      GROUP BY tk.team_type, tk.user_id
      ORDER BY tk.team_type, u.name
    `).all(...baseParams);

    // ── Week-by-week trend ─────────────────────────────────────────────────
    const trend = db.prepare(`
      SELECT
        tk.team_type,
        tk.week_start_date,
        COUNT(*)                                                     AS total,
        COALESCE(SUM(tk.actual_hours), 0)                           AS total_hours,
        SUM(CASE WHEN tk.status = 'Completed' THEN 1 ELSE 0 END)   AS completed
      FROM tasks tk
      JOIN users u ON tk.user_id = u.id
      WHERE tk.team_type IN (${inClause})
        AND u.team = ?
      GROUP BY tk.team_type, tk.week_start_date
      ORDER BY tk.week_start_date DESC
      LIMIT 60
    `).all(...[...subtypes, t]);

    const subtypeList = Object.values(subtypeMap);
    const teamTotal = subtypeList.reduce((acc, s) => ({
      total:       acc.total       + s.total,
      total_hours: acc.total_hours + s.total_hours,
      completed:   acc.completed   + s.completed,
      in_progress: acc.in_progress + s.in_progress,
    }), zero());

    result[t] = { subtypes: subtypeList, members, trend, total: teamTotal };
  }

  // ── Grand total across queried teams ──────────────────────────────────────
  const grand = Object.values(result).reduce((acc, td) => ({
    total:       acc.total       + td.total.total,
    total_hours: acc.total_hours + td.total.total_hours,
    completed:   acc.completed   + td.total.completed,
    in_progress: acc.in_progress + td.total.in_progress,
  }), zero());

  res.json({ teams: result, grand });
});

module.exports = router;
