import { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  'Completed':   'bg-emerald-100 text-emerald-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Blocked':     'bg-red-100 text-red-700',
  'Not Started': 'bg-gray-100 text-gray-600',
};
const PRIORITY_COLOR = {
  High:   'text-red-600 font-semibold',
  Medium: 'text-amber-600',
  Low:    'text-gray-400',
};

export default function TaskImportModal({ isOpen, onClose, onImported, isManager = false }) {
  const [step,     setStep]     = useState('upload');  // 'upload' | 'preview' | 'done'
  const [file,     setFile]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview,  setPreview]  = useState(null);      // { tasks, errors, count }
  const [result,   setResult]   = useState(null);      // { imported, errors }
  const [busy,     setBusy]     = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const reset = () => { setStep('upload'); setFile(null); setPreview(null); setResult(null); };
  const handleClose = () => { reset(); onClose(); };

  const acceptFile = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) { toast.error('Please upload an Excel file (.xlsx or .xls)'); return; }
    setFile(f);
    setPreview(null);
  };

  const downloadTemplate = async () => {
    try {
      const res = await axios.get('/api/tasks/upload-template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'task_upload_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download template'); }
  };

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await axios.post('/api/tasks/upload/preview', fd);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to parse file');
    } finally { setBusy(false); }
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await axios.post('/api/tasks/upload', fd);
      setResult(data);
      setStep('done');
      onImported?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Import failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📥</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import Tasks from Excel</h2>
              <p className="text-xs text-gray-500">
                {step === 'upload'  && 'Download the template, fill it in, then upload'}
                {step === 'preview' && `${preview?.count ?? 0} tasks ready to import`}
                {step === 'done'    && `${result?.imported} tasks imported successfully`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-0 border-b border-gray-100 px-6">
          {[['upload', '1', 'Upload'], ['preview', '2', 'Preview'], ['done', '3', 'Done']].map(([s, n, label]) => (
            <div key={s} className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 mr-2 ${
              step === s ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s ? 'bg-blue-600 text-white' :
                (['preview','done'].includes(step) && s === 'upload') || (step === 'done' && s === 'preview')
                  ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{(['preview','done'].includes(step) && s === 'upload') || (step === 'done' && s === 'preview') ? '✓' : n}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Template download */}
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-2xl mt-0.5">📋</span>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 text-sm">Step 1 — Download the template</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Fill in task details.
                    {isManager
                      ? ' Include "Member Email" to assign tasks to specific members.'
                      : ' All tasks will be assigned to your account.'}
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  ⬇ Template
                </button>
              </div>

              {/* Drag-and-drop zone */}
              <div
                onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files[0]); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files[0])}
                />
                {file ? (
                  <div>
                    <p className="text-3xl mb-2">✅</p>
                    <p className="font-semibold text-emerald-700 text-sm">{file.name}</p>
                    <p className="text-xs text-emerald-600 mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">📂</p>
                    <p className="font-semibold text-gray-600 text-sm">Drop Excel file here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">.xlsx or .xls — max 10 MB</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handlePreview}
                  disabled={!file || busy}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                >
                  {busy ? <span className="animate-spin text-base">⏳</span> : '👁'}
                  {busy ? 'Parsing…' : 'Preview Import'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Errors */}
              {preview.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-700 mb-1.5">⚠ {preview.errors.length} row{preview.errors.length !== 1 ? 's' : ''} skipped:</p>
                  <ul className="space-y-0.5">
                    {preview.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600">{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.count === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <p className="text-3xl mb-2">🚫</p>
                  <p className="text-sm font-medium">No valid tasks found in the file</p>
                  <p className="text-xs mt-1">Check that Task Title and Start Date (or Week Start Date) columns are present</p>
                </div>
              ) : (
                <>
                  {/* Summary banner */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                    <span className="text-base">📊</span>
                    <span>
                      <strong>{preview.count}</strong> task entr{preview.count !== 1 ? 'ies' : 'y'} across{' '}
                      <strong>{new Set(preview.tasks.map(t => t.week_start_date)).size}</strong> week{new Set(preview.tasks.map(t => t.week_start_date)).size !== 1 ? 's' : ''}.
                      {preview.tasks.some(t => t._totalWeeks > 1) && ' Multi-week tasks have been split — hours divided evenly per week.'}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <tr>
                          {isManager && <th className="px-3 py-2 text-left font-semibold">Member</th>}
                          <th className="px-3 py-2 text-left font-semibold">Task Title</th>
                          <th className="px-3 py-2 text-left font-semibold">Start → End</th>
                          <th className="px-3 py-2 text-left font-semibold">Week</th>
                          <th className="px-3 py-2 text-left font-semibold">Priority</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                          <th className="px-3 py-2 text-left font-semibold">Type</th>
                          <th className="px-3 py-2 text-right font-semibold">Est h</th>
                          <th className="px-3 py-2 text-right font-semibold">Act h</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.tasks.map((t, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                            {isManager && (
                              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{t.member_name}</td>
                            )}
                            <td className="px-3 py-2 text-gray-900 max-w-[160px]">
                              <div className="truncate font-medium" title={t.title}>{t.title}</div>
                              {t._totalWeeks > 1 && (
                                <span className="inline-block mt-0.5 text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                                  wk {t._weekIndex}/{t._totalWeeks}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                              {t._startDate === t._endDate
                                ? t._startDate
                                : <>{t._startDate}<br /><span className="text-gray-300">→ {t._endDate}</span></>
                              }
                            </td>
                            <td className="px-3 py-2 text-blue-700 font-semibold whitespace-nowrap">{t.week_start_date}</td>
                            <td className={`px-3 py-2 whitespace-nowrap ${PRIORITY_COLOR[t.priority] || ''}`}>{t.priority}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLOR[t.status] || 'bg-gray-100 text-gray-600'}`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{t.task_type || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{t.estimated_hours || 0}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{t.actual_hours || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✅</div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{result.imported} task{result.imported !== 1 ? 's' : ''} imported!</p>
                <p className="text-sm text-gray-500 mt-1">Tasks are now visible in the dashboard</p>
              </div>
              {result.errors?.length > 0 && (
                <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-700 mb-1">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped:</p>
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>

          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-white transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={!preview?.count || busy}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                >
                  {busy ? <span className="animate-spin">⏳</span> : '📥'}
                  {busy ? 'Importing…' : `Import ${preview?.count} task${preview?.count !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
            {step === 'done' && (
              <button
                onClick={() => { reset(); }}
                className="px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
              >
                Import more
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
