import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import TaskFormModal from '../components/TaskFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { weekOptions } from '../utils/weekUtils';

const STATUSES = ['', 'Not Started', 'In Progress', 'Completed', 'Blocked'];
const PRIORITIES = ['', 'High', 'Medium', 'Low'];

export default function ManagerDashboard() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ week: '', user_id: '', status: '', priority: '', team: '' });
  const [sortField, setSortField] = useState('week_start_date');
  const [sortDir, setSortDir] = useState('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exportWeekFrom, setExportWeekFrom] = useState('');
  const [exportWeekTo, setExportWeekTo] = useState('');
  const [exportMonth, setExportMonth] = useState('');
  const weeks = weekOptions(16);

  // Generate last 12 months as YYYY-MM options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { value, label };
  });

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

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const clearFilters = () => setFilters({ week: '', user_id: '', status: '', priority: '' });

  const sorted = [...tasks].sort((a, b) => {
    const va = a[sortField] ?? '';
    const vb = b[sortField] ?? '';
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
      const res = await fetch(`/api/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks_export.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  // Stats
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const blocked = tasks.filter(t => t.status === 'Blocked').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const totalEst = tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  const totalActual = tasks.reduce((s, t) => s + (t.actual_hours || 0), 0);

  // Group by member
  const byMember = sorted.reduce((acc, t) => {
    const key = t.member_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Team task overview and analytics</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Total Tasks', value: total, icon: '📋', color: 'text-gray-900' },
          { label: 'Completed', value: `${completedPct}%`, icon: '✅', color: 'text-emerald-600' },
          { label: 'In Progress', value: inProgress, icon: '🔄', color: 'text-blue-600' },
          { label: 'Blocked', value: blocked, icon: '🚫', color: 'text-red-600' },
          { label: 'Est. Hours', value: `${totalEst.toFixed(1)}h`, icon: '⏱', color: 'text-gray-900' },
          { label: 'Actual Hours', value: `${totalActual.toFixed(1)}h`, icon: '⏱', color: 'text-gray-900' },
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

      {/* Filters */}
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
              {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
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

      {/* Export panel */}
      <div className="card p-4 mb-6 border-dashed border-2 border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-700">📤 Export Data</span>
          <span className="text-xs text-gray-400">(Excel includes a Monthly Dashboard as the first sheet)</span>
        </div>

        {/* Month quick-filter */}
        <div className="flex items-center gap-2 mb-3 mt-2">
          <span className="text-xs font-medium text-gray-600 shrink-0">Filter by Month:</span>
          <select
            className="input text-sm max-w-[220px]"
            value={exportMonth}
            onChange={e => { setExportMonth(e.target.value); if (e.target.value) { setExportWeekFrom(''); setExportWeekTo(''); } }}
          >
            <option value="">All months (or use week range below)</option>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {exportMonth && (
            <button onClick={() => setExportMonth('')} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className={exportMonth ? 'opacity-40 pointer-events-none' : ''}>
            <label className="label text-xs">From Week</label>
            <select className="input text-sm w-44" value={exportWeekFrom} onChange={e => setExportWeekFrom(e.target.value)}>
              <option value="">Earliest</option>
              {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className={exportMonth ? 'opacity-40 pointer-events-none' : ''}>
            <label className="label text-xs">To Week</label>
            <select className="input text-sm w-44" value={exportWeekTo} onChange={e => setExportWeekTo(e.target.value)}>
              <option value="">Latest</option>
              {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
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

      {/* Task Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium">No tasks match the current filters</p>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="btn-secondary mt-4">Clear Filters</button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-300">
                  {[
                    ['title',           'TASK'],
                    ['status',          'STATUS'],
                    ['actual_hours',    'Hours'],
                    ['task_type',       'Task Type'],
                    ['requester',       'Requester'],
                    ['week_no',         'WeekNO'],
                    ['owner',           'Owner'],
                    ['team_type',       'Team_type'],
                  ].map(([field, label]) => (
                    <th
                      key={field}
                      className="px-3 py-2.5 text-center text-xs font-bold text-gray-900 uppercase tracking-wide border border-gray-400 cursor-pointer hover:bg-yellow-400 select-none whitespace-nowrap"
                      onClick={() => handleSort(field)}
                    >
                      {label}<SortIcon field={field} />
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-900 uppercase tracking-wide border border-gray-400 whitespace-nowrap">Member</th>
                  <th className="px-3 py-2.5 border border-gray-400 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((task, idx) => (
                  <tr key={task.id} className={`hover:bg-yellow-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-2.5 border-x border-gray-100 max-w-[200px]">
                      <p className="font-medium text-gray-900 truncate text-xs">{task.title}</p>
                      {task.description && <p className="text-gray-400 text-[10px] truncate">{task.description}</p>}
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-center">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-center text-xs font-semibold text-gray-700">
                      {task.actual_hours ?? 0}h
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-center">
                      {task.task_type ? (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          {task.task_type}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-xs text-gray-600 text-center whitespace-nowrap">
                      {task.requester || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-center">
                      {task.week_no ? (
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">W{task.week_no}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-xs text-gray-600 text-center whitespace-nowrap">
                      {task.owner || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 text-center">
                      {task.team_type ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${task.team_type === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                          {task.team_type}
                        </span>
                      ) : task.member_team ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${task.member_team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                          {task.member_team}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-x border-gray-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${task.member_team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                          {task.member_name?.charAt(0)}
                        </div>
                        <span className="text-xs text-gray-700 font-medium">{task.member_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingTask(task); setModalOpen(true); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >✏️</button>
                        <button
                          onClick={() => setDeleteTarget(task)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Showing {sorted.length} task{sorted.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

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
