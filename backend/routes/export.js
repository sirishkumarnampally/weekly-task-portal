const express = require('express');
const XLSX = require('xlsx');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireManager, (req, res) => {
  const { week_from, week_to, user_id, month, format = 'xlsx' } = req.query;

  let query = `
    SELECT u.name  AS "Member Name",
           t.week_start_date AS "Week Start",
           t.title           AS "Task Title",
           t.description     AS "Description",
           t.priority        AS "Priority",
           t.status          AS "Status",
           t.estimated_hours AS "Est. Hours",
           t.actual_hours    AS "Actual Hours",
           t.notes           AS "Notes"
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (user_id)   { query += ' AND t.user_id = ?';           params.push(user_id); }
  if (week_from) { query += ' AND t.week_start_date >= ?';   params.push(week_from); }
  if (week_to)   { query += ' AND t.week_start_date <= ?';   params.push(week_to); }

  // month filter: YYYY-MM  →  match week_start_date starting with that prefix
  if (month)     { query += " AND strftime('%Y-%m', t.week_start_date) = ?"; params.push(month); }

  query += ' ORDER BY u.name, t.week_start_date DESC';

  const rows = db.prepare(query).all(...params);

  // ── CSV path ────────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const headers = ['Member Name', 'Week Start', 'Task Title', 'Description',
                     'Priority', 'Status', 'Est. Hours', 'Actual Hours', 'Notes'];
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

  // ── Sheet 1: Monthly Dashboard ──────────────────────────────────────────────
  const monthlyMap = {};
  for (const r of rows) {
    // Derive YYYY-MM from "Week Start" (stored as YYYY-MM-DD)
    const ym = String(r['Week Start']).slice(0, 7);
    if (!monthlyMap[ym]) {
      monthlyMap[ym] = { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, estHours: 0, actualHours: 0 };
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

  const monthLabel = (ym) => {
    const [y, m] = ym.split('-');
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const dashboardRows = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, s]) => ({
      'Month':            monthLabel(ym),
      'Total Tasks':      s.total,
      'Completed':        s.completed,
      'In Progress':      s.inProgress,
      'Blocked':          s.blocked,
      'Not Started':      s.notStarted,
      'Completion %':     s.total ? `${Math.round((s.completed / s.total) * 100)}%` : '0%',
      'Est. Hours':       parseFloat(s.estHours.toFixed(1)),
      'Actual Hours':     parseFloat(s.actualHours.toFixed(1)),
      'Hours Variance':   parseFloat((s.actualHours - s.estHours).toFixed(1)),
    }));

  // Add totals row
  if (dashboardRows.length) {
    const tot = Object.values(monthlyMap).reduce((acc, s) => {
      acc.total      += s.total;
      acc.completed  += s.completed;
      acc.inProgress += s.inProgress;
      acc.blocked    += s.blocked;
      acc.notStarted += s.notStarted;
      acc.estHours   += s.estHours;
      acc.actualHours+= s.actualHours;
      return acc;
    }, { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, estHours: 0, actualHours: 0 });

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
    });
  }

  const dashWs = XLSX.utils.json_to_sheet(
    dashboardRows.length ? dashboardRows : [{ 'Month': 'No data for selected filters' }]
  );
  dashWs['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, dashWs, '📊 Monthly Dashboard');

  // ── Sheet 2: Task Detail ────────────────────────────────────────────────────
  const detailWs = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ 'Member Name': 'No tasks found for selected filters' }]
  );
  detailWs['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 30 },
    { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, '📋 Task Detail');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks_export.xlsx"');
  res.send(buf);
});

module.exports = router;
