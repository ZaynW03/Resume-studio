export function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      {label && <div className="panel-title mb-1.5">{label}</div>}
      <input
        type={type}
        className="input-dark"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function TextArea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <label className="block">
      {label && <div className="panel-title mb-1.5">{label}</div>}
      <textarea
        className="input-dark"
        rows={rows}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      {label && <div className="panel-title mb-1.5">{label}</div>}
      <select
        className="select-dark"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) =>
          typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </label>
  )
}

export function Slider({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <label className="block">
      {label && (
        <div className="panel-title mb-1.5 flex justify-between items-center normal-case tracking-normal">
          <span className="uppercase tracking-[0.18em]">{label}</span>
          <span className="text-indigo-500 font-mono text-[11px]">{value}{unit}</span>
        </div>
      )}
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </label>
  )
}

export function StepSlider({ label, value, onChange, options }) {
  const idx = options.findIndex((o) => {
    const v = typeof o === 'number' ? o : (o.id ?? o.value)
    return v === value
  })
  const safeIdx = idx < 0 ? 0 : idx

  const prev = () => {
    if (safeIdx <= 0) return
    const o = options[safeIdx - 1]
    onChange(typeof o === 'number' ? o : (o.id ?? o.value))
  }
  const next = () => {
    if (safeIdx >= options.length - 1) return
    const o = options[safeIdx + 1]
    onChange(typeof o === 'number' ? o : (o.id ?? o.value))
  }
  const onRange = (e) => {
    const i = parseInt(e.target.value, 10)
    const o = options[i]
    onChange(typeof o === 'number' ? o : (o.id ?? o.value))
  }

  const labels = options.map((o) =>
    typeof o === 'number' ? String(o) : typeof o === 'string' ? o : o.label
  )
  const currentLabel = labels[safeIdx] ?? String(value)

  return (
    <div>
      {label && (
        <div className="panel-title mb-2 flex justify-between items-center normal-case tracking-normal">
          <span className="uppercase tracking-[0.18em]">{label}</span>
          <span className="text-indigo-600 font-semibold text-xs">{currentLabel}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" className="step-btn" onClick={prev} disabled={safeIdx <= 0}>−</button>
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            className="step-slider"
            min={0}
            max={options.length - 1}
            step={1}
            value={safeIdx}
            onChange={onRange}
          />
          <div className="flex justify-between px-0.5">
            {labels.map((l, i) => (
              <span key={i} className="text-[9px] text-gray-300 leading-none">{l}</span>
            ))}
          </div>
        </div>
        <button type="button" className="step-btn" onClick={next} disabled={safeIdx >= options.length - 1}>+</button>
      </div>
    </div>
  )
}

export function Toggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full text-left cursor-pointer select-none group"
    >
      <span className="text-xs text-gray-600 group-hover:text-gray-900">{label}</span>
      <span
        className={
          'relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ml-2 ' +
          (value ? 'bg-indigo-500' : 'bg-gray-200')
        }
      >
        <span
          className={
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ' +
            (value ? 'translate-x-4' : '')
          }
        />
      </span>
    </button>
  )
}

export function Button({ children, onClick, variant = 'primary', className = '', disabled, ...rest }) {
  const map = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    ghost:     'btn-ghost',
    danger:    'btn-danger',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${map[variant] || map.primary} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ColorSwatch({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-gray-400">{value}</span>
        <span
          className="relative inline-block w-7 h-7 rounded border border-gray-200 overflow-hidden"
          style={{ background: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </span>
      </div>
    </label>
  )
}
