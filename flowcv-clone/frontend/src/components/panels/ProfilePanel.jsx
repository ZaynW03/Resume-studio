import { useEffect, useState } from 'react'
import { api } from '../../api'
import { Button, TextField, TextArea } from '../common/Fields'
import RichTextEditor from '../editor/RichTextEditor'
import {
  Briefcase, FolderGit2, GraduationCap, Wrench, Award, FileText,
  Plus, Trash2, Save, ArrowRight, User, Upload,
  ArrowRightLeft, CheckCircle2,
} from 'lucide-react'
import { useResumeStore, EMPTY_ENTRY } from '../../store/resumeStore'

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

// Top pane: authoritative personal details, stored in the profile library.
function PersonalPane({ profile, setProfile, setDirty, onSaveProfile }) {
  const syncFromProfile = useResumeStore((s) => s.syncPersonalFromProfile)
  const [justSynced, setJustSynced] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState('')

  const P = profile.personal || {}

  const update = (patch) => {
    setProfile((p) => ({ ...p, personal: { ...(p.personal || {}), ...patch } }))
    setDirty(true)
  }

  const uploadPhoto = async (file) => {
    if (!file) return
    setPhotoBusy(true); setPhotoErr('')
    try {
      const { url } = await api.uploadPhoto(file)
      // Update local state
      const nextProfile = { ...profile, personal: { ...(profile.personal || {}), photo_url: url } }
      setProfile(nextProfile)
      setDirty(true)
      // Auto-save so the photo_url persists across reloads
      try { await api.saveProfile(nextProfile) } catch { /* ignore; user can manually save */ }
    } catch (e) {
      setPhotoErr(String(e.message || e))
    } finally {
      setPhotoBusy(false)
    }
  }

  const onSync = () => {
    syncFromProfile(P)
    setJustSynced(true)
    setTimeout(() => setJustSynced(false), 1500)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/5">
        <User size={13} className="text-cyan-400"/>
        <div className="text-[11px] font-semibold text-zinc-100 uppercase tracking-[0.15em]">
          Personal details
        </div>
        <div className="flex-1"/>
        <button
          onClick={onSync}
          className={
            'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ' +
            (justSynced
              ? 'bg-green-400/10 text-green-400'
              : 'bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20')
          }
          title="Apply these personal details to the resume currently being edited"
        >
          {justSynced ? <CheckCircle2 size={11}/> : <ArrowRightLeft size={11}/>}
          {justSynced ? 'Synced' : 'Sync to current resume'}
        </button>
      </div>

      <div className="p-3.5 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {P.photo_url ? (
              <img src={P.photo_url}
                onError={(e) => { e.currentTarget.style.display = 'none'; setPhotoErr(`Image failed to load from ${P.photo_url} — backend not running or proxy misconfigured.`) }}
                className="w-16 h-16 rounded-full object-cover border border-white/10"/>
            ) : (
              <div className="w-16 h-16 rounded-full bg-ink-800 border border-white/10 flex items-center justify-center text-zinc-600">
                <User size={24}/>
              </div>
            )}
            <label className={
              "cursor-pointer text-xs flex items-center gap-1 " +
              (photoBusy ? "text-zinc-500 pointer-events-none" : "text-cyan-400 hover:text-cyan-300")
            }>
              <Upload size={12}/>
              {photoBusy ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" disabled={photoBusy}
                onChange={(e) => uploadPhoto(e.target.files?.[0])}/>
            </label>
            {P.photo_url && (
              <button className="text-xs text-zinc-500 hover:text-red-400" onClick={() => update({ photo_url: '' })}>
                Remove
              </button>
            )}
          </div>
          {photoErr && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5">
              {photoErr}
              <div className="text-red-300/70 mt-0.5">
                Check <a href="http://localhost:8000/api/diagnostics" target="_blank" rel="noreferrer"
                  className="underline hover:text-cyan-400">diagnostics</a>.
              </div>
            </div>
          )}
          {P.photo_url && !photoErr && (
            <div className="text-[10px] text-zinc-500 font-mono truncate">
              ✓ saved at {P.photo_url}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Full name" value={P.full_name} onChange={(v) => update({ full_name: v })}/>
          <TextField label="Job title" value={P.job_title} onChange={(v) => update({ job_title: v })}/>
          <TextField label="Email"     value={P.email}     onChange={(v) => update({ email: v })}/>
          <TextField label="Phone"     value={P.phone}     onChange={(v) => update({ phone: v })}/>
          <TextField label="Location"  value={P.location}  onChange={(v) => update({ location: v })}/>
          <TextField label="Website"   value={P.website}   onChange={(v) => update({ website: v })}/>
          <TextField label="LinkedIn"  value={P.linkedin}  onChange={(v) => update({ linkedin: v })}/>
          <TextField label="GitHub"    value={P.github}    onChange={(v) => update({ github: v })}/>
          <TextField label="WeChat"    value={P.wechat}    onChange={(v) => update({ wechat: v })}/>
          <TextField label="QQ"        value={P.qq}        onChange={(v) => update({ qq: v })}/>
        </div>

        <div className="text-[10px] text-zinc-500">
          Stored once here, reused across resumes. Click
          <span className="text-cyan-400"> Sync to current resume </span>
          after editing to push these values into the resume you&apos;re working on.
        </div>
      </div>
    </div>
  )
}

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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-ink-900/50">
        <div className="flex-1 text-sm font-medium text-zinc-100 truncate">
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

export default function ProfilePanel() {
  const [profile, setProfile] = useState(null)
  const [openPool, setOpenPool] = useState('experiences')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

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

  const save = async () => {
    setBusy(true)
    try {
      const latest = await api.getProfile().catch(() => ({}))
      const saved = await api.saveProfile(mergeProfilePreservingUntouched(latest, profile))
      setProfile(saved)
      setDirty(false)
    }
    catch (e) { alert('Save failed: ' + e.message) }
    finally { setBusy(false) }
  }

  if (!profile) {
    return <div className="p-4 text-sm text-zinc-500">Loading profile library…</div>
  }

  const update = (poolKey, idx, patch) => {
    setProfile((p) => {
      const next = { ...p }
      next[poolKey] = next[poolKey].map((e, i) => (i === idx ? { ...e, ...patch } : e))
      return next
    })
    setDirty(true)
  }
  const remove = (poolKey, idx) => {
    setProfile((p) => ({ ...p, [poolKey]: p[poolKey].filter((_, i) => i !== idx) }))
    setDirty(true)
  }
  const add = (poolKey, factory) => {
    setProfile((p) => ({ ...p, [poolKey]: [...(p[poolKey] || []), factory()] }))
    setDirty(true)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-20 px-4 py-4 bg-ink-900/95 backdrop-blur supports-[backdrop-filter]:bg-ink-900/85 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Profile library</div>
            <div className="text-[11px] text-zinc-500">
              Persistent pool of your history. Reuse entries across resumes.
            </div>
          </div>
          <Button onClick={save} disabled={!dirty || busy}>
            <Save size={12}/> {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="p-4 pt-3 flex flex-col gap-3">
        <PersonalPane profile={profile} setProfile={setProfile} setDirty={setDirty}/>

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
              className="flex items-center justify-center gap-1.5 text-sm text-cyan-400 border border-dashed border-white/10 rounded py-2.5 hover:border-cyan-400/50 hover:bg-cyan-400/5"
            >
              <Plus size={14}/> Add entry
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
