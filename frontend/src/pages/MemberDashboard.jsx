import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import TaskFormModal from '../components/TaskFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { weekOptions, currentWeekStart, formatWeekLabel } from '../utils/weekUtils';

export default function MemberDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStart());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const weeks = weekOptions(12);

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

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSave = async (formData) => {
    try {
      if (editingTask) {
        await axios.put(`/api/tasks/${editingTask.id}`, formData);
        toast.success('Task updated successfully');
      } else {
        await axios.post('/api/tasks', formData);
        toast.success('Task added successfully');
      }
      setModalOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save task');
      throw err;
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/tasks/${deleteTarget.id}`);
      toast.success('Task deleted');
      setDeleteTarget(null);
      fetchTasks();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const openAdd = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  // Stats
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const blocked = tasks.filter(t => t.status === 'Blocked').length;
  const totalEst = tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  const totalActual = tasks.reduce((s, t) => s + (t.actual_hours || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track your weekly work, {user?.name?.split(' ')[0]}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <span>+</span> Add Task
        </button>
      </div>

      {/* Week selector */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-gray-700 shrink-0">📅 Week:</span>
        <select
          className="input max-w-xs"
          value={selectedWeek}
          onChange={e => setSelectedWeek(e.target.value)}
        >
          {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{total} task{total !== 1 ? 's' : ''} this week</span>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: total, color: 'text-gray-900', bg: 'bg-gray-50', icon: '📋' },
            { label: 'Completed', value: completed, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '✅' },
            { label: 'In Progress', value: inProgress, color: 'text-blue-700', bg: 'bg-blue-50', icon: '🔄' },
            { label: 'Blocked', value: blocked, color: 'text-red-700', bg: 'bg-red-50', icon: '🚫' },
          ].map(s => (
            <div key={s.label} className={`card p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{s.icon}</span>
                <span className="text-xs text-gray-500 font-medium">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hours summary */}
      {total > 0 && (
        <div className="card p-4 mb-6 flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500">Estimated Hours</p>
            <p className="text-xl font-bold text-gray-900">{totalEst.toFixed(1)}h</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500">Actual Hours</p>
            <p className="text-xl font-bold text-gray-900">{totalActual.toFixed(1)}h</p>
          </div>
          {totalEst > 0 && (
            <>
              <div className="w-px h-8 bg-gray-200" />
              <div>
                <p className="text-xs text-gray-500">Completion Rate</p>
                <p className="text-xl font-bold text-emerald-600">
                  {total > 0 ? Math.round((completed / total) * 100) : 0}%
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-gray-600 font-medium">No tasks for {formatWeekLabel(selectedWeek)}</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Task" to log your first task for this week</p>
          <button onClick={openAdd} className="btn-primary mt-4">+ Add Your First Task</button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEdit}
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
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
