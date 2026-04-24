import { useState, useEffect } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { TextField, TextArea, Toggle, SelectField } from '../common/Fields'
import RichTextEditor from './RichTextEditor'
import { api } from '../../api'
import { Sparkles, ChevronUp } from 'lucide-react'
import { useT } from '../../i18n'

function Row({ children }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function DescriptionEditor({ value, onChange, jd, language }) {
  const [busy, setBusy] = useState(false)
  const [llmReady, setLlmReady] = useState(false)
  useEffect(() => { api.llmStatus().then((s) => setLlmReady(s.configured)).catch(() => {}) }, [])

  const improve = async () => {
    const plain = (value || '').replace(/<[^>]+>/g, '').trim()
    if (!plain) return
    setBusy(true)
    try {
      const { text } = await api.improve(plain, jd || '', language || 'en')
      onChange(`<p>${text}</p>`)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="panel-title">Description</div>
        {llmReady && (
          <button
            onClick={improve}
            disabled={busy}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
          >
            <Sparkles size={11}/> {busy ? 'Improving…' : 'AI improve'}
          </button>
        )}
      </div>
      <RichTextEditor value={value} onChange={onChange}/>
    </div>
  )
}

// ---------- Per-type field sets ----------

function EducationFields({ entry, set, t }) {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <TextField label="School"   value={entry.school} onChange={(v) => set({ school: v })}/>
        <TextField label="Degree"   value={entry.degree} onChange={(v) => set({ degree: v })}/>
      </Row>
      <Row>
        <TextField label="Field of study" value={entry.field_of_study} onChange={(v) => set({ field_of_study: v })}/>
        <TextField label="Location"       value={entry.location}       onChange={(v) => set({ location: v })}/>
      </Row>
      <Row>
        <TextField label="Start date" value={entry.start_date} onChange={(v) => set({ start_date: v })} placeholder="2021-09"/>
        <TextField label="End date"   value={entry.end_date}   onChange={(v) => set({ end_date: v })}   placeholder="Present"/>
      </Row>
      <Row>
        <TextField label="GPA" value={entry.gpa} onChange={(v) => set({ gpa: v })}/>
        <div className="flex items-end pb-1">
          <Toggle label="Full-time" value={entry.is_full_time} onChange={(v) => set({ is_full_time: v })}/>
        </div>
      </Row>
      <DescriptionEditor value={entry.description} onChange={(v) => set({ description: v })}/>
    </div>
  )
}

function ExperienceFields({ entry, set }) {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <TextField label="Position" value={entry.position} onChange={(v) => set({ position: v })}/>
        <TextField label="Company"  value={entry.company}  onChange={(v) => set({ company: v })}/>
      </Row>
      <Row>
        <TextField label="Location" value={entry.location} onChange={(v) => set({ location: v })}/>
        <div className="flex items-end pb-1">
          <Toggle label="Currently working here" value={entry.currently_working} onChange={(v) => set({ currently_working: v })}/>
        </div>
      </Row>
      <Row>
        <TextField label="Start date" value={entry.start_date} onChange={(v) => set({ start_date: v })}/>
        <TextField label="End date"   value={entry.end_date}   onChange={(v) => set({ end_date: v })}/>
      </Row>
      <DescriptionEditor value={entry.description} onChange={(v) => set({ description: v })}/>
    </div>
  )
}

function ProjectFields({ entry, set }) {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <TextField label="Project name" value={entry.name} onChange={(v) => set({ name: v })}/>
        <TextField label="Role"         value={entry.role} onChange={(v) => set({ role: v })}/>
      </Row>
      <Row>
        <TextField label="Start date" value={entry.start_date} onChange={(v) => set({ start_date: v })}/>
        <TextField label="End date"   value={entry.end_date}   onChange={(v) => set({ end_date: v })}/>
      </Row>
      <TextField label="Link" value={entry.link} onChange={(v) => set({ link: v })} placeholder="https://…"/>
      <DescriptionEditor value={entry.description} onChange={(v) => set({ description: v })}/>
    </div>
  )
}

function SkillFields({ entry, set }) {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <TextField label="Category" value={entry.category} onChange={(v) => set({ category: v })}/>
        <SelectField label="Level" value={entry.level || ''} onChange={(v) => set({ level: v })}
          options={[{value:'',label:'—'},'Beginner','Intermediate','Advanced','Expert']}/>
      </Row>
      <TextArea
        label="Items (comma-separated)"
        value={(entry.items || []).join(', ')}
        onChange={(v) => set({ items: v.split(',').map((x) => x.trim()).filter(Boolean) })}
        rows={2}/>
    </div>
  )
}

function AwardFields({ entry, set }) {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <TextField label="Title"  value={entry.title}  onChange={(v) => set({ title: v })}/>
        <TextField label="Issuer" value={entry.issuer} onChange={(v) => set({ issuer: v })}/>
      </Row>
      <TextField label="Date" value={entry.date} onChange={(v) => set({ date: v })}/>
      <TextArea label="Description" value={entry.description} onChange={(v) => set({ description: v })} rows={3}/>
    </div>
  )
}

function SummaryFields({ entry, set }) {
  return <DescriptionEditor value={entry.content} onChange={(v) => set({ content: v })}/>
}

function CustomFields({ entry, set }) {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <TextField label="Title"    value={entry.title}    onChange={(v) => set({ title: v })}/>
        <TextField label="Subtitle" value={entry.subtitle} onChange={(v) => set({ subtitle: v })}/>
      </Row>
      <TextField label="Date" value={entry.date} onChange={(v) => set({ date: v })}/>
      <DescriptionEditor value={entry.description} onChange={(v) => set({ description: v })}/>
    </div>
  )
}

const FIELDS = {
  education: EducationFields,
  experience: ExperienceFields,
  projects: ProjectFields,
  skills: SkillFields,
  awards: AwardFields,
  summary: SummaryFields,
  custom: CustomFields,
}

/** Inline editor: expanded panel that drops down below a clicked entry row. */
export default function InlineEntryEditor({ moduleId, entryId, onClose }) {
  const t = useT()
  const mod   = useResumeStore((s) => s.resume.modules.find((m) => m.id === moduleId))
  const entry = mod?.entries.find((e) => e.id === entryId)
  const updateEntry = useResumeStore((s) => s.updateEntry)

  if (!mod || !entry) return null
  const Fields = FIELDS[mod.type] || CustomFields
  const set = (patch) => updateEntry(moduleId, entryId, patch)

  return (
    <div className="border-l-2 border-cyan-400/40 bg-ink-800/60 rounded-r-md overflow-hidden animate-[fadeIn_0.15s_ease-out]">
      <div className="flex items-center justify-between px-4 py-2 bg-cyan-400/5 border-b border-white/5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono">Editing entry</div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
          title="Collapse">
          <ChevronUp size={14}/>
        </button>
      </div>
      <div className="p-4">
        <Fields entry={entry} set={set} t={t}/>
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="w-32">
            <Toggle label="Hidden" value={entry.hidden} onChange={(v) => set({ hidden: v })}/>
          </div>
          <button onClick={onClose} className="btn-secondary">Done</button>
        </div>
      </div>
    </div>
  )
}
