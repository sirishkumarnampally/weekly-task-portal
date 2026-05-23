import { useState, useEffect } from 'react';
import axios from 'axios';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { useAuth } from '../context/AuthContext';
import { currentWeekStart, formatWeekLabel } from '../utils/weekUtils';

const TEAMS = ['VPM', 'CWGW'];

const TEAM_STYLE = {
  VPM:  { bg: 'bg-blue-600',   light: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-800'  },
  CWGW: { bg: 'bg-violet-600', light: 'bg-violet-50 border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-800' },
};

const STAT_STATUS = ['Completed', 'In Progress', 'Blocked', 'Not Started'];
const STATUS_DOT  = { 'Completed': 'bg-emerald-500', 'In Progress': 'bg-blue-500', 'Blocked': 'bg-red-500', 'Not Started': 'bg-gray-300' };

export default function NissanTasksSlider() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const memberTeam = user?.team || 'VPM';

  const [open, setOpen]           = useState(true);
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTeam, setActiveTeam] = useState(isManager ? 'VPM' : memberTeam);
  const [expandedTask, setExpandedTask] = useState(null);
  const week = currentWeekStart();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/tasks', { params: { week } });
        setTasks(data);
      } catch { /* silently fail — slider is supplementary */ }
      finally { setLoading(false); }
    };
    fetch();
  }, [week]);

  // For managers, filter by selected tab; for members the API already scopes to their team
  const teamTasks = isManager
    ? tasks.filter(t => t.member_team === activeTeam)
    : tasks;

  const stats = STAT_STATUS.map(s => ({
    label: s,
    count: teamTasks.filter(t => t.status === s).length,
  }));

  const totalEst    = teamTasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  const totalActual = teamTasks.reduce((s, t) => s + (t.actual_hours || 0), 0);
  const completedPct = teamTasks.length
    ? Math.round((teamTasks.filter(t => t.status === 'Completed').length / teamTasks.length) * 100)
    : 0;

  const style = TEAM_STYLE[activeTeam];

  return (
    <>
      {/* Slide-out toggle tab — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 px-1.5 py-4 rounded-r-xl shadow-lg text-white text-xs font-bold tracking-wider transition-all duration-300 ${style.bg} ${open ? 'left-72' : 'left-0'}`}
        title={open ? 'Collapse Nissan Tasks' : 'Expand Nissan Tasks'}
      >
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold tracking-widest uppercase opacity-90">
          Nissan Weekly
        </span>
        <span className="text-base">{open ? '◀' : '▶'}</span>
      </button>

      {/* Slider panel */}
      <aside
        className={`fixed top-0 left-0 h-full z-30 flex flex-col bg-white border-r border-gray-200 shadow-xl transition-all duration-300 ease-in-out ${open ? 'w-72' : 'w-0 overflow-hidden'}`}
      >
        {/* Header */}
        <div className={`${style.bg} px-4 pt-5 pb-4 shrink-0`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🚗</span>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">Nissan Weekly Tasks</h2>
              <p className="text-white/70 text-xs">{formatWeekLabel(week)}</p>
            </div>
          </div>

          {/* Team tabs — managers can switch, members are locked to their team */}
          {isManager ? (
            <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
              {TEAMS.map(t => (
                <button
                  key={t}
                  onClick={() => { setActiveTeam(t); setExpandedTask(null); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTeam === t
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg px-3 py-1.5 text-center">
              <span className="text-white text-xs font-bold tracking-wide">{memberTeam} Team</span>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className={`grid grid-cols-2 gap-2 px-3 py-3 border-b ${style.light} border-b shrink-0`}>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{teamTasks.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Tasks</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${style.text}`}>{completedPct}%</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Complete</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{totalEst.toFixed(1)}h</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Est. Hours</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{totalActual.toFixed(1)}h</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Actual Hrs</p>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {stats.map(s => s.count > 0 && (
              <div key={s.label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s.label]}`} />
                <span className="text-[10px] text-gray-600">{s.label.replace(' ', ' ')}: <strong>{s.count}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {teamTasks.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100 shrink-0">
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${style.bg}`}
                style={{ width: `${completedPct}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{completedPct}% of week complete</p>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : teamTasks.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-gray-500 text-xs">No tasks for {activeTeam} this week</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {teamTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  className="w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors"
                >
                  {/* Member name */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${style.bg}`}>
                        {task.member_name?.charAt(0)}
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium truncate max-w-[100px]">{task.member_name}</span>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>

                  {/* Task title */}
                  <p className="text-xs font-semibold text-gray-800 leading-snug mb-1.5 text-left">
                    {task.title}
                  </p>

                  <StatusBadge status={task.status} />

                  {/* Expanded detail */}
                  {expandedTask === task.id && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-left">
                      {task.description && (
                        <p className="text-[11px] text-gray-500 italic">{task.description}</p>
                      )}
                      <div className="flex gap-3 text-[10px] text-gray-500">
                        <span>⏱ Est: <strong>{task.estimated_hours}h</strong></span>
                        <span>✅ Actual: <strong>{task.actual_hours}h</strong></span>
                      </div>
                      {task.notes && (
                        <p className="text-[10px] text-gray-400 italic">"{task.notes}"</p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-3 py-2 border-t border-gray-100 shrink-0 ${style.light}`}>
          <p className="text-[10px] text-center text-gray-400 font-medium">
            {activeTeam} · Week of {formatWeekLabel(week).split('–')[0].trim()}
          </p>
        </div>
      </aside>
    </>
  );
}
