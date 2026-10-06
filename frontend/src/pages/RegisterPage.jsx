import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';

const emptyForm = { fullName: '', email: '', phone: '', address: '', password: '' };

function WaveLogo({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export default function RegisterPage() {
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', formData);
      navigate('/login', { state: { registeredEmail: formData.email } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-original flex min-h-screen flex-col lg:flex-row">
      <aside className="relative flex flex-col justify-between bg-gradient-to-b from-[#061433] via-[#0b2460] to-[#1d5bff] px-8 py-10 text-white lg:w-[42%] lg:px-12 lg:py-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-white no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#7eb6ff] text-[#061433]">
            <WaveLogo className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">CleanCloud</span>
        </Link>

        <div className="my-16 max-w-sm lg:my-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7eb6ff]/90">
            Get started
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
            Join the
            <br />
            neighborhood.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Create a customer account to request pickups, track garments, view invoices, and follow delivery updates.
          </p>
        </div>

        <p className="text-sm text-white/40">Soft on clothes. Clear on details.</p>
      </aside>

      <main className="flex flex-1 flex-col justify-center bg-[#f4f8ff] px-6 py-12 sm:px-10 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[420px]">
          <p className="page-kicker">Customer details</p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-[#061433]">
            Create an account
          </h2>
          <p className="mt-2 text-[15px] text-[#5b6784]">
            This creates a customer account only. Staff access is managed separately.
          </p>

          {error && <p role="alert" className="notice-error mt-6">{error}</p>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="label">
              Full name
              <input autoComplete="name" name="fullName" minLength={2} maxLength={100} value={formData.fullName} onChange={update} className="field mt-2" required />
            </label>
            <label className="label">
              Email address
              <input autoComplete="email" name="email" maxLength={100} type="email" value={formData.email} onChange={update} className="field mt-2" required />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">
                Phone
                <input type="tel" autoComplete="tel" name="phone" minLength={9} maxLength={20} value={formData.phone} onChange={update} className="field mt-2" />
              </label>
              <label className="label">
                Password
                <input autoComplete="new-password" name="password" minLength={8} maxLength={72} type="password" value={formData.password} onChange={update} className="field mt-2" required />
              </label>
            </div>
            <label className="label">
              Address
              <input autoComplete="street-address" name="address" minLength={3} maxLength={150} value={formData.address} onChange={update} className="field mt-2" />
            </label>

            <button disabled={loading} type="submit" className="btn-primary mt-2 w-full">
              {loading ? 'Creating account…' : (
                <>
                  <span aria-hidden>→</span>
                  Create account
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#5b6784]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#061433] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
