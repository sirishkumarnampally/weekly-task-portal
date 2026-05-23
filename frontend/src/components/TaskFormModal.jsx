import { useState, useEffect } from 'react';
import { weekOptions, currentWeekStart } from '../utils/weekUtils';

const PRIORITIES  = ['High', 'Medium', 'Low'];
const STATUSES    = ['In Progress', 'Completed'];

// Task Type: Regular or Irregular only
const TASK_TYPES  = ['Regular', 'Irregular'];

// Team Type options per team (functional department within the team)
const TEAM_TYPE_OPTIONS = {
  VPM:  ['AMO', 'PJ'],
  CWGW: ['Infra', 'Review & Manage'],
};

const TEAM_STYLE = {
  VPM:  { bg: 'bg-blue-700',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  CWGW: { bg: 'bg-violet-700', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  AMO:  { bg: 'bg-blue-600',   light: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  PJ:   { bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

const getWeekNo = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  // Sunday-based week number
  const sunWeekStart = new Date(d);
  sunWeekStart.setDate(d.getDate() - d.getDay()); // back to Sunday
  const jan1      = new Date(sunWeekStart.getFullYear(), 0, 1);
  const firstSun  = new Date(jan1);
  firstSun.setDate(jan1.getDate() - jan1.getDay());
  return Math.round((sunWeekStart - firstSun) / (7 * 86400000)) + 1;
};

const emptyForm = (weekStart = currentWeekStart(), userTeam = '') => ({
  title: '',
  description: '',
  priority: 'Medium',
  status: 'In Progress',
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
  const [form, setForm]     = useState(emptyForm(currentWeekStart(), userTeam));
  const [saving, setSaving] = useState(false);
  const weeks               = weekOptions(12);

  // Determine which team_type options to show
  const getTeamTypeOptions = (team) => TEAM_TYPE_OPTIONS[team] || [];

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        title:           initialData.title           || '',
        description:     initialData.description     || '',
        priority:        initialData.priority         || 'Medium',
        status:          STATUSES.includes(initialData.status) ? initialData.status : 'In Progress',
        estimated_hours: initialData.estimated_hours ?? '',
        actual_hours:    initialData.actual_hours     ?? '',
        notes:           initialData.notes            || '',
        week_start_date: initialData.week_start_date  || currentWeekStart(),
        task_type:       initialData.task_type        || '',
        requester:       initialData.requester        || '',
        week_no:         initialData.week_no          || getWeekNo(initialData.week_start_date),
        owner:           initialData.owner            || '',
        team_type:       initialData.team_type        || '',
      });
    } else {
      const ws = currentWeekStart();
      setForm({ ...emptyForm(ws, userTeam), team_type: '' });
    }
  }, [isOpen, initialData, userTeam]);

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
        // For members, always stamp their team onto team field
        ...(!isManager && userTeam ? { team_type: form.team_type || '' } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  // Header color: based on team_type or user's team
  const activeTeam  = isManager ? null : userTeam;
  const headerStyle = TEAM_STYLE[activeTeam] || TEAM_STYLE[form.team_type] || { bg: 'bg-slate-800' };
  const teamTypeOpts = isManager
    ? getTeamTypeOptions(form.team || userTeam || 'VPM')   // manager uses selected team
    : getTeamTypeOptions(userTeam);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className={`sticky top-0 z-10 ${headerStyle.bg} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {initialData ? 'Edit Task' : 'Add New Task'}
            </h2>
            {memberName && <p className="text-white/70 text-xs mt-0.5">{memberName}</p>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* ── Row 1: Team Type + Week ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Team Type <span className="text-red-500">*</span>
                {!isManager && userTeam && (
                  <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${TEAM_STYLE[userTeam]?.bg}`}>
                    {userTeam}
                  </span>
                )}
              </label>
              {/* Manager: show toggle between VPM/CWGW teams */}
              {isManager ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {['VPM', 'CWGW'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { set('team', t); set('team_type', ''); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                          (form.team || userTeam) === t
                            ? `${TEAM_STYLE[t].bg} text-white border-transparent`
                            : `bg-white ${TEAM_STYLE[t].text} border-current opacity-50 hover:opacity-80`
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Sub-type dropdown after team selection */}
                  {(form.team || userTeam) && (
                    <select
                      className="input"
                      value={form.team_type}
                      onChange={e => set('team_type', e.target.value)}
                      required
                    >
                      <option value="">Select type…</option>
                      {getTeamTypeOptions(form.team || userTeam).map(o => <option key={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ) : (
                /* Members: dropdown based on their team */
                <select
                  className="input"
                  value={form.team_type}
                  onChange={e => set('team_type', e.target.value)}
                  required
                >
                  <option value="">Select type…</option>
                  {teamTypeOpts.map(o => <option key={o}>{o}</option>)}
                </select>
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
                type="number" min="1" max="53" className="input"
                value={form.week_no}
                onChange={e => set('week_no', e.target.value)}
                placeholder="Auto-calculated"
              />
            </div>
            <div>
              <label className="label">Task Type</label>
              <select className="input" value={form.task_type} onChange={e => set('task_type', e.target.value)}>
                <option value="">Select…</option>
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ── Row 3: Requester + Owner ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Requester</label>
              <input type="text" className="input" placeholder="Who requested this?" value={form.requester} onChange={e => set('requester', e.target.value)} />
            </div>
            <div>
              <label className="label">Owner</label>
              <input type="text" className="input" placeholder="Who owns this task?" value={form.owner} onChange={e => set('owner', e.target.value)} />
            </div>
          </div>

          {/* ── Task Title ── */}
          <div>
            <label className="label">Task Title <span className="text-red-500">*</span></label>
            <input
              type="text" className="input"
              placeholder="e.g. Implement login feature"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
            />
          </div>

          {/* ── Description ── */}
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="Brief description…" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* ── Status + Priority ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* ── Hours ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estimated Hours</label>
              <input type="number" min="0" step="0.5" className="input" placeholder="0" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} />
            </div>
            <div>
              <label className="label">Actual Hours</label>
              <input type="number" min="0" step="0.5" className="input" placeholder="0" value={form.actual_hours} onChange={e => set('actual_hours', e.target.value)} />
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="label">Notes / Comments</label>
            <textarea className="input resize-none" rows={2} placeholder="Any blockers, updates, or comments…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2 justify-end border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={saving || !form.team_type}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving…</>
                : initialData ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
