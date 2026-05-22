const express = require('express');
const XLSX = require('xlsx');
const db = require('../db/database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireManager, (req, res) => {
  const { week_from, week_to, user_id, format = 'xlsx' } = req.query;

  let query = `
    SELECT u.name as "Member Name", t.week_start_date as "Week Start",
           t.title as "Task Title", t.description as "Description",
           t.priority as "Priority", t.status as "Status",
           t.estimated_hours as "Est. Hours", t.actual_hours as "Actual Hours",
           t.notes as "Notes"
    FROM tasks t
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (user_id) { query += ' AND t.user_id = ?'; params.push(user_id); }
  if (week_from) { query += ' AND t.week_start_date >= ?'; params.push(week_from); }
  if (week_to) { query += ' AND t.week_start_date <= ?'; params.push(week_to); }

  query += ' ORDER BY u.name, t.week_start_date DESC';

  const rows = db.prepare(query).all(...params);

  if (format === 'csv') {
    const headers = Object.keys(rows[0] || {
      'Member Name': '', 'Week Start': '', 'Task Title': '', Description: '',
      Priority: '', Status: '', 'Est. Hours': '', 'Actual Hours': '', Notes: ''
    });
    const csvLines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks_export.csv"');
    return res.send(csvLines.join('\n'));
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
  ws['!cols'] = colWidths;

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks_export.xlsx"');
  res.send(buf);
});

module.exports = router;
