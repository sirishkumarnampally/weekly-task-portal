import { useState, useEffect } from 'react';
import { weekOptions, currentWeekStart } from '../utils/weekUtils';

const PRIORITIES  = ['High', 'Medium', 'Low'];
const STATUSES    = ['Not Started', 'In Progress', 'Completed', 'Blocked'];
const TASK_TYPES  = ['Development', 'Testing', 'Documentation', 'Design', 'Meeting', 'Review', 'Analysis', 'Deployment', 'Other'];
const TEAMS       = ['VPM', 'CWGW'];

const TEAM_STYLE = {
  VPM:  { bg: 'bg-blue-600',   ring: 'ring-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700' },
  CWGW: { bg: 'bg-violet-600', ring: 'ring-violet-500', light: 'bg-violet-50', text: 'text-violet-700' },
};

const getWeekNo = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
};

const emptyForm = (weekStart = currentWeekStart()) => ({
  title: '',
  description: '',
  priority: 'Medium',
  status: 'Not Started',
  estimated_hours: '',
  actual_hours: '',
  notes: '',
  week_start_date: weekStart,
  task_type: '',
  requester: '',
  week_no: getWeekNo(weekStart),
  owner: '',
  team_type: '',
});

export default function TaskFormModal({ isOpen, onClose, onSave, initialData, memberName, isManager, userTeam }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const weeks = weekOptions(12);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        title:           initialData.title           || '',
        description:     initialData.description     || '',
        priority:        initialData.priority         || 'Medium',
        status:          initialData.status           || 'Not Started',
        estimated_hours: initialData.estimated_hours ?? '',
        actual_hours:    initialData.actual_hours     ?? '',
        notes:           initialData.notes            || '',
        week_start_date: initialData.week_start_date  || currentWeekStart(),
        task_type:       initialData.task_type        || '',
        requester:       initialData.requester        || '',
        week_no:         initialData.week_no          || getWeekNo(initialData.week_start_date),
        owner:           initialData.owner            || '',
        team_type:       initialData.team_type        || (isManager ? '' : userTeam || ''),
      });
    } else {
      const ws = currentWeekStart();
      setForm({ ...emptyForm(ws), team_type: isManager ? '' : (userTeam || '') });
    }
  }, [isOpen, initialData, isManager, userTeam]);

  if (!isOpen) return null;

  const set = (field, value) => setForm(f => {
    const next = { ...f, [field]: value };
    if (field === 'week_start_date') next.week_no = getWeekNo(value);
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        estimated_hours: parseFloat(form.estimated_hours) || 0,
        actual_hours:    parseFloat(form.actual_hours)    || 0,
        week_no:         parseInt(form.week_no)           || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const teamStyle = TEAM_STYLE[form.team_type] || TEAM_STYLE.VPM;
  const headerBg  = form.team_type ? teamStyle.bg : 'bg-gray-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className={`sticky top-0 z-10 ${headerBg} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {initialData ? 'Edit Task' : 'Add New Task'}
            </h2>
            {memberName && <p className="text-white/70 text-xs mt-0.5">{memberName}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Row 1: Team Type + Week ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Team <span className="text-red-500">*</span>
              </label>
              {isManager ? (
                <div className="flex gap-2">
                  {TEAMS.map(t => {
                    const s = TEAM_STYLE[t];
                    const active = form.team_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('team_type', t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                          active
                            ? `${s.bg} text-white border-transparent shadow-md`
                            : `bg-white ${s.text} border-current opacity-60 hover:opacity-100`
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`input flex items-center gap-2 ${teamStyle.light} ${teamStyle.text} font-semibold`}>
                  <span className={`w-2 h-2 rounded-full ${teamStyle.bg}`} />
                  {form.team_type || userTeam || '—'}
                </div>
              )}
            </div>
            <div>
              <label className="label">Week</label>
              <select className="input" value={form.week_start_date} onChange={e => set('week_start_date', e.target.value)}>
                {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>

          {/* ── Row 2: Week No + Task Type ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Week No</label>
              <input
                type="number"
                min="1"
                max="53"
                className="input"
                value={form.week_no}
                onChange={e => set('week_no', e.target.value)}
                placeholder="Auto-calculated"
              />
            </div>
            <div>
              <label className="label">Task Type</label>
              <select className="input" value={form.task_type} onChange={e => set('task_type', e.target.value)}>
                <option value="">Select type...</option>
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ── Row 3: Requester + Owner ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Requester</label>
              <input
                type="text"
                className="input"
                placeholder="Who requested this task?"
                value={form.requester}
                onChange={e => set('requester', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Owner</label>
              <input
                type="text"
                className="input"
                placeholder="Who owns this task?"
                value={form.owner}
                onChange={e => set('owner', e.target.value)}
              />
            </div>
          </div>

          {/* ── Task Title ── */}
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

          {/* ── Description ── */}
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Brief description of the task..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* ── Priority + Status ── */}
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

          {/* ── Hours ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estimated Hours</label>
              <input
                type="number" min="0" step="0.5" className="input" placeholder="0"
                value={form.estimated_hours}
                onChange={e => set('estimated_hours', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Actual Hours</label>
              <input
                type="number" min="0" step="0.5" className="input" placeholder="0"
                value={form.actual_hours}
                onChange={e => set('actual_hours', e.target.value)}
              />
            </div>
          </div>

          {/* ── Notes ── */}
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
            <button
              type="submit"
              disabled={saving || (isManager && !form.team_type)}
              className={`btn-primary flex items-center gap-2 disabled:opacity-50`}
            >
              {saving
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                : initialData ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
