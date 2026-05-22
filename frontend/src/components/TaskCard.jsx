import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';

export default function TaskCard({ task, onEdit, onDelete, showMember = false }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {showMember && (
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {task.member_name}
              </span>
            )}
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{task.title}</h3>
          {task.description && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors text-sm"
            title="Edit"
          >✏️</button>
          <button
            onClick={() => onDelete(task)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors text-sm"
            title="Delete"
          >🗑️</button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span title="Estimated hours">⏱ Est: <strong className="text-gray-700">{task.estimated_hours}h</strong></span>
        <span title="Actual hours">✅ Actual: <strong className="text-gray-700">{task.actual_hours}h</strong></span>
        {task.notes && (
          <span className="truncate text-gray-400 italic">"{task.notes}"</span>
        )}
      </div>
    </div>
  );
}
