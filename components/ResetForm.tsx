'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Landing page for the emailed reset link. */
export default function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Those two passwords do not match.'); return; }
    setBusy(true); setError('');

    const res = await fetch('/api/auth/reset-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) { router.push('/'); router.refresh(); }
    else { setError(data.error ?? 'Could not reset your password.'); setBusy(false); }
  }

  if (!token) {
    return (
      <div className="app" style={{ paddingBottom: 0, justifyContent: 'center' }}>
        <div className="screen" style={{ flex: 'none' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>🔗</div>
            <div className="auth-title" style={{ marginTop: 8 }}>Link incomplete</div>
            <p className="muted small">
              This page needs the link from your reset email.
            </p>
            <a className="btn btn-ghost" href="/login">Back to sign in</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ paddingBottom: 0, justifyContent: 'center' }}>
      <div className="screen" style={{ flex: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 46, lineHeight: 1 }}>🪙</div>
          <h1 style={{ fontSize: 24, margin: '12px 0 0', letterSpacing: '-.02em' }}>
            Choose a new password
          </h1>
        </div>

        <form className="card" onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor="p1">New password</label>
            <input id="p1" className="input" type="password" autoComplete="new-password"
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   required minLength={8} autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="p2">Confirm it</label>
            <input id="p2" className="input" type="password" autoComplete="new-password"
                   value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save and sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
