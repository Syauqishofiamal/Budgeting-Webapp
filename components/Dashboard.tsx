'use client';
import { CATEGORY_MAP } from '@/lib/constants';
import { BADGES } from '@/lib/badges';
import { formatMoney } from '@/lib/dates';
import EntryList from './EntryList';
import type { AppState, Expense } from '@/lib/types';

export default function Dashboard({
  state, onEdit, onDelete,
}: {
  state: AppState;
  onEdit: (e: Expense, amount: number, note: string) => void;
  onDelete: (e: Expense) => void;
}) {
  const { budget, xp, streak, settings } = state;
  const cur = settings.currency;

  return (
    <div className="screen">
      {/* ── Budget as a resource bar, never a debt counter ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="spread" style={{ marginBottom: 10 }}>
          <div className="stat">
            <span className="stat-label">{budget.over ? 'Over by' : 'Left this month'}</span>
            <span className="stat-value">
              {formatMoney(Math.abs(budget.remaining), cur)}
            </span>
          </div>
          <div className="stat" style={{ alignItems: 'flex-end' }}>
            <span className="stat-label">Spent</span>
            <span className="stat-value num" style={{ fontSize: 16, color: 'var(--text-dim)' }}>
              {formatMoney(budget.spent, cur)}
            </span>
          </div>
        </div>
        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: `${budget.fraction * 100}%` }} />
        </div>
        {budget.over && (
          // Framing stays neutral and forward-looking — no red alarm, no shame.
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Over by {formatMoney(Math.abs(budget.remaining), cur)} this month.
            Next month resets to {formatMoney(budget.total, cur)}.
          </p>
        )}
      </div>

      {/* ── XP / level / streak ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <span className="pill pill-gold">Level {xp.level}</span>
          <span className="pill pill-flame">🔥 {streak.current} day{streak.current === 1 ? '' : 's'}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${xp.progress * 100}%` }} />
        </div>
        <div className="spread" style={{ marginTop: 6 }}>
          <span className="tiny faint num">{xp.xpIntoLevel} / {xp.xpForNextLevel} XP</span>
          <span className="tiny faint">
            {streak.freezeAvailable ? '❄️ Freeze ready' : '❄️ Freeze used'}
          </span>
        </div>
      </div>

      {/* ── Weekly quests ── */}
      {state.quests.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="screen-title" style={{ margin: '0 0 10px' }}>This week</div>
          {state.quests.map((q) => {
            const pct = q.target > 0 ? Math.min(1, q.progress / q.target) : 0;
            return (
              <div key={q.slug} style={{ marginBottom: 10 }}>
                <div className="spread" style={{ marginBottom: 4 }}>
                  <span className="small" style={{ fontWeight: 600 }}>
                    {q.completed ? '✅ ' : ''}{q.title}
                  </span>
                  <span className="tiny faint num">
                    {Math.round(q.progress * 100) / 100}/{Math.round(q.target * 100) / 100}
                  </span>
                </div>
                <div className="xp-track">
                  <div className="xp-fill" style={{
                    width: `${pct * 100}%`,
                    background: q.completed ? 'var(--accent)' : 'var(--gold)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Today ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="spread" style={{ marginBottom: 4 }}>
          <div className="screen-title" style={{ margin: 0 }}>Today</div>
          <span className="small num" style={{ fontWeight: 700 }}>
            {formatMoney(state.todayTotal, cur)}
          </span>
        </div>
        <EntryList expenses={state.todayExpenses} currency={cur}
                   onEdit={onEdit} onDelete={onDelete} />
      </div>

      {/* ── Category breakdown ── */}
      {state.byCategory.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="screen-title" style={{ margin: '0 0 8px' }}>This month by category</div>
          {state.byCategory.map((c) => {
            const max = state.byCategory[0].total || 1;
            const name = CATEGORY_MAP[c.category]?.label ?? c.category;
            return (
              <div key={`${c.category}-${c.subtype ?? ''}`} style={{ marginBottom: 9 }}>
                <div className="spread" style={{ marginBottom: 3 }}>
                  <span className="small">
                    {CATEGORY_MAP[c.category]?.icon} {name}
                    {c.subtype && <span className="faint"> · {c.subtype}</span>}
                  </span>
                  <span className="small num">{formatMoney(c.total, cur)}</span>
                </div>
                <div className="xp-track">
                  <div className="xp-fill" style={{
                    width: `${(c.total / max) * 100}%`, background: 'var(--accent)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Badges ── */}
      <div className="card">
        <div className="screen-title" style={{ margin: '0 0 10px' }}>Badges</div>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const owned = state.badges.includes(b.slug);
            return (
              <div key={b.slug} className={`badge ${owned ? '' : 'badge-locked'}`}
                   title={owned ? b.label : b.hint}>
                <span className="badge-ico" aria-hidden>{b.icon}</span>
                <span className="badge-label">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
