import { useResumeStore } from '../../store/resumeStore'
import { User, FileEdit, Palette } from 'lucide-react'
import { useT } from '../../i18n'

const TABS = [
  { id: 'profile',   glyph: 'I',   Icon: User,     key: 'tab.profile'   },
  { id: 'content',   glyph: 'II',  Icon: FileEdit, key: 'tab.content'   },
  { id: 'customize', glyph: 'III', Icon: Palette,  key: 'tab.customize' },
]

export default function Sidebar() {
  const t = useT()
  const activeTab    = useResumeStore((s) => s.activeTab)
  const setActiveTab = useResumeStore((s) => s.setActiveTab)

  return (
    <div className="w-[76px] bg-ink-800 border-r border-white/5 flex flex-col items-center py-4 gap-1 relative flex-shrink-0">
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent"/>
      <div className="absolute right-0 top-0 bottom-0 w-1.5 flex flex-col justify-evenly items-end pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="block bg-cyan-400/25"
            style={{ width: i % 5 === 0 ? 6 : 3, height: 1 }}/>
        ))}
      </div>

      {TABS.map(({ id, glyph, Icon, key }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={
              'group relative w-16 py-3 rounded-md flex flex-col items-center gap-1 transition-all ' +
              (active
                ? 'bg-cyan-400/10 text-cyan-300'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200')
            }
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-cyan-400 rounded-r shadow-[0_0_8px_0_rgba(34,211,238,0.8)]"/>
            )}
            <span className={
              'font-mono text-[9px] tracking-[0.2em] ' +
              (active ? 'text-cyan-400' : 'text-zinc-600 group-hover:text-zinc-400')
            }>{glyph}</span>
            <Icon size={20} strokeWidth={active ? 2.2 : 1.7}/>
            <span className="text-[10px] tracking-[0.12em] font-medium">
              {t(key)}
            </span>
          </button>
        )
      })}

      <div className="flex-1"/>
      <div className="text-[8px] font-mono text-zinc-700 tracking-[0.2em]"
        style={{ writingMode: 'vertical-rl' }}>
        ANNO MMXXV
      </div>
    </div>
  )
}
