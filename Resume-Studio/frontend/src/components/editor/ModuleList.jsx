import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Eye, EyeOff, Trash2, Plus, ChevronDown, ChevronRight,
  Library, Scissors, User,
} from 'lucide-react'

import { useResumeStore, MODULE_BLUEPRINTS, PERSONAL_FIELD_ORDER } from '../../store/resumeStore'
import Icon, { ICON_CHOICES } from '../common/Icon'
import LibraryPickerModal from '../common/LibraryPickerModal'
import InlineEntryEditor from './InlineEntryEditor'
import { useT } from '../../i18n'
import { TextField, Toggle } from '../common/Fields'

function isBlankPersonalValue(value) {
  return String(value ?? '').trim() === ''
}

function entryLabel(type, e) {
  switch (type) {
    case 'education':  return e.school || 'Untitled school'
    case 'experience': return e.position ? `${e.position}${e.company ? ' · ' + e.company : ''}` : (e.company || 'Untitled role')
    case 'projects':   return e.name || 'Untitled project'
    case 'skills':     return e.category || (e.items?.length ? e.items.join(', ').slice(0, 40) : 'Skill group')
    case 'awards':     return e.title || 'Untitled award'
    case 'summary':    return (e.content || '').replace(/<[^>]+>/g, '').slice(0, 50) || 'Summary'
    default:           return e.title || 'Untitled'
  }
}

// ---------- Entry row (with its own inline editor) ----------

function EntryRow({ mod, entry }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id })
  const updateEntry = useResumeStore((s) => s.updateEntry)
  const removeEntry = useResumeStore((s) => s.removeEntry)
  const t = useT()
  const [open, setOpen] = useState(false)  // local per-entry state

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div
        className={
          'group flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg border transition-colors cursor-pointer ' +
          (open
            ? 'border-indigo-300 bg-indigo-50/60'
            : 'border-gray-200 bg-white hover:border-indigo-200')
        }
        onClick={() => setOpen(!open)}
      >
        <button
          className="text-zinc-600 hover:text-cyan-400 cursor-grab active:cursor-grabbing"
          {...attributes} {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14}/>
        </button>
        <div className={'flex-1 text-sm truncate ' + (entry.hidden ? 'text-gray-300 line-through' : 'text-gray-900')}>
          {entryLabel(mod.type, entry)}
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200"
          onClick={(e) => { e.stopPropagation(); updateEntry(mod.id, entry.id, { hidden: !entry.hidden }) }}
          title={entry.hidden ? 'Show' : 'Hide'}
        >
          {entry.hidden ? <EyeOff size={13}/> : <Eye size={13}/>}
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(t('module.delete_confirm'))) removeEntry(mod.id, entry.id)
          }}
        >
          <Trash2 size={13}/>
        </button>
        {open
          ? <ChevronDown size={14} className="text-cyan-400"/>
          : <ChevronRight size={14} className="text-zinc-600"/>}
      </div>
      {open && (
        <div className="mt-1.5 mb-1">
          <InlineEntryEditor
            moduleId={mod.id}
            entryId={entry.id}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

// ---------- Page break module (minimal visual marker) ----------

function PageBreakCard({ mod }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id })
  const removeModule = useResumeStore((s) => s.removeModule)
  const t = useT()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-amber-400/40 bg-amber-400/5">
      <button className="text-amber-400/60 hover:text-amber-400 cursor-grab active:cursor-grabbing"
        {...attributes} {...listeners}>
        <GripVertical size={14}/>
      </button>
      <Scissors size={14} className="text-amber-400"/>
      <div className="flex-1 text-xs text-amber-400 font-mono uppercase tracking-[0.15em]">
        page break · content below jumps to next page
      </div>
      <button
        className="p-1 rounded hover:bg-red-500/10 text-red-400"
        onClick={() => { if (confirm('Remove this page break?')) removeModule(mod.id) }}
        title="Remove">
        <Trash2 size={13}/>
      </button>
    </div>
  )
}

function PersonalFieldRow({ field, value, visible, onToggle, onChange }) {
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
    <div ref={setNodeRef} style={style} className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <button className="text-zinc-600 hover:text-cyan-400 cursor-grab active:cursor-grabbing"
          {...attributes} {...listeners}>
          <GripVertical size={14}/>
        </button>
        <div className="flex-1 text-[11px] text-gray-700 uppercase tracking-[0.15em]">
          {t(`field.${field}`, field)}
        </div>
        <div className="w-32 shrink-0">
          <Toggle label="Show on resume" value={visible} onChange={onToggle}/>
        </div>
      </div>
      <TextField
        value={value || ''}
        onChange={onChange}
        placeholder="Leave empty to keep hidden"
      />
    </div>
  )
}

function PersonalDetailsCard({ mod }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id })
  const updateModule = useResumeStore((s) => s.updateModule)
  const updatePersonal = useResumeStore((s) => s.updatePersonal)
  const personal = useResumeStore((s) => s.resume.personal)

  const fieldOrder = personal.visible_fields?.length ? personal.visible_fields : PERSONAL_FIELD_ORDER
  const hidden = new Set(personal.hidden_fields || [])
  const visible = new Set(fieldOrder.filter((field) => !hidden.has(field) && !isBlankPersonalValue(personal[field])))
  const fieldSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const toggleVisible = (field, on) => {
    if (on && isBlankPersonalValue(personal[field])) return
    const nextHidden = new Set(hidden)
    if (on) nextHidden.delete(field)
    else nextHidden.add(field)
    updatePersonal({ hidden_fields: [...nextHidden] })
  }

  const onFieldChange = (field, value) => {
    const nextHidden = new Set(hidden)
    const wasBlank = isBlankPersonalValue(personal[field])
    const isBlank = isBlankPersonalValue(value)

    if (isBlank) nextHidden.add(field)
    else if (wasBlank) nextHidden.delete(field)

    updatePersonal({
      [field]: value,
      hidden_fields: [...nextHidden],
    })
  }

  const onFieldDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(fieldOrder, fieldOrder.indexOf(active.id), fieldOrder.indexOf(over.id))
    updatePersonal({ visible_fields: next })
  }

  return (
    <div ref={setNodeRef} style={style} className="card overflow-visible">
      <div className="flex items-center gap-2 px-3 py-3 border-b transition-colors border-indigo-200 bg-indigo-50/50">
        <button
          className="text-zinc-600 hover:text-cyan-400 cursor-grab active:cursor-grabbing"
          {...attributes} {...listeners}
        >
          <GripVertical size={16}/>
        </button>
        <User size={16} className="text-cyan-400"/>
        <div className="flex-1 text-left text-[15px] font-semibold text-gray-900 truncate">
          {mod.name}
        </div>
        <button
          className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200"
          title={mod.hidden ? 'Show' : 'Hide'}
          onClick={() => updateModule(mod.id, { hidden: !mod.hidden })}
        >
          {mod.hidden ? <EyeOff size={14}/> : <Eye size={14}/>}
        </button>
      </div>

      {!mod.hidden && (
        <div className="p-3 flex flex-col gap-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-[0.18em]">
            Drag to reorder fields. Empty fields stay hidden until you fill them in.
          </div>
          <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={onFieldDragEnd}>
            <SortableContext items={fieldOrder} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {fieldOrder.map((field) => (
                  <PersonalFieldRow
                    key={field}
                    field={field}
                    value={personal[field]}
                    visible={visible.has(field)}
                    onToggle={(on) => toggleVisible(field, on)}
                    onChange={(v) => onFieldChange(field, v)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}

// ---------- Regular module card ----------

function ModuleCard({ mod, defaultOpen = true }) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id })
  const updateModule    = useResumeStore((s) => s.updateModule)
  const removeModule    = useResumeStore((s) => s.removeModule)
  const addEntry        = useResumeStore((s) => s.addEntry)
  const reorderEntries  = useResumeStore((s) => s.reorderEntries)

  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [editingName, setEditingName] = useState(false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const entrySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onEntryDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = mod.entries.map((e) => e.id)
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    reorderEntries(mod.id, arrayMove(ids, oldIdx, newIdx))
  }

  const onLibraryPick = (picked) => {
    const withIds = picked.map((e) => ({
      ...e, id: Math.random().toString(36).slice(2, 14), hidden: false,
    }))
    updateModule(mod.id, { entries: [...mod.entries, ...withIds] })
    setShowLibrary(false)
  }

  const hasLibraryPool = ['experience','projects','education','skills','awards','summary'].includes(mod.type)

  return (
    <div ref={setNodeRef} style={style} className="card overflow-visible">
      {/* Header */}
      <div
        className={
          'flex items-center gap-2 px-3 py-3 border-b transition-colors cursor-pointer ' +
          (isOpen ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 hover:bg-gray-50')
        }
        onClick={() => setIsOpen(!isOpen)}
      >
        <button
          className="text-zinc-600 hover:text-cyan-400 cursor-grab active:cursor-grabbing"
          {...attributes} {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16}/>
        </button>

        <div className="relative">
          <button
            className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500"
            onClick={(e) => { e.stopPropagation(); setPickingIcon(!pickingIcon) }}
          >
            <Icon name={mod.icon} size={17}/>
          </button>
          {pickingIcon && (
            <>
              <div className="fixed inset-0 z-20"
                onClick={(e) => { e.stopPropagation(); setPickingIcon(false) }}/>
              <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 grid grid-cols-6 gap-0.5 w-56">
                {ICON_CHOICES.map((n) => (
                  <button key={n}
                    className={
                      'p-1.5 rounded-lg hover:bg-indigo-50 ' +
                      (n === mod.icon ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500')
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      updateModule(mod.id, { icon: n })
                      setPickingIcon(false)
                    }}
                  >
                    <Icon name={n} size={15}/>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {editingName ? (
          <input autoFocus
            className="flex-1 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:border-indigo-500"
            value={mod.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateModule(mod.id, { name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}/>
        ) : (
          <button
            className="flex-1 text-left text-[15px] font-semibold text-gray-900 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true) }}
          >
            {mod.name}
            <span className="text-gray-400 font-normal ml-2 text-xs tabular-nums">
              {mod.entries.length}
            </span>
          </button>
        )}

        <button
          className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200"
          title={mod.hidden ? 'Show' : 'Hide'}
          onClick={(e) => { e.stopPropagation(); updateModule(mod.id, { hidden: !mod.hidden }) }}
        >
          {mod.hidden ? <EyeOff size={14}/> : <Eye size={14}/>}
        </button>
        <button
          className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Delete "${mod.name}"?`)) removeModule(mod.id)
          }}
        >
          <Trash2 size={14}/>
        </button>
        {isOpen
          ? <ChevronDown size={16} className="text-cyan-400"/>
          : <ChevronRight size={16} className="text-zinc-600"/>}
      </div>

      {/* Expanded entries */}
      {isOpen && (
        <div className="p-3 flex flex-col gap-2">
          {mod.entries.length === 0 && (
            <div className="text-xs text-zinc-500 text-center py-3">No entries yet.</div>
          )}
          <DndContext sensors={entrySensors} collisionDetection={closestCenter} onDragEnd={onEntryDragEnd}>
            <SortableContext items={mod.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              {mod.entries.map((e) => <EntryRow key={e.id} mod={mod} entry={e}/>)}
            </SortableContext>
          </DndContext>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => addEntry(mod.id)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm text-indigo-500 border border-dashed border-gray-200 rounded-lg py-2.5 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <Plus size={14}/> {t('module.new_entry')}
            </button>
            {hasLibraryPool && (
              <button
                onClick={() => setShowLibrary(true)}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg py-2.5 hover:border-gray-300 hover:bg-gray-50"
              >
                <Library size={14}/> {t('module.from_library')}
              </button>
            )}
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

// ---------- Top-level module list ----------

export default function ModuleList() {
  const t = useT()
  const modules = useResumeStore((s) => s.resume.modules)
  const reorder = useResumeStore((s) => s.reorderModules)
  const addModule = useResumeStore((s) => s.addModule)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = modules.findIndex((m) => m.id === active.id)
    const newIdx = modules.findIndex((m) => m.id === over.id)
    reorder(arrayMove(modules, oldIdx, newIdx).map((m) => m.id))
  }

  const typesInUse = new Set(modules.map((m) => m.type))
  const addable = Object.keys(MODULE_BLUEPRINTS).filter(
    (type) => type !== 'page_break' && (type === 'custom' || !typesInUse.has(type))
  )

  return (
    <div className="flex flex-col gap-2.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {modules.map((m) =>
            m.type === 'page_break'
              ? <PageBreakCard key={m.id} mod={m}/>
              : m.type === 'personal_details'
              ? <PersonalDetailsCard key={m.id} mod={m}/>
              : <ModuleCard key={m.id} mod={m}/>
          )}
        </SortableContext>
      </DndContext>

      <div className="mt-2 pt-3 border-t border-gray-100">
        <div className="panel-title mb-2">{t('module.add_section')}</div>
        <div className="flex flex-wrap gap-1.5">
          {addable.map((type) => (
            <button
              key={type}
              onClick={() => addModule(type)}
              className={
                'chip ' +
                (type === 'page_break' ? 'border-amber-400/40 text-amber-400' : '')
              }
            >
              <Plus size={11}/>
              <Icon name={MODULE_BLUEPRINTS[type].icon} size={12}/>
              {MODULE_BLUEPRINTS[type].name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}