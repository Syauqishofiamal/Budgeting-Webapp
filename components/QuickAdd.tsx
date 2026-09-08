'use client';
import { useEffect, useState } from 'react';
import { CATEGORIES, FOOD_SUBTYPES, type CategorySlug } from '@/lib/constants';
import { addDays, friendlyDate } from '@/lib/dates';
import Keypad from './Keypad';
import type { AppState } from '@/lib/types';

interface Props {
  state: AppState;
  onSave: (e: {
    date: string; category: string; customLabel: string | null;
    subtype: string | null; amount: number; note: string | null;
  }) => void;
  onNoSpend: () => void;
}

export default function QuickAdd({ state, onSave, onNoSpend }: Props) {
  const today = state.today;
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<CategorySlug | null>(null);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [chips, setChips] = useState<{ amounts: number[]; mode: 'full' | 'approx' } | null>(null);

  // Fetch remembered amounts whenever the category/subtype selection settles.
  useEffect(() => {
    if (!category) { setChips(null); return; }
    if (category === 'food' && !subtype) { setChips(null); return; }
    let cancelled = false;
    const qs = new URLSearchParams({ chips: category });
    if (subtype) qs.set('subtype', subtype);
    fetch(`/api/expenses?${qs}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setChips(d); })
      .catch(() => { if (!cancelled) setChips(null); });
    return () => { cancelled = true; };
  }, [category, subtype, state.todayExpenses.length]);

  function selectCategory(slug: CategorySlug) {
    if (category === slug) { setCategory(null); setSubtype(null); return; }
    setCategory(slug);
    setSubtype(null);
    if (slug !== 'custom') setCustomLabel('');
  }

  const numericAmount = parseFloat(amount || '0');
  const needsSubtype = category === 'food' && !subtype;
  const needsLabel = category === 'custom' && customLabel.trim() === '';
  const canSave = category !== null && numericAmount > 0 && !needsSubtype && !needsLabel;

  function save() {
    if (!canSave || !category) return;
    onSave({
      date, category,
      customLabel: category === 'custom' ? customLabel.trim() : null,
      subtype, amount: Math.round(numericAmount * 100) / 100,
      note: note.trim() || null,
    });
    // Reset to a ready state immediately — never navigate away.
    setAmount(''); setNote(''); setShowNote(false);
    setCategory(null); setSubtype(null); setCustomLabel('');
    setChips(null);
  }

  const yesterday = addDays(today, -1);
  const isOlder = date !== today && date !== yesterday;

  return (
    <div className="screen quickadd">
      {/* ── Date ── */}
      <div className="row" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${date === today ? 'chip-selected' : ''}`}
                aria-pressed={date === today}
                onClick={() => setDate(today)}>Today</button>
        <button type="button" className={`chip ${date === yesterday ? 'chip-selected' : ''}`}
                aria-pressed={date === yesterday}
                onClick={() => setDate(yesterday)}>Yesterday</button>
        <label className={`chip tap ${isOlder ? 'chip-selected' : ''}`}
               style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span aria-hidden>📅</span>
          <span>{isOlder ? friendlyDate(date, today) : 'Older'}</span>
          <span className="sr-only">Pick a date</span>
          <input type="date" max={today} value={date}
                 onChange={(e) => e.target.value && setDate(e.target.value)}
                 style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%',
                          height: '100%', padding: 0, border: 'none' }} />
        </label>
      </div>

      {/* ── Categories ── */}
      <div className="cat-grid">
        {CATEGORIES.map((c) => (
          <button key={c.slug} type="button" className="cat-tile"
                  aria-pressed={category === c.slug}
                  onClick={() => selectCategory(c.slug)}>
            <span className="cat-ico" aria-hidden>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Food subtypes, inline ── */}
      {category === 'food' && (
        <div className="subtypes">
          {FOOD_SUBTYPES.map((s) => (
            <button key={s.slug} type="button" className="subtype"
                    aria-pressed={subtype === s.slug}
                    onClick={() => setSubtype(subtype === s.slug ? null : s.slug)}>
              <span aria-hidden>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Custom label ── */}
      {category === 'custom' && (
        <div style={{ marginTop: 10 }}>
          <input className="input" placeholder="What was it?" value={customLabel} maxLength={60}
                 onChange={(e) => setCustomLabel(e.target.value)} autoFocus />
        </div>
      )}

      {/* ── Remembered amounts ──
          Chips LOAD into the keypad. They never commit — a wrong saved number
          is worse than a saved keystroke. */}
      {chips && chips.amounts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="chips-label">
            {chips.mode === 'approx' ? '≈ Last time — edit it' : 'Recent amounts'}
          </div>
          <div className="chips">
            {chips.amounts.map((a) => (
              <button key={a} type="button"
                      className={`chip chip-amount ${chips.mode === 'approx' ? 'chip-approx' : ''}`}
                      onClick={() => setAmount(a.toFixed(2))}>
                {chips.mode === 'approx' ? '~' : ''}{a.toFixed(2)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Note (collapsed by default), kept above the keypad so the sticky
             Save dock can never cover it. ── */}
      <div style={{ marginTop: 8 }}>
        {showNote ? (
          <input className="input" placeholder="Note (optional)" value={note} maxLength={280}
                 onChange={(e) => setNote(e.target.value)} autoFocus />
        ) : (
          <button type="button" className="note-toggle" onClick={() => setShowNote(true)}>
            + Add a note
          </button>
        )}
      </div>

      {/* ── Amount + keypad ── */}
      <div className="amount-zone">
        <Keypad value={amount} onChange={setAmount} currency={state.settings.currency} />
      </div>

      {/* Sticky so Save is always in reach, never scrolled under the tab bar. */}
      <div className="save-dock">
        <button type="button" className="btn" disabled={!canSave} onClick={save}>
          {canSave ? `Save ${state.settings.currency} ${numericAmount.toFixed(2)}` : 'Save'}
        </button>
      </div>

      {/* ── No-spend day: a first-class action ── */}
      {state.todayExpenses.length === 0 && !state.noSpendToday && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }}
                onClick={onNoSpend}>
          🧘 No spending today
        </button>
      )}
      {state.noSpendToday && (
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: 12 }}>
          Today is marked as a no-spend day.
        </p>
      )}
    </div>
  );
}
