'use client';
import { useState } from 'react';
import { CATEGORY_MAP } from '@/lib/constants';
import { formatMoney } from '@/lib/dates';
import type { Expense } from '@/lib/types';

function label(e: Expense): string {
  if (e.category === 'custom') return e.custom_label || 'Other';
  const base = CATEGORY_MAP[e.category]?.label ?? e.category;
  return e.subtype ? `${base} · ${e.subtype}` : base;
}

export default function EntryList({
  expenses, currency, onEdit, onDelete,
}: {
  expenses: Expense[]; currency: string;
  onEdit: (e: Expense, amount: number, note: string) => void;
  onDelete: (e: Expense) => void;
}) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');

  function startEdit(e: Expense) {
    setEditing(e); setAmt(e.amount.toFixed(2)); setNote(e.note ?? '');
  }
  function commit() {
    if (!editing) return;
    const v = parseFloat(amt);
    if (Number.isFinite(v) && v >= 0) onEdit(editing, Math.round(v * 100) / 100, note.trim());
    setEditing(null);
  }

  if (expenses.length === 0) {
    return (
      <div className="empty">
        <div className="empty-ico">🍃</div>
        <div className="small">Nothing logged yet today.</div>
      </div>
    );
  }

  return (
    <div>
      {expenses.map((e) => (
        <div key={e.id} className="entry" style={e.pending ? { opacity: .55 } : undefined}>
          <div className="entry-ico" aria-hidden>
            {e.category === 'custom' ? '✨' : CATEGORY_MAP[e.category]?.icon ?? '•'}
          </div>
          <div className="entry-main">
            <div className="entry-label">{label(e)}</div>
            {e.note && <div className="entry-note">{e.note}</div>}
          </div>
          <div className="entry-amt num">{formatMoney(e.amount, currency)}</div>
          <button className="icon-btn" aria-label="Edit entry"
                  onClick={() => startEdit(e)} disabled={e.pending}>✎</button>
          <button className="icon-btn" aria-label="Delete entry"
                  onClick={() => onDelete(e)} disabled={e.pending}>🗑</button>
        </div>
      ))}

      {editing && (
        <div className="celebrate" role="dialog" aria-modal="true"
             onClick={(ev) => { if (ev.target === ev.currentTarget) setEditing(null); }}>
          <div className="celebrate-card" style={{ textAlign: 'left', width: '100%' }}>
            <div className="field-label">Amount</div>
            <input className="input" inputMode="decimal" value={amt} autoFocus
                   onChange={(e) => setAmt(e.target.value)} />
            <div className="field-label" style={{ marginTop: 12 }}>Note</div>
            <input className="input" value={note} maxLength={280}
                   onChange={(e) => setNote(e.target.value)} />
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" onClick={commit}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
