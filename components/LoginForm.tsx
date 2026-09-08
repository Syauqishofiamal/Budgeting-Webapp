'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'login' | 'demo' | null>(null);
  const [error, setError] = useState('');

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy('login'); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) { router.push('/'); router.refresh(); }
    else { setError((await res.json().catch(() => ({}))).error ?? 'Sign in failed'); setBusy(null); }
  }

  async function tryDemo() {
    setBusy('demo'); setError('');
    const res = await fetch('/api/auth/demo', { method: 'POST' });
    if (res.ok) { router.push('/'); router.refresh(); }
    else { setError('Could not start the demo'); setBusy(null); }
  }

  return (
    <div className="app" style={{ paddingBottom: 0, justifyContent: 'center' }}>
      <div className="screen" style={{ flex: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 46, lineHeight: 1 }}>🪙</div>
          <h1 style={{ fontSize: 28, margin: '12px 0 4px', letterSpacing: '-.02em' }}>Coffer</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Log an expense in under five seconds.
          </p>
        </div>

        <form className="card" onSubmit={signIn}>
          <div style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor="u">Username</label>
            <input id="u" className="input" autoComplete="username" value={username}
                   onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label" htmlFor="p">Password</label>
            <input id="p" className="input" type="password" autoComplete="current-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <p className="small" style={{ color: 'var(--flame)', marginTop: 0, marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={busy !== null}>
            {busy === 'login' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="row" style={{ margin: '20px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="tiny faint">or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button className="btn btn-soft" onClick={tryDemo} disabled={busy !== null}>
          {busy === 'demo' ? 'Loading sample data…' : '✨ Try the demo'}
        </button>
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          A shared sandbox with two months of sample spending.
          <br />Explore freely — it resets nightly.
        </p>
      </div>
    </div>
  );
}
