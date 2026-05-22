export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
            <span className="text-xl">{danger ? '⚠️' : 'ℹ️'}</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
            <p className="text-gray-600 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
