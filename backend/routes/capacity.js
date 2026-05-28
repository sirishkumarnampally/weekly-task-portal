const express = require('express');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// Return Sunday–Saturday weeks that overlap with a given month
function getWeeksForMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);

  // Find the Sunday on or before firstDay
  const getSunday = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // getDay() 0=Sun, so Sun→0, Mon→-1, ...
    return d;
  };

  const pad    = (n) => String(n).padStart(2, '0');
  const toStr  = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmt    = (d) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;

  const weeks = [];
  let sunday  = getSunday(firstDay);
  let weekNum = 1;

  while (sunday <= lastDay) {
    // Saturday = Sunday + 6
    const saturday   = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const dispStart  = sunday < firstDay ? new Date(firstDay) : new Date(sunday);
    const dispEnd    = saturday > lastDay ? new Date(lastDay)  : new Date(saturday);

    // Working days (Mon–Fri) within the display range
    let workingDays = 0;
    const d = new Date(dispStart);
    while (d <= dispEnd) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) workingDays++;
      d.setDate(d.getDate() + 1);
    }

    weeks.push({
      label:     `Week-${pad(weekNum)}`,
      weekStart: toStr(sunday),     // Sunday — matches task week_start_date (also Sunday-based now)
      weekEnd:   toStr(saturday),
      dispStart: toStr(dispStart),
      dispEnd:   toStr(dispEnd),
      dateRange: `${fmt(dispStart)} - ${fmt(dispEnd)}`,
      workingDays,
    });

    weekNum++;
    sunday = new Date(sunday);
    sunday.setDate(sunday.getDate() + 7);
  }

  return weeks;
}

// Aggregate task hours for a user between two dates
function getTaskHours(userId, weekStart, weekEnd) {
  const rows = db.prepare(`
    SELECT COALESCE(SUM(actual_hours), 0) as hrs, task_type, COUNT(*) as cnt
    FROM tasks
    WHERE user_id = ?
      AND week_start_date >= ?
      AND week_start_date <= ?
    GROUP BY task_type
  `).all(userId, weekStart, weekEnd);

  let taskCount = 0, taskHours = 0, monitoringHours = 0, enhancementHours = 0;
  for (const r of rows) {
    const t = (r.task_type || '').toLowerCase();
    if (t === 'monitoring' || t === 'support') {
      monitoringHours += r.hrs;
    } else if (t === 'enhancement') {
      enhancementHours += r.hrs;
    } else {
      taskCount += r.cnt;
      taskHours += r.hrs;
    }
  }
  return { taskCount, taskHours, monitoringHours, enhancementHours };
}

// GET /api/capacity/report?month=YYYY-MM&team=VPM
router.get('/report', authenticate, requireManager, (req, res) => {
  const { month, team } = req.query;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

  const [year, mon] = month.split('-').map(Number);
  const weeks       = getWeeksForMonth(year, mon);

  // Members for this report
  let mq = `SELECT id, name, team, dept FROM users WHERE role = 'member'`;
  const mp = [];
  if (team) { mq += ' AND team = ?'; mp.push(team); }
  mq += ' ORDER BY team, name';
  const members = db.prepare(mq).all(...mp);

  const pad      = (n) => String(n).padStart(2, '0');
  const lastDay  = new Date(year, mon, 0).getDate();
  const monthStart = `${year}-${pad(mon)}-01`;
  const monthEnd   = `${year}-${pad(mon)}-${pad(lastDay)}`;

  const DEFAULT_HRS_PER_DAY = 9;

  // weekStart  = actual Sunday (matches what members save leave against)
  // dispStart/dispEnd = month-clipped boundaries used only for task queries
  //   to prevent cross-month task bleeding.
  const firstWeekStart = weeks[0].weekStart;
  const lastWeekStart  = weeks[weeks.length - 1].weekStart;

  const weeksData = weeks.map(w => {
    const memberRows = members.map(m => {
      // Capacity records (leave + overrides) are keyed by weekStart (Sunday).
      // Members save leave via the week picker which uses Sunday keys.
      const cap = db.prepare(
        `SELECT available_hours, leave_hours FROM capacity WHERE user_id = ? AND week_start_date = ?`
      ).get(m.id, w.weekStart);

      const leaveHours     = cap?.leave_hours || 0;
      const availableHours = cap?.available_hours > 0
        ? cap.available_hours
        : Math.max(0, w.workingDays * DEFAULT_HRS_PER_DAY - leaveHours);
      // Task query lower bound = weekStart so partial-first-week tasks (stored
      // under prior-month Sunday) are included; upper bound = dispEnd to prevent
      // next-month tasks bleeding in on the last partial week.
      const { taskCount, taskHours, monitoringHours, enhancementHours } = getTaskHours(m.id, w.weekStart, w.dispEnd);
      const totalHours     = taskHours + monitoringHours + enhancementHours;

      return {
        userId: m.id,
        name: m.name,
        dept: m.dept || m.team || '',
        availableHours,
        leaveHours,
        taskCount,
        taskHours,
        monitoringHours,
        enhancementHours,
        totalHours,
      };
    });

    const totalHours     = memberRows.reduce((s, r) => s + r.totalHours, 0);
    const maxAvail       = Math.max(...memberRows.map(r => r.availableHours).filter(h => h > 0), 1);
    const actualManWeeks = totalHours / maxAvail;

    return { ...w, members: memberRows, totalHours, maxAvail, actualManWeeks };
  });

  // Monthly totals — use weekStart boundaries so partial first/last weeks
  // (whose Sunday may fall outside the calendar month) are included correctly.
  const monthlyMembers = members.map(m => {
    const capAgg = db.prepare(`
      SELECT COALESCE(SUM(available_hours), 0) as total_avail,
             COALESCE(SUM(leave_hours), 0)     as total_leave
      FROM capacity
      WHERE user_id = ? AND week_start_date >= ? AND week_start_date <= ?
    `).get(m.id, firstWeekStart, lastWeekStart);

    const totalWorkingDays = weeks.reduce((s, w) => s + w.workingDays, 0);
    const leaveHours       = capAgg?.total_leave || 0;
    const availableHours   = capAgg?.total_avail > 0
      ? capAgg.total_avail
      : Math.max(0, totalWorkingDays * DEFAULT_HRS_PER_DAY - leaveHours);

    const { taskCount, taskHours, monitoringHours, enhancementHours } = getTaskHours(m.id, firstWeekStart, lastWeekStart);
    const totalHours = taskHours + monitoringHours + enhancementHours;

    return {
      userId: m.id,
      name: m.name,
      dept: m.dept || m.team || '',
      availableHours,
      leaveHours,
      taskCount,
      taskHours,
      monitoringHours,
      enhancementHours,
      totalHours,
    };
  });

  const monthTotalHours = monthlyMembers.reduce((s, r) => s + r.totalHours, 0);
  const maxMonthAvail   = Math.max(...monthlyMembers.map(r => r.availableHours).filter(h => h > 0), 1);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel = `${MONTHS[mon - 1]} ${year}`;

  res.json({
    month,
    monthLabel,
    monthDateRange: `01 ${MONTHS[mon - 1]} - ${pad(lastDay)} ${MONTHS[mon - 1]}`,
    weeks: weeksData,
    monthly: {
      label: monthLabel,
      members: monthlyMembers,
      totalHours: monthTotalHours,
      maxAvail: maxMonthAvail,
      actualManWeeks: monthTotalHours / maxMonthAvail,
    },
  });
});

// GET /api/capacity?week=YYYY-MM-DD&team=VPM  — capacity settings for a week
router.get('/', authenticate, requireManager, (req, res) => {
  const { week, team } = req.query;
  let q = `SELECT c.*, u.name, u.team, u.dept FROM capacity c JOIN users u ON c.user_id = u.id WHERE 1=1`;
  const p = [];
  if (week) { q += ' AND c.week_start_date = ?'; p.push(week); }
  if (team) { q += ' AND u.team = ?'; p.push(team); }
  res.json(db.prepare(q).all(...p));
});

// POST /api/capacity/bulk  — upsert capacity for multiple user/weeks
router.post('/bulk', authenticate, requireManager, (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries[] required' });

  const stmt = db.prepare(`
    INSERT INTO capacity (user_id, week_start_date, available_hours, leave_hours)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, week_start_date) DO UPDATE SET
      available_hours = excluded.available_hours,
      leave_hours     = excluded.leave_hours
  `);

  db.transaction((rows) => rows.forEach(r => stmt.run(r.user_id, r.week_start_date, r.available_hours || 0, r.leave_hours || 0)))(entries);
  res.json({ ok: true, count: entries.length });
});

// GET /api/capacity/leave-summary?week=YYYY-MM-DD|month=YYYY-MM&team=
// Returns all members with their leave. month= aggregates across all weeks of the month.
router.get('/leave-summary', authenticate, requireManager, (req, res) => {
  const { week, month, team } = req.query;
  if (!week && !month) return res.status(400).json({ error: 'week or month required' });

  if (month) {
    // Use getWeeksForMonth so we query by weekStart (Sunday) range — the same
    // keys members use when saving leave. strftime('%Y-%m', ...) would miss the
    // first week when its Sunday falls in the prior calendar month.
    const [ly, lm] = month.split('-').map(Number);
    const monthWeeksList = getWeeksForMonth(ly, lm);
    const firstWkStart = monthWeeksList[0].weekStart;
    const lastWkStart  = monthWeeksList[monthWeeksList.length - 1].weekStart;

    // Aggregate leave per user across all weeks of the month
    let q = `
      SELECT u.id, u.name, u.team,
             COALESCE(SUM(c.leave_hours), 0) AS leave_hours
      FROM users u
      LEFT JOIN capacity c ON c.user_id = u.id
        AND c.week_start_date >= ? AND c.week_start_date <= ?
      WHERE u.role = 'member'
    `;
    const p = [firstWkStart, lastWkStart];
    if (team) { q += ' AND u.team = ?'; p.push(team); }
    q += ' GROUP BY u.id, u.name, u.team ORDER BY u.team, u.name';
    const members = db.prepare(q).all(...p);

    // Per-week detail for members who have leave
    let wq = `
      SELECT c.user_id, c.week_start_date, c.leave_hours
      FROM capacity c
      JOIN users u ON c.user_id = u.id
      WHERE u.role = 'member'
        AND c.week_start_date >= ? AND c.week_start_date <= ?
        AND c.leave_hours > 0
    `;
    const wp = [firstWkStart, lastWkStart];
    if (team) { wq += ' AND u.team = ?'; wp.push(team); }
    wq += ' ORDER BY c.week_start_date';
    const weekRows = db.prepare(wq).all(...wp);

    const weekMap = {};
    for (const r of weekRows) {
      if (!weekMap[r.user_id]) weekMap[r.user_id] = [];
      weekMap[r.user_id].push({
        week:       r.week_start_date,
        leave_hours: r.leave_hours,
        leave_days:  r.leave_hours / 9,
      });
    }

    return res.json(members.map(m => ({
      ...m,
      leave_days: m.leave_hours / 9,
      on_leave:   m.leave_hours > 0,
      weeks:      weekMap[m.id] || [],
    })));
  }

  // Single-week mode
  let q = `
    SELECT u.id, u.name, u.team,
           COALESCE(c.leave_hours, 0) AS leave_hours
    FROM users u
    LEFT JOIN capacity c ON c.user_id = u.id AND c.week_start_date = ?
    WHERE u.role = 'member'
  `;
  const p = [week];
  if (team) { q += ' AND u.team = ?'; p.push(team); }
  q += ' ORDER BY u.team, u.name';

  const members = db.prepare(q).all(...p);
  res.json(members.map(m => ({
    ...m,
    leave_days: m.leave_hours / 9,
    on_leave:   m.leave_hours > 0,
    weeks:      [],
  })));
});

// GET /api/capacity/my-leave?week=YYYY-MM-DD  — member's own leave for a week
router.get('/my-leave', authenticate, (req, res) => {
  const { week } = req.query;
  if (!week) return res.status(400).json({ error: 'week required' });
  const row = db.prepare(
    'SELECT leave_hours FROM capacity WHERE user_id = ? AND week_start_date = ?'
  ).get(req.user.id, week);
  res.json({ leave_hours: row?.leave_hours || 0, leave_days: (row?.leave_hours || 0) / 9 });
});

// POST /api/capacity/leave  — member logs their own holiday/leave for a week
router.post('/leave', authenticate, (req, res) => {
  const { week_start_date, leave_days } = req.body;
  if (!week_start_date) return res.status(400).json({ error: 'week_start_date required' });

  const days       = Math.max(0, Math.min(5, parseFloat(leave_days) || 0));
  const leaveHours = days * 9;

  db.prepare(`
    INSERT INTO capacity (user_id, week_start_date, available_hours, leave_hours)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(user_id, week_start_date) DO UPDATE SET
      leave_hours = excluded.leave_hours
  `).run(req.user.id, week_start_date, leaveHours);

  res.json({ ok: true, leave_days: days, leave_hours: leaveHours });
});

module.exports = router;
