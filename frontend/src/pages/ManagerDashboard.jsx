import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import TaskFormModal from '../components/TaskFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import {
  weekOptions,
  weekOptionsForYear,
  monthOptionsForYear,
  currentWeekStart,
} from '../utils/weekUtils';

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = `${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const YEAR_OPTIONS  = Array.from({ length: 2030 - 2024 + 1 }, (_, i) => 2024 + i);
const STATUSES      = ['', 'Not Started', 'In Progress', 'Completed', 'Blocked'];
const PRIORITIES    = ['', 'High', 'Medium', 'Low'];

function fmtDays(d) {
  return d % 1 === 0 ? String(d) : d.toFixed(1);
}

export default function ManagerDashboard() {
  // ── Tasks / Users ────────────────────────────────────────────────────────
  const [tasks,        setTasks]        = useState([]);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filters,      setFilters]      = useState({ week: '', user_id: '', status: '', priority: '', team: '' });
  const [sortField,    setSortField]    = useState('week_start_date');
  const [sortDir,      setSortDir]      = useState('desc');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingTask,  setEditingTask]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');

  // ── Export ───────────────────────────────────────────────────────────────
  const [exportFormat,   setExportFormat]   = useState('xlsx');
  const [exportYear,     setExportYear]     = useState(CURRENT_YEAR);
  const [exportMonth,    setExportMonth]    = useState('');
  const [exportWeekFrom, setExportWeekFrom] = useState('');
  const [exportWeekTo,   setExportWeekTo]   = useState('');

  // ── Leave section (bottom, independent controls) ─────────────────────────
  const [leaveData,    setLeaveData]    = useState([]);
  const [leaveYear,    setLeaveYear]    = useState(CURRENT_YEAR);
  const [leavePeriod,  setLeavePeriod]  = useState('month');   // 'month' | 'week'
  const [leaveMonth,   setLeaveMonth]   = useState(CURRENT_MONTH);
  const [leaveWeekSel, setLeaveWeekSel] = useState('');
  const [leaveTeam,    setLeaveTeam]    = useState('');

  // ── Derived option lists ─────────────────────────────────────────────────
  const filterWeeks  = weekOptions(16);
  const exportWeeks  = useMemo(() => weekOptionsForYear(exportYear),  [exportYear]);
  const exportMonths = useMemo(() => monthOptionsForYear(exportYear), [exportYear]);
  const leaveWeekOpts  = useMemo(() => weekOptionsForYear(leaveYear),  [leaveYear]);
  const leaveMonthOpts = useMemo(() => monthOptionsForYear(leaveYear), [leaveYear]);

  // Reset export selectors on year change
  useEffect(() => { setExportWeekFrom(''); setExportWeekTo(''); setExportMonth(''); }, [exportYear]);

  // Reset leave selectors on year change
  useEffect(() => { setLeaveMonth(''); setLeaveWeekSel(''); }, [leaveYear]);

  // ── Fetch tasks + users ───────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [tasksRes, usersRes] = await Promise.all([
        axios.get('/api/tasks', { params }),
        axios.get('/api/users'),
      ]);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch leave summary (independent from task filters) ───────────────────
  const fetchLeave = useCallback(async () => {
    const params = {};
    if (leavePeriod === 'month') {
      if (!leaveMonth) return;
      params.month = leaveMonth;
    } else {
      if (!leaveWeekSel) return;
      params.week = leaveWeekSel;
    }
    if (leaveTeam) params.team = leaveTeam;
    try {
      const { data } = await axios.get('/api/capacity/leave-summary', { params });
      setLeaveData(data);
    } catch { /* supplementary — ignore */ }
  }, [leavePeriod, leaveMonth, leaveWeekSel, leaveTeam]);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const handleSave = async (formData) => {
    try {
      if (editingTask) {
        await axios.put(`/api/tasks/${editingTask.id}`, formData);
        toast.success('Task updated');
      }
      setModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save task');
      throw err;
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/tasks/${deleteTarget.id}`);
      toast.success('Task deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const setFilter    = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const clearFilters = () => { setFilters({ week: '', user_id: '', status: '', priority: '', team: '' }); setSearchQuery(''); };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ format: exportFormat });
      if (filters.user_id) params.set('user_id', filters.user_id);
      if (exportMonth) {
        params.set('month', exportMonth);
      } else {
        if (exportWeekFrom) params.set('week_from', exportWeekFrom);
        if (exportWeekTo)   params.set('week_to',   exportWeekTo);
      }
      const token = localStorage.getItem('token');
      const res   = await fetch(`/api/export?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tasks_export_${exportYear}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const total        = tasks.length;
  const completed    = tasks.filter(t => t.status === 'Completed').length;
  const blocked      = tasks.filter(t => t.status === 'Blocked').length;
  const inProgress   = tasks.filter(t => t.status === 'In Progress').length;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const totalEst     = tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  const totalActual  = tasks.reduce((s, t) => s + (t.actual_hours    || 0), 0);

  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    const va = a[sortField] ?? '', vb = b[sortField] ?? '';
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }), [tasks, sortField, sortDir]);

  const displayTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(t =>
      (t.title       || '').toLowerCase().includes(q) ||
      (t.member_name || '').toLowerCase().includes(q) ||
      (t.requester   || '').toLowerCase().includes(q) ||
      (t.owner       || '').toLowerCase().includes(q) ||
      (t.task_type   || '').toLowerCase().includes(q) ||
      (t.status      || '').toLowerCase().includes(q)
    );
  }, [sorted, searchQuery]);

  const activeFilters   = Object.values(filters).filter(Boolean).length;
  const onLeaveCount    = leaveData.filter(m => m.on_leave).length;
  const totalLeaveDays  = leaveData.reduce((s, m) => s + (m.leave_days || 0), 0);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Team task overview and analytics</p>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
        {[
          { label: 'Total Tasks',  value: total,                        icon: '📋', color: 'text-gray-900'    },
          { label: 'Completed',    value: `${completedPct}%`,           icon: '✅', color: 'text-emerald-600' },
          { label: 'In Progress',  value: inProgress,                   icon: '🔄', color: 'text-blue-600'    },
          { label: 'Blocked',      value: blocked,                      icon: '🚫', color: 'text-red-600'     },
          { label: 'Est. Hours',   value: `${totalEst.toFixed(1)}h`,    icon: '⏱', color: 'text-gray-900'    },
          { label: 'Actual Hours', value: `${totalActual.toFixed(1)}h`, icon: '⏱', color: 'text-gray-900'    },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{s.icon}</span>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-700">🔍 Filters</span>
          {activeFilters > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {activeFilters} active
            </span>
          )}
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 ml-auto underline">
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="label text-xs">Team</label>
            <div className="flex gap-1">
              {['', 'VPM', 'CWGW'].map(t => (
                <button
                  key={t}
                  onClick={() => setFilter('team', t)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    filters.team === t
                      ? t === 'VPM'  ? 'bg-blue-600 text-white border-blue-600'
                      : t === 'CWGW' ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >{t || 'All'}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label text-xs">Week</label>
            <select className="input text-sm" value={filters.week} onChange={e => setFilter('week', e.target.value)}>
              <option value="">All weeks</option>
              {filterWeeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Member</label>
            <select className="input text-sm" value={filters.user_id} onChange={e => setFilter('user_id', e.target.value)}>
              <option value="">All members</option>
              {users.filter(u => u.role === 'member')
                .filter(u => !filters.team || u.team === filters.team)
                .map(u => <option key={u.id} value={u.id}>{u.name} ({u.team})</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select className="input text-sm" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Priority</label>
            <select className="input text-sm" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p || 'All priorities'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Export panel ── */}
      <div className="card p-4 mb-6 border-dashed border-2 border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-700">📤 Export Data</span>
          <span className="text-xs text-gray-400">(Excel: Monthly Dashboard · Task Detail · Leave Summary)</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label text-xs">Year</label>
            <select className="input text-sm w-24" value={exportYear} onChange={e => setExportYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Month</label>
            <select
              className="input text-sm w-44"
              value={exportMonth}
              onChange={e => { setExportMonth(e.target.value); if (e.target.value) { setExportWeekFrom(''); setExportWeekTo(''); } }}
            >
              <option value="">All months (or use weeks)</option>
              {exportMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className={exportMonth ? 'opacity-40 pointer-events-none' : ''}>
            <label className="label text-xs">From Week</label>
            <select className="input text-sm w-44" value={exportWeekFrom} onChange={e => setExportWeekFrom(e.target.value)}>
              <option value="">Earliest</option>
              {exportWeeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className={exportMonth ? 'opacity-40 pointer-events-none' : ''}>
            <label className="label text-xs">To Week</label>
            <select className="input text-sm w-44" value={exportWeekTo} onChange={e => setExportWeekTo(e.target.value)}>
              <option value="">Latest</option>
              {exportWeeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Format</label>
            <select className="input text-sm w-28" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
          <button onClick={handleExport} className="btn-primary flex items-center gap-2">
            <span>⬇️</span> Export {exportFormat.toUpperCase()}
          </button>
        </div>
      </div>

      {/* ── Task Table ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium">No tasks match the current filters</p>
          {activeFilters > 0 && <button onClick={clearFilters} className="btn-secondary mt-4">Clear Filters</button>}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">
              {searchQuery && displayTasks.length !== sorted.length
                ? <><span className="font-semibold text-gray-800">{displayTasks.length}</span> of {sorted.length} tasks</>
                : <><span className="font-semibold text-gray-800">{sorted.length}</span> task{sorted.length !== 1 ? 's' : ''}</>
              }
            </span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">🔍</span>
              <input
                type="text"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input text-sm py-1.5 pl-8 pr-7 w-60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg leading-none"
                  title="Clear search"
                >×</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '32%' }} />
                <col style={{ width: '8%'  }} />
                <col style={{ width: '5%'  }} />
                <col style={{ width: '8%'  }} />
                <col style={{ width: '9%'  }} />
                <col style={{ width: '7%'  }} />
                <col style={{ width: '8%'  }} />
                <col style={{ width: '9%'  }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '4%'  }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-800">
                  {[
                    ['title',           'TASK'],
                    ['status',          'STATUS'],
                    ['actual_hours',    'Hours'],
                    ['task_type',       'Task Type'],
                    ['requester',       'Requester'],
                    ['week_start_date', 'WeekNO'],
                    ['owner',           'Owner'],
                    ['team_type',       'Team_type'],
                    ['member_name',     'Member'],
                  ].map(([field, label]) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className="px-3 py-3 text-center text-xs font-bold text-white tracking-wider cursor-pointer hover:bg-slate-700 select-none whitespace-nowrap border-r border-slate-600 last:border-0"
                    >
                      {label}<SortIcon field={field} />
                    </th>
                  ))}
                  <th className="px-2 py-3 border-0" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayTasks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">
                      No tasks match <strong>"{searchQuery}"</strong>
                      <button onClick={() => setSearchQuery('')} className="ml-2 text-blue-500 hover:underline text-xs">Clear search</button>
                    </td>
                  </tr>
                ) : displayTasks.map((task, idx) => (
                  <tr key={task.id} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-3 py-2.5 border-r border-gray-100">
                      <p className="font-semibold text-gray-900 truncate">{task.title}</p>
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center font-semibold text-gray-700">
                      {task.actual_hours > 0 ? `${task.actual_hours}h` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center">
                      {task.task_type
                        ? <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{task.task_type}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center text-gray-600 truncate">
                      {task.requester || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center">
                      {task.week_start_date
                        ? <span className="font-medium text-gray-700 whitespace-nowrap">{task.week_start_date.slice(5).replace('-', '/')}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center text-gray-600 truncate">
                      {task.owner || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100 text-center">
                      {(task.team_type || task.member_team)
                        ? <span className={`font-bold px-2 py-0.5 rounded-full text-white text-[10px] ${
                            task.team_type === 'AMO'   ? 'bg-blue-600'   :
                            task.team_type === 'PJ'    ? 'bg-indigo-600' :
                            task.team_type === 'Infra' ? 'bg-teal-600'   :
                            task.member_team === 'VPM' ? 'bg-blue-600'   : 'bg-violet-600'
                          }`}>{task.team_type || task.member_team}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 border-r border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${task.member_team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                          {task.member_name?.charAt(0)}
                        </div>
                        <span className="text-gray-700 font-medium truncate">{task.member_name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTask(task); setModalOpen(true); }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors text-xs" title="Edit">✏️</button>
                        <button onClick={() => setDeleteTarget(task)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors text-xs" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Leave / Holiday section (bottom) ── */}
      <div className="card mt-6 overflow-hidden border-l-4 border-amber-400">

        {/* Header row with controls */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
          <span className="text-sm font-semibold text-amber-800 shrink-0">🏖 Holiday / Leave</span>

          {/* Year */}
          <select
            className="input text-xs w-20 py-1"
            value={leaveYear}
            onChange={e => setLeaveYear(Number(e.target.value))}
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Period toggle */}
          <div className="flex rounded-lg border border-amber-300 overflow-hidden text-xs">
            {['month', 'week'].map(p => (
              <button
                key={p}
                onClick={() => setLeavePeriod(p)}
                className={`px-3 py-1 font-medium transition-colors capitalize ${
                  leavePeriod === p ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'
                }`}
              >{p}</button>
            ))}
          </div>

          {/* Month / Week selector */}
          {leavePeriod === 'month' ? (
            <select
              className="input text-xs w-40 py-1"
              value={leaveMonth}
              onChange={e => setLeaveMonth(e.target.value)}
            >
              <option value="">Select month</option>
              {leaveMonthOpts.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          ) : (
            <select
              className="input text-xs w-48 py-1"
              value={leaveWeekSel}
              onChange={e => setLeaveWeekSel(e.target.value)}
            >
              <option value="">Select week</option>
              {leaveWeekOpts.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          )}

          {/* Team filter */}
          <div className="flex rounded-lg border border-amber-300 overflow-hidden text-xs">
            {[['', 'All'], ['VPM', 'VPM'], ['CWGW', 'CWGW']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setLeaveTeam(val)}
                className={`px-2.5 py-1 font-semibold transition-colors ${
                  leaveTeam === val
                    ? val === 'VPM'  ? 'bg-blue-600 text-white'
                    : val === 'CWGW' ? 'bg-violet-600 text-white'
                    : 'bg-amber-500 text-white'
                    : 'bg-white text-amber-700 hover:bg-amber-50'
                }`}
              >{lbl}</button>
            ))}
          </div>

          {/* Summary pills */}
          <div className="ml-auto flex items-center gap-2 text-xs shrink-0">
            {onLeaveCount > 0 ? (
              <>
                <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  {onLeaveCount} on leave
                </span>
                <span className="text-amber-700 font-medium">
                  {fmtDays(totalLeaveDays)} days total
                </span>
              </>
            ) : leaveData.length > 0 ? (
              <span className="text-gray-400 italic">No leave recorded</span>
            ) : null}
          </div>
        </div>

        {/* Body */}
        {/* Month mode */}
        {leavePeriod === 'month' && (
          leaveMonth ? (
            leaveData.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : (
              <div>
                {/* Members WITH leave */}
                {leaveData.filter(m => m.on_leave).map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50/70 border-b border-amber-100">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${m.team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{m.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${m.team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                          {m.team}
                        </span>
                      </div>
                      {m.weeks && m.weeks.length > 0 && (
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {m.weeks.map(w => (
                            <span key={w.week} className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-medium">
                              Wk {w.week.slice(5).replace('-', '/')} · {fmtDays(w.leave_days)}d
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold text-amber-700">{fmtDays(m.leave_days)}</span>
                      <span className="text-xs text-amber-600 ml-0.5">days</span>
                    </div>
                  </div>
                ))}

                {/* Members WITHOUT leave — compact footer row */}
                {leaveData.filter(m => !m.on_leave).length > 0 && (
                  <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 bg-gray-50 border-t border-gray-100">
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">No leave recorded:</span>
                    {leaveData.filter(m => !m.on_leave).map(m => (
                      <span key={m.id} className="flex items-center gap-1 text-[11px] text-gray-400">
                        <span className={`w-2 h-2 rounded-full inline-block ${m.team === 'VPM' ? 'bg-blue-300' : 'bg-violet-300'}`} />
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* All members have leave — no footer needed */}
                {leaveData.every(m => m.on_leave) && leaveData.length > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700 font-medium">
                    All members have leave recorded this month
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Select a month to view leave records
            </div>
          )
        )}

        {/* Week mode */}
        {leavePeriod === 'week' && (
          leaveWeekSel ? (
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {leaveData.length === 0 ? (
                <span className="text-xs text-gray-400">Loading…</span>
              ) : leaveData.map(m => (
                <div
                  key={m.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    m.on_leave
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0 ${m.team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                    {m.name.charAt(0)}
                  </div>
                  <span>{m.name}</span>
                  {m.on_leave && (
                    <span className="ml-1 bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      {fmtDays(m.leave_days)}d
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Select a week to view leave records
            </div>
          )
        )}
      </div>

      <TaskFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={handleSave}
        initialData={editingTask}
        memberName={editingTask?.member_name}
        isManager={true}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Task"
        message={`Delete "${deleteTarget?.title}" by ${deleteTarget?.member_name}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
