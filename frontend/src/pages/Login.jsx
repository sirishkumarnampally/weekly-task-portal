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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden shrink-0">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-10" />
          <div className="absolute -top-20 right-1/4 w-96 h-96 bg-violet-500 rounded-full blur-3xl opacity-10" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-10">
          {/* Top nav bar */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
                <span className="text-lg">🚗</span>
              </div>
              <div>
                <p className="text-white font-extrabold text-sm leading-none tracking-wide">NISSAN</p>
                <p className="text-blue-300/80 text-[10px] tracking-widest uppercase">Task Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 backdrop-blur">VPM</span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/30 backdrop-blur">CWGW</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-4 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-xs font-medium">Team Collaboration Platform</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
              Weekly Task<br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                Management Portal
              </span>
            </h1>
            <p className="text-blue-200/70 text-sm max-w-md mx-auto leading-relaxed">
              Track, manage and report weekly tasks across VPM and CWGW teams — with role-based access and one-click Excel exports.
            </p>
          </div>

          {/* Team cards */}
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            <div className="group bg-blue-600/10 hover:bg-blue-600/20 backdrop-blur border border-blue-400/20 hover:border-blue-400/40 rounded-2xl p-4 text-center transition-all duration-200">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <span className="text-xl">🚘</span>
              </div>
              <p className="text-white font-bold text-sm">VPM</p>
              <p className="text-blue-300/70 text-[10px] mt-0.5 leading-snug">Vehicle Programme<br />Management</p>
            </div>
            <div className="group bg-violet-600/10 hover:bg-violet-600/20 backdrop-blur border border-violet-400/20 hover:border-violet-400/40 rounded-2xl p-4 text-center transition-all duration-200">
              <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <span className="text-xl">🔌</span>
              </div>
              <p className="text-white font-bold text-sm">CWGW</p>
              <p className="text-violet-300/70 text-[10px] mt-0.5 leading-snug">Connected &amp; Gateway<br />Work Group</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Login Form ── */}
      <div className="flex-1 flex items-start justify-center px-4 pt-8 pb-10">
        <div className="w-full max-w-md">

          {/* Form card */}
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-base">📋</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Sign In</p>
                <p className="text-white/70 text-xs mt-0.5">Enter your credentials</p>
              </div>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2"
                >
                  {loading
                    ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Signing in...</>
                    : 'Sign In →'}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-sm text-blue-200/60 mt-4">
            New to the portal?{' '}
            <Link to="/register" className="text-blue-300 hover:text-white font-medium underline underline-offset-2 transition-colors">
              Create an account
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-white/10" />
              <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Demo Accounts</p>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fillDemo('manager@demo.com', 'manager123')}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 rounded-xl p-3 text-left transition-all backdrop-blur group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span>👔</span>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">Manager</span>
                </div>
                <p className="text-white/70 text-xs">manager@demo.com</p>
                <p className="text-white/30 text-xs">manager123</p>
              </button>
              <button
                onClick={() => fillDemo('bob@demo.com', 'member123')}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/40 rounded-xl p-3 text-left transition-all backdrop-blur group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span>👤</span>
                  <span className="text-[10px] font-bold text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded">Member (VPM)</span>
                </div>
                <p className="text-white/70 text-xs">bob@demo.com</p>
                <p className="text-white/30 text-xs">member123</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
