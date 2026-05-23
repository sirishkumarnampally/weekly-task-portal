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
    <div className="min-h-screen flex">

      {/* ── LEFT: Brand Banner ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 overflow-hidden">

        {/* Background blobs */}
        <div className="absolute -top-32 -left-20 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-violet-600 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-800 rounded-full blur-3xl opacity-10 pointer-events-none" />

        <div className="relative flex flex-col h-full px-12 py-10">

          {/* Nissan logo / wordmark */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-10 flex items-center justify-center">
              <svg viewBox="0 0 110 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <ellipse cx="55" cy="22" rx="53" ry="20" stroke="white" strokeWidth="3"/>
                <rect x="2" y="18" width="20" height="8" fill="white"/>
                <rect x="88" y="18" width="20" height="8" fill="white"/>
                <text x="55" y="26.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="white" letterSpacing="2">NISSAN</text>
              </svg>
            </div>
            <div>
              <p className="text-white font-extrabold text-base leading-none tracking-widest uppercase">Nissan</p>
              <p className="text-blue-300/70 text-[10px] tracking-widest uppercase">Weekly Task Portal</p>
            </div>
            <div className="h-8 w-px bg-white/10 mx-1" />
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-400/30 rounded-full px-3 py-1.5 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] font-semibold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent tracking-wide whitespace-nowrap">
                Team Collaboration Platform
              </span>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-16 mb-12">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
              Weekly Task<br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                Management Portal
              </span>
            </h1>
            <p className="text-blue-200/60 text-sm leading-relaxed max-w-sm">
              Track, manage, and report weekly tasks across teams — with role-based access, capacity reports, and one-click Excel exports.
            </p>
          </div>

          {/* VPM Card */}
          <div className="group bg-blue-600/10 hover:bg-blue-600/18 border border-blue-400/20 hover:border-blue-400/40 rounded-2xl p-6 mb-4 backdrop-blur transition-all duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="text-2xl">🚘</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-extrabold text-lg leading-none">VPM</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/25 text-blue-300 border border-blue-400/30">Team</span>
                </div>
                <p className="text-blue-200 font-semibold text-sm mb-2">Vehicle Profile Management</p>
                <p className="text-blue-300/60 text-xs leading-relaxed">
                  A centralized data store where connected car metadata is stored and shared with all other connected services across the ecosystem.
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20">AMO</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">PJ</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/20">Infra</span>
                </div>
              </div>
            </div>
          </div>

          {/* CWGW Card */}
          <div className="group bg-violet-600/10 hover:bg-violet-600/18 border border-violet-400/20 hover:border-violet-400/40 rounded-2xl p-6 backdrop-blur transition-all duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="text-2xl">🔌</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-extrabold text-lg leading-none">CWGW</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/25 text-violet-300 border border-violet-400/30">Team</span>
                </div>
                <p className="text-violet-200 font-semibold text-sm mb-2">Carwings Gateway</p>
                <p className="text-violet-300/60 text-xs leading-relaxed">
                  A connected service providing charging station info, weather forecasts, news, and other connected services information to vehicles.
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/20">AMO</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/20">Infra</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-auto pt-10">
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
            <p className="text-white/25 text-xs text-center tracking-wide">
              © {new Date().getFullYear()} Nissan Motor Co. — Internal Use Only
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6 py-12">

        {/* Mobile logo (shown only on small screens) */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="w-14 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow px-2">
            <svg viewBox="0 0 110 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <ellipse cx="55" cy="22" rx="53" ry="20" stroke="white" strokeWidth="3"/>
              <rect x="2" y="18" width="20" height="8" fill="white"/>
              <rect x="88" y="18" width="20" height="8" fill="white"/>
              <text x="55" y="26.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="white" letterSpacing="2">NISSAN</text>
            </svg>
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm tracking-wide uppercase">Nissan</p>
            <p className="text-slate-400 text-[10px] tracking-widest uppercase">Task Portal</p>
          </div>
        </div>

        <div className="w-full max-w-sm">

          {/* Heading */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to your portal account</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-base">📋</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Sign In</p>
                <p className="text-white/70 text-xs mt-0.5">Enter your credentials below</p>
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
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 mt-1"
                >
                  {loading
                    ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Signing in...</>
                    : 'Sign In →'}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            New to the portal?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Create an account
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-slate-200" />
              <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Demo Accounts</p>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fillDemo('manager@demo.com', 'manager123')}
                className="bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl p-3 text-left transition-all shadow-sm group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span>👔</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">Manager</span>
                </div>
                <p className="text-slate-600 text-xs">manager@demo.com</p>
                <p className="text-slate-400 text-xs">manager123</p>
              </button>
              <button
                onClick={() => fillDemo('bob@demo.com', 'member123')}
                className="bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl p-3 text-left transition-all shadow-sm group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span>👤</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">VPM Member</span>
                </div>
                <p className="text-slate-600 text-xs">bob@demo.com</p>
                <p className="text-slate-400 text-xs">member123</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
