import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === 'manager' ? '/manager' : '/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, password) => setForm({ email, password });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Task Portal</h1>
          <p className="text-gray-500 mt-1 text-sm">Team collaboration made simple</p>
        </div>

        {/* Form Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {loading ? (
                <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          New to the portal?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">Create an account</Link>
        </p>

        {/* Demo credentials */}
        <div className="mt-6">
          <p className="text-center text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fillDemo('manager@demo.com', 'manager123')}
              className="card p-3 text-left hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-purple-300"
            >
              <div className="flex items-center gap-2 mb-1">
                <span>👔</span>
                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">Manager</span>
              </div>
              <p className="text-xs text-gray-600">manager@demo.com</p>
              <p className="text-xs text-gray-400">manager123</p>
            </button>
            <button
              onClick={() => fillDemo('bob@demo.com', 'member123')}
              className="card p-3 text-left hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-blue-300"
            >
              <div className="flex items-center gap-2 mb-1">
                <span>👤</span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Member</span>
              </div>
              <p className="text-xs text-gray-600">bob@demo.com</p>
              <p className="text-xs text-gray-400">member123</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
