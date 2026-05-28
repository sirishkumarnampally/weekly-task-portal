import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import TaskFormModal from '../components/TaskFormModal';
import TaskImportModal from '../components/TaskImportModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { weekOptions, currentWeekStart, formatWeekLabel } from '../utils/weekUtils';

const TEAM_STYLE = {
  VPM:  { bg: 'bg-blue-600',   badge: 'bg-blue-100 text-blue-800',   border: 'border-blue-200', text: 'text-blue-700' },
  CWGW: { bg: 'bg-violet-600', badge: 'bg-violet-100 text-violet-800', border: 'border-violet-200', text: 'text-violet-700' },
};

export default function MemberDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStart());
  const [viewMode, setViewMode] = useState('team');   // 'team' | 'mine'
  const [modalOpen,    setModalOpen]    = useState(false);
  const [importOpen,   setImportOpen]   = useState(false);
  const [editingTask,  setEditingTask]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [leaveDays, setLeaveDays] = useState('0');
  const [savedLeaveHours, setSavedLeaveHours] = useState(0);
  const [savingLeave, setSavingLeave] = useState(false);
  const weeks = weekOptions(12);

  const teamStyle = TEAM_STYLE[user?.team] || TEAM_STYLE.VPM;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/tasks', {
        params: { week: selectedWeek },
      });
      setTasks(data);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  const fetchLeave = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/capacity/my-leave', { params: { week: selectedWeek } });
      setSavedLeaveHours(data.leave_hours || 0);
      setLeaveDays(String(data.leave_days || 0));
    } catch {
      setSavedLeaveHours(0);
      setLeaveDays('0');
    }
  }, [selectedWeek]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  const saveLeave = async () => {
    setSavingLeave(true);
    try {
      const { data } = await axios.post('/api/capacity/leave', {
        week_start_date: selectedWeek,
        leave_days: parseFloat(leaveDays) || 0,
      });
      setSavedLeaveHours(data.leave_hours);
      toast.success(`Leave saved — ${data.leave_hours}h deducted from capacity`);
    } catch {
      toast.error('Failed to save leave');
    } finally {
      setSavingLeave(false);
    }
  };

  const displayedTasks = viewMode === 'mine'
    ? tasks.filter(t => t.user_id === user?.id)
    : tasks;

  const handleSave = async (formData) => {
    try {
      if (editingTask) {
        await axios.put(`/api/tasks/${editingTask.id}`, formData);
        toast.success('Task updated');
      } else {
        await axios.post('/api/tasks', formData);
        toast.success('Task added');
      }
      setModalOpen(false);
      setEditingTask(null);
      fetchTasks();
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
      fetchTasks();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete task');
    }
  };

  const canEdit = (task) => task.user_id === user?.id;

  // Stats across displayed tasks
  const total      = displayedTasks.length;
  const completed  = displayedTasks.filter(t => t.status === 'Completed').length;
  const inProgress = displayedTasks.filter(t => t.status === 'In Progress').length;
  const blocked    = displayedTasks.filter(t => t.status === 'Blocked').length;

  // Group by member for team view
  const grouped = displayedTasks.reduce((acc, t) => {
    const key = t.member_name || 'Unknown';
    if (!acc[key]) acc[key] = { tasks: [], isMe: t.user_id === user?.id };
    acc[key].tasks.push(t);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-gray-900">
              {viewMode === 'mine' ? 'My Tasks' : `${user?.team} Team Tasks`}
            </h1>
            {user?.team && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${teamStyle.bg}`}>
                {user.team}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm">
            {viewMode === 'mine'
              ? 'Your personal task log'
              : `All tasks across your ${user?.team} team — you can only edit your own`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors"
          >
            📥 Import
          </button>
          <button onClick={() => { setEditingTask(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
            <span>+</span> Add Task
          </button>
        </div>
      </div>

      {/* Week + View toggles */}
      <div className={`card p-4 mb-5 flex flex-wrap items-center gap-4 border-l-4 ${teamStyle.border}`}>
        <span className="text-sm font-medium text-gray-700 shrink-0">📅 Week:</span>
        <select
          className="input max-w-xs"
          value={selectedWeek}
          onChange={e => setSelectedWeek(e.target.value)}
        >
          {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>

        {/* Team / Mine toggle */}
        <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setViewMode('team')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'team' ? `${teamStyle.bg} text-white shadow-sm` : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 {user?.team} Team
          </button>
          <button
            onClick={() => setViewMode('mine')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👤 My Tasks
          </button>
        </div>
      </div>

      {/* Holiday / Leave card */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-4 border-l-4 border-amber-400">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg">🏖️</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">Holiday / Leave</p>
            <p className="text-xs text-gray-400">for {formatWeekLabel(selectedWeek)}</p>
          </div>
          {savedLeaveHours > 0 && (
            <span className="ml-1 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              {savedLeaveHours}h off
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Days on leave:</label>
            <input
              type="number" min="0" max="5" step="0.5"
              className="input w-20 text-center py-1.5 text-sm"
              value={leaveDays}
              onChange={e => setLeaveDays(e.target.value)}
            />
            <span className="text-xs text-gray-400">× 9h = <strong className="text-gray-700">{((parseFloat(leaveDays) || 0) * 9).toFixed(0)}h</strong></span>
          </div>
          <button
            onClick={saveLeave}
            disabled={savingLeave}
            className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
          >
            {savingLeave ? 'Saving…' : 'Save Leave'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total',       value: total,      icon: '📋', color: 'text-gray-900' },
            { label: 'Completed',   value: completed,  icon: '✅', color: 'text-emerald-600' },
            { label: 'In Progress', value: inProgress, icon: '🔄', color: 'text-blue-600' },
            { label: 'Blocked',     value: blocked,    icon: '🚫', color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span>{s.icon}</span>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : displayedTasks.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-gray-600 font-medium">
            No tasks for {formatWeekLabel(selectedWeek)}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {viewMode === 'mine' ? 'Click "Add Task" to log your first task' : `No ${user?.team} team tasks this week yet`}
          </p>
          <button onClick={() => { setEditingTask(null); setModalOpen(true); }} className="btn-primary mt-4">
            + Add Task
          </button>
        </div>
      ) : viewMode === 'team' ? (
        // Grouped by member
        <div className="space-y-6">
          {Object.entries(grouped).map(([memberName, { tasks: mTasks, isMe }]) => (
            <div key={memberName}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${teamStyle.bg}`}>
                  {memberName.charAt(0)}
                </div>
                <span className="font-semibold text-gray-800 text-sm">{memberName}</span>
                {isMe && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">You</span>}
                <span className="text-xs text-gray-400">{mTasks.length} task{mTasks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2 pl-9">
                {mTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showMember={false}
                    onEdit={canEdit(task) ? (t) => { setEditingTask(t); setModalOpen(true); } : null}
                    onDelete={canEdit(task) ? setDeleteTarget : null}
                    readOnly={!canEdit(task)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat list — my tasks only
        <div className="space-y-3">
          {displayedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <TaskFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={handleSave}
        initialData={editingTask}
        memberName={user?.name}
        isManager={false}
        userTeam={user?.team}
      />

      <TaskImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { setImportOpen(false); fetchTasks(); toast.success('Tasks imported successfully!'); }}
        isManager={false}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
