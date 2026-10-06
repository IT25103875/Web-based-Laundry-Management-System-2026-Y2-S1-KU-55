import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { setCredentials, encodeCredentials } from '../lib/api';

function WaveLogo({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export default function LoginPage({ initialMode = 'customer' }) {
  const location = useLocation();
  const [mode, setMode] = useState(initialMode === 'staff' ? 'staff' : 'customer');
  const isStaff = mode === 'staff';
  const [username, setUsername] = useState(location.state?.registeredEmail || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [pendingPasswordChange, setPendingPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      let loginPassword = password;
      if (pendingPasswordChange) {
        await api.put('/auth/password', { password: newPassword });
        loginPassword = newPassword;
        setPassword(newPassword);
      }
      const credentials = encodeCredentials(username, loginPassword);
      const { data } = await api.post('/auth/login', { username, password: loginPassword });
      if (!isStaff && data.role !== 'CUSTOMER') {
        setError('Please use the Staff tab for staff accounts.');
        setLoading(false);
        return;
      }
      if (isStaff && data.role === 'CUSTOMER') {
        setError('Please use the Customer tab for customer accounts.');
        setLoading(false);
        return;
      }
      setCredentials(credentials);
      localStorage.setItem('cleancloud_user', JSON.stringify(data));
      if (data.mustChangePassword) { setPendingPasswordChange(true); return; }
      navigate(data.role === 'CUSTOMER' ? '/portal' : '/staff');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-original flex min-h-screen flex-col lg:flex-row">
      {/* Left panel */}
      <aside className="relative flex flex-col justify-between bg-gradient-to-b from-[#061433] via-[#0b2460] to-[#1d5bff] px-8 py-10 text-white lg:w-[42%] lg:px-12 lg:py-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-white no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1d5bff] text-white">
            <WaveLogo className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">CleanCloud</span>
        </Link>

        <div className="my-16 max-w-sm lg:my-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7eb6ff]">
            Neighborhood laundry, considered
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
            A little less to
            <br />
            carry.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            CleanCloud keeps the everyday moving quietly in the background, so you can keep your
            attention on what matters.
          </p>
        </div>

        <p className="text-sm text-white/40">Soft on clothes. Clear on details.</p>
      </aside>

      {/* Right panel / form */}
      <main className="flex flex-1 flex-col justify-center bg-[#f4f8ff] px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[400px]">
          <p className="page-kicker">Welcome back</p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-[#061433]">
            Good to see you.
          </h2>
          <p className="mt-2 text-[15px] text-[#5b6784]">
            Sign in to pick up where you left off.
          </p>

          {/* Customer / Staff toggle */}
          <div className="mt-8 flex rounded-full bg-[#e7efff] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('customer');
                setError('');
              }}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                !isStaff
                  ? 'bg-white text-[#061433] shadow-sm'
                  : 'text-[#5b6784] hover:text-[#061433]'
              }`}
              aria-pressed={!isStaff}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('staff');
                setError('');
              }}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                isStaff
                  ? 'bg-white text-[#061433] shadow-sm'
                  : 'text-[#5b6784] hover:text-[#061433]'
              }`}
              aria-pressed={isStaff}
            >
              Staff
            </button>
          </div>

          {location.state?.registeredEmail && (
            <p role="status" className="notice-success mt-6">Account created. Sign in with your email.</p>
          )}
          {error && <p role="alert" className="notice-error mt-6">{error}</p>}

          {pendingPasswordChange && <p role="status" className="notice-success mt-6">Before opening your workspace, choose your own password to replace the temporary password.</p>}
          <form onSubmit={login} className="mt-6 space-y-4">
            <label className="label">
              {isStaff ? 'Email (staff account)' : 'Email address'}
              <input
                className="field mt-2"
                type="email"
                disabled={pendingPasswordChange}
                placeholder={isStaff ? 'admin@CleanCloud.lk' : 'you@example.com'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete={isStaff ? 'username' : 'email'}
                required
              />
            </label>

            <label className="label">
              Password
              <input
                type="password"
                className="field mt-2"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={pendingPasswordChange}
                required
              />
            </label>

            {pendingPasswordChange && <label className="label">New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field mt-2" autoComplete="new-password" minLength={8} maxLength={72} required /></label>}
            <button disabled={loading} type="submit" className="btn-primary mt-2 w-full">
              {loading ? 'Signing in…' : (
                <>
                  <span aria-hidden>→</span>
                  {pendingPasswordChange ? 'Save password & continue' : 'Sign in'}
                </>
              )}
            </button>
          </form>

          {!isStaff && (
            <p className="mt-6 text-center text-sm text-[#5b6784]">
              New to CleanCloud?{' '}
              <Link to="/register" className="font-semibold text-[#061433] hover:underline">
                Create an account
              </Link>
            </p>
          )}

          {isStaff && (
            <p className="mt-6 text-center text-sm text-[#5b6784]">
              Customer account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('customer');
                  setError('');
                }}
                className="font-semibold text-[#061433] hover:underline"
              >
                Switch to Customer
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
