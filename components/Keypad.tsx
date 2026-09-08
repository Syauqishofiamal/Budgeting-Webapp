'use client';

/**
 * Numeric keypad. Amount is held as a STRING so trailing decimals ("12.",
 * "12.0") survive editing — the prompt's core requirement is that tapping a
 * remembered chip loads a value you can then edit digit by digit.
 */
export default function Keypad({
  value, onChange, currency,
}: { value: string; onChange: (v: string) => void; currency: string }) {

  function press(k: string) {
    if (k === 'del') { onChange(value.slice(0, -1)); return; }
    if (k === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : value + '.');
      return;
    }
    // Cap at two decimal places.
    const dot = value.indexOf('.');
    if (dot >= 0 && value.length - dot > 2) return;
    if (value === '0') { onChange(k); return; }
    if (value.replace('.', '').length >= 9) return;
    onChange(value + k);
  }

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','del'];
  return (
    <div>
      <div className={`amount-display ${value === '' ? 'empty' : ''}`}>
        <span className="cur">{currency}</span>{value === '' ? '0' : value}
      </div>
      <div className="keypad">
        {keys.map((k) => (
          <button key={k} type="button" className={`key ${k === 'del' || k === '.' ? 'key-fn' : ''}`}
                  onClick={() => press(k)}
                  aria-label={k === 'del' ? 'Delete last digit' : k}>
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
    </div>
  );
}
