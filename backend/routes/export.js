const express = require('express');
const XLSX = require('xlsx');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireManager, (req, res) => {
  const { week_from, week_to, user_id, month, format = 'xlsx' } = req.query;

  // ── Task query ──────────────────────────────────────────────────────────────
  let taskQuery = `
    SELECT u.name            AS "Member Name",
           u.team            AS "Team",
           t.week_start_date AS "Week Start",
           t.title           AS "Task Title",
           t.description     AS "Description",
           t.priority        AS "Priority",
           t.status          AS "Status",
           t.task_type       AS "Task Type",
           t.requester       AS "Requester",
           t.owner           AS "Owner",
           t.team_type       AS "Team Type",
           t.estimated_hours AS "Est. Hours",
           t.actual_hours    AS "Actual Hours"
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const taskParams = [];
  if (user_id)   { taskQuery += ' AND t.user_id = ?';                               taskParams.push(user_id); }
  if (week_from) { taskQuery += ' AND t.week_start_date >= ?';                      taskParams.push(week_from); }
  if (week_to)   { taskQuery += ' AND t.week_start_date <= ?';                      taskParams.push(week_to); }
  if (month)     { taskQuery += " AND strftime('%Y-%m', t.week_start_date) = ?";    taskParams.push(month); }
  taskQuery += ' ORDER BY u.team, u.name, t.week_start_date DESC';

  const rows = db.prepare(taskQuery).all(...taskParams);

  // ── Leave query — same time bounds ─────────────────────────────────────────
  let leaveQuery = `
    SELECT u.name            AS "Member Name",
           u.team            AS "Team",
           c.week_start_date AS "Week",
           ROUND(c.leave_hours / 9.0, 1) AS "Leave Days",
           c.leave_hours     AS "Leave Hours"
    FROM capacity c
    JOIN users u ON c.user_id = u.id
    WHERE u.role = 'member' AND c.leave_hours > 0
  `;
  const leaveParams = [];
  if (user_id)   { leaveQuery += ' AND c.user_id = ?';                              leaveParams.push(user_id); }
  if (week_from) { leaveQuery += ' AND c.week_start_date >= ?';                     leaveParams.push(week_from); }
  if (week_to)   { leaveQuery += ' AND c.week_start_date <= ?';                     leaveParams.push(week_to); }
  if (month)     { leaveQuery += " AND strftime('%Y-%m', c.week_start_date) = ?";   leaveParams.push(month); }
  leaveQuery += ' ORDER BY u.team, u.name, c.week_start_date';

  const leaveRows = db.prepare(leaveQuery).all(...leaveParams);

  // ── CSV path ────────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const headers = [
      'Member Name', 'Team', 'Week Start', 'Task Title', 'Description',
      'Priority', 'Status', 'Task Type', 'Requester', 'Owner', 'Team Type',
      'Est. Hours', 'Actual Hours',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks_export.csv"');
    return res.send(csvLines.join('\n'));
  }

  // ── Excel path ──────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const monthLabel = (ym) => {
    const [y, m] = ym.split('-');
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  // Aggregate tasks per month
  const monthlyMap = {};
  for (const r of rows) {
    const ym = String(r['Week Start']).slice(0, 7);
    if (!monthlyMap[ym]) {
      monthlyMap[ym] = {
        total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0,
        estHours: 0, actualHours: 0, leaveHours: 0,
      };
    }
    const m = monthlyMap[ym];
    m.total++;
    if (r['Status'] === 'Completed')   m.completed++;
    if (r['Status'] === 'In Progress') m.inProgress++;
    if (r['Status'] === 'Blocked')     m.blocked++;
    if (r['Status'] === 'Not Started') m.notStarted++;
    m.estHours    += Number(r['Est. Hours'])    || 0;
    m.actualHours += Number(r['Actual Hours'])  || 0;
  }

  // Merge leave hours per month into monthlyMap
  for (const r of leaveRows) {
    const ym = String(r['Week']).slice(0, 7);
    if (monthlyMap[ym]) {
      monthlyMap[ym].leaveHours += Number(r['Leave Hours']) || 0;
    } else {
      // Month with leave but no tasks — still record it
      monthlyMap[ym] = {
        total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0,
        estHours: 0, actualHours: 0, leaveHours: Number(r['Leave Hours']) || 0,
      };
    }
  }

  // ── Sheet 1: Monthly Dashboard ──────────────────────────────────────────────
  const dashboardRows = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, s]) => ({
      'Month':          monthLabel(ym),
      'Total Tasks':    s.total,
      'Completed':      s.completed,
      'In Progress':    s.inProgress,
      'Blocked':        s.blocked,
      'Not Started':    s.notStarted,
      'Completion %':   s.total ? `${Math.round((s.completed / s.total) * 100)}%` : '0%',
      'Est. Hours':     parseFloat(s.estHours.toFixed(1)),
      'Actual Hours':   parseFloat(s.actualHours.toFixed(1)),
      'Hours Variance': parseFloat((s.actualHours - s.estHours).toFixed(1)),
      'Leave Days':     parseFloat((s.leaveHours / 9).toFixed(1)),
    }));

  if (dashboardRows.length) {
    const tot = Object.values(monthlyMap).reduce((acc, s) => {
      acc.total      += s.total;
      acc.completed  += s.completed;
      acc.inProgress += s.inProgress;
      acc.blocked    += s.blocked;
      acc.notStarted += s.notStarted;
      acc.estHours   += s.estHours;
      acc.actualHours+= s.actualHours;
      acc.leaveHours += s.leaveHours;
      return acc;
    }, { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, estHours: 0, actualHours: 0, leaveHours: 0 });

    dashboardRows.push({
      'Month':          'TOTAL',
      'Total Tasks':    tot.total,
      'Completed':      tot.completed,
      'In Progress':    tot.inProgress,
      'Blocked':        tot.blocked,
      'Not Started':    tot.notStarted,
      'Completion %':   tot.total ? `${Math.round((tot.completed / tot.total) * 100)}%` : '0%',
      'Est. Hours':     parseFloat(tot.estHours.toFixed(1)),
      'Actual Hours':   parseFloat(tot.actualHours.toFixed(1)),
      'Hours Variance': parseFloat((tot.actualHours - tot.estHours).toFixed(1)),
      'Leave Days':     parseFloat((tot.leaveHours / 9).toFixed(1)),
    });
  }

  const dashWs = XLSX.utils.json_to_sheet(
    dashboardRows.length ? dashboardRows : [{ 'Month': 'No data for selected filters' }]
  );
  dashWs['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 16 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, dashWs, '📊 Monthly Dashboard');

  // ── Sheet 2: Task Detail ────────────────────────────────────────────────────
  const detailWs = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ 'Member Name': 'No tasks found for selected filters' }]
  );
  detailWs['!cols'] = [
    { wch: 20 }, { wch: 8 },  { wch: 12 }, { wch: 30 },
    { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, '📋 Task Detail');

  // ── Sheet 3: Leave Summary ──────────────────────────────────────────────────
  const leaveWs = XLSX.utils.json_to_sheet(
    leaveRows.length ? leaveRows : [{ 'Member Name': 'No leave recorded for selected period' }]
  );
  leaveWs['!cols'] = [
    { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, leaveWs, '🏖 Leave Summary');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks_export.xlsx"');
  res.send(buf);
});

module.exports = router;
