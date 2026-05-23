import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const TEAMS = ['VPM', 'CWGW'];
const emptyForm = { name: '', email: '', role: 'member', team: 'VPM', dept: '', password: '' };

// ─── Import Preview Modal ─────────────────────────────────────────────────────
function ImportPreviewModal({ preview, file, onClose, onConfirm, executing }) {
  const { users, tasks, userErrors, taskWarnings, existingMembersCount } = preview;

  const byTeam = users.reduce((acc, u) => {
    if (!acc[u.team]) acc[u.team] = [];
    acc[u.team].push(u);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Import Preview</h2>
            <p className="text-blue-200 text-xs mt-0.5">Review before executing — this action cannot be undone</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Warning banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-amber-800 font-semibold text-sm">Destructive action</p>
              <p className="text-amber-700 text-xs mt-0.5">
                <strong>{existingMembersCount} existing member account{existingMembersCount !== 1 ? 's' : ''}</strong> and all their tasks will be permanently removed.
                <strong> {users.length} new member{users.length !== 1 ? 's' : ''}</strong> and <strong>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</strong> will be imported.
              </p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-blue-700">{users.length}</p>
              <p className="text-xs text-blue-600 font-medium mt-0.5">Users to import</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-emerald-700">{tasks.length}</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Tasks to import</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-red-600">{existingMembersCount}</p>
              <p className="text-xs text-red-500 font-medium mt-0.5">Accounts removed</p>
            </div>
          </div>

          {/* Users list by team */}
          {Object.entries(byTeam).map(([team, members]) => (
            <div key={team}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>{team}</span>
                <span className="text-xs text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Name', 'Email', 'Dept', 'Role'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {members.map((u, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{u.name}</td>
                        <td className="px-3 py-2 text-gray-500">{u.email}</td>
                        <td className="px-3 py-2 text-gray-500">{u.dept || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${u.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Task summary by user */}
          {tasks.length > 0 && (() => {
            const byUser = tasks.reduce((acc, t) => {
              acc[t.memberEmail] = (acc[t.memberEmail] || 0) + 1;
              return acc;
            }, {});
            return (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Tasks per member</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(byUser).map(([email, count]) => {
                    const u = users.find(u => u.email === email);
                    return (
                      <span key={email} className="bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 text-xs">
                        <span className="font-medium text-gray-800">{u?.name || email}</span>
                        <span className="text-emerald-600 ml-1">{count}t</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Errors / warnings */}
          {(userErrors.length > 0 || taskWarnings.length > 0) && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-red-700 mb-2">Skipped rows ({userErrors.length + taskWarnings.length})</p>
              {[...userErrors, ...taskWarnings].slice(0, 10).map((e, i) => (
                <p key={i} className="text-xs text-red-600">• {e}</p>
              ))}
              {(userErrors.length + taskWarnings.length) > 10 && (
                <p className="text-xs text-red-400">+{(userErrors.length + taskWarnings.length) - 10} more…</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onConfirm(file)}
            disabled={executing || users.length === 0}
            className="btn-primary flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {executing
              ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Importing…</>
              : `Confirm Import — Replace ${existingMembersCount} accounts`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Result Modal ──────────────────────────────────────────────────────
function ImportResultModal({ result, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Import Complete</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-blue-700">{result.usersImported}</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">Users imported</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-emerald-700">{result.tasksImported}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Tasks imported</p>
          </div>
        </div>
        {(result.userErrors?.length > 0 || result.taskWarnings?.length > 0) && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
            {result.userErrors?.length > 0 && <p>{result.userErrors.length} user row{result.userErrors.length !== 1 ? 's' : ''} skipped</p>}
            {result.taskWarnings?.length > 0 && <p>{result.taskWarnings.length} task row{result.taskWarnings.length !== 1 ? 's' : ''} skipped</p>}
          </div>
        )}
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManageUsers() {
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm]               = useState(emptyForm);
  const [saving, setSaving]           = useState(false);

  // Import state
  const fileInputRef   = useRef(null);
  const [previewing, setPreviewing]   = useState(false);
  const [executing, setExecuting]     = useState(false);
  const [preview, setPreview]         = useState(null);   // parsed preview data
  const [importFile, setImportFile]   = useState(null);   // File object kept for execute step
  const [importResult, setImportResult] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/users');
      setUsers(data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd  = () => { setEditingUser(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, team: user.team || 'VPM', dept: user.dept || '', password: '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        const payload = { name: form.name, email: form.email, role: form.role, team: form.team, dept: form.dept };
        if (form.password) payload.password = form.password;
        await axios.put(`/api/users/${editingUser.id}`, payload);
        toast.success('User updated');
      } else {
        await axios.post('/api/users', form);
        toast.success('User created');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/users/${deleteTarget.id}`);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  // ── Download template ───────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    const token = localStorage.getItem('token');
    const res   = await fetch('/api/import/template', { headers: { Authorization: `Bearer ${token}` } });
    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = 'import_template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Step 1: user selects file → preview ────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setImportFile(file);
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post('/api/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to parse Excel file');
      setImportFile(null);
    } finally {
      setPreviewing(false);
    }
  };

  // ── Step 2: manager confirms → execute ─────────────────────────────────────
  const handleConfirmImport = async (file) => {
    setExecuting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post('/api/import/execute', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(null);
      setImportFile(null);
      setImportResult(data);
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Import failed');
    } finally {
      setExecuting(false);
    }
  };

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Add members manually or bulk-import from Excel</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <span>+</span> Add User
        </button>
      </div>

      {/* Excel Import Panel */}
      <div className="card p-5 mb-6 border-2 border-dashed border-blue-200 bg-blue-50/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📥</span>
          <h2 className="font-bold text-gray-800">Bulk Import from Excel</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Upload a <strong>.xlsx</strong> file with two sheets:
          <span className="mx-1 bg-white border border-blue-200 rounded px-1.5 py-0.5 text-xs font-mono text-blue-700">Users</span>
          and
          <span className="mx-1 bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-700">Tasks</span>.
          All existing member accounts will be replaced with the users from the file.
        </p>

        {/* Column info */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-white border border-blue-100 rounded-xl p-3">
            <p className="font-semibold text-blue-700 mb-1.5">Users sheet columns</p>
            {['Name', 'Email', 'Password', 'Team (VPM/CWGW)', 'Dept (VPM: AMO/PJ/Infra · CWGW: AMO/Infra)', 'Role'].map(c => (
              <span key={c} className="inline-block bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 mr-1 mb-1 font-mono">{c}</span>
            ))}
          </div>
          <div className="bg-white border border-emerald-100 rounded-xl p-3">
            <p className="font-semibold text-emerald-700 mb-1.5">Tasks sheet columns</p>
            {['Member Email', 'Week Start', 'Task', 'Status', 'Hours', 'Task Type', 'Requester', 'Owner', 'Team Type'].map(c => (
              <span key={c} className="inline-block bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5 mr-1 mb-1 font-mono">{c}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
            <span>⬇️</span> Download Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={previewing || executing}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {previewing
              ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Parsing…</>
              : <><span>📂</span> Choose Excel File</>}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800">
              <tr>
                {['Name', 'Email', 'Team / Role', 'Dept', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u, i) => (
                <tr key={u.id} className={`transition-colors group ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role === 'manager' ? '👔 Manager' : '👤 Member'}
                      </span>
                      {u.team && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${u.team === 'VPM' ? 'bg-blue-600' : 'bg-violet-600'}`}>
                          {u.team}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.dept || '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{u.created_at?.split('T')[0]}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="text-xs btn-secondary py-1 px-3">Edit</button>
                      <button onClick={() => setDeleteTarget(u)} className="text-xs text-red-600 hover:text-red-700 font-medium border border-red-200 hover:border-red-300 rounded-lg px-3 py-1 transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
          {users.length} user{users.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="member">Team Member</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="label">Team</label>
                  <select className="input" value={form.team} onChange={e => set('team', e.target.value)}>
                    <option value="">— None —</option>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Dept / Role Code</label>
                <input type="text" className="input" placeholder="VPM: AMO / PJ / Infra · CWGW: AMO / Infra" value={form.dept} onChange={e => set('dept', e.target.value)} />
              </div>
              <div>
                <label className="label">{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)} required={!editingUser} minLength={6} />
              </div>
              <div className="flex gap-3 pt-2 justify-end border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <ImportPreviewModal
          preview={preview}
          file={importFile}
          onClose={() => { setPreview(null); setImportFile(null); }}
          onConfirm={handleConfirmImport}
          executing={executing}
        />
      )}

      {/* Result modal */}
      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete User"
        message={`Delete "${deleteTarget?.name}"? All their tasks will also be deleted.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
