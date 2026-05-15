'use client';
import { useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat', 'Other'];

export default function GymSignup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    gymName: '', city: CITIES[0], area: '', address: '', lat: '', lng: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(form.phone)) { setError('Enter a valid 10-digit mobile number'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setStep(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/v1/auth/gym/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone, password: form.password,
          gymName: form.gymName, city: form.city, area: form.area, address: form.address,
          lat: form.lat ? Number(form.lat) : undefined,
          lng: form.lng ? Number(form.lng) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
    padding: '11px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }));
        setError('');
      },
      () => setError('Could not read current location. You can add latitude and longitude later from Profile.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (done) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass p-10 w-full max-w-md text-center">
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 className="serif text-2xl font-bold mb-3">You're registered!</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--t2)', lineHeight: 1.7 }}>
          Your gym partner account has been created. Your gym listing is currently <strong style={{ color: '#FFB400' }}>pending review</strong>. Complete KYC verification to go live on the platform.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>Sign in to your dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center py-10">
      <div className="glass p-10 w-full" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg" style={{ background: 'var(--accent)', color: '#000' }}>B</div>
          <div>
            <div className="serif text-xl font-bold">Book<em style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--t2)' }}>My</em>Fit</div>
            <div className="text-xs" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>Gym Partner</div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[{ n: 1, label: 'Your Account' }, { n: 2, label: 'Gym Details' }].map(({ n, label }) => (
            <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: step >= n ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                color: step >= n ? '#000' : 'rgba(255,255,255,0.4)',
              }}>{n}</div>
              <span style={{ fontSize: 12, color: step >= n ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: step === n ? 600 : 400 }}>{label}</span>
              {n < 2 && <div style={{ flex: 1, height: 1, background: step > n ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }} />}
            </div>
          ))}
        </div>

        <h1 className="serif text-2xl font-bold mb-1">{step === 1 ? 'Create your account' : 'Tell us about your gym'}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--t2)' }}>
          {step === 1 ? 'Start your BookMyFit gym partner journey.' : 'Your gym will be reviewed and activated after KYC.'}
        </p>

        {error && <div className="text-sm mb-4 p-3 rounded-lg" style={{ color: '#FF6B6B', background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)' }}>{error}</div>}

        {step === 1 ? (
          <form onSubmit={nextStep} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="Your name" required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="you@yourgym.in" required />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} type="tel" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile number" maxLength={10} required />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input style={inputStyle} type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Re-enter password" required />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center mt-2">Continue to Gym Details →</button>
          </form>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Gym Name</label>
              <input style={inputStyle} value={form.gymName} onChange={set('gymName')} placeholder="e.g. Iron Republic Gym" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>City</label>
                <select style={inputStyle} value={form.city} onChange={set('city')}>
                  {CITIES.map((c) => <option key={c} style={{ background: '#111' }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Area / Locality</label>
                <input style={inputStyle} value={form.area} onChange={set('area')} placeholder="e.g. Andheri West" required />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Full Address</label>
              <input style={inputStyle} value={form.address} onChange={set('address')} placeholder="Street address, landmark" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Latitude</label>
                <input style={inputStyle} value={form.lat} onChange={set('lat')} placeholder="20.2961" />
              </div>
              <div>
                <label style={labelStyle}>Longitude</label>
                <input style={inputStyle} value={form.lng} onChange={set('lng')} placeholder="85.8245" />
              </div>
            </div>
            <button type="button" className="btn btn-ghost text-xs justify-center" onClick={useCurrentLocation}>
              Use current browser location
            </button>
            <div style={{ background: 'rgba(255,180,0,0.06)', border: '1px solid rgba(255,180,0,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              ⚠️ After registration, complete <strong style={{ color: '#FFB400' }}>KYC verification</strong> in your dashboard. Your gym will go live only after admin approval.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost flex-1" onClick={() => { setStep(1); setError(''); }}>← Back</button>
              <button type="submit" className="btn btn-primary flex-1 justify-center" disabled={loading}>
                {loading ? 'Registering…' : 'Register Gym'}
              </button>
            </div>
          </form>
        )}

        <p className="text-sm mt-5 text-center" style={{ color: 'var(--t2)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
