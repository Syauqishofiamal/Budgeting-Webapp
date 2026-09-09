'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Amount entry. Works two ways:
 *
 *  - Phone: the on-screen keypad, which is the fast 3-tap path.
 *  - Laptop: type straight into the field, or use the number keys anywhere on
 *    the page. Enter saves.
 *
 * The value is held as a STRING so trailing decimals ("12.", "12.0") survive
 * editing — tapping a remembered chip must load a value you can then edit digit
 * by digit.
 */
export default function Keypad({
  value, onChange, currency, onSubmit, focusKey,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: string;
  /** Called on Enter, so a laptop user never has to reach for the mouse. */
  onSubmit?: () => void;
  /** Changes whenever the parent wants the field focused (category picked). */
  focusKey?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Touch devices get a read-only field: tapping it would otherwise raise the
  // OS keyboard on top of the custom keypad, which is worse than either alone.
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    setIsTouch(touch);
  }, []);

  // Focus the field on laptops each time a category is picked, so typing can
  // start immediately. The click that selects a category leaves focus on that
  // button, so this has to run after it — hence the dependency on focusKey
  // rather than on mount alone.
  useEffect(() => {
    if (isTouch || !focusKey) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isTouch, focusKey]);

  /** Normalises any candidate string to a valid amount, or returns null. */
  function clean(raw: string): string | null {
    let v = raw.replace(/[^\d.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot >= 0) {
      // Keep only the first decimal point.
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      const [whole, frac = ''] = v.split('.');
      if (frac.length > 2) v = `${whole}.${frac.slice(0, 2)}`;
    }
    if (v.replace('.', '').length > 9) return null;
    if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.replace(/^0+/, '') || '0';
    return v;
  }

  function press(k: string) {
    if (k === 'del') { onChange(value.slice(0, -1)); return; }
    if (k === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : value + '.');
      return;
    }
    const dot = value.indexOf('.');
    if (dot >= 0 && value.length - dot > 2) return;
    if (value === '0') { onChange(k); return; }
    if (value.replace('.', '').length >= 9) return;
    onChange(value + k);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(); }
    if (e.key === 'Escape') { e.preventDefault(); onChange(''); }
  }

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','del'];

  return (
    <div>
      <label className="amount-label" htmlFor="amount-field">Amount</label>

      <div className={`amount-row ${value === '' ? 'empty' : ''}`}>
        <span className="cur">{currency}</span>
        <input
          id="amount-field"
          ref={inputRef}
          className="amount-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          // Read-only on touch so the native keyboard never covers the keypad.
          readOnly={isTouch}
          placeholder="0"
          value={value}
          onChange={(e) => { const v = clean(e.target.value); if (v !== null) onChange(v); }}
          onKeyDown={onKeyDown}
          aria-label={`Amount in ${currency}`}
        />
      </div>

      {!isTouch && (
        <p className="tiny faint keypad-hint">Type the amount, then press Enter to save.</p>
      )}

      <div className="keypad">
        {keys.map((k) => (
          <button key={k} type="button"
                  className={`key ${k === 'del' || k === '.' ? 'key-fn' : ''}`}
                  onClick={() => press(k)}
                  // Keep focus in the field so typing still works after a click.
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label={k === 'del' ? 'Delete last digit' : k}>
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
    </div>
  );
}
