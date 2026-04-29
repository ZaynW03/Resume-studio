import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { Button, TextField, TextArea } from '../common/Fields'
import RichTextEditor from '../editor/RichTextEditor'
import {
  Briefcase, FolderGit2, GraduationCap, Wrench, Award, FileText,
  Plus, Trash2, ArrowRight, User, Upload,
  Pencil, MapPin, Mail, Phone, Globe, Link2, Github, MessageCircle, AtSign, Check,
  Instagram, Send, Gamepad2, Globe2, Cake, Sparkles,
} from 'lucide-react'
import { useResumeStore, EMPTY_ENTRY } from '../../store/resumeStore'

const uid = () => Math.random().toString(36).slice(2, 14)

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

const POOLS = [
  { key: 'experiences', type: 'experience', label: 'Experience', Icon: Briefcase,      factory: EMPTY_ENTRY.experience },
  { key: 'projects',    type: 'projects',   label: 'Projects',   Icon: FolderGit2,     factory: EMPTY_ENTRY.projects   },
  { key: 'educations',  type: 'education',  label: 'Education',  Icon: GraduationCap,  factory: EMPTY_ENTRY.education  },
  { key: 'skills',      type: 'skills',     label: 'Skills',     Icon: Wrench,         factory: EMPTY_ENTRY.skills     },
  { key: 'awards',      type: 'awards',     label: 'Awards',     Icon: Award,          factory: EMPTY_ENTRY.awards     },
  { key: 'summaries',   type: 'summary',    label: 'Summaries',  Icon: FileText,       factory: EMPTY_ENTRY.summary    },
]

// Contact fields shown in preview card
const PREVIEW_FIELDS = [
  { key: 'location', Icon: MapPin },
  { key: 'email',    Icon: Mail },
  { key: 'phone',    Icon: Phone },
  { key: 'website',  Icon: Globe },
  { key: 'linkedin', Icon: Link2 },
  { key: 'github',   Icon: Github },
  { key: 'wechat',   Icon: MessageCircle },
  { key: 'qq',       Icon: AtSign },
]

const BUILTIN_PERSONAL_FIELDS = [
  { key: 'full_name', label: 'Full name' },
  { key: 'job_title', label: 'Job title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'website', label: 'Website' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'github', label: 'GitHub' },
  { key: 'wechat', label: 'WeChat' },
  { key: 'qq', label: 'QQ' },
]

// Quick-add presets for custom fields
const PRESET_EXTRAS = [
  { icon: 'gender',      label: 'Gender'      },
  { icon: 'instagram',   label: 'Instagram'   },
  { icon: 'twitter',     label: 'Twitter/X'   },
  { icon: 'telegram',    label: 'Telegram'    },
  { icon: 'discord',     label: 'Discord'     },
  { icon: 'nationality', label: 'Nationality' },
  { icon: 'birthday',    label: 'Birthday'    },
]

const EXTRA_ICON_REGISTRY = {
  gender: User,
  instagram: Instagram,
  twitter: AtSign,
  telegram: Send,
  discord: Gamepad2,
  nationality: Globe2,
  birthday: Cake,
  custom: Sparkles,
}

const BUILTIN_FIELD_ICON_KEY = {
  full_name: 'custom',
  job_title: 'custom',
  email: 'custom',
  phone: 'custom',
  location: 'nationality',
  website: 'nationality',
  linkedin: 'custom',
  github: 'custom',
  wechat: 'custom',
  qq: 'custom',
}

const LEGACY_ICON_TO_KEY = {
  '⚧': 'gender',
  '📸': 'instagram',
  '𝕏': 'twitter',
  '✈️': 'telegram',
  '🎮': 'discord',
  '🌏': 'nationality',
  '🎂': 'birthday',
}

const LABEL_TO_ICON_KEY = {
  gender: 'gender',
  instagram: 'instagram',
  'twitter/x': 'twitter',
  twitter: 'twitter',
  telegram: 'telegram',
  discord: 'discord',
  nationality: 'nationality',
  birthday: 'birthday',
}

function resolveExtraIconKey(field = {}) {
  if (field.icon && EXTRA_ICON_REGISTRY[field.icon]) return field.icon
  if (field.icon && LEGACY_ICON_TO_KEY[field.icon]) return LEGACY_ICON_TO_KEY[field.icon]
  const byLabel = LABEL_TO_ICON_KEY[String(field.label || '').trim().toLowerCase()]
  return byLabel || 'custom'
}

function ExtraFieldIcon({ field, size = 13, className = '' }) {
  const Icon = EXTRA_ICON_REGISTRY[resolveExtraIconKey(field)] || Sparkles
  return <Icon size={size} className={className} />
}

// ─── Personal preview card ────────────────────────────────────────────────────

function PersonalPreviewCard({ P, onEdit }) {
  const visibleContacts = PREVIEW_FIELDS.filter(({ key }) => P[key])
  const visibleExtras   = (P.extra_fields || []).filter((f) => f.value)
  const empty = visibleContacts.length === 0 && visibleExtras.length === 0

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6">
        {/* Edit button */}
        <button
          onClick={onEdit}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors shadow-sm"
          title="Edit personal details"
        >
          <Pencil size={14}/>
        </button>

        {/* Name + job title */}
        <div className="mb-5 pr-12">
          {P.full_name ? (
            <h2 className="text-2xl font-bold text-gray-900 leading-snug">{P.full_name}</h2>
          ) : (
            <h2 className="text-lg font-normal text-gray-300 italic">Your Name</h2>
          )}
          {P.job_title && (
            <p className="text-sm text-gray-400 mt-0.5">{P.job_title}</p>
          )}
        </div>

        {/* Photo + contacts */}
        <div className="flex gap-5">
          {/* Photo */}
          <div className="flex-shrink-0">
            {P.photo_url ? (
              <img
                src={P.photo_url}
                className="w-[88px] h-[108px] object-cover rounded-lg border border-gray-100"
              />
            ) : (
              <div className="w-[88px] h-[108px] rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                <User size={24} className="text-gray-300"/>
              </div>
            )}
          </div>

          {/* Contact list */}
          <div className="flex flex-col gap-2 min-w-0 flex-1 justify-center">
            {visibleContacts.map(({ key, Icon }) => (
              <div key={key} className="flex items-center gap-2.5">
                <Icon size={13} className="text-indigo-400 flex-shrink-0"/>
                <span className="text-xs text-gray-700 truncate">{P[key]}</span>
              </div>
            ))}
            {visibleExtras.map((f) => (
              <div key={f.id || f.label} className="flex items-center gap-2.5">
                <ExtraFieldIcon field={f} className="text-indigo-400 flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate">{f.value}</span>
              </div>
            ))}
            {empty && (
              <p className="text-xs text-gray-300 italic">Click ✏ to add contact info</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Personal edit form ───────────────────────────────────────────────────────

function PersonalEditForm({ profile, setProfile, onDone }) {
  const updatePersonal = useResumeStore((s) => s.updatePersonal)
  const [photoBusy, setPhotoBusy]   = useState(false)
  const [photoErr,  setPhotoErr]    = useState('')
  const [doneBusy, setDoneBusy] = useState(false)
  const latestProfileRef = useRef(profile)
  const latestPersonalRef = useRef(profile.personal || {})

  const P = profile.personal || {}

  useEffect(() => {
    latestProfileRef.current = profile
    latestPersonalRef.current = profile.personal || {}
  }, [profile])

  const update = (patch) => {
    const nextPersonal = { ...(latestPersonalRef.current || {}), ...patch }
    latestPersonalRef.current = nextPersonal
    const nextProfile = { ...(latestProfileRef.current || {}), personal: nextPersonal }
    latestProfileRef.current = nextProfile
    setProfile(nextProfile)
    updatePersonal(patch)
  }

  const setExtras = (extras) => update({ extra_fields: extras })
  const hiddenFields = Array.isArray(P.hidden_fields)
    ? P.hidden_fields
    : (Array.isArray(P.hidden_builtin_fields) ? P.hidden_builtin_fields : [])

  const addExtra = (preset = null) => {
    const f = preset
      ? { id: uid(), icon: preset.icon, label: preset.label, value: '' }
      : { id: uid(), icon: '', label: '', value: '' }
    setExtras([...(P.extra_fields || []), f])
  }

  const patchExtra = (id, patch) =>
    setExtras((P.extra_fields || []).map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const removeExtra = (id) =>
    setExtras((P.extra_fields || []).filter((f) => f.id !== id))

  const removeBuiltin = (fieldKey) => {
    if (hiddenFields.includes(fieldKey)) return
    update({
      [fieldKey]: '',
      hidden_fields: [...hiddenFields, fieldKey],
    })
  }

  const restoreBuiltin = (fieldKey) => {
    update({
      hidden_fields: hiddenFields.filter((k) => k !== fieldKey),
    })
  }

  const visibleBuiltinFields = BUILTIN_PERSONAL_FIELDS.filter((f) => !hiddenFields.includes(f.key))
  const hiddenBuiltinFields = BUILTIN_PERSONAL_FIELDS.filter((f) => hiddenFields.includes(f.key))

  const uploadPhoto = async (file) => {
    if (!file) return
    setPhotoBusy(true); setPhotoErr('')
    try {
      const { url } = await api.uploadPhoto(file)
      const nextPersonal = { ...(latestPersonalRef.current || {}), photo_url: url }
      latestPersonalRef.current = nextPersonal
      const next = { ...(latestProfileRef.current || {}), personal: nextPersonal }
      latestProfileRef.current = next
      setProfile(next)
      updatePersonal({ photo_url: url })
      try { await api.saveProfile(next) } catch { /* silent */ }
    } catch (e) {
      setPhotoErr(String(e.message || e))
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleDone = async () => {
    setDoneBusy(true)
    try {
      const localProfile = latestProfileRef.current || profile || {}
      const localPersonal = latestPersonalRef.current || localProfile.personal || {}
      const latest = await api.getProfile().catch(() => ({}))
      const payload = mergeProfilePreservingUntouched(latest, localProfile)
      payload.personal = { ...(payload.personal || {}), ...localPersonal }
      const saved = await api.saveProfile(payload)
      setProfile(saved)
      if (saved?.personal) updatePersonal(saved.personal)
      onDone()
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setDoneBusy(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <User size={13} className="text-indigo-500"/>
          <span className="text-[11px] font-semibold text-gray-900 uppercase tracking-[0.15em]">Personal details</span>
        </div>
      </div>

      <div className="p-3.5 flex flex-col gap-4">
        {/* Photo */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {P.photo_url ? (
              <img src={P.photo_url}
                onError={(e) => { e.currentTarget.style.display='none'; setPhotoErr('Image failed to load.') }}
                className="w-16 h-16 rounded-full object-cover border border-gray-200"/>
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                <User size={22}/>
              </div>
            )}
            <label className={'cursor-pointer text-xs flex items-center gap-1 ' +
              (photoBusy ? 'text-gray-400 pointer-events-none' : 'text-indigo-500 hover:text-indigo-700')}>
              <Upload size={12}/>
              {photoBusy ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" disabled={photoBusy}
                onChange={(e) => uploadPhoto(e.target.files?.[0])}/>
            </label>
            {P.photo_url && (
              <button className="text-xs text-gray-400 hover:text-red-400" onClick={() => update({ photo_url: '' })}>
                Remove
              </button>
            )}
          </div>
          {photoErr && (
            <div className="text-[11px] text-red-400 bg-red-50 border border-red-100 rounded px-2 py-1.5">{photoErr}</div>
          )}
        </div>

        {/* Built-in fields, now entry-style like custom fields */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">
            Personal entries
          </div>
          {visibleBuiltinFields.map((field) => (
            <div key={field.key} className="flex items-center gap-1.5">
              <div className="h-9 w-9 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
                <ExtraFieldIcon field={{ icon: BUILTIN_FIELD_ICON_KEY[field.key] || 'custom' }} size={14} />
              </div>
              <div className="w-28 h-9 border border-gray-200 rounded-xl px-2.5 text-xs bg-gray-50 text-gray-500 flex items-center">
                {field.label}
              </div>
              <input
                type="text"
                value={P[field.key] || ''}
                onChange={(e) => update({ [field.key]: e.target.value })}
                placeholder="Value"
                className="flex-1 h-9 border border-gray-200 rounded-xl px-2.5 text-xs bg-white focus:border-indigo-400 focus:outline-none"
              />
              <button
                onClick={() => removeBuiltin(field.key)}
                className="h-9 w-9 flex items-center justify-center border border-transparent rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50"
                title={`Remove ${field.label}`}
              >
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>

        {/* Custom / extra fields */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">
            Custom fields
          </div>

          {(P.extra_fields || []).map((f) => (
            <div key={f.id} className="flex items-center gap-1.5">
              <div className="h-9 w-9 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
                <ExtraFieldIcon field={f} size={14} />
              </div>
              <input
                type="text"
                value={f.label || ''}
                onChange={(e) => patchExtra(f.id, { label: e.target.value })}
                placeholder="Label"
                className="w-28 h-9 border border-gray-200 rounded-xl px-2.5 text-xs bg-white focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="text"
                value={f.value || ''}
                onChange={(e) => patchExtra(f.id, { value: e.target.value })}
                placeholder="Value"
                className="flex-1 h-9 border border-gray-200 rounded-xl px-2.5 text-xs bg-white focus:border-indigo-400 focus:outline-none"
              />
              <button
                onClick={() => removeExtra(f.id)}
                className="h-9 w-9 flex items-center justify-center border border-transparent rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50"
              >
                <Trash2 size={13}/>
              </button>
            </div>
          ))}

          {/* Preset quick-add buttons */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {hiddenBuiltinFields.map((field) => (
              <button
                key={field.key}
                onClick={() => restoreBuiltin(field.key)}
                className="flex items-center gap-1 text-[11px] border border-gray-200 rounded-lg px-2 py-1 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <ExtraFieldIcon field={{ icon: BUILTIN_FIELD_ICON_KEY[field.key] || 'custom' }} size={12} />
                <span>{field.label}</span>
              </button>
            ))}
            {PRESET_EXTRAS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => addExtra(preset)}
                className="flex items-center gap-1 text-[11px] border border-gray-200 rounded-lg px-2 py-1 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <ExtraFieldIcon field={preset} size={12} />
                <span>{preset.label}</span>
              </button>
            ))}
            <button
              onClick={() => addExtra()}
              className="flex items-center gap-1 text-[11px] border border-dashed border-gray-200 rounded-lg px-2 py-1 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Plus size={10}/> Custom
            </button>
          </div>
        </div>

        <button
          onClick={handleDone}
          disabled={doneBusy}
          className={
            'w-full mt-1 h-10 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ' +
            (doneBusy ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700')
          }
        >
          <Check size={14}/> {doneBusy ? 'Saving…' : 'Done'}
        </button>
      </div>
    </div>
  )
}

// ─── PersonalPane — switches between preview and edit ─────────────────────────

function PersonalPane({ profile, setProfile }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <PersonalEditForm
        profile={profile}
        setProfile={setProfile}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <PersonalPreviewCard
      P={profile.personal || {}}
      onEdit={() => setEditing(true)}
    />
  )
}

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({ poolKey, entry, onChange, onRemove, onImport }) {
  const primary = {
    experiences: 'position',
    projects: 'name',
    educations: 'school',
    awards: 'title',
    summaries: null,
    skills: 'category',
  }[poolKey]
  const secondary = {
    experiences: 'company',
    projects: 'role',
    educations: 'degree',
    awards: 'issuer',
  }[poolKey]

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
        <div className="flex-1 text-sm font-medium text-gray-900 truncate">
          {primary ? (entry[primary] || 'Untitled') : 'Summary'}
          {secondary && entry[secondary] ? <span className="text-zinc-500"> · {entry[secondary]}</span> : null}
        </div>
        <button
          onClick={() => onImport(entry)}
          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          title="Add to current resume"
        >
          <ArrowRight size={11}/> Use in resume
        </button>
        <button onClick={onRemove} className="p-1 rounded hover:bg-red-500/10 text-red-400">
          <Trash2 size={12}/>
        </button>
      </div>
      <div className="p-3 flex flex-col gap-2.5">
        {poolKey === 'experiences' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label="Position" value={entry.position} onChange={(v) => onChange({ position: v })}/>
            <TextField label="Company"  value={entry.company}  onChange={(v) => onChange({ company: v })}/>
            <TextField label="Start"    value={entry.start_date} onChange={(v) => onChange({ start_date: v })}/>
            <TextField label="End"      value={entry.end_date}   onChange={(v) => onChange({ end_date: v })}/>
          </div>
        )}
        {poolKey === 'projects' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label="Name" value={entry.name} onChange={(v) => onChange({ name: v })}/>
            <TextField label="Role" value={entry.role} onChange={(v) => onChange({ role: v })}/>
            <TextField label="Start" value={entry.start_date} onChange={(v) => onChange({ start_date: v })}/>
            <TextField label="End"   value={entry.end_date}   onChange={(v) => onChange({ end_date: v })}/>
            <div className="col-span-2">
              <TextField label="Link" value={entry.link} onChange={(v) => onChange({ link: v })}/>
            </div>
          </div>
        )}
        {poolKey === 'educations' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label="School" value={entry.school} onChange={(v) => onChange({ school: v })}/>
            <TextField label="Degree" value={entry.degree} onChange={(v) => onChange({ degree: v })}/>
            <TextField label="Start" value={entry.start_date} onChange={(v) => onChange({ start_date: v })}/>
            <TextField label="End"   value={entry.end_date}   onChange={(v) => onChange({ end_date: v })}/>
          </div>
        )}
        {poolKey === 'awards' && (
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label="Title"  value={entry.title}  onChange={(v) => onChange({ title: v })}/>
            <TextField label="Issuer" value={entry.issuer} onChange={(v) => onChange({ issuer: v })}/>
            <TextField label="Date"   value={entry.date}   onChange={(v) => onChange({ date: v })}/>
          </div>
        )}
        {poolKey === 'skills' && (
          <>
            <TextField label="Category" value={entry.category} onChange={(v) => onChange({ category: v })}/>
            <TextArea label="Items (comma separated)"
              value={(entry.items || []).join(', ')}
              onChange={(v) => onChange({ items: v.split(',').map((x) => x.trim()).filter(Boolean) })}
              rows={2}/>
          </>
        )}

        {['experiences','projects','educations','summaries'].includes(poolKey) && (
          <div>
            <div className="panel-title mb-1.5">Description</div>
            <RichTextEditor
              value={poolKey === 'summaries' ? entry.content : entry.description}
              onChange={(v) => onChange(poolKey === 'summaries' ? { content: v } : { description: v })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ProfilePanel ─────────────────────────────────────────────────────────────

export default function ProfilePanel() {
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
      .then((p) => {
        const loaded = p || {}
        setProfile(loaded)
      })
      .catch((e) => alert('Failed to load profile: ' + e.message))
  }, [])

  if (!profile) {
    return <div className="p-4 text-sm text-zinc-500">Loading profile library…</div>
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
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-20 px-4 py-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Profile library</div>
            <div className="text-[11px] text-zinc-500">
              Persistent pool of your history. Reuse entries across resumes.
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 pt-3 flex flex-col gap-3">
        <div className="panel-title pt-2">Entries</div>

        <div className="flex flex-wrap gap-1.5">
          {POOLS.map(({ key, label, Icon }) => {
            const active = openPool === key
            return (
              <button key={key}
                onClick={() => setOpenPool(key)}
                className={'chip ' + (active ? 'chip-active' : '')}
              >
                <Icon size={11}/> {label}
                <span className={'tabular-nums text-[10px] ' + (active ? 'text-cyan-300' : 'text-zinc-500')}>
                  {(profile[key] || []).length}
                </span>
              </button>
            )
          })}
        </div>

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
              className="flex items-center justify-center gap-1.5 text-sm text-indigo-500 border border-dashed border-gray-200 rounded-lg py-2.5 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <Plus size={14}/> Add entry
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
