const express = require('express');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// Return the Monday-based weeks that overlap with a given month
function getWeeksForMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);

  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const pad    = (n) => String(n).padStart(2, '0');
  const toStr  = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmt    = (d) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;

  const weeks = [];
  let monday  = getMonday(firstDay);
  let weekNum = 1;

  while (monday <= lastDay) {
    const sunday     = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dispStart  = monday < firstDay ? new Date(firstDay) : new Date(monday);
    const dispEnd    = sunday > lastDay  ? new Date(lastDay)  : new Date(sunday);

    // Working days (Mon–Fri) within the display range
    let workingDays = 0;
    const d = new Date(dispStart);
    while (d <= dispEnd) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) workingDays++;
      d.setDate(d.getDate() + 1);
    }

    weeks.push({
      label:       `Week-${pad(weekNum)}`,
      weekStart:   toStr(monday),         // Monday — used to match task week_start_date
      weekEnd:     toStr(sunday),
      dispStart:   toStr(dispStart),
      dispEnd:     toStr(dispEnd),
      dateRange:   `${fmt(dispStart)} - ${fmt(dispEnd)}`,
      workingDays,
    });

    weekNum++;
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
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

  // Build per-week member rows
  const weeksData = weeks.map(w => {
    const memberRows = members.map(m => {
      const cap = db.prepare(
        `SELECT available_hours, leave_hours FROM capacity WHERE user_id = ? AND week_start_date = ?`
      ).get(m.id, w.weekStart);

      const availableHours = cap ? cap.available_hours : w.workingDays * DEFAULT_HRS_PER_DAY;
      const leaveHours     = cap ? cap.leave_hours : 0;
      const { taskCount, taskHours, monitoringHours, enhancementHours } = getTaskHours(m.id, w.weekStart, w.weekEnd);
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

  // Monthly totals
  const monthlyMembers = members.map(m => {
    const capAgg = db.prepare(`
      SELECT COALESCE(SUM(available_hours), 0) as total_avail,
             COALESCE(SUM(leave_hours), 0)     as total_leave
      FROM capacity
      WHERE user_id = ? AND week_start_date >= ? AND week_start_date <= ?
    `).get(m.id, monthStart, monthEnd);

    // Default total capacity if none set
    const totalWorkingDays = weeks.reduce((s, w) => s + w.workingDays, 0);
    const availableHours   = (capAgg?.total_avail > 0)
      ? capAgg.total_avail
      : totalWorkingDays * DEFAULT_HRS_PER_DAY;
    const leaveHours       = capAgg?.total_leave || 0;

    const { taskCount, taskHours, monitoringHours, enhancementHours } = getTaskHours(m.id, monthStart, monthEnd);
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

module.exports = router;
