'use client';
import { useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_MAP } from '@/lib/constants';
import { formatMoney, friendlyDate } from '@/lib/dates';
import type { Expense } from '@/lib/types';

interface HistoryData {
  month: string; total: number; availableMonths: string[]; expenses: Expense[];
}

export default function History({ today, currency }: { today: string; currency: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [category, setCategory] = useState<string | null>(null);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ month });
    if (category) qs.set('category', category);
    fetch(`/api/history?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [month, category]);

  const months = data?.availableMonths?.length ? data.availableMonths : [today.slice(0, 7)];

  // Group by day for readability.
  const byDay = new Map<string, Expense[]>();
  for (const e of data?.expenses ?? []) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }

  return (
    <div className="screen">
      <div className="screen-title">History</div>

      <div className="row" style={{ marginBottom: 10 }}>
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB',
                { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </option>
          ))}
        </select>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        <button className="chip" aria-pressed={category === null}
                style={category === null ? { borderColor: 'var(--accent)',
                  background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                onClick={() => setCategory(null)}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.slug} className="chip" aria-pressed={category === c.slug}
                  style={category === c.slug ? { borderColor: 'var(--accent)',
                    background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                  onClick={() => setCategory(c.slug)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="spread">
          <span className="stat-label">Total{category ? ` · ${CATEGORY_MAP[category]?.label}` : ''}</span>
          <span className="stat-value num">{formatMoney(data?.total ?? 0, currency)}</span>
        </div>
      </div>

      {loading ? (
        <div className="card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel" style={{ height: 46, marginBottom: 8 }} />
          ))}
        </div>
      ) : (data?.expenses.length ?? 0) === 0 ? (
        <div className="empty">
          <div className="empty-ico">📭</div>
          <div className="small">Nothing here for this filter.</div>
        </div>
      ) : (
        [...byDay.entries()].map(([day, items]) => (
          <div className="card" key={day} style={{ marginBottom: 10 }}>
            <div className="spread" style={{ marginBottom: 6 }}>
              <span className="tiny faint" style={{ fontWeight: 700 }}>
                {friendlyDate(day, today)}
              </span>
              <span className="tiny faint num">
                {formatMoney(items.reduce((s, e) => s + e.amount, 0), currency)}
              </span>
            </div>
            {items.map((e) => (
              <div key={e.id} className="entry">
                <div className="entry-ico" aria-hidden>
                  {e.category === 'custom' ? '✨' : CATEGORY_MAP[e.category]?.icon}
                </div>
                <div className="entry-main">
                  <div className="entry-label">
                    {e.category === 'custom'
                      ? e.custom_label
                      : CATEGORY_MAP[e.category]?.label}
                    {e.subtype && <span className="faint"> · {e.subtype}</span>}
                  </div>
                  {e.note && <div className="entry-note">{e.note}</div>}
                </div>
                <div className="entry-amt num">{formatMoney(e.amount, currency)}</div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
