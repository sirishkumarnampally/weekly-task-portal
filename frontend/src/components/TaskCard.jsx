import StatusBadge from './StatusBadge';

const TEAM_TYPE_DOT = {
  AMO:   'bg-blue-500',
  PJ:    'bg-indigo-500',
  Infra: 'bg-teal-500',
};

export default function TaskCard({ task, onEdit, onDelete, showMember = false, readOnly = false }) {
  const dot = TEAM_TYPE_DOT[task.team_type];

  return (
    <div className="card p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Top row: team_type dot + member badge + status */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {task.team_type && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-600">
                {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
                {task.team_type}
              </span>
            )}
            {showMember && (
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {task.member_name}
              </span>
            )}
            <StatusBadge status={task.status} />
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{task.title}</h3>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            {task.actual_hours > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-gray-400">⏱</span>
                <strong className="text-gray-700">{task.actual_hours}h</strong>
              </span>
            )}
            {task.task_type && (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">
                {task.task_type}
              </span>
            )}
            {task.requester && (
              <span className="text-gray-400">Req: <span className="text-gray-600">{task.requester}</span></span>
            )}
            {task.owner && (
              <span className="text-gray-400">Owner: <span className="text-gray-600">{task.owner}</span></span>
            )}
            {task.notes && (
              <span className="truncate italic text-gray-400 max-w-xs">"{task.notes}"</span>
            )}
          </div>
        </div>

        {/* Edit / Delete — only shown when editable */}
        {!readOnly && (onEdit || onDelete) && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors text-sm"
                title="Edit"
              >✏️</button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(task)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors text-sm"
                title="Delete"
              >🗑️</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
