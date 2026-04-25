import { useState, useRef } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import {
  ChevronLeft, ChevronRight, Check, Lock, GripVertical, EyeOff,
  LayoutTemplate, Rows3,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 'flowcv-style', name: 'FlowCV',  desc: 'Two-column · icon headings' },
  { id: 'classic',      name: 'Classic', desc: 'Single column · traditional' },
  { id: 'minimal',      name: 'Minimal', desc: 'Clean · no color · compact'  },
]

const FONT_SIZES   = [9, 9.5, 10, 10.5, 11, 11.5, 12]
const LINE_HEIGHTS = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8]

const LR_MARGINS = [
  { id: 24, label: 'Narrow' },
  { id: 40, label: 'Normal' },
  { id: 56, label: 'Wide'   },
  { id: 72, label: 'Extra'  },
]
const TB_MARGINS = [
  { id: 12, label: 'Tight'    },
  { id: 24, label: 'Normal'   },
  { id: 36, label: 'Relaxed'  },
  { id: 48, label: 'Spacious' },
]
const ENTRY_SPACINGS = [4, 6, 8, 10, 12, 16]

const ENTRY_LAYOUTS = [
  { id: 'inline',    label: 'Inline'    },
  { id: 'left-col',  label: 'Left col'  },
  { id: 'right-col', label: 'Right col' },
]

const TITLE_SIZES    = [10, 11, 12, 13, 14]
const SUBTITLE_SIZES = [9, 10, 11, 12, 13]

const SUBTITLE_STYLES = [
  { id: 'underline',   label: 'Underline' },
  { id: 'overline',    label: 'Overline'  },
  { id: 'double-line', label: 'Double'    },
  { id: 'box',         label: 'Box'       },
  { id: 'pill',        label: 'Pill'      },
  { id: 'left-bar',    label: 'Left bar'  },
  { id: 'plain',       label: 'Plain'     },
]

// ─── UI helpers ──────────────────────────────────────────────────────────────

function ModuleSection({ icon: Icon, label, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
      </div>
      <div className="p-4 flex flex-col gap-5">{children}</div>
    </div>
  )
}

function SubSection({ label, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-[9px] uppercase tracking-[0.25em] text-gray-400 font-semibold">
          {label}
        </span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>
      {children}
    </div>
  )
}

function ChoiceRow({ label, value, options, onChange, columns }) {
  return (
    <div>
      {label && <div className="panel-title mb-1.5">{label}</div>}
      <div
        className={columns ? 'grid gap-1' : 'flex flex-wrap gap-1'}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {options.map((o) => {
          const v = typeof o === 'number' ? o : typeof o === 'string' ? o : (o.id ?? o.value)
          const l = typeof o === 'number' ? String(o) : typeof o === 'string' ? o : o.label
          const active = value === v
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={'chip ' + (active ? 'chip-active' : '')}
            >
              {l}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Template thumbnails ─────────────────────────────────────────────────────

function FlowCVThumb() {
  return (
    <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="100" height="130" fill="white" />
      {/* Header */}
      <rect x="7"  y="8"  width="58" height="5"   rx="1"   fill="#1e293b" />
      <rect x="7"  y="15" width="40" height="2.5" rx="0.5" fill="#94a3b8" />
      {/* Column divider */}
      <line x1="38" y1="24" x2="38" y2="122" stroke="#e5e7eb" strokeWidth="0.7" />
      {/* Left sidebar headings */}
      <rect x="7" y="24" width="24" height="2.5" rx="0.5" fill="#2563eb" opacity="0.7" />
      <circle cx="10" cy="32" r="1.8" fill="#2563eb" opacity="0.5" />
      <rect x="14" y="30.5" width="17" height="2"   rx="0.5" fill="#334155" />
      <rect x="14" y="34.5" width="14" height="1.5" rx="0.5" fill="#94a3b8" />
      <circle cx="10" cy="42" r="1.8" fill="#2563eb" opacity="0.5" />
      <rect x="14" y="40.5" width="19" height="2"   rx="0.5" fill="#334155" />
      <rect x="14" y="44.5" width="15" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="7"  y="52" width="24" height="2.5" rx="0.5" fill="#2563eb" opacity="0.7" />
      <rect x="7"  y="57" width="28" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="7"  y="61" width="25" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="7"  y="65" width="27" height="1.5" rx="0.5" fill="#94a3b8" />
      {/* Right content */}
      <rect x="42" y="24" width="24" height="2.5" rx="0.5" fill="#2563eb" opacity="0.7" />
      <rect x="42" y="29" width="50" height="2"   rx="0.5" fill="#334155" />
      <rect x="42" y="33" width="48" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="42" y="37" width="45" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="42" y="42" width="50" height="2"   rx="0.5" fill="#334155" />
      <rect x="42" y="46" width="48" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="42" y="50" width="44" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="42" y="56" width="24" height="2.5" rx="0.5" fill="#2563eb" opacity="0.7" />
      <rect x="42" y="61" width="50" height="2"   rx="0.5" fill="#334155" />
      <rect x="42" y="65" width="45" height="1.5" rx="0.5" fill="#94a3b8" />
    </svg>
  )
}

function ClassicThumb() {
  return (
    <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="100" height="130" fill="white" />
      {/* Centered name */}
      <rect x="20" y="8"  width="60" height="5"   rx="1"   fill="#1e293b" />
      <rect x="30" y="15" width="40" height="2.5" rx="0.5" fill="#94a3b8" />
      {/* Section 1 */}
      <rect x="7" y="25" width="28" height="3" rx="0.5" fill="#1e293b" />
      <line x1="7" y1="29.5" x2="93" y2="29.5" stroke="#1e293b" strokeWidth="0.8" />
      <rect x="7" y="33" width="86" height="2"   rx="0.5" fill="#334155" />
      <rect x="7" y="37" width="82" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="7" y="41" width="78" height="1.5" rx="0.5" fill="#94a3b8" />
      {/* Section 2 */}
      <rect x="7" y="49" width="32" height="3" rx="0.5" fill="#1e293b" />
      <line x1="7" y1="53.5" x2="93" y2="53.5" stroke="#1e293b" strokeWidth="0.8" />
      <rect x="7" y="57" width="86" height="2"   rx="0.5" fill="#334155" />
      <rect x="7" y="61" width="78" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="7" y="65" width="82" height="1.5" rx="0.5" fill="#94a3b8" />
      <rect x="7" y="70" width="86" height="2"   rx="0.5" fill="#334155" />
      <rect x="7" y="74" width="74" height="1.5" rx="0.5" fill="#94a3b8" />
      {/* Section 3 */}
      <rect x="7" y="82" width="22" height="3" rx="0.5" fill="#1e293b" />
      <line x1="7" y1="86.5" x2="93" y2="86.5" stroke="#1e293b" strokeWidth="0.8" />
      <rect x="7" y="90" width="86" height="2"   rx="0.5" fill="#334155" />
      <rect x="7" y="94" width="80" height="1.5" rx="0.5" fill="#94a3b8" />
    </svg>
  )
}

function MinimalThumb() {
  return (
    <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="100" height="130" fill="white" />
      {/* Centered name block */}
      <rect x="18" y="8"  width="64" height="6"   rx="1"   fill="#111827" />
      <rect x="28" y="17" width="44" height="2.5" rx="0.5" fill="#6b7280" />
      <rect x="10" y="22" width="80" height="0.5" rx="0.25" fill="#d1d5db" />
      {/* Section 1 — thin rule, small heading */}
      <rect x="10" y="28" width="20" height="2" rx="0.5" fill="#374151" />
      <rect x="10" y="31" width="80" height="0.4" fill="#e5e7eb" />
      <rect x="10" y="35" width="80" height="1.8" rx="0.5" fill="#374151" />
      <rect x="10" y="39" width="70" height="1.4" rx="0.5" fill="#9ca3af" />
      <rect x="10" y="43" width="74" height="1.4" rx="0.5" fill="#9ca3af" />
      {/* Section 2 */}
      <rect x="10" y="51" width="28" height="2" rx="0.5" fill="#374151" />
      <rect x="10" y="54" width="80" height="0.4" fill="#e5e7eb" />
      <rect x="10" y="58" width="80" height="1.8" rx="0.5" fill="#374151" />
      <rect x="10" y="62" width="68" height="1.4" rx="0.5" fill="#9ca3af" />
      <rect x="10" y="66" width="72" height="1.4" rx="0.5" fill="#9ca3af" />
      <rect x="10" y="72" width="80" height="1.8" rx="0.5" fill="#374151" />
      <rect x="10" y="76" width="62" height="1.4" rx="0.5" fill="#9ca3af" />
      {/* Section 3 */}
      <rect x="10" y="84" width="18" height="2" rx="0.5" fill="#374151" />
      <rect x="10" y="87" width="80" height="0.4" fill="#e5e7eb" />
      <rect x="10" y="91" width="80" height="1.8" rx="0.5" fill="#374151" />
      <rect x="10" y="95" width="74" height="1.4" rx="0.5" fill="#9ca3af" />
    </svg>
  )
}

function TemplateThumbnail({ id }) {
  if (id === 'classic') return <ClassicThumb />
  if (id === 'minimal') return <MinimalThumb />
  return <FlowCVThumb />
}

// ─── Template Carousel ───────────────────────────────────────────────────────

function TemplateCarousel({ current, onApply }) {
  const [pending, setPending] = useState(current)
  const scrollRef = useRef(null)

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 152, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        {/* Left arrow */}
        <button
          onClick={() => scroll(-1)}
          className="flex-none w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Scrollable cards */}
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto flex-1 scroll-smooth no-scrollbar"
        >
          {TEMPLATES.map((tpl) => {
            const isApplied = current === tpl.id
            const isSel     = pending === tpl.id
            return (
              <div
                key={tpl.id}
                onClick={() => setPending(tpl.id)}
                className={[
                  'flex-none w-[130px] cursor-pointer rounded-lg border overflow-hidden transition-all',
                  isSel
                    ? 'border-indigo-400 shadow-[0_0_14px_-4px_rgba(99,102,241,0.3)]'
                    : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <div className="aspect-[5/6.5] bg-white overflow-hidden">
                  <TemplateThumbnail id={tpl.id} />
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-t border-gray-100">
                  <div>
                    <div className="text-[11px] text-gray-900 font-medium leading-tight">{tpl.name}</div>
                    <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{tpl.desc}</div>
                  </div>
                  {isApplied && (
                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-none ml-1">
                      <Check size={9} className="text-indigo-600" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll(1)}
          className="flex-none w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Apply */}
      <button
        onClick={() => onApply(pending)}
        disabled={pending === current}
        className={[
          'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
          pending !== current
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
            : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed',
        ].join(' ')}
      >
        <Check size={12} />
        {pending === current ? 'Applied' : 'Apply template'}
      </button>
    </div>
  )
}

// ─── Section Reorder ─────────────────────────────────────────────────────────

function SortableSection({ mod }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors',
        mod.hidden
          ? 'border-gray-100 bg-white opacity-50'
          : 'border-gray-200 bg-white hover:border-gray-300',
      ].join(' ')}
    >
      <button
        className="text-gray-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing flex-none"
        {...attributes} {...listeners}
      >
        <GripVertical size={13} />
      </button>
      <span className="flex-1 text-xs text-gray-800 truncate">{mod.name}</span>
      {mod.hidden && <EyeOff size={11} className="text-zinc-600 flex-none" />}
    </div>
  )
}

function SectionReorder() {
  const modules = useResumeStore((s) => s.resume.modules)
  const reorder = useResumeStore((s) => s.reorderModules)

  const personalMod = modules.find((m) => m.type === 'personal_details')
  const otherMods   = modules.filter((m) => m.type !== 'personal_details')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids  = otherMods.map((m) => m.id)
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id))
    reorder([...(personalMod ? [personalMod.id] : []), ...next])
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Personal Details — pinned */}
      {personalMod && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded border border-cyan-400/25 bg-cyan-400/5">
          <Lock size={11} className="text-cyan-400 flex-none" />
          <span className="flex-1 text-xs text-gray-800 truncate">{personalMod.name}</span>
          <span className="text-[9px] text-cyan-400/50 uppercase tracking-widest flex-none">
            pinned
          </span>
        </div>
      )}

      {/* Other sections — draggable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={otherMods.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {otherMods.map((m) => <SortableSection key={m.id} mod={m} />)}
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CustomizePanel() {
  const c      = useResumeStore((s) => s.resume.customize)
  const update = useResumeStore((s) => s.updateCustomize)

  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4 app-scrollbar">

      {/* ── MODULE I: TEMPLATE ── */}
      <ModuleSection icon={LayoutTemplate} label="Template">
        <TemplateCarousel
          current={c.template}
          onApply={(t) => update({ template: t })}
        />
      </ModuleSection>

      {/* ── MODULE II: LAYOUT & SPACING ── */}
      <ModuleSection icon={Rows3} label="Layout & Spacing">

        {/* 1 · Columns */}
        <SubSection label="Columns">
          <ChoiceRow
            value={c.columns}
            onChange={(v) => update({ columns: v })}
            options={[
              { id: 'single', label: 'Single' },
              { id: 'two',    label: 'Double' },
            ]}
            columns={2}
          />
        </SubSection>

        {/* 2 · Section Order */}
        <SubSection label="Section Order">
          <SectionReorder />
        </SubSection>

        {/* 3 · Spacing */}
        <SubSection label="Spacing">
          <ChoiceRow
            label="Font size"
            value={c.font_size}
            onChange={(v) => update({ font_size: v })}
            options={FONT_SIZES.map((n) => ({ id: n, label: String(n) }))}
            columns={7}
          />
          <ChoiceRow
            label="Line height"
            value={c.line_height}
            onChange={(v) => update({ line_height: v })}
            options={LINE_HEIGHTS.map((n) => ({ id: n, label: String(n) }))}
            columns={7}
          />
          <ChoiceRow
            label="Left & Right margin"
            value={c.page_margin}
            onChange={(v) => update({ page_margin: v })}
            options={LR_MARGINS}
            columns={4}
          />
          <ChoiceRow
            label="Top & Bottom margin"
            value={c.vertical_margin ?? 24}
            onChange={(v) => update({ vertical_margin: v })}
            options={TB_MARGINS}
            columns={4}
          />
          <ChoiceRow
            label="Space between entries"
            value={c.entry_spacing}
            onChange={(v) => update({ entry_spacing: v })}
            options={ENTRY_SPACINGS.map((n) => ({ id: n, label: String(n) }))}
            columns={6}
          />
        </SubSection>

        {/* 4 · Entry Layout */}
        <SubSection label="Entry Layout">
          <ChoiceRow
            label="Layout mode"
            value={c.entry_layout ?? 'inline'}
            onChange={(v) => update({ entry_layout: v })}
            options={ENTRY_LAYOUTS}
            columns={3}
          />
          <ChoiceRow
            label="Title size"
            value={c.entry_title_size ?? 11}
            onChange={(v) => update({ entry_title_size: v })}
            options={TITLE_SIZES.map((n) => ({ id: n, label: String(n) }))}
            columns={5}
          />
          <ChoiceRow
            label="Section heading size"
            value={c.subtitle_size ?? 11}
            onChange={(v) => update({ subtitle_size: v })}
            options={SUBTITLE_SIZES.map((n) => ({ id: n, label: String(n) }))}
            columns={5}
          />
          <ChoiceRow
            label="Section heading style"
            value={c.subtitle_style ?? 'underline'}
            onChange={(v) => update({ subtitle_style: v })}
            options={SUBTITLE_STYLES}
            columns={3}
          />
        </SubSection>

      </ModuleSection>
    </div>
  )
}
