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
          <span className="text-cyan-400 font-mono text-[11px]">{value}{unit}</span>
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

export function Toggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full text-left cursor-pointer select-none group"
    >
      <span className="text-xs text-zinc-400 group-hover:text-zinc-200">{label}</span>
      <span
        className={
          'relative w-9 h-5 rounded-full transition-colors ' +
          (value ? 'bg-cyan-400 shadow-[0_0_10px_-2px_rgba(34,211,238,0.8)]' : 'bg-zinc-700')
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

export function Button({ children, onClick, variant = 'primary', className = '', ...rest }) {
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
      className={`${map[variant] || map.primary} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ColorSwatch({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-zinc-500">{value}</span>
        <span
          className="relative inline-block w-7 h-7 rounded border border-white/10 overflow-hidden"
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
