import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const TEAMS = [
  {
    id: 'VPM',
    label: 'VPM',
    description: 'Vehicle Programme Management',
    color: 'blue',
    icon: '🚘',
  },
  {
    id: 'CWGW',
    label: 'CWGW',
    description: 'Connected & Gateway Work Group',
    color: 'violet',
    icon: '🔌',
  },
];

const TEAM_STYLES = {
  blue:   { ring: 'ring-blue-500',   bg: 'bg-blue-600',   light: 'bg-blue-50 border-blue-400',   text: 'text-blue-700' },
  violet: { ring: 'ring-violet-500', bg: 'bg-violet-600', light: 'bg-violet-50 border-violet-400', text: 'text-violet-700' },
};

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = pick team, 2 = fill details
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const team = TEAMS.find(t => t.id === selectedTeam);
  const style = team ? TEAM_STYLES[team.color] : null;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword)
      return toast.error('Passwords do not match');
    if (form.password.length < 6)
      return toast.error('Password must be at least 6 characters');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, team: selectedTeam }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Registration failed');

      // Auto-login with the returned token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      const axios = (await import('axios')).default;
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

      toast.success(`Welcome to ${selectedTeam}, ${data.user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch {
      toast.error('Registration failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-500 mt-1 text-sm">Join the Nissan Weekly Task Portal</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {['Choose Team', 'Your Details'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? (style ? style.bg : 'bg-blue-600') + ' text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              {i === 0 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        <div className="card p-8">

          {/* ── Step 1: Team selection ─────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Which team are you joining?</h2>
              <p className="text-sm text-gray-500 mb-5">Your team determines which data you can see. You can only access your team's tasks.</p>

              <div className="grid grid-cols-1 gap-4 mb-6">
                {TEAMS.map(t => {
                  const s = TEAM_STYLES[t.color];
                  const selected = selectedTeam === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeam(t.id)}
                      className={`relative w-full text-left p-5 rounded-xl border-2 transition-all duration-150 ${
                        selected
                          ? `${s.light} ${s.ring} ring-2`
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${selected ? s.bg : 'bg-gray-100'}`}>
                          {t.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xl font-bold ${selected ? s.text : 'text-gray-900'}`}>{t.label}</span>
                            {selected && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${s.bg}`}>Selected</span>}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selected ? `${s.bg} border-transparent` : 'border-gray-300'
                        }`}>
                          {selected && <span className="text-white text-xs">✓</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!selectedTeam}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                Continue with {selectedTeam || '...'} →
              </button>
            </div>
          )}

          {/* ── Step 2: Details form ───────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleRegister}>
              {/* Team badge recap */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border mb-5 ${style?.light}`}>
                <span className="text-2xl">{team?.icon}</span>
                <div>
                  <p className="text-xs text-gray-500">Joining team</p>
                  <p className={`font-bold text-sm ${style?.text}`}>{team?.label} — {team?.description}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">Change</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Sarah Connor"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    required autoFocus
                  />
                </div>
                <div>
                  <label className="label">Work Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@nissan.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Min. 6 characters"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      required minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >{showPass ? '🙈' : '👁'}</button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                <button type="submit" disabled={loading} className={`flex-1 py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors ${style?.bg || 'bg-blue-600'} hover:opacity-90 disabled:opacity-50`}>
                  {loading
                    ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Creating...</>
                    : `Join ${selectedTeam}`}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
