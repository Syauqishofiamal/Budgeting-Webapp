'use client';
import { useEffect, useMemo } from 'react';

const COLORS = ['#4f7a5b', '#b8873b', '#c4622d', '#6f9d7c', '#d9ad5e'];

/** Milestone moment: under 2s, dismissible, and silent under reduced-motion. */
export default function Celebration({
  icon, title, body, onDismiss,
}: { icon: string; title: string; body: string; onDismiss: () => void }) {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const t = setTimeout(onDismiss, 1900);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bits = useMemo(
    () => Array.from({ length: reduced ? 0 : 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.35,
      dur: 1.1 + Math.random() * 0.8,
      color: COLORS[i % COLORS.length],
    })), [reduced]);

  return (
    <>
      {bits.length > 0 && (
        <div className="confetti" aria-hidden>
          {bits.map((b, i) => (
            <i key={i} style={{
              left: `${b.left}%`, background: b.color,
              animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`,
            }} />
          ))}
        </div>
      )}
      <div className="celebrate" onClick={onDismiss} role="dialog" aria-modal="true">
        <div className="celebrate-card">
          <div className="celebrate-ico" aria-hidden>{icon}</div>
          <div className="celebrate-title">{title}</div>
          {body && <div className="muted small">{body}</div>}
          <div className="tiny faint" style={{ marginTop: 12 }}>Tap to dismiss</div>
        </div>
      </div>
    </>
  );
}
