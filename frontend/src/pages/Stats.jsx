import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { weekOptionsForYear, monthOptionsForYear } from '../utils/weekUtils';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 2030 - 2024 + 1 }, (_, i) => 2024 + i);

const SUBTYPE_META = {
  AMO:   { bg: 'bg-blue-600',   light: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   bar: 'bg-blue-500',   barLight: 'bg-blue-100'  },
  PJ:    { bg: 'bg-indigo-600', light: 'bg-indigo-50', border: 'border-indigo-200',text: 'text-indigo-700', bar: 'bg-indigo-500', barLight: 'bg-indigo-100'},
  Infra: { bg: 'bg-teal-600',   light: 'bg-teal-50',   border: 'border-teal-200',  text: 'text-teal-700',   bar: 'bg-teal-500',   barLight: 'bg-teal-100'  },
};

const TEAM_META = {
  VPM:  { bg: 'bg-blue-700',   header: 'from-blue-700 to-blue-900',   subtypes: ['AMO', 'PJ', 'Infra'], label: 'Vehicle Profile Management' },
  CWGW: { bg: 'bg-violet-700', header: 'from-violet-700 to-violet-900', subtypes: ['AMO', 'Infra'],    label: 'Carwings Gateway'            },
};

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ─── Vertical bar chart (CSS only) ───────────────────────────────────────────
function BarChart({ bars, maxValue, height = 120, title }) {
  const max = maxValue || Math.max(...bars.map(b => b.value), 1);
  return (
    <div>
      {title && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</p>}
      <div className="flex items-end gap-3" style={{ height }}>
        {bars.map((bar) => {
          const m    = SUBTYPE_META[bar.label] || {};
          const barH = Math.round((bar.value / max) * height);
          return (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1 group">
              {/* Value label */}
              <span className={`text-xs font-bold ${m.text || 'text-gray-700'} transition-opacity`}>
                {bar.value}
              </span>
              {/* Bar */}
              <div
                className="w-full rounded-t-lg transition-all duration-500 relative cursor-default"
                style={{ height: barH || 4 }}
              >
                <div className={`w-full h-full rounded-t-lg ${m.bar || 'bg-gray-400'}`} />
                {/* Hover tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {bar.label}: {bar.value} {bar.unit || 'tasks'}
                </div>
              </div>
              {/* X label */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${m.bg || 'bg-gray-500'} whitespace-nowrap`}>
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donut-style progress ring (CSS) ─────────────────────────────────────────
function RingProgress({ value, max, color, size = 64, label }) {
  const r   = (size / 2) - 6;
  const c   = 2 * Math.PI * r;
  const off = c - (pct(value, max) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="text-[10px] font-semibold text-gray-500">{label}</span>
      <span className="text-sm font-extrabold text-gray-800 -mt-1">{pct(value, max)}%</span>
    </div>
  );
}

// ─── Sub-type stat card ───────────────────────────────────────────────────────
function SubtypeCard({ st }) {
  const m   = SUBTYPE_META[st.team_type] || {};
  const cmp = pct(st.completed, st.total);
  return (
    <div className={`rounded-xl border ${m.border} ${m.light} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full text-white ${m.bg}`}>{st.team_type}</span>
        <span className={`text-2xl font-extrabold ${m.text}`}>{st.total}</span>
      </div>
      {/* Completion bar */}
      <div className="h-1.5 bg-white rounded-full mb-3 overflow-hidden border border-gray-100">
        <div className={`h-full ${m.bar} rounded-full transition-all duration-500`} style={{ width: `${cmp}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-xs font-bold text-emerald-600">{st.completed}</p>
          <p className="text-[9px] text-gray-400">Done</p>
        </div>
        <div>
          <p className="text-xs font-bold text-blue-600">{st.in_progress}</p>
          <p className="text-[9px] text-gray-400">Active</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-700">{Number(st.total_hours).toFixed(0)}h</p>
          <p className="text-[9px] text-gray-400">Hours</p>
        </div>
      </div>
    </div>
  );
}

// ─── Team section ─────────────────────────────────────────────────────────────
function TeamSection({ teamKey, teamData }) {
  const meta     = TEAM_META[teamKey];
  const total    = teamData.total;
  const subtypes = teamData.subtypes;

  const taskBars  = subtypes.map(s => ({ label: s.team_type, value: s.total }));
  const hourBars  = subtypes.map(s => ({ label: s.team_type, value: Number(s.total_hours), unit: 'hours' }));
  const maxTasks  = Math.max(...taskBars.map(b => b.value), 1);
  const maxHours  = Math.max(...hourBars.map(b => b.value), 1);

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-6">

      {/* Team header */}
      <div className={`bg-gradient-to-r ${meta.header} px-6 py-4 flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-extrabold text-base">{teamKey}</span>
            <span className="text-white/60 text-xs">·</span>
            <span className="text-white/70 text-xs">{meta.label}</span>
          </div>
          <div className="flex items-center gap-4 text-white/70 text-xs">
            <span><strong className="text-white">{total.total}</strong> tasks</span>
            <span><strong className="text-white">{Number(total.total_hours).toFixed(0)}h</strong> logged</span>
            <span><strong className="text-white">{pct(total.completed, total.total)}%</strong> complete</span>
          </div>
        </div>
        {/* Ring progress */}
        <RingProgress
          value={total.completed}
          max={total.total}
          color={teamKey === 'VPM' ? '#60a5fa' : '#a78bfa'}
          size={70}
          label="Completion"
        />
      </div>

      <div className="p-5 space-y-6 bg-white">

        {/* Sub-type cards */}
        <div className={`grid gap-4 ${meta.subtypes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {subtypes.map(st => <SubtypeCard key={st.team_type} st={st} />)}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4">
            <BarChart bars={taskBars} maxValue={maxTasks} height={110} title="Task Count" />
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <BarChart bars={hourBars} maxValue={maxHours} height={110} title="Hours Logged" />
          </div>
        </div>

        {/* Member table */}
        {teamData.members.length > 0 && (
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Member', 'Sub-team', 'Tasks', 'Done', 'Active', 'Hours', 'Progress'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wider text-[10px] border-r border-gray-100 last:border-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teamData.members.map((m, i) => {
                  const sm = SUBTYPE_META[m.team_type] || {};
                  const c  = pct(m.completed, m.total);
                  return (
                    <tr key={`${m.member_name}-${m.team_type}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2.5 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${meta.bg}`}>
                            {m.member_name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{m.member_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r border-gray-100">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${sm.bg || 'bg-gray-500'}`}>{m.team_type}</span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-gray-100 text-center font-bold text-gray-800">{m.total}</td>
                      <td className="px-3 py-2.5 border-r border-gray-100 text-center">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">{m.completed}</span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-gray-100 text-center">
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">{m.in_progress}</span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-gray-100 text-center font-semibold text-gray-700">{Number(m.total_hours).toFixed(0)}h</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${sm.bar || 'bg-gray-400'} rounded-full`} style={{ width: `${c}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 w-7 text-right">{c}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Stats() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filterMode, setFilterMode] = useState('all');
  const [year, setYear]             = useState(CURRENT_YEAR);
  const [week, setWeek]             = useState('');
  const [month, setMonth]           = useState('');
  const [team, setTeam]             = useState('');

  const weeks  = useMemo(() => weekOptionsForYear(year),  [year]);
  const months = useMemo(() => monthOptionsForYear(year), [year]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterMode === 'week'  && week)  params.week  = week;
      if (filterMode === 'month' && month) params.month = month;
      if (team) params.team = team;
      const { data: res } = await axios.get('/api/stats', { params });
      setData(res);
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [filterMode, week, month, team]);

  // Reset week/month when year changes so stale values don't persist
  useEffect(() => { setWeek(''); setMonth(''); }, [year]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const grand = data?.grand || { total: 0, total_hours: 0, completed: 0, in_progress: 0 };
  const visibleTeams = team ? [team] : ['VPM', 'CWGW'];

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Stats</h1>
          <p className="text-gray-500 text-sm mt-0.5">Task breakdown by team and sub-team with charts</p>
        </div>
        <button onClick={fetchStats} className="btn-secondary text-xs flex items-center gap-1.5">
          ↻ Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">

          {/* Year dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700 shrink-0">Year</label>
            <select
              className="input text-sm w-28 font-semibold"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>
                  {y}{y === CURRENT_YEAR ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-gray-200 shrink-0" />

          {/* Team dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700 shrink-0">Team</label>
            <select
              className="input text-sm w-52"
              value={team}
              onChange={e => setTeam(e.target.value)}
            >
              <option value="">All Teams</option>
              <option value="VPM">VPM — Vehicle Profile Management</option>
              <option value="CWGW">CWGW — Carwings Gateway</option>
            </select>
          </div>

          <div className="w-px h-6 bg-gray-200 shrink-0" />

          {/* Period toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-700 shrink-0">Period</label>
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              {[['all', 'All Year'], ['month', 'Month'], ['week', 'Week']].map(([val, lbl]) => (
                <button key={val} onClick={() => setFilterMode(val)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filterMode === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Week / Month sub-selectors */}
        {filterMode !== 'all' && (
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-400 shrink-0">{year} —</span>
            {filterMode === 'month' && (
              <select className="input text-sm max-w-xs" value={month} onChange={e => setMonth(e.target.value)}>
                <option value="">All months of {year}</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
            {filterMode === 'week' && (
              <select className="input text-sm max-w-xs" value={week} onChange={e => setWeek(e.target.value)}>
                <option value="">All weeks of {year}</option>
                {weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            )}
            <span className="text-xs text-gray-400">
              {filterMode === 'week'  ? `${weeks.length} weeks available` : '12 months'}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Grand total banner */}
          <div className="bg-slate-800 rounded-2xl p-5 mb-6 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-0.5">
                {team ? `${team} Total` : 'Grand Total — VPM + CWGW'}
              </p>
              <p className="text-white text-4xl font-extrabold">{grand.total}</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {team
                  ? `across ${TEAM_META[team]?.subtypes.join(' · ')}`
                  : 'across AMO · PJ · Infra'}
              </p>
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Overall completion</span>
                <span className="font-bold text-white">{pct(grand.completed, grand.total)}%</span>
              </div>
              <div className="h-3 bg-slate-600 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${pct(grand.completed, grand.total)}%` }} />
              </div>
            </div>
            <div className="flex gap-6">
              {[
                { label: 'Completed',   value: grand.completed,               color: 'text-emerald-400' },
                { label: 'In Progress', value: grand.in_progress,              color: 'text-blue-400'   },
                { label: 'Hours',       value: `${Number(grand.total_hours).toFixed(0)}h`, color: 'text-slate-200' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team sections */}
          {data && visibleTeams.map(tk =>
            data.teams[tk] ? (
              <TeamSection key={tk} teamKey={tk} teamData={data.teams[tk]} />
            ) : null
          )}

          {grand.total === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-medium">No tasks found for the selected filter</p>
              <p className="text-sm mt-1">Try selecting a different team or time period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
