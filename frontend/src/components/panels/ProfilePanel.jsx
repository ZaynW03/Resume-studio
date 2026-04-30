import { useEffect, useState } from 'react'
import { api } from '../../api'
import { TextField, TextArea } from '../common/Fields'
import RichTextEditor from '../editor/RichTextEditor'
import {
  Briefcase, FolderGit2, GraduationCap, Wrench, Award, FileText,
  Plus, Trash2,
} from 'lucide-react'
import { useResumeStore, EMPTY_ENTRY } from '../../store/resumeStore'
import { useT } from '../../i18n'

const POOLS = [
  { key: 'experiences', type: 'experience', label: 'Experience', Icon: Briefcase,      factory: EMPTY_ENTRY.experience },
  { key: 'projects',    type: 'projects',   label: 'Projects',   Icon: FolderGit2,     factory: EMPTY_ENTRY.projects   },
  { key: 'educations',  type: 'education',  label: 'Education',  Icon: GraduationCap,  factory: EMPTY_ENTRY.education  },
  { key: 'skills',      type: 'skills',     label: 'Skills',     Icon: Wrench,         factory: EMPTY_ENTRY.skills     },
  { key: 'awards',      type: 'awards',     label: 'Awards',     Icon: Award,          factory: EMPTY_ENTRY.awards     },
  { key: 'summaries',   type: 'summary',    label: 'Summaries',  Icon: FileText,       factory: EMPTY_ENTRY.summary    },
]

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({ poolKey, entry, onChange, onRemove, onImport }) {
  const t = useT()

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
      <div className="p-4 flex flex-col gap-2.5">
        {poolKey === 'experiences' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label={t('editor.position')}   value={entry.position}   onChange={(v) => onChange({ position: v })}/>
            <TextField label={t('editor.company')}    value={entry.company}    onChange={(v) => onChange({ company: v })}/>
            <TextField label={t('editor.start_date')} value={entry.start_date} onChange={(v) => onChange({ start_date: v })}/>
            <TextField label={t('editor.end_date')}   value={entry.end_date}   onChange={(v) => onChange({ end_date: v })}/>
          </div>
        )}
        {poolKey === 'projects' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label={t('editor.project_name')} value={entry.name} onChange={(v) => onChange({ name: v })}/>
            <TextField label={t('editor.role')}         value={entry.role} onChange={(v) => onChange({ role: v })}/>
            <TextField label={t('editor.start_date')}   value={entry.start_date} onChange={(v) => onChange({ start_date: v })}/>
            <TextField label={t('editor.end_date')}     value={entry.end_date}   onChange={(v) => onChange({ end_date: v })}/>
            <div className="col-span-2">
              <TextField label={t('editor.link')} value={entry.link} onChange={(v) => onChange({ link: v })}/>
            </div>
          </div>
        )}
        {poolKey === 'educations' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label={t('editor.school')}     value={entry.school} onChange={(v) => onChange({ school: v })}/>
            <TextField label={t('editor.degree')}     value={entry.degree} onChange={(v) => onChange({ degree: v })}/>
            <TextField label={t('editor.start_date')} value={entry.start_date} onChange={(v) => onChange({ start_date: v })}/>
            <TextField label={t('editor.end_date')}   value={entry.end_date}   onChange={(v) => onChange({ end_date: v })}/>
          </div>
        )}
        {poolKey === 'awards' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label={t('editor.title')}  value={entry.title}  onChange={(v) => onChange({ title: v })}/>
            <TextField label={t('editor.issuer')} value={entry.issuer} onChange={(v) => onChange({ issuer: v })}/>
            <TextField label={t('editor.date')}   value={entry.date}   onChange={(v) => onChange({ date: v })}/>
          </div>
        )}
        {poolKey === 'skills' && (
          <>
            <TextField label={t('editor.category')} value={entry.category} onChange={(v) => onChange({ category: v })}/>
            <TextArea label={t('editor.items')}
              value={(entry.items || []).join(', ')}
              onChange={(v) => onChange({ items: v.split(',').map((x) => x.trim()).filter(Boolean) })}
              rows={2}/>
          </>
        )}
        {['experiences','projects','educations','summaries'].includes(poolKey) && (
          <div>
            <div className="panel-title mb-1.5">{t('editor.description')}</div>
            <RichTextEditor
              value={poolKey === 'summaries' ? entry.content : entry.description}
              onChange={(v) => onChange(poolKey === 'summaries' ? { content: v } : { description: v })}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-1">
          <button
            onClick={() => onImport(entry)}
            className="flex items-center gap-1 text-xs border border-indigo-200 text-indigo-600 rounded-full px-2.5 py-1 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
          >
            <Plus size={11}/> {t('profile.use_in_resume')}
          </button>
          <button
            onClick={onRemove}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <Trash2 size={12}/> {t('editor.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ProfilePanel ─────────────────────────────────────────────────────────────

export default function ProfilePanel() {
  const t = useT()
  const [profile, setProfile] = useState(null)
  const [openPool, setOpenPool] = useState('experiences')

  const addEntryToCurrent = (poolKey, entry) => {
    const type = POOLS.find((p) => p.key === poolKey)?.type
    if (!type) return
    const resume = useResumeStore.getState().resume
    const mod = resume.modules.find((m) => m.type === type)
    if (!mod) return alert(`No "${type}" module in this resume. Add one first in Content.`)
    const id = Math.random().toString(36).slice(2, 14)
    const { hidden, ...rest } = entry
    const newEntry = { ...rest, id, hidden: false }
    useResumeStore.getState().updateModule(mod.id, { entries: [...mod.entries, newEntry] })
  }

  useEffect(() => {
    api.getProfile()
      .then((p) => setProfile(p || {}))
      .catch((e) => alert('Failed to load profile: ' + e.message))
  }, [])

  if (!profile) {
    return <div className="p-5 text-sm text-zinc-500">{t('profile.loading')}</div>
  }

  const update = (poolKey, idx, patch) => {
    setProfile((p) => {
      const next = { ...p }
      next[poolKey] = next[poolKey].map((e, i) => (i === idx ? { ...e, ...patch } : e))
      return next
    })
  }
  const remove = (poolKey, idx) => {
    setProfile((p) => ({ ...p, [poolKey]: p[poolKey].filter((_, i) => i !== idx) }))
  }
  const add = (poolKey, factory) => {
    setProfile((p) => ({ ...p, [poolKey]: [...(p[poolKey] || []), factory()] }))
  }

  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4">
      {/* Pool tabs */}
      <div className="flex flex-wrap gap-1.5">
        {POOLS.map(({ key, Icon: PoolIcon }) => {
          const active = openPool === key
          return (
            <button key={key}
              onClick={() => setOpenPool(key)}
              className={'chip ' + (active ? 'chip-active' : '')}
            >
              <PoolIcon size={11}/> {t('profile.pool.' + key)}
              <span className={'tabular-nums text-[10px] ' + (active ? 'text-indigo-500' : 'text-zinc-400')}>
                {(profile[key] || []).length}
              </span>
            </button>
          )
        })}
      </div>

      {/* Entry cards for active pool */}
      {POOLS.filter((p) => p.key === openPool).map(({ key, factory }) => (
        <div key={key} className="flex flex-col gap-2">
          {(profile[key] || []).map((entry, idx) => (
            <EntryCard
              key={`${key}-${entry.id || idx}`}
              poolKey={key}
              entry={entry}
              onChange={(patch) => update(key, idx, patch)}
              onRemove={() => remove(key, idx)}
              onImport={(e) => addEntryToCurrent(key, e)}
            />
          ))}

          <button
            onClick={() => add(key, factory)}
            className="flex items-center justify-center gap-1.5 text-sm text-indigo-500 border border-dashed border-gray-200 rounded-2xl py-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <Plus size={14}/> {t('profile.add_entry')}
          </button>
        </div>
      ))}
    </div>
  )
}
