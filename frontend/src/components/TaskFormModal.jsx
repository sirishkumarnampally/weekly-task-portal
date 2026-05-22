import { useState, useEffect } from 'react';
import { weekOptions, currentWeekStart } from '../utils/weekUtils';

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Blocked'];

const emptyForm = {
  title: '',
  description: '',
  priority: 'Medium',
  status: 'Not Started',
  estimated_hours: '',
  actual_hours: '',
  notes: '',
  week_start_date: currentWeekStart(),
};

export default function TaskFormModal({ isOpen, onClose, onSave, initialData, memberName }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const weeks = weekOptions(12);

  useEffect(() => {
    if (isOpen) {
      setForm(initialData ? {
        title: initialData.title || '',
        description: initialData.description || '',
        priority: initialData.priority || 'Medium',
        status: initialData.status || 'Not Started',
        estimated_hours: initialData.estimated_hours || '',
        actual_hours: initialData.actual_hours || '',
        notes: initialData.notes || '',
        week_start_date: initialData.week_start_date || currentWeekStart(),
      } : { ...emptyForm, week_start_date: currentWeekStart() });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        estimated_hours: parseFloat(form.estimated_hours) || 0,
        actual_hours: parseFloat(form.actual_hours) || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {initialData ? 'Edit Task' : 'Add New Task'}
            </h2>
            {memberName && <p className="text-sm text-gray-500">{memberName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Week */}
          <div>
            <label className="label">Week</label>
            <select className="input" value={form.week_start_date} onChange={e => set('week_start_date', e.target.value)}>
              {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="label">Task Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Implement login feature"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Brief description of the task..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estimated Hours</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                placeholder="0"
                value={form.estimated_hours}
                onChange={e => set('estimated_hours', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Actual Hours</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                placeholder="0"
                value={form.actual_hours}
                onChange={e => set('actual_hours', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes / Comments</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Any blockers, updates, or comments..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2 justify-end border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</> : initialData ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
