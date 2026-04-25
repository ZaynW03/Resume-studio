import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckSquare, Square, Library } from 'lucide-react'
import { api } from '../../api'
import { Button } from './Fields'

// Map module type -> profile library pool key
const TYPE_TO_POOL = {
  experience:  'experiences',
  projects:    'projects',
  education:   'educations',
  skills:      'skills',
  awards:      'awards',
  summary:     'summaries',
}

function summarize(poolKey, e) {
  switch (poolKey) {
    case 'experiences':
      return {
        title:    e.position || 'Untitled role',
        subtitle: [e.company, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
        body:     e.description,
      }
    case 'projects':
      return {
        title:    e.name || 'Untitled project',
        subtitle: [e.role, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
        body:     e.description,
      }
    case 'educations':
      return {
        title:    e.school || 'Untitled school',
        subtitle: [e.degree, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
        body:     e.description,
      }
    case 'skills':
      return { title: e.category || 'Skills', subtitle: '', body: (e.items || []).join(', ') }
    case 'awards':
      return { title: e.title || 'Untitled award', subtitle: [e.issuer, e.date].filter(Boolean).join(' · '), body: e.description }
    case 'summaries':
      return { title: 'Summary', subtitle: '', body: e.content }
    default:
      return { title: '', subtitle: '', body: '' }
  }
}

export default function LibraryPickerModal({ moduleType, onClose, onPick }) {
  const [profile, setProfile] = useState(null)
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile({}))
  }, [])

  const pool = TYPE_TO_POOL[moduleType]
  const entries = useMemo(() => (profile && pool ? (profile[pool] || []) : []), [profile, pool])

  const toggle = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === entries.length) setSelected(new Set())
    else setSelected(new Set(entries.map((_, i) => i)))
  }

  const confirm = () => {
    const picked = [...selected].sort((a, b) => a - b).map((i) => {
      const e = entries[i]
      // Strip id/hidden so the entry list generates fresh ones on insertion.
      const { id, hidden, ...rest } = e
      return rest
    })
    onPick(picked)
  }

  if (!pool) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <div className="card p-4 max-w-md">
          <div className="text-sm text-gray-700 mb-3">
            Profile library doesn't track this module type.
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] bg-ink-800 border border-white/10 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-white/5 flex-shrink-0">
          <Library size={16} className="text-cyan-400"/>
          <div>
            <div className="text-sm font-semibold text-gray-900">Add from profile library</div>
            <div className="text-[11px] text-zinc-500">
              Select entries to copy into this resume. Edits won't affect the library copy.
            </div>
          </div>
          <div className="flex-1"/>
          <button onClick={toggleAll} className="text-[11px] text-cyan-400 hover:text-cyan-300">
            {entries.length && selected.size === entries.length ? 'Deselect all' : 'Select all'}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white">
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {!profile ? (
            <div className="text-sm text-zinc-500 py-6 text-center">Loading library…</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">
              Your profile library has no {pool} entries yet.
              <br/>Add some under the <span className="text-cyan-400">Profile</span> tab first.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((e, idx) => {
                const s = summarize(pool, e)
                const on = selected.has(idx)
                return (
                  <label
                    key={idx}
                    className={
                      'flex items-start gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ' +
                      (on
                        ? 'bg-cyan-400/5 border-cyan-400/40'
                        : 'bg-ink-700 border-white/5 hover:border-white/20')
                    }
                  >
                    <button
                      onClick={(evt) => { evt.preventDefault(); toggle(idx) }}
                      className={'mt-0.5 ' + (on ? 'text-cyan-400' : 'text-zinc-600 hover:text-zinc-400')}
                    >
                      {on ? <CheckSquare size={16}/> : <Square size={16}/>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{s.title}</div>
                      {s.subtitle && <div className="text-xs text-zinc-500 truncate">{s.subtitle}</div>}
                      {s.body && (
                        <div
                          className="mt-1 text-xs text-zinc-400"
                          style={{
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}
                          dangerouslySetInnerHTML={{ __html: s.body }}
                        />
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-white/5 bg-ink-900/40 flex-shrink-0">
          <div className="text-[11px] text-zinc-500">
            {selected.size} selected
          </div>
          <div className="flex-1"/>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} disabled={selected.size === 0}>
            Add {selected.size || ''}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
