import { useEffect, useRef, useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { api } from '../../api'
import { Button } from './Fields'
import {
  Upload, FilePlus2, Languages, Loader2,
  ChevronDown, User, FileEdit, Palette, Sparkles, Trash2,
} from 'lucide-react'
import { useT } from '../../i18n'

const TAB_KEYS = [
  { id: 'profile',   key: 'tab.profile',   Icon: User },
  { id: 'content',   key: 'tab.content',   Icon: FileEdit },
  { id: 'customize', key: 'tab.customize', Icon: Palette },
  { id: 'ai',        key: 'tab.ai',        Icon: Sparkles },
]

export default function TopBar({ onImportParsed }) {
  const t = useT()
  const resume       = useResumeStore((s) => s.resume)
  const savedAt      = useResumeStore((s) => s.savedAt)
  const saving       = useResumeStore((s) => s.saving)
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

  const lastSavedJson = useRef('')
  useEffect(() => {
    const json = JSON.stringify(resume)
    if (lastSavedJson.current === json) return
    lastSavedJson.current = json
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

  const onDeleteResume = async (resumeId) => {
    if (!confirm(t('topbar.delete_confirm'))) return
    try {
      await api.deleteResume(resumeId)
      if (resume.id === resumeId) reset()
      await refreshList()
    } catch (err) {
      alert(`${t('topbar.delete')}: ${err.message}`)
    }
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
        {TAB_KEYS.map(({ id, key, Icon }) => {
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
              {t(key)}
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
            <><Loader2 size={11} className="animate-spin text-indigo-500"/><span className="text-indigo-500">{t('topbar.status_saving')}</span></>
          ) : savedAt ? (
            <><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/><span>{t('topbar.status_saved')}</span></>
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
            {t('topbar.open')} <ChevronDown size={12}/>
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-80 overflow-y-auto z-30">
              <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100">
                {t('topbar.recent')}
              </div>
              {resumes.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">{t('topbar.no_saved')}</div>
              )}
              {resumes.map((r) => {
                const isCurrent = resume.id === r.id
                return (
                <div
                  key={r.id}
                  className={[
                    'px-2 py-1.5 flex items-center gap-2 rounded-lg mx-1',
                    isCurrent ? 'bg-indigo-50' : 'hover:bg-gray-50',
                  ].join(' ')}
                >
                  <button
                    onClick={() => { load(r.id); setMenuOpen(false) }}
                    className="flex-1 min-w-0 text-left px-1 py-0.5 text-xs text-gray-700 flex flex-col"
                  >
                    <span className="font-medium truncate flex items-center gap-2">
                      <span className={isCurrent ? 'text-indigo-700' : ''}>{r.title}</span>
                      {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">
                          {t('topbar.current')}
                        </span>
                      )}
                    </span>
                    {r.updated_at && (
                      <span className={`text-[10px] ${isCurrent ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {new Date(r.updated_at).toLocaleString()}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteResume(r.id).then(() => {
                        if (resume.id !== r.id) return
                        setMenuOpen(false)
                      })
                    }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    title={t('topbar.delete')}
                    aria-label={t('topbar.delete')}
                  >
                    <Trash2 size={13}/>
                  </button>
                </div>
                )
              })}
            </div>
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
      </div>
    </div>
  )
}
