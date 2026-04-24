import { useEffect, useRef, useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { api } from '../../api'
import { Button } from './Fields'
import {
  Upload, FilePlus2, Save, Languages, Loader2,
  ChevronDown, Compass,
} from 'lucide-react'
import { useT } from '../../i18n'

export default function TopBar({ onImportParsed }) {
  const t = useT()
  const resume    = useResumeStore((s) => s.resume)
  const savedAt   = useResumeStore((s) => s.savedAt)
  const saving    = useResumeStore((s) => s.saving)
  const setTitle  = useResumeStore((s) => s.setTitle)
  const setLang   = useResumeStore((s) => s.setLanguage)
  const save      = useResumeStore((s) => s.save)
  const reset     = useResumeStore((s) => s.resetResume)
  const load      = useResumeStore((s) => s.load)

  const [resumes, setResumes] = useState([])
  const [uploading, setUploading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fileInput = useRef(null)
  const menuRef = useRef(null)

  const refreshList = () => api.listResumes().then(setResumes).catch(() => {})
  useEffect(() => { refreshList() }, [])

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Auto-save after the resume stops changing
  const lastSaved = useRef(null)
  useEffect(() => {
    if (lastSaved.current === resume) return
    lastSaved.current = resume
    const timer = setTimeout(() => { save().then(refreshList).catch(() => {}) }, 1500)
    return () => clearTimeout(timer)
  }, [resume, save])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { resume: parsed } = await api.uploadResume(file)
      onImportParsed?.(parsed)
      await refreshList()
    } catch (err) {
      alert('Parse failed: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const onNew = () => {
    if (!confirm(t('topbar.new_confirm'))) return
    reset()
  }

  return (
    <div className="relative h-14 bg-ink-800 border-b border-white/5 flex items-center px-4 gap-3 z-20 flex-shrink-0">
      {/* Measurement ruler strip at the bottom edge */}
      <div className="absolute left-0 right-0 bottom-0 h-1.5 pointer-events-none flex items-end">
        {Array.from({ length: 60 }).map((_, i) => (
          <span key={i}
            className="flex-1 border-l border-cyan-400/20"
            style={{ height: i % 5 === 0 ? 6 : 3 }}/>
        ))}
      </div>

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_14px_-2px_rgba(34,211,238,0.7)]">
            <Compass size={16} className="text-black"/>
          </div>
          <div className="absolute inset-0 rounded-md border border-cyan-400/30 animate-pulse pointer-events-none"/>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] tracking-[0.25em] text-cyan-400/80 uppercase font-mono">Codex</span>
          <span className="text-sm font-bold tracking-tight text-white -mt-0.5">
            resume<span className="text-cyan-400">·</span>studio
          </span>
        </div>
      </div>

      <div className="w-px h-6 bg-white/10"/>

      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono">
          {t('topbar.title')}
        </span>
        <input
          value={resume.title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent border border-transparent hover:border-white/10 focus:border-cyan-400/60 focus:bg-ink-900 focus:outline-none rounded px-2 py-1 text-sm text-zinc-100 w-56 italic transition-colors"
          placeholder="Untitled resume"
        />
      </div>

      {/* Language */}
      <div className="flex items-center gap-1.5">
        <Languages size={12} className="text-zinc-500"/>
        <select
          value={resume.language}
          onChange={(e) => setLang(e.target.value)}
          className="bg-transparent border border-white/10 hover:border-white/20 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-cyan-400/60 font-mono cursor-pointer"
        >
          <option value="en" className="bg-ink-800">EN</option>
          <option value="zh" className="bg-ink-800">中文</option>
        </select>
      </div>

      {/* Recent files */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-ghost flex items-center gap-1"
        >
          {t('topbar.open')} <ChevronDown size={12}/>
        </button>
        {menuOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-ink-800 border border-white/10 rounded-lg shadow-2xl py-1 max-h-80 overflow-y-auto z-30">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-mono border-b border-white/5">
              {t('topbar.manuscripts')}
            </div>
            {resumes.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-500">{t('topbar.no_saved')}</div>
            )}
            {resumes.map((r) => (
              <button
                key={r.id}
                onClick={() => { load(r.id); setMenuOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white flex flex-col"
              >
                <span className="font-medium truncate">{r.title}</span>
                {r.updated_at && (
                  <span className="text-zinc-500 text-[10px] font-mono">
                    {new Date(r.updated_at).toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1"/>

      {/* Save LED */}
      <div className="flex items-center gap-1.5 text-[10px] tabular-nums font-mono">
        {saving ? (
          <>
            <Loader2 size={11} className="animate-spin text-cyan-400"/>
            <span className="text-cyan-400 tracking-[0.2em]">{t('topbar.saving')}</span>
          </>
        ) : savedAt ? (
          <>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"/>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400"/>
            </span>
            <span className="text-green-400 tracking-[0.2em] uppercase">{t('topbar.saved')}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"/>
            <span className="text-zinc-500 tracking-[0.2em] uppercase">{t('topbar.idle')}</span>
          </>
        )}
      </div>

      <Button variant="ghost" onClick={onNew}>
        <FilePlus2 size={13}/> {t('topbar.new')}
      </Button>

      <Button variant="secondary" onClick={() => fileInput.current?.click()}>
        <Upload size={13}/>{uploading ? t('topbar.parsing') : t('topbar.import')}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={onUpload}
      />

      <Button onClick={() => save().then(refreshList)}>
        <Save size={13}/> {t('topbar.save')}
      </Button>
    </div>
  )
}
