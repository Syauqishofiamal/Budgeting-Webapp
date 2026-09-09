'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import QuickAdd from './QuickAdd';
import Dashboard from './Dashboard';
import History from './History';
import More from './More';
import Toast from './Toast';
import Celebration from './Celebration';
import { buildFeedback, buzz, type Feedback } from '@/lib/feedback';
import type { AppState, Expense, LogResponse } from '@/lib/types';

type Tab = 'add' | 'today' | 'history' | 'more';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today',   icon: '🏠', label: 'Home' },
  { id: 'add',     icon: '➕', label: 'Add' },
  { id: 'history', icon: '📋', label: 'History' },
  { id: 'more',    icon: '⚙️', label: 'Settings' },
];

export default function AppShell({ isDemo }: { isDemo: boolean }) {
  const [tab, setTab] = useState<Tab>('today');
  const [state, setState] = useState<AppState | null>(null);
  const [toast, setToast] = useState<(Feedback & { expenseId: number | null }) | null>(null);
  const [celebration, setCelebration] = useState<Feedback['celebrate']>(null);
  const tempId = useRef(-1);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/state');
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Optimistic save. The entry appears and the toast fires immediately; the
   * server round-trip reconciles afterwards. Feedback never waits on the network.
   */
  const save = useCallback(async (e: {
    date: string; category: string; customLabel: string | null;
    subtype: string | null; amount: number; note: string | null;
  }) => {
    if (!state) return;
    const optimisticId = tempId.current--;
    const optimistic: Expense = {
      id: optimisticId, date: e.date, category: e.category,
      custom_label: e.customLabel, subtype: e.subtype, amount: e.amount,
      note: e.note, created_at: new Date().toISOString(), pending: true,
    };

    // 1. Paint immediately.
    setState((s) => s && {
      ...s,
      todayExpenses: e.date === s.today ? [optimistic, ...s.todayExpenses] : s.todayExpenses,
      todayTotal: e.date === s.today ? s.todayTotal + e.amount : s.todayTotal,
      budget: {
        ...s.budget,
        spent: s.budget.spent + e.amount,
        remaining: s.budget.remaining - e.amount,
        fraction: s.budget.total > 0
          ? Math.max(0, Math.min(1, (s.budget.remaining - e.amount) / s.budget.total)) : 0,
        over: s.budget.spent + e.amount > s.budget.total,
      },
    });
    buzz(state.settings.hapticsEnabled);

    // 2. Persist, then reconcile.
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      });
      if (!res.ok) throw new Error('save failed');
      const result: LogResponse = await res.json();
      const fb = buildFeedback(result, 'expense');
      setToast({ ...fb, expenseId: result.expenseId });
      if (fb.celebrate) setCelebration(fb.celebrate);
      await refresh();
    } catch {
      // Roll the optimistic row back out and say so plainly.
      setState((s) => s && {
        ...s,
        todayExpenses: s.todayExpenses.filter((x) => x.id !== optimisticId),
        todayTotal: s.todayTotal - e.amount,
      });
      setToast({
        line: 'Could not save — check your connection.',
        sub: 'Nothing was recorded.', celebrate: null, expenseId: null,
      });
    }
  }, [state, refresh]);

  /** Undo: server restores the pre-save snapshot exactly. */
  const undo = useCallback(async () => {
    if (!toast?.expenseId) return;
    const id = toast.expenseId;
    setToast(null);
    setCelebration(null);
    setState((s) => s && { ...s, todayExpenses: s.todayExpenses.filter((x) => x.id !== id) });
    await fetch('/api/undo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseId: id }),
    });
    await refresh();
  }, [toast, refresh]);

  const noSpend = useCallback(async () => {
    const res = await fetch('/api/no-spend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const result: LogResponse = await res.json();
    const fb = buildFeedback(result, 'no_spend');
    // No undo target: a no-spend day has no expense row behind it.
    setToast({ ...fb, expenseId: null });
    if (fb.celebrate) setCelebration(fb.celebrate);
    await refresh();
  }, [refresh]);

  const editExpense = useCallback(async (e: Expense, amount: number, note: string) => {
    setState((s) => s && {
      ...s,
      todayExpenses: s.todayExpenses.map((x) => x.id === e.id ? { ...x, amount, note } : x),
    });
    await fetch(`/api/expenses/${e.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note, date: e.date }),
    });
    await refresh();
  }, [refresh]);

  const deleteExpense = useCallback(async (e: Expense) => {
    setState((s) => s && {
      ...s,
      todayExpenses: s.todayExpenses.filter((x) => x.id !== e.id),
      todayTotal: s.todayTotal - e.amount,
    });
    await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  const quickLog = useCallback((category: string, amount: number) => {
    if (!state) return;
    save({ date: state.today, category, customLabel: null, subtype: null, amount, note: null });
    setTab('add');
  }, [state, save]);

  if (!state) {
    return (
      <div className="app">
        <div className="screen">
          <div className="skel" style={{ height: 96, marginBottom: 12 }} />
          <div className="skel" style={{ height: 74, marginBottom: 12 }} />
          <div className="skel" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {isDemo && (
        <div className="demo-banner">
          ✨ Demo mode — sample data, resets nightly
        </div>
      )}

      {tab === 'add' && <QuickAdd state={state} onSave={save} onNoSpend={noSpend} />}
      {tab === 'today' && (
        <Dashboard state={state} onEdit={editExpense} onDelete={deleteExpense} />
      )}
      {tab === 'history' && (
        <History today={state.today} currency={state.settings.currency} />
      )}
      {tab === 'more' && (
        <More state={state} onRefresh={refresh} onQuickLog={quickLog} />
      )}

      {toast && (
        <Toast line={toast.line} sub={toast.sub} canUndo={toast.expenseId !== null}
               onUndo={undo} onDismiss={() => setToast(null)} />
      )}
      {celebration && (
        <Celebration {...celebration} onDismiss={() => setCelebration(null)} />
      )}

      <nav className="tabs">
        <div className="tabs-inner">
          {TABS.map((t) => (
            <button key={t.id} className="tab" onClick={() => setTab(t.id)}
                    aria-current={tab === t.id ? 'page' : undefined}>
              <span className="tab-ico" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
