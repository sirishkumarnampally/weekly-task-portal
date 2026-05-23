import { useState, useEffect } from 'react';
import { weekOptions, currentWeekStart } from '../utils/weekUtils';

const STATUSES   = ['In Progress', 'Completed'];
const TASK_TYPES = ['Regular', 'Irregular'];

const TEAM_TYPE_OPTIONS = {
  VPM:  ['AMO', 'PJ'],
  CWGW: ['Infra', 'Review & Manage'],
};

const TEAM_STYLE = {
  VPM:  { bg: 'bg-blue-700',   text: 'text-blue-700' },
  CWGW: { bg: 'bg-violet-700', text: 'text-violet-700' },
  AMO:  { bg: 'bg-blue-600',   text: 'text-blue-700' },
  PJ:   { bg: 'bg-indigo-600', text: 'text-indigo-700' },
};

const emptyForm = (weekStart = currentWeekStart()) => ({
  title:           '',
  status:          'In Progress',
  hours:           '',         // single "Number of Hours" field → saved as actual_hours
  notes:           '',
  week_start_date: weekStart,
  task_type:       '',
  requester:       '',
  owner:           '',
  team_type:       '',
  team:            '',         // manager's team selection (VPM/CWGW)
});

export default function TaskFormModal({ isOpen, onClose, onSave, initialData, memberName, isManager, userTeam }) {
  const [form, setForm]     = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const weeks               = weekOptions(12);

  const getTeamTypeOptions = (team) => TEAM_TYPE_OPTIONS[team] || [];

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        title:           initialData.title          || '',
        status:          STATUSES.includes(initialData.status) ? initialData.status : 'In Progress',
        hours:           initialData.actual_hours   ?? '',
        notes:           initialData.notes          || '',
        week_start_date: initialData.week_start_date || currentWeekStart(),
        task_type:       initialData.task_type      || '',
        requester:       initialData.requester      || '',
        owner:           initialData.owner          || '',
        team_type:       initialData.team_type      || '',
        team:            initialData.member_team    || userTeam || '',
      });
    } else {
      setForm({ ...emptyForm(), team: isManager ? '' : (userTeam || '') });
    }
  }, [isOpen, initialData, isManager, userTeam]);

  if (!isOpen) return null;

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title:           form.title,
        status:          form.status,
        actual_hours:    parseFloat(form.hours) || 0,
        estimated_hours: parseFloat(form.hours) || 0,   // keep DB field in sync
        notes:           form.notes,
        week_start_date: form.week_start_date,
        task_type:       form.task_type,
        requester:       form.requester,
        owner:           form.owner,
        team_type:       form.team_type,
        priority:        'Medium',   // neutral default; field removed from UI
        description:     '',
        week_no:         0,
      });
    } finally {
      setSaving(false);
    }
  };

  // Header colour matches team or team_type
  const resolvedTeam = isManager ? (form.team || '') : (userTeam || '');
  const headerBg     = TEAM_STYLE[resolvedTeam]?.bg || TEAM_STYLE[form.team_type]?.bg || 'bg-slate-800';

  const activeTeamTypeOpts = getTeamTypeOptions(resolvedTeam || userTeam);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className={`sticky top-0 z-10 ${headerBg} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
          <div>
            <h2 className="text-base font-bold text-white">
              {initialData ? 'Edit Task' : 'New Task'}
            </h2>
            {memberName && <p className="text-white/70 text-xs mt-0.5">{memberName}</p>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* ── Team Type ── */}
          <div>
            <label className="label">
              Team Type <span className="text-red-500">*</span>
              {!isManager && userTeam && (
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${TEAM_STYLE[userTeam]?.bg || 'bg-slate-600'}`}>
                  {userTeam}
                </span>
              )}
            </label>

            {isManager ? (
              <div className="space-y-2">
                {/* Team toggle */}
                <div className="flex gap-2">
                  {['VPM', 'CWGW'].map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => { set('team', t); set('team_type', ''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                        form.team === t
                          ? `${TEAM_STYLE[t].bg} text-white border-transparent shadow`
                          : `bg-white ${TEAM_STYLE[t].text} border-current opacity-50 hover:opacity-80`
                      }`}
                    >{t}</button>
                  ))}
                </div>
                {/* Sub-type once team chosen */}
                {form.team && (
                  <select className="input" value={form.team_type} onChange={e => set('team_type', e.target.value)} required>
                    <option value="">Select sub-type…</option>
                    {getTeamTypeOptions(form.team).map(o => <option key={o}>{o}</option>)}
                  </select>
                )}
              </div>
            ) : (
              <select className="input" value={form.team_type} onChange={e => set('team_type', e.target.value)} required>
                <option value="">Select type…</option>
                {activeTeamTypeOpts.map(o => <option key={o}>{o}</option>)}
              </select>
            )}
          </div>

          {/* ── Week + Task Type ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Week</label>
              <select className="input" value={form.week_start_date} onChange={e => set('week_start_date', e.target.value)}>
                {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Task Type</label>
              <select className="input" value={form.task_type} onChange={e => set('task_type', e.target.value)}>
                <option value="">Select…</option>
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ── Requester + Owner ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Requester</label>
              <input type="text" className="input" placeholder="Who requested this?" value={form.requester} onChange={e => set('requester', e.target.value)} />
            </div>
            <div>
              <label className="label">Owner</label>
              <input type="text" className="input" placeholder="Who owns this?" value={form.owner} onChange={e => set('owner', e.target.value)} />
            </div>
          </div>

          {/* ── Task Title ── */}
          <div>
            <label className="label">Task <span className="text-red-500">*</span></label>
            <input type="text" className="input" placeholder="Describe the task…" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>

          {/* ── Status + Number of Hours ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Number of Hours</label>
              <input
                type="number" min="0" step="0.5" className="input" placeholder="e.g. 8"
                value={form.hours}
                onChange={e => set('hours', e.target.value)}
              />
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="Any comments or blockers…" value={form.notes} onChange={e => set('notes', e.target.value)} />
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
