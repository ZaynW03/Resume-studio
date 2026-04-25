import { useEffect, useRef, useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { api } from '../../api'
import { Button } from './Fields'
import {
  Upload, FilePlus2, Save, Languages, Loader2,
  ChevronDown, User, FileEdit, Palette, Sparkles,
} from 'lucide-react'
import { useT } from '../../i18n'

const TABS = [
  { id: 'profile',   label: 'Overview',  Icon: User },
  { id: 'content',   label: 'Content',   Icon: FileEdit },
  { id: 'customize', label: 'Customize', Icon: Palette },
  { id: 'ai',        label: 'AI Tools',  Icon: Sparkles },
]

export default function TopBar({ onImportParsed }) {
  const t = useT()
  const resume       = useResumeStore((s) => s.resume)
  const savedAt      = useResumeStore((s) => s.savedAt)
  const saving       = useResumeStore((s) => s.saving)
  const setTitle     = useResumeStore((s) => s.setTitle)
  const setLang      = useResumeStore((s) => s.setLanguage)
  const save         = useResumeStore((s) => s.save)
  const reset        = useResumeStore((s) => s.resetResume)
  const load         = useResumeStore((s) => s.load)
  const activeTab    = useResumeStore((s) => s.activeTab)
  const setActiveTab = useResumeStore((s) => s.setActiveTab)

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
    <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-20 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold leading-none">R</span>
        </div>
        <span className="text-sm font-semibold text-gray-900 tracking-tight whitespace-nowrap">Resume Studio</span>
      </div>

      <div className="w-px h-5 bg-gray-200 flex-shrink-0"/>

      {/* Tab navigation */}
      <nav className="flex items-center gap-0.5">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                active
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
              ].join(' ')}
            >
              <Icon size={14}/>
              {label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1"/>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Save status */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400">
          {saving ? (
            <><Loader2 size={11} className="animate-spin text-indigo-500"/><span className="text-indigo-500">Saving…</span></>
          ) : savedAt ? (
            <><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/><span>Saved</span></>
          ) : null}
        </div>

        {/* Language */}
        <div className="flex items-center gap-1">
          <Languages size={12} className="text-gray-400"/>
          <select
            value={resume.language}
            onChange={(e) => setLang(e.target.value)}
            className="bg-transparent border-none text-xs text-gray-500 focus:outline-none cursor-pointer"
          >
            <option value="en">EN</option>
            <option value="zh">中文</option>
          </select>
        </div>

        {/* Open recent */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="btn-ghost flex items-center gap-1"
          >
            Open <ChevronDown size={12}/>
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-80 overflow-y-auto z-30">
              <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100">
                Recent Resumes
              </div>
              {resumes.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">{t('topbar.no_saved')}</div>
              )}
              {resumes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { load(r.id); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex flex-col"
                >
                  <span className="font-medium truncate">{r.title}</span>
                  {r.updated_at && (
                    <span className="text-gray-400 text-[10px]">
                      {new Date(r.updated_at).toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" onClick={onNew}>
          <FilePlus2 size={13}/> New
        </Button>

        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <Upload size={13}/>{uploading ? 'Parsing…' : 'Import'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={onUpload}
        />

        <Button onClick={() => save().then(refreshList)}>
          <Save size={13}/> Save
        </Button>
      </div>
    </div>
  )
}
