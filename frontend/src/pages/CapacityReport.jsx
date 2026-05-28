import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const THIS_MONTH = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { value, label };
});

function fmt2(n) { return (n || 0).toFixed(2); }
function num(n)  { return n || 0; }

// ─── Single week block ───────────────────────────────────────────────────────
function WeekBlock({ week, onEditCapacity }) {
  const totalHours = week.members.reduce((s, m) => s + m.totalHours, 0);

  return (
    <div className="mb-1">
      <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>

        {/* ── Row 1: Week label + section headers ── */}
        <thead>
          <tr>
            <td className="bg-slate-800 text-white font-extrabold px-2 py-1.5 text-xs border border-slate-900">
              {week.label}
            </td>
            <td className="bg-slate-700 text-slate-200 px-2 py-1.5 border border-slate-800 text-[10px]" colSpan={1}>
              {week.dateRange}
              <span className="ml-2 text-slate-400">({week.workingDays} working days · {week.workingDays * 9}h cap)</span>
            </td>
            <td className="bg-blue-700 text-white font-bold text-center border border-blue-800 text-[10px]" colSpan={3}>
              Tasks
            </td>
            <td className="bg-indigo-700 text-white font-bold text-center border border-indigo-800 text-[10px]" colSpan={2}>
              Total
            </td>
            <td className="bg-teal-700 text-white font-bold text-center border border-teal-800 text-[10px]">
              Leave
            </td>
            <td className="bg-emerald-700 text-white font-bold text-center border border-emerald-800 text-[10px]">
              Actual Utilization
            </td>
          </tr>
          <tr>
            <td className="bg-slate-700 text-white px-2 py-1 border border-slate-600 text-[10px]">Name</td>
            <td className="bg-slate-600 text-slate-100 text-center px-1 py-1 border border-slate-500 text-[10px]">
              Avail. Cap.
            </td>
            <td className="bg-blue-600 text-white text-center font-semibold px-1 py-1 border border-blue-700 text-[10px]">Tasks</td>
            <td className="bg-blue-600 text-white text-center font-semibold px-1 py-1 border border-blue-700 text-[10px]">Hours</td>
            <td className="bg-blue-600 text-white text-center font-semibold px-1 py-1 border border-blue-700 text-[10px] leading-tight">
              Monitoring,<br />Support
            </td>
            <td className="bg-indigo-600 text-white text-center font-semibold px-1 py-1 border border-indigo-700 text-[10px]">Enh.</td>
            <td className="bg-indigo-600 text-white text-center font-semibold px-1 py-1 border border-indigo-700 text-[10px]">Hours</td>
            <td className="bg-teal-600 text-white text-center font-semibold px-1 py-1 border border-teal-700 text-[10px]">
              Holidays
            </td>
            <td className="bg-emerald-600 text-white text-center px-1 py-1 border border-emerald-700 text-[10px]"></td>
          </tr>
        </thead>

        {/* ── Member rows ── */}
        <tbody>
          {week.members.map((m, i) => (
            <tr key={m.userId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-1 border border-gray-200 text-gray-900 font-medium truncate">
                {m.name}{m.dept ? `(${m.dept})` : ''}
              </td>
              <td
                className="text-center px-1 py-1 border border-gray-200 text-slate-700 font-semibold cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                title="Click to set capacity"
                onClick={() => onEditCapacity(m, week.weekStart)}
              >
                {num(m.availableHours)}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">
                {num(m.taskCount)}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">
                {num(m.taskHours)}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">
                {num(m.monitoringHours) || 0}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">
                {num(m.enhancementHours) || 0}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 font-semibold text-gray-800">
                {num(m.totalHours)}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-600">
                {num(m.leaveHours) ? (m.leaveHours / 9).toFixed(1).replace(/\.0$/, '') + ' d' : '—'}
              </td>
              <td className="border border-gray-100 bg-white" />
            </tr>
          ))}
        </tbody>

        {/* ── Totals row ── */}
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1.5 border border-slate-300 text-slate-700 text-right text-[10px]" colSpan={6}>
              {totalHours}
            </td>
            <td className="text-center px-1 py-1.5 border border-slate-300 text-slate-800 font-extrabold">
              {totalHours}
            </td>
            <td className="border border-slate-200" />
            <td className="bg-emerald-600 text-white font-bold px-3 py-1.5 border border-emerald-700 text-[10px] rounded-sm">
              Actual Man Weeks &nbsp;
              <span className="font-extrabold">{week.actualManWeeks.toFixed(13)}</span>
            </td>
          </tr>
          {/* spacer */}
          <tr><td colSpan={9} className="py-1 bg-gray-100" /></tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Monthly summary block ───────────────────────────────────────────────────
function MonthlyBlock({ monthly, monthDateRange, onEditCapacity }) {
  return (
    <div className="mt-2">
      <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <thead>
          <tr>
            <td className="bg-slate-800 text-white font-extrabold px-2 py-1.5 border border-slate-900 text-xs">
              {monthly.label}
            </td>
            <td className="bg-slate-700 text-slate-200 px-2 py-1.5 border border-slate-800 text-[10px]">
              {monthDateRange}
              <span className="ml-2 text-slate-400">(9 hrs/day · Mon–Fri)</span>
            </td>
            <td className="bg-blue-700 text-white font-bold text-center border border-blue-800 text-[10px]" colSpan={3}>Tasks</td>
            <td className="bg-indigo-700 text-white font-bold text-center border border-indigo-800 text-[10px]" colSpan={2}>Total</td>
            <td className="bg-teal-700 text-white font-bold text-center border border-teal-800 text-[10px]">Leave</td>
            <td className="bg-emerald-700 text-white font-bold text-center border border-emerald-800 text-[10px]">Actual Utilization</td>
          </tr>
          <tr>
            <td className="bg-slate-700 text-white px-2 py-1 border border-slate-600 text-[10px]">Name</td>
            <td className="bg-slate-600 text-slate-100 text-center px-1 py-1 border border-slate-500 text-[10px]">Avail. Cap.</td>
            <td className="bg-blue-600 text-white text-center font-semibold px-1 py-1 border border-blue-700 text-[10px]">Tasks</td>
            <td className="bg-blue-600 text-white text-center font-semibold px-1 py-1 border border-blue-700 text-[10px]">Hours</td>
            <td className="bg-blue-600 text-white text-center font-semibold px-1 py-1 border border-blue-700 text-[10px] leading-tight">Monitoring,<br />Support</td>
            <td className="bg-indigo-600 text-white text-center font-semibold px-1 py-1 border border-indigo-700 text-[10px]">Enh.</td>
            <td className="bg-indigo-600 text-white text-center font-semibold px-1 py-1 border border-indigo-700 text-[10px]">Hours</td>
            <td className="bg-teal-600 text-white text-center font-semibold px-1 py-1 border border-teal-700 text-[10px]">Holidays</td>
            <td className="bg-emerald-600 text-white text-center px-1 py-1 border border-emerald-700 text-[10px]"></td>
          </tr>
        </thead>
        <tbody>
          {monthly.members.map((m, i) => (
            <tr key={m.userId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-1 border border-gray-200 text-gray-900 font-medium truncate">
                {m.name}{m.dept ? `(${m.dept})` : ''}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700 font-semibold">
                {num(m.availableHours)}
              </td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">{num(m.taskCount)}</td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">{num(m.taskHours)}</td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">{num(m.monitoringHours)}</td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-700">{num(m.enhancementHours)}</td>
              <td className="text-center px-1 py-1 border border-gray-200 font-semibold text-gray-800">{num(m.totalHours)}</td>
              <td className="text-center px-1 py-1 border border-gray-200 text-gray-600">{num(m.leaveHours)}</td>
              <td className="border border-gray-100" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td className="px-2 py-1.5 border border-slate-300 text-slate-700 text-right text-[10px]" colSpan={6}>{monthly.totalHours}</td>
            <td className="text-center px-1 py-1.5 border border-slate-300 text-slate-800 font-extrabold">{monthly.totalHours}</td>
            <td className="border border-slate-200" />
            <td className="bg-emerald-600 text-white font-bold px-3 py-1.5 border border-emerald-700 text-[10px] rounded-sm">
              Actual Man Weeks &nbsp;
              <span className="font-extrabold">{monthly.actualManWeeks.toFixed(13)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Capacity edit modal ─────────────────────────────────────────────────────
function CapacityModal({ entry, onClose, onSave }) {
  const [avail, setAvail]       = useState(entry.availableHours ?? 0);
  const [leaveDays, setLeaveDays] = useState((entry.leaveHours ?? 0) / 9);
  const [saving, setSaving]     = useState(false);

  const leaveHours = (parseFloat(leaveDays) || 0) * 9;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...entry, available_hours: parseFloat(avail) || 0, leave_hours: leaveHours });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-80 p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Set Capacity</h3>
        <p className="text-xs text-gray-500 mb-4">
          {entry.name} · Week of {entry.weekStart}
        </p>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">Available Hours (override)</label>
            <input type="number" min="0" step="0.5" className="input" value={avail} onChange={e => setAvail(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-0.5">Leave blank (0) to use default: working days × 9h</p>
          </div>
          <div>
            <label className="label text-xs">Holiday / Leave Days</label>
            <input type="number" min="0" max="5" step="0.5" className="input" value={leaveDays} onChange={e => setLeaveDays(e.target.value)} />
            {leaveHours > 0 && (
              <p className="text-[10px] text-amber-600 mt-0.5">{leaveDays} day{leaveDays != 1 ? 's' : ''} = {leaveHours}h deducted from capacity</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CapacityReport() {
  const [month, setMonth]       = useState(THIS_MONTH);
  const [team, setTeam]         = useState('');
  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [capModal, setCapModal] = useState(null); // { userId, name, weekStart, availableHours, leaveHours }

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month };
      if (team) params.team = team;
      const { data } = await axios.get('/api/capacity/report', { params });
      setReport(data);
    } catch {
      toast.error('Failed to load capacity report');
    } finally {
      setLoading(false);
    }
  }, [month, team]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleEditCapacity = (member, weekStart) => {
    setCapModal({
      userId: member.userId,
      name: member.name,
      weekStart,
      availableHours: member.availableHours,
      leaveHours: member.leaveHours,
    });
  };

  const handleSaveCapacity = async (entry) => {
    await axios.post('/api/capacity/bulk', {
      entries: [{
        user_id: entry.userId,
        week_start_date: entry.weekStart,
        available_hours: entry.available_hours,
        leave_hours: entry.leave_hours,
      }],
    });
    toast.success('Capacity updated');
    fetchReport();
  };

  const handleExport = () => {
    // Simple CSV export of the report
    if (!report) return;
    const rows = [['Week', 'Name', 'Dept', 'Available Hours', 'Tasks', 'Task Hours', 'Monitoring Hours', 'Enhancement Hours', 'Total Hours', 'Leave Hours']];
    report.weeks.forEach(w => {
      w.members.forEach(m => {
        rows.push([w.label, m.name, m.dept, m.availableHours, m.taskCount, m.taskHours, m.monitoringHours, m.enhancementHours, m.totalHours, m.leaveHours]);
      });
      rows.push([w.label + ' TOTAL', '', '', '', '', '', '', '', w.totalHours, '']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `capacity_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  };

  return (
    <div className="p-6 max-w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Capacity &amp; Utilization Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">Weekly resource utilization by team member</p>
        </div>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
          ⬇️ Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label text-xs">Month</label>
          <select className="input text-sm w-52" value={month} onChange={e => setMonth(e.target.value)}>
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Team</label>
          <select
            className="input text-sm w-36"
            value={team}
            onChange={e => setTeam(e.target.value)}
          >
            <option value="">All Teams</option>
            <option value="VPM">VPM</option>
            <option value="CWGW">CWGW</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="text-slate-500 text-xs">⏱</span>
          <span className="text-xs text-slate-600">
            Capacity = <strong>Mon – Fri working days × 9 hrs</strong>. Click any capacity cell to override per person.
          </span>
        </div>
      </div>

      {/* Report */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !report ? null : (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 overflow-x-auto">
          {/* Weekly blocks */}
          {report.weeks.map(week => (
            <WeekBlock key={week.weekStart} week={week} onEditCapacity={handleEditCapacity} />
          ))}

          {/* Monthly summary */}
          <MonthlyBlock
            monthly={report.monthly}
            monthDateRange={report.monthDateRange}
            onEditCapacity={handleEditCapacity}
          />
        </div>
      )}

      {/* Capacity edit modal */}
      {capModal && (
        <CapacityModal
          entry={capModal}
          onClose={() => setCapModal(null)}
          onSave={handleSaveCapacity}
        />
      )}
    </div>
  );
}
