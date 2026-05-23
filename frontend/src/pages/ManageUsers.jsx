import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const TEAMS = ['VPM', 'CWGW'];
const emptyForm = { name: '', email: '', role: 'member', team: 'VPM', password: '' };

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Import state
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
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

  const openAdd = () => { setEditingUser(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, team: user.team || 'VPM', password: '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        const payload = { name: form.name, email: form.email, role: form.role };
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

  // ── Download import template ─────────────────────────────────────────────
  const downloadTemplate = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/import/template', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Handle Excel file upload ──────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';           // reset input so same file can be re-selected

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post('/api/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      if (data.created.length) {
        toast.success(`${data.created.length} user${data.created.length > 1 ? 's' : ''} imported`);
        fetchUsers();
      } else {
        toast.error('No new users were created');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Add and manage team members</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <span>+</span> Add User
        </button>
      </div>

      {/* Excel Import Panel */}
      <div className="card p-5 mb-6 border-2 border-dashed border-blue-200 bg-blue-50/40">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📥</span>
          <h2 className="font-semibold text-gray-800">Bulk Import Users from Excel</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Upload an <strong>.xlsx</strong> file with columns: <code className="bg-white px-1 py-0.5 rounded border text-xs">Name</code>&nbsp;
          <code className="bg-white px-1 py-0.5 rounded border text-xs">Email</code>&nbsp;
          <code className="bg-white px-1 py-0.5 rounded border text-xs">Role</code>&nbsp;
          <code className="bg-white px-1 py-0.5 rounded border text-xs">Password</code>.
          Role defaults to <em>member</em>; Password defaults to <em>Welcome@123</em> if blank.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <span>⬇️</span> Download Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {importing
              ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Importing...</>
              : <><span>📂</span> Choose Excel File</>}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {/* Import result summary */}
        {importResult && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">{importResult.message}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Created', items: importResult.created, color: 'emerald' },
                { label: 'Skipped', items: importResult.skipped, color: 'yellow' },
                { label: 'Errors',  items: importResult.errors,  color: 'red' },
              ].map(({ label, items, color }) => items.length > 0 && (
                <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-3`}>
                  <p className={`text-xs font-semibold text-${color}-700 mb-1`}>{label} ({items.length})</p>
                  <ul className="space-y-0.5">
                    {items.slice(0, 5).map((item, i) => (
                      <li key={i} className="text-xs text-gray-600 truncate">
                        {item.name || item.email || JSON.stringify(item.row).slice(0, 40)}
                        {item.reason && <span className="text-gray-400"> — {item.reason}</span>}
                      </li>
                    ))}
                    {items.length > 5 && <li className="text-xs text-gray-400">+{items.length - 5} more</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'manager' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {u.role === 'manager' ? '👔 Manager' : '👤 Member'}
                      </span>
                      {u.team && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          u.team === 'VPM' ? 'bg-blue-600 text-white' : 'bg-violet-600 text-white'
                        }`}>
                          {u.team}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.created_at?.split('T')[0]}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="text-xs btn-secondary py-1 px-3">Edit</button>
                      <button onClick={() => setDeleteTarget(u)} className="text-xs btn-danger py-1 px-3">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
          {users.length} user{users.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* User Add/Edit Modal */}
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
                <label className="label">{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required={!editingUser}
                  minLength={6}
                />
              </div>
              <div className="flex gap-3 pt-2 justify-end border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
