'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'signin' | 'signup' | 'forgot';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function switchMode(next: Mode) {
    setMode(next); setError(''); setNotice(''); setPassword('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy('form'); setError(''); setNotice('');

    const endpoint =
      mode === 'signin' ? '/api/auth/login'
      : mode === 'signup' ? '/api/auth/signup'
      : '/api/auth/reset-request';

    const payload =
      mode === 'signup' ? { email, password, displayName: displayName || null }
      : mode === 'forgot' ? { email }
      : { email, password };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      setBusy(null);
      return;
    }

    if (mode === 'forgot') {
      setNotice(data.message ?? 'Check your inbox.');
      setBusy(null);
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function tryDemo() {
    setBusy('demo'); setError('');
    const res = await fetch('/api/auth/demo', { method: 'POST' });
    if (res.ok) { router.push('/'); router.refresh(); }
    else { setError('Could not start the demo.'); setBusy(null); }
  }

  const title = mode === 'signin' ? 'Welcome back'
              : mode === 'signup' ? 'Create your account'
              : 'Reset your password';
  const cta = mode === 'signin' ? 'Sign in'
            : mode === 'signup' ? 'Create account'
            : 'Send reset link';

  return (
    <div className="app" style={{ paddingBottom: 0, justifyContent: 'center' }}>
      <div className="screen" style={{ flex: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 46, lineHeight: 1 }}>🪙</div>
          <h1 style={{ fontSize: 28, margin: '12px 0 4px', letterSpacing: '-.02em' }}>Coffer</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Log an expense in under five seconds.
          </p>
        </div>

        <form className="card" onSubmit={submit}>
          <div className="auth-title">{title}</div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="n">Name (optional)</label>
              <input id="n" className="input" autoComplete="name" value={displayName}
                     maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor="e">Email</label>
            <input id="e" className="input" type="email" autoComplete="email"
                   inputMode="email" autoCapitalize="none" spellCheck={false}
                   value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {mode !== 'forgot' && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="p">Password</label>
              <input id="p" className="input" type="password"
                     autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     required minLength={mode === 'signup' ? 8 : undefined} />
              {mode === 'signup' && (
                <p className="tiny faint" style={{ margin: '6px 0 0' }}>
                  At least 8 characters.
                </p>
              )}
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button className="btn" type="submit" disabled={busy !== null}>
            {busy === 'form' ? 'Working…' : cta}
          </button>

          <div className="auth-links">
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
                <button type="button" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              </>
            )}
            {mode !== 'signin' && (
              <button type="button" onClick={() => switchMode('signin')}>
                ← Back to sign in
              </button>
            )}
          </div>
        </form>

        <div className="row" style={{ margin: '18px 0 12px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="tiny faint">or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <button className="btn btn-soft" onClick={tryDemo} disabled={busy !== null}>
          {busy === 'demo' ? 'Loading sample data…' : '✨ Try the demo'}
        </button>
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          A shared sandbox with two months of sample spending.
          <br />No account needed — explore freely.
        </p>
      </div>
    </div>
  );
}
