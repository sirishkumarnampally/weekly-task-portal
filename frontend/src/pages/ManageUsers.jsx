import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyForm = { name: '', email: '', role: 'member', password: '' };

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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

  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, password: '' });
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

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">Add and manage team members</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <span>+</span> Add User
        </button>
      </div>

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
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'manager'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {u.role === 'manager' ? '👔 Manager' : '👤 Member'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.created_at?.split('T')[0]}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="text-xs btn-secondary py-1 px-3">Edit</button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="text-xs btn-danger py-1 px-3"
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* User Modal */}
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
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="member">Team Member</option>
                  <option value="manager">Manager</option>
                </select>
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
