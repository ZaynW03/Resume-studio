import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Eye, EyeOff, Trash2, Plus, ChevronDown, ChevronUp,
  Scissors, User, Pencil,
} from 'lucide-react'

import { useResumeStore, MODULE_BLUEPRINTS } from '../../store/resumeStore'
import Icon from '../common/Icon'
import LibraryPickerModal from '../common/LibraryPickerModal'
import InlineEntryEditor from './InlineEntryEditor'
import { useT } from '../../i18n'

const uid = () => Math.random().toString(36).slice(2, 14)

// ─── 6-dot drag handle icon ────────────────────────────────────────────────

function GripDots({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2.5" cy="2"  r="1.4"/>
      <circle cx="7.5" cy="2"  r="1.4"/>
      <circle cx="2.5" cy="8"  r="1.4"/>
      <circle cx="7.5" cy="8"  r="1.4"/>
      <circle cx="2.5" cy="14" r="1.4"/>
      <circle cx="7.5" cy="14" r="1.4"/>
    </svg>
  )
}

// ─── Personal details data ─────────────────────────────────────────────────

const BUILTIN_PERSONAL_FIELDS = [
  { key: 'full_name', label: 'Full name' },
  { key: 'job_title', label: 'Job title' },
  { key: 'email',     label: 'Email' },
  { key: 'phone',     label: 'Phone' },
  { key: 'location',  label: 'Location' },
  { key: 'website',   label: 'Website' },
  { key: 'linkedin',  label: 'LinkedIn' },
  { key: 'github',    label: 'GitHub' },
  { key: 'wechat',    label: 'WeChat' },
  { key: 'qq',        label: 'QQ' },
]

const PRESET_EXTRAS = [
  { icon: 'gender',      label: 'Gender' },
  { icon: 'instagram',   label: 'Instagram' },
  { icon: 'twitter',     label: 'Twitter/X' },
  { icon: 'telegram',    label: 'Telegram' },
  { icon: 'discord',     label: 'Discord' },
  { icon: 'nationality', label: 'Nationality' },
  { icon: 'birthday',    label: 'Birthday' },
]

const EXTRA_ICON_MAP = {
  gender: '⚧', instagram: '📸', twitter: '@', telegram: '✈',
  discord: '🎮', nationality: '🌏', birthday: '🎂', custom: '✦',
}

const CONTACT_ICONS = {
  location: '📍', email: '✉', phone: '📞', date_of_birth: '🎂',
  website: '🌐', linkedin: '🔗', github: '💻', wechat: '💬', qq: '🐧',
}

const toExtraToken = (id) => `extra:${id}`

// ─── Entry helpers ─────────────────────────────────────────────────────────

function entryLabel(type, e) {
  switch (type) {
    case 'education':  return [e.school, e.degree].filter(Boolean).join(', ') || 'Untitled school'
    case 'experience': return e.position ? `${e.position}${e.company ? ' · ' + e.company : ''}` : (e.company || 'Untitled role')
    case 'projects':   return e.name || 'Untitled project'
    case 'skills':     return e.category || (e.items?.length ? e.items.join(', ').slice(0, 40) : 'Skill group')
    case 'awards':     return e.title || 'Untitled award'
    case 'summary':    return (e.content || '').replace(/<[^>]+>/g, '').slice(0, 50) || 'Summary'
    default:           return e.title || 'Untitled'
  }
}

// ─── EntryRow ──────────────────────────────────────────────────────────────

function EntryRow({ mod, entry, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id })
  const updateEntry = useResumeStore((s) => s.updateEntry)
  const t           = useT()
  const [open, setOpen] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col border-t border-gray-100">
      {/* Row */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50/80 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <button
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          {...attributes} {...listeners}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <GripDots size={12}/>
        </button>

        <span className={
          'flex-1 text-sm truncate ' +
          (entry.hidden ? 'text-gray-300 line-through' : 'text-gray-800 font-medium')
        }>
          {entryLabel(mod.type, entry)}
        </span>

        <button
          className={'p-1 rounded transition-colors flex-shrink-0 ' +
            (entry.hidden ? 'text-gray-300 hover:text-gray-500' : 'text-gray-400 hover:text-gray-600')}
          onClick={(e) => { e.stopPropagation(); updateEntry(mod.id, entry.id, { hidden: !entry.hidden }) }}
          title={entry.hidden ? 'Show' : 'Hide'}
        >
          {entry.hidden ? <EyeOff size={15}/> : <Eye size={15}/>}
        </button>
      </div>

      {/* Inline editor */}
      {open && (
        <div className="border-t border-gray-100">
          <InlineEntryEditor
            moduleId={mod.id}
            entryId={entry.id}
            onClose={() => setOpen(false)}
            onDelete={() => { if (confirm(t('module.delete_confirm'))) { onDelete(); setOpen(false) } }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Page-break marker ────────────────────────────────────────────────────

function PageBreakCard({ mod }) {
  const removeModule = useResumeStore((s) => s.removeModule)
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-dashed border-amber-300/60 bg-amber-50">
      <Scissors size={13} className="text-amber-400"/>
      <div className="flex-1 text-xs text-amber-500 font-mono uppercase tracking-[0.15em]">
        page break
      </div>
      <button
        className="p-1 rounded hover:bg-red-50 text-red-300 hover:text-red-400 transition-colors"
        onClick={() => { if (confirm('Remove page break?')) removeModule(mod.id) }}
      >
        <Trash2 size={13}/>
      </button>
    </div>
  )
}

// ─── PersonalFieldRow (original style) ────────────────────────────────────

const BUILTIN_ENTRY_META = {
  full_name: { label: 'Full name', icon: '👤' },
  job_title: { label: 'Job title', icon: '💼' },
  location:  { label: 'Location',  icon: '📍' },
  email:     { label: 'Email',     icon: '✉'  },
  phone:     { label: 'Phone',     icon: '📞' },
  website:   { label: 'Website',   icon: '🌐' },
  linkedin:  { label: 'LinkedIn',  icon: '🔗' },
  github:    { label: 'GitHub',    icon: '💻' },
  wechat:    { label: 'WeChat',    icon: '💬' },
  qq:        { label: 'QQ',        icon: '🐧' },
}

function PersonalFieldRow({
  field, label, icon, value, visible, isCustom,
  onToggle, onValueChange, onLabelChange, onRemove, canRemove,
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-gray-800 mb-1">
            {isCustom ? (
              <input
                value={label || ''}
                onChange={(e) => onLabelChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Label"
                className="w-40 bg-transparent outline-none text-[13px] font-semibold text-gray-800 placeholder:text-zinc-400"
              />
            ) : (
              t(`field.${field}`, label || field)
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-sm flex items-center justify-center text-gray-500">
              {icon || '•'}
            </div>
            <div className={
              'flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm truncate ' +
              (visible ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-zinc-400 line-through')
            }>
              <input
                value={value || ''}
                onChange={(e) => onValueChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Empty"
                className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-zinc-400"
              />
            </div>
            <button
              className={'p-1.5 rounded-lg transition-colors flex-shrink-0 ' +
                (visible ? 'text-indigo-500 hover:bg-indigo-50' : 'text-zinc-300 hover:bg-gray-100')}
              onClick={() => onToggle(!visible)}
              title={visible ? 'Hide from resume' : 'Show on resume'}
            >
              {visible ? <Eye size={16}/> : <EyeOff size={16}/>}
            </button>
            {canRemove && (
              <button
                className="p-1.5 rounded-lg transition-colors flex-shrink-0 text-zinc-300 hover:text-red-400 hover:bg-red-50"
                onClick={() => onRemove()}
                title="Delete field"
              >
                <Trash2 size={14}/>
              </button>
            )}
            <button
              className="text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing flex-shrink-0 p-1"
              {...attributes} {...listeners}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/><path d="M8 8l4-4 4 4"/><path d="M8 16l4 4 4-4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PersonalDetailsCard (original style) ─────────────────────────────────

function PersonalDetailsCard({ mod }) {
  const updatePersonal = useResumeStore((s) => s.updatePersonal)
  const personal = useResumeStore((s) => s.resume.personal)
  const [editing, setEditing] = useState(false)

  const builtinEntries = BUILTIN_PERSONAL_FIELDS.map((f) => ({
    token: f.key,
    id: f.key,
    field: f.key,
    label: BUILTIN_ENTRY_META[f.key]?.label || f.label,
    icon: BUILTIN_ENTRY_META[f.key]?.icon || '•',
    value: personal[f.key] || '',
    isCustom: false,
    isBuiltin: true,
  }))
  const extraEntries = (personal.extra_fields || []).map((ef) => ({
    token: toExtraToken(ef.id),
    id: ef.id,
    field: ef.id,
    label: ef.label || 'New Entry',
    icon: EXTRA_ICON_MAP[ef.icon] || ef.icon || '✦',
    value: ef.value || '',
    isCustom: true,
    isBuiltin: false,
  }))
  const allEntries = [...builtinEntries, ...extraEntries]
  const byToken = new Map(allEntries.map((e) => [e.token, e]))

  const baseOrder = Array.isArray(personal.visible_fields) && personal.visible_fields.length
    ? personal.visible_fields
    : [...builtinEntries.map((e) => e.token), ...extraEntries.map((e) => e.token)]
  const dedupedBase = [...new Set(baseOrder)]
  const orderTokens = [
    ...dedupedBase.filter((t) => byToken.has(t)),
    ...allEntries.map((e) => e.token).filter((t) => !dedupedBase.includes(t)),
  ]
  const hidden  = new Set(personal.hidden_fields || [])
  const visible = new Set(orderTokens.filter((token) => !hidden.has(token)))

  const orderedEntries = orderTokens.map((token) => byToken.get(token)).filter(Boolean)
  const visibleEntries = orderedEntries.filter((e) => !hidden.has(e.token))
  const hiddenBuiltin  = builtinEntries.filter((e) => hidden.has(e.token))
  const hiddenExtra    = extraEntries.filter((e) => hidden.has(e.token))
  const fieldSensors   = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const toggleVisible = (token, on) => {
    const nextHidden = new Set(hidden)
    if (on) nextHidden.delete(token)
    else nextHidden.add(token)
    updatePersonal({ hidden_fields: [...nextHidden] })
  }

  const onFieldDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    updatePersonal({ visible_fields: arrayMove(orderTokens, orderTokens.indexOf(active.id), orderTokens.indexOf(over.id)) })
  }

  const patchExtra = (id, patch) => {
    updatePersonal({ extra_fields: (personal.extra_fields || []).map((ef) => ef.id === id ? { ...ef, ...patch } : ef) })
  }

  const updateEntryValue = (entry, value) => {
    if (entry.isBuiltin) {
      updatePersonal({ [entry.field]: value })
      return
    }
    patchExtra(entry.id, { value })
    const token = entry.token
    if (!orderTokens.includes(token) || hidden.has(token)) {
      updatePersonal({
        visible_fields: orderTokens.includes(token) ? orderTokens : [...orderTokens, token],
        hidden_fields: (personal.hidden_fields || []).filter((t) => t !== token),
      })
    }
  }

  const updateEntryLabel = (entry, label) => {
    if (!entry.isCustom) return
    patchExtra(entry.id, { label })
  }

  const removeEntry = (entry) => {
    if (entry.isBuiltin) {
      updatePersonal({
        [entry.field]: '',
        hidden_fields: [...new Set([...(personal.hidden_fields || []), entry.token])],
      })
      return
    }
    updatePersonal({
      extra_fields: (personal.extra_fields || []).filter((ef) => ef.id !== entry.id),
      visible_fields: orderTokens.filter((t) => t !== entry.token),
      hidden_fields: (personal.hidden_fields || []).filter((t) => t !== entry.token),
    })
  }

  const addExtra = (preset = null) => {
    const ef = preset
      ? { id: uid(), icon: preset.icon, label: preset.label, value: '' }
      : { id: uid(), icon: 'custom', label: '', value: '' }
    updatePersonal({
      extra_fields: [...(personal.extra_fields || []), ef],
      visible_fields: [...orderTokens, toExtraToken(ef.id)],
      hidden_fields: (personal.hidden_fields || []).filter((t) => t !== toExtraToken(ef.id)),
    })
  }

  const P = personal
  const contactEntries = orderedEntries.filter(
    (e) => !hidden.has(e.token) && String(e.value || '').trim() &&
           !['full_name', 'job_title', 'summary_line'].includes(e.field)
  )

  return (
    <div className="card overflow-visible">
      {/* ── Preview card ── */}
      <div className="relative group cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            {P.full_name || <span className="text-zinc-300 font-normal">Your name</span>}
          </h2>
          {P.job_title && <div className="text-sm text-zinc-500 mt-0.5">{P.job_title}</div>}

          <div className="mt-3 flex items-start gap-4">
            {P.photo_url ? (
              <img src={P.photo_url} className="w-24 h-28 rounded-lg object-cover border border-gray-200/60 flex-shrink-0"/>
            ) : (
              <div className="w-24 h-28 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <User size={32} className="text-gray-300"/>
              </div>
            )}
            {contactEntries.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {contactEntries.map((e) => (
                  <div key={e.token} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="text-[11px] w-4 text-center flex-shrink-0">
                      {e.isBuiltin ? (CONTACT_ICONS[e.field] || e.icon || '•') : (e.icon || '✦')}
                    </span>
                    <span className="truncate">{e.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          onClick={(e) => { e.stopPropagation(); setEditing(!editing) }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      {/* ── Edit panel ── */}
      {editing && (
        <div className="border-t border-gray-100">
          <div className="p-5 pb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Personal Details</h3>

            {/* Name + Title + Photo row */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1 flex flex-col gap-3">
                {byToken.has('full_name') && (() => {
                  const fVisible = visible.has('full_name')
                  return (
                    <div>
                      <div className="text-[13px] font-semibold text-gray-800 mb-1">Full name</div>
                      <div className={'px-3 py-2.5 rounded-lg text-sm ' + (fVisible ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-zinc-400 line-through')}>
                        {P.full_name || <span className="italic text-zinc-400" style={{textDecoration:'none'}}>Empty</span>}
                      </div>
                    </div>
                  )
                })()}
                {byToken.has('job_title') && (() => {
                  const fVisible = visible.has('job_title')
                  return (
                    <div>
                      <div className="text-[13px] font-semibold text-gray-800 mb-1">Professional title</div>
                      <div className={'px-3 py-2.5 rounded-lg text-sm ' + (fVisible ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-zinc-400 line-through')}>
                        {P.job_title || <span className="italic text-zinc-400" style={{textDecoration:'none'}}>Empty</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div className="flex-shrink-0">
                <div className="text-[13px] font-semibold text-gray-800 mb-1">Photo</div>
                {P.photo_url ? (
                  <img src={P.photo_url} className="w-28 h-36 rounded-lg object-cover border border-gray-200"/>
                ) : (
                  <div className="w-28 h-36 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <User size={36} className="text-gray-300"/>
                  </div>
                )}
              </div>
            </div>

            {/* Sortable fields */}
            <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={onFieldDragEnd}>
              <SortableContext items={visibleEntries.map((e) => e.token)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {visibleEntries.map((entry) => (
                    <PersonalFieldRow
                      key={entry.token}
                      field={entry.token}
                      label={entry.label}
                      icon={entry.icon}
                      value={entry.value}
                      visible={visible.has(entry.token)}
                      isCustom={entry.isCustom}
                      onToggle={(on) => toggleVisible(entry.token, on)}
                      onValueChange={(v) => updateEntryValue(entry, v)}
                      onLabelChange={(label) => updateEntryLabel(entry, label)}
                      onRemove={() => removeEntry(entry)}
                      canRemove={true}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-2">Add entries</div>
              <div className="flex flex-wrap gap-1.5">
                {hiddenBuiltin.map((entry) => (
                  <button key={entry.token} onClick={() => toggleVisible(entry.token, true)} className="chip">
                    <Plus size={11}/> {entry.label}
                  </button>
                ))}
                {hiddenExtra.map((entry) => (
                  <button key={entry.token} onClick={() => toggleVisible(entry.token, true)} className="chip">
                    <Plus size={11}/> {entry.label || 'New Entry'}
                  </button>
                ))}
                {PRESET_EXTRAS.map((preset) => (
                  <button key={preset.label} onClick={() => addExtra(preset)} className="chip">
                    <Plus size={11}/> {preset.label}
                  </button>
                ))}
                <button onClick={() => addExtra()} className="chip">
                  <Plus size={11}/> New Entry
                </button>
              </div>
            </div>

            <button
              onClick={() => setEditing(false)}
              className="w-full mt-5 py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ModuleCard ────────────────────────────────────────────────────────────

function ModuleCard({ mod, defaultOpen = false }) {
  const t              = useT()
  const updateModule   = useResumeStore((s) => s.updateModule)
  const removeModule   = useResumeStore((s) => s.removeModule)
  const addEntry       = useResumeStore((s) => s.addEntry)
  const removeEntry    = useResumeStore((s) => s.removeEntry)
  const reorderEntries = useResumeStore((s) => s.reorderEntries)

  const [isOpen, setIsOpen]         = useState(defaultOpen)
  const [editingName, setEditingName] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  const entrySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onEntryDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids    = mod.entries.map((e) => e.id)
    reorderEntries(mod.id, arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  const onLibraryPick = (picked) => {
    const withIds = picked.map((e) => ({ ...e, id: uid(), hidden: false }))
    updateModule(mod.id, { entries: [...mod.entries, ...withIds] })
    setShowLibrary(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
      {/* Header */}
      <div
        className={'flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none ' +
          (isOpen ? 'rounded-t-2xl' : 'rounded-2xl')}
        onClick={() => !editingName && setIsOpen((o) => !o)}
      >
        <Icon name={mod.icon} size={17} className="text-[#1e1b3a] flex-shrink-0"/>

        {editingName ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-[15px] font-bold text-gray-900 outline-none border-b border-indigo-300 focus:border-indigo-500"
            value={mod.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateModule(mod.id, { name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
          />
        ) : (
          <span className="flex-1 text-[15px] font-bold text-[#1e1b3a]">{mod.name}</span>
        )}

        {isOpen && !editingName && (
          <button
            className="flex items-center gap-1.5 text-[12px] text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
          >
            <Pencil size={11}/> Edit Heading
          </button>
        )}

        {isOpen
          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/>
          : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>
        }
      </div>

      {/* Expanded body */}
      {isOpen && (
        <div className="border-t border-gray-200">
          {/* Entry list */}
          <DndContext sensors={entrySensors} collisionDetection={closestCenter} onDragEnd={onEntryDragEnd}>
            <SortableContext items={mod.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              {mod.entries.map((e) => (
                <EntryRow
                  key={e.id}
                  mod={mod}
                  entry={e}
                  onDelete={() => removeEntry(mod.id, e.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {mod.entries.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              No entries yet — click + Add Entry below.
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center px-4 py-2 border-t border-gray-100">
            <button
              className={'p-1.5 rounded-lg transition-colors flex-shrink-0 ' +
                (mod.hidden ? 'text-gray-300 hover:text-gray-500' : 'text-gray-400 hover:text-gray-600') +
                ' hover:bg-gray-50'}
              onClick={() => updateModule(mod.id, { hidden: !mod.hidden })}
              title={mod.hidden ? 'Show section' : 'Hide section'}
            >
              {mod.hidden ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>

            <button
              onClick={() => addEntry(mod.id)}
              className="flex-1 flex items-center justify-center gap-2 text-[14px] text-gray-600 py-2 hover:text-indigo-600 font-medium transition-colors"
            >
              <Plus size={15}/> {t('module.new_entry')}
            </button>

            <button
              className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Delete "${mod.name}"?`)) removeModule(mod.id)
              }}
              title="Delete section"
            >
              <Trash2 size={15}/>
            </button>
          </div>
        </div>
      )}

      {showLibrary && (
        <LibraryPickerModal
          moduleType={mod.type}
          onClose={() => setShowLibrary(false)}
          onPick={onLibraryPick}
        />
      )}
    </div>
  )
}

// ─── ModuleList (top-level) ────────────────────────────────────────────────

export default function ModuleList() {
  const t       = useT()
  const modules = useResumeStore((s) => s.resume.modules)
  const addModule = useResumeStore((s) => s.addModule)

  const typesInUse = new Set(modules.map((m) => m.type))
  const addable    = Object.keys(MODULE_BLUEPRINTS).filter(
    (type) => type !== 'page_break' && (type === 'custom' || !typesInUse.has(type))
  )

  return (
    <div className="flex flex-col gap-2.5">
      {modules.map((m) =>
        m.type === 'page_break'
          ? <PageBreakCard key={m.id} mod={m}/>
          : m.type === 'personal_details'
          ? <PersonalDetailsCard key={m.id} mod={m}/>
          : <ModuleCard key={m.id} mod={m}/>
      )}

      <div className="mt-2 pt-3 border-t border-gray-200">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-2">
          {t('module.add_section')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {addable.map((type) => (
            <button
              key={type}
              onClick={() => addModule(type)}
              className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Plus size={11}/>
              <Icon name={MODULE_BLUEPRINTS[type].icon} size={11}/>
              {MODULE_BLUEPRINTS[type].name}
            </button>
          ))}
          <button
            onClick={() => addModule('page_break')}
            className="flex items-center gap-1.5 text-xs border border-amber-200 rounded-full px-3 py-1.5 text-amber-500 hover:bg-amber-50 transition-colors"
          >
            <Scissors size={11}/> Page Break
          </button>
        </div>
      </div>
    </div>
  )
}
