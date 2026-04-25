import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, CheckSquare, Square } from 'lucide-react'
import { api } from '../../api'
import { Button } from './Fields'

function mergeProfilePreservingUntouched(latest = {}, incoming = {}) {
  return {
    ...latest,
    ...incoming,
    personal: incoming.personal ?? latest.personal ?? {},
    experiences: incoming.experiences ?? latest.experiences ?? [],
    projects: incoming.projects ?? latest.projects ?? [],
    educations: incoming.educations ?? latest.educations ?? [],
    skills: incoming.skills ?? latest.skills ?? [],
    awards: incoming.awards ?? latest.awards ?? [],
    summaries: incoming.summaries ?? latest.summaries ?? [],
  }
}

// Map module types in the imported resume to pool keys in the profile library.
const TYPE_TO_POOL = {
  experience: 'experiences',
  projects: 'projects',
  education: 'educations',
  skills: 'skills',
  awards: 'awards',
  summary: 'summaries',
}

const POOL_LABELS = {
  experiences: 'Experience',
  projects:    'Projects',
  educations:  'Education',
  skills:      'Skills',
  awards:      'Awards',
  summaries:   'Summaries',
}

// Fields worth showing as a compact preview for each pool
function summarize(poolKey, e) {
  switch (poolKey) {
    case 'experiences':
      return {
        title: e.position || 'Untitled role',
        subtitle: [e.company, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
        body: e.description,
      }
    case 'projects':
      return {
        title: e.name || 'Untitled project',
        subtitle: [e.role, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
        body: e.description,
      }
    case 'educations':
      return {
        title: e.school || 'Untitled school',
        subtitle: [e.degree, [e.start_date, e.end_date].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
        body: e.description,
      }
    case 'skills':
      return {
        title: e.category || 'Skills',
        subtitle: '',
        body: (e.items || []).join(', '),
      }
    case 'awards':
      return {
        title: e.title || 'Untitled award',
        subtitle: [e.issuer, e.date].filter(Boolean).join(' · '),
        body: e.description,
      }
    case 'summaries':
      return {
        title: 'Summary',
        subtitle: '',
        body: e.content,
      }
    default:
      return { title: '', subtitle: '', body: '' }
  }
}

// Crude duplicate detection: match on the primary field (case-insensitive,
// trimmed, stripped of punctuation). Good enough to flag obvious overlaps.
function normalize(s) {
  return (s || '').toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '').trim()
}
function isDuplicate(poolKey, entry, existing) {
  const key = {
    experiences: (x) => normalize(x.position) + '|' + normalize(x.company),
    projects:    (x) => normalize(x.name),
    educations:  (x) => normalize(x.school) + '|' + normalize(x.degree),
    skills:      (x) => normalize(x.category),
    awards:      (x) => normalize(x.title),
    summaries:   (x) => normalize((x.content || '').slice(0, 40)),
  }[poolKey]
  if (!key) return false
  const k = key(entry)
  if (!k) return false
  return (existing || []).some((x) => key(x) === k)
}

function PoolGroup({ poolKey, entries, selected, toggleSelect, duplicates }) {
  if (!entries.length) return null
  const allSelected = entries.every((_, i) => selected[i])
  const toggleAll = () => {
    entries.forEach((_, i) => toggleSelect(i, !allSelected))
  }
  return (
    <section className="card relative z-0 overflow-visible">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5 bg-ink-900/50 rounded-t-[8px]">
        <div className="text-[11px] font-semibold text-gray-900 uppercase tracking-[0.15em]">
          {POOL_LABELS[poolKey]}
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">
          {entries.filter((_, i) => selected[i]).length} / {entries.length}
        </div>
        <div className="flex-1"/>
        <button
          onClick={toggleAll}
          className="text-[11px] text-cyan-400 hover:text-cyan-300"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="divide-y divide-white/5 rounded-b-[8px] bg-transparent">
        {entries.map((e, idx) => {
          const s = summarize(poolKey, e)
          const dup = duplicates[idx]
          const on = selected[idx]
          return (
            <label
              key={idx}
              className={
                'flex items-start gap-3 px-3.5 py-3 cursor-pointer transition-colors ' +
                (on ? 'bg-cyan-400/5' : 'hover:bg-white/5')
              }
            >
              <button
                onClick={(evt) => { evt.preventDefault(); toggleSelect(idx, !on) }}
                className={'mt-0.5 ' + (on ? 'text-cyan-400' : 'text-zinc-600 hover:text-zinc-400')}
              >
                {on ? <CheckSquare size={16}/> : <Square size={16}/>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.title}</div>
                  {dup && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      duplicate
                    </span>
                  )}
                </div>
                {s.subtitle && (
                  <div className="text-xs text-zinc-500 truncate">{s.subtitle}</div>
                )}
                {s.body && (
                  <div
                    className="mt-1 text-xs text-zinc-400 [&_ul]:list-disc [&_ul]:ml-4"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    dangerouslySetInnerHTML={{ __html: s.body }}
                  />
                )}
              </div>
            </label>
          )
        })}
      </div>
    </section>
  )
}

export default function ImportReviewModal({ parsedResume, onClose, onConfirm }) {
  const [profile, setProfile] = useState(null)

  // Load current profile to detect duplicates
  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile({}))
  }, [])

  // Extract entries per pool from parsed modules
  const extracted = useMemo(() => {
    const out = {}
    for (const m of parsedResume?.modules || []) {
      const pool = TYPE_TO_POOL[m.type]
      if (!pool) continue
      if (!out[pool]) out[pool] = []
      for (const e of m.entries || []) {
        // Keep only entries with some content
        const s = summarize(pool, e)
        if ((s.title && s.title !== 'Untitled' && s.title !== 'Summary') || s.body) {
          out[pool].push(e)
        }
      }
    }
    return out
  }, [parsedResume])

  // Compute duplicate flags and initial selections.
  const duplicates = useMemo(() => {
    const d = {}
    if (!profile) return d
    for (const [pool, items] of Object.entries(extracted)) {
      d[pool] = items.map((e) => isDuplicate(pool, e, profile[pool] || []))
    }
    return d
  }, [extracted, profile])

  const [selected, setSelected] = useState({})
  // Initialize selection: duplicates start unchecked.
  useEffect(() => {
    if (!profile) return
    const init = {}
    for (const [pool, items] of Object.entries(extracted)) {
      init[pool] = items.map((_, i) => !(duplicates[pool]?.[i]))
    }
    setSelected(init)
  }, [extracted, duplicates, profile])

  const totalExtracted = Object.values(extracted).reduce((n, a) => n + a.length, 0)
  const totalSelected = Object.entries(selected).reduce(
    (n, [_, arr]) => n + (arr || []).filter(Boolean).length, 0
  )

  const toggleSelect = (pool, idx, val) => {
    setSelected((s) => ({ ...s, [pool]: s[pool].map((v, i) => i === idx ? val : v) }))
  }

  const skipAll = () => {
    onConfirm(parsedResume, null)   // null => don't touch library
  }

  const confirmAndMerge = async () => {
    if (!profile) return
    // Build next profile: append selected entries into the right pools, strip ids so backend re-generates
    const latest = await api.getProfile().catch(() => (profile || {}))
    const next = mergeProfilePreservingUntouched(latest, profile)
    for (const [pool, items] of Object.entries(extracted)) {
      const chosen = items.filter((_, i) => selected[pool]?.[i]).map((e) => {
        const { id, hidden, ...rest } = e
        return rest
      })
      if (!chosen.length) continue
      next[pool] = [ ...(next[pool] || []), ...chosen ]
    }
    try {
      await api.saveProfile(next)
    } catch (e) {
      if (!confirm('Saving to profile library failed (' + e.message + '). Continue anyway?')) return
    }
    onConfirm(parsedResume, next)
  }

  if (!parsedResume) return null
  const noEntries = totalExtracted === 0

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-ink-800 border border-white/10 rounded-lg shadow-2xl flex flex-col min-h-0">
        {/* Header */}
        <div className="relative z-20 flex items-center gap-3 px-5 h-14 border-b border-white/5 bg-ink-800 rounded-t-lg flex-shrink-0">
          <Sparkles size={16} className="text-cyan-400"/>
          <div>
            <div className="text-sm font-semibold text-gray-900">Add to your profile library?</div>
            <div className="text-[11px] text-zinc-500">
              Selected entries will be saved so you can reuse them across different resumes.
            </div>
          </div>
          <div className="flex-1"/>
          <div className="text-xs text-cyan-400 font-mono tabular-nums">
            {totalSelected} / {totalExtracted} selected
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white">
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-scroll overflow-x-hidden px-4 py-4 pr-3 pb-6 flex flex-col gap-3 app-scrollbar">
          {noEntries ? (
            <div className="text-center text-sm text-zinc-500 py-8">
              No experience/project/skill entries detected in this file.
              <br/>You can still edit the parsed content in the editor.
            </div>
          ) : (
            !profile ? (
              <div className="text-sm text-zinc-500">Loading profile library…</div>
            ) : (
              Object.entries(extracted).map(([pool, entries]) => (
                <PoolGroup
                  key={pool}
                  poolKey={pool}
                  entries={entries}
                  selected={selected[pool] || []}
                  duplicates={duplicates[pool] || []}
                  toggleSelect={(idx, val) => toggleSelect(pool, idx, val)}
                />
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="relative z-20 flex items-center gap-2 px-5 py-3 border-t border-white/5 bg-ink-900/40 rounded-b-lg flex-shrink-0">
          <div className="text-[11px] text-zinc-500">
            Entries are selected by default. Unchecking an entry will still open the parsed resume for editing.
          </div>
          <div className="flex-1"/>
          <Button variant="ghost" onClick={skipAll}>Skip — just open the resume</Button>
          <Button onClick={confirmAndMerge} disabled={noEntries}>
            Add {totalSelected} to library &amp; open
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
