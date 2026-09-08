'use client';
import { useEffect } from 'react';

/** Stays ~5s and carries Undo — the primary correction path for a fat finger. */
export default function Toast({
  line, sub, canUndo, onUndo, onDismiss,
}: {
  line: string; sub: string; canUndo: boolean;
  onUndo: () => void; onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss, line, sub]);

  return (
    <div className="toast-wrap">
      <div className="toast" role="status" aria-live="polite">
        <div className="toast-main">
          <div className="toast-line">{line}</div>
          <div className="toast-sub num">{sub}</div>
        </div>
        {canUndo && (
          <button className="toast-undo" onClick={onUndo}>Undo</button>
        )}
      </div>
    </div>
  );
}
