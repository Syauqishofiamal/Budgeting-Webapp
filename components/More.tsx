'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CATEGORY_MAP } from '@/lib/constants';
import { formatMoney } from '@/lib/dates';
import type { AppState } from '@/lib/types';

export default function More({
  state, onRefresh, onQuickLog,
}: {
  state: AppState; onRefresh: () => void;
  onQuickLog: (category: string, amount: number) => void;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(state.settings.monthlyBudget));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function saveBudget() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: Number(budget) }),
    });
    setSaving(false); setSavedMsg('Budget updated');
    setTimeout(() => setSavedMsg(''), 2500);
    onRefresh();
  }

  async function toggle(key: 'soundEnabled' | 'hapticsEnabled', value: boolean) {
    await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    onRefresh();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login'); router.refresh();
  }

  return (
    <div className="screen">
      {/* ── Recurring bills: one tap, amount pre-filled, always confirmed ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="screen-title" style={{ margin: '0 0 4px' }}>Recurring bills</div>
        <p className="tiny faint" style={{ marginTop: 0 }}>
          One tap logs last month&apos;s amount. Edit it on the Add screen if it changed.
        </p>
        {state.recurring.length === 0 && (
          <p className="small muted">No templates yet.</p>
        )}
        {state.recurring.map((r) => (
          <div key={r.id} className="entry">
            <div className="entry-ico" aria-hidden>{CATEGORY_MAP[r.category]?.icon ?? '•'}</div>
            <div className="entry-main">
              <div className="entry-label">
                {r.custom_label || CATEGORY_MAP[r.category]?.label || r.category}
              </div>
              <div className="entry-note">
                Last: {formatMoney(r.last_amount, state.settings.currency)}
              </div>
            </div>
            <button className="chip" onClick={() => onQuickLog(r.category, r.last_amount)}>
              Log
            </button>
          </div>
        ))}
      </div>

      {/* ── Export ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="screen-title" style={{ margin: '0 0 10px' }}>Export</div>
        <div className="row">
          <a className="btn btn-ghost" href="/api/export/xlsx" download>⬇ XLSX</a>
          <a className="btn btn-ghost" href="/api/export/csv" download>⬇ CSV</a>
        </div>
        <p className="tiny faint" style={{ marginBottom: 0 }}>
          One sheet per month plus a summary. Always a live query.
        </p>
      </div>

      {/* ── Settings ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="screen-title" style={{ margin: '0 0 10px' }}>Settings</div>
        <label className="field-label" htmlFor="b">Monthly budget ({state.settings.currency})</label>
        <div className="row">
          <input id="b" className="input" inputMode="decimal" value={budget}
                 onChange={(e) => setBudget(e.target.value)} />
          <button className="chip" onClick={saveBudget} disabled={saving}>Save</button>
        </div>
        {savedMsg && <p className="tiny" style={{ color: 'var(--accent)' }}>{savedMsg}</p>}

        <div className="spread" style={{ marginTop: 14 }}>
          <span className="small">Haptic feedback</span>
          <input type="checkbox" checked={state.settings.hapticsEnabled}
                 onChange={(e) => toggle('hapticsEnabled', e.target.checked)}
                 style={{ width: 20, height: 20 }} />
        </div>
        <div className="spread" style={{ marginTop: 10 }}>
          <span className="small">Sound</span>
          <input type="checkbox" checked={state.settings.soundEnabled}
                 onChange={(e) => toggle('soundEnabled', e.target.checked)}
                 style={{ width: 20, height: 20 }} />
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <div>
            <div className="small" style={{ fontWeight: 600 }}>
              {state.isDemo ? 'Demo session' : 'Signed in'}
            </div>
            <div className="tiny faint">
              Longest streak {state.streak.longest} days · {state.xp.total} XP total
            </div>
          </div>
          <button className="chip" onClick={logout}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
