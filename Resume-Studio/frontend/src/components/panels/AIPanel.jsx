import { useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { Button } from '../common/Fields'
import { api } from '../../api'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { useT } from '../../i18n'

function JobMatchPanel() {
  const t = useT()
  const resume  = useResumeStore((s) => s.resume)
  const save    = useResumeStore((s) => s.save)
  const replace = useResumeStore((s) => s.replaceResume)
  const [open, setOpen] = useState(true)
  const [jd, setJd] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const runAnalyze = async () => {
    setBusy(true)
    try {
      await save()
      const r = await api.analyze(resume.id, jd)
      setResult(r)
    } catch (e) { alert('Analyze failed: ' + e.message) }
    finally { setBusy(false) }
  }

  const runGenerate = async () => {
    if (!confirm(t('jd.replace_confirm'))) return
    setBusy(true)
    try {
      const gen = await api.generate(jd, resume.language)
      if (gen.error) throw new Error(gen.error)
      const merged = {
        ...resume,
        personal: { ...resume.personal, ...(gen.personal || {}) },
        modules: (gen.modules || []).map((m) => ({
          id: Math.random().toString(36).slice(2, 14),
          type: m.type, name: m.name, icon: m.icon || 'circle', hidden: false,
          entries: (m.entries || []).map((e) => ({
            id: Math.random().toString(36).slice(2, 14), hidden: false, ...e,
          })),
        })),
      }
      replace(merged)
    } catch (e) { alert('Generation failed: ' + e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <Sparkles size={14} className="text-indigo-500"/>
        <span className="text-sm font-semibold text-gray-900">{t('jd.heading')}</span>
        <div className="flex-1"/>
        {open
          ? <ChevronDown size={14} className="text-gray-400"/>
          : <ChevronRight size={14} className="text-gray-400"/>}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Paste a job description to analyze your resume's match score, or generate a tailored resume from scratch.
          </p>
          <textarea
            className="input-dark font-mono text-xs"
            rows={6}
            placeholder={t('jd.placeholder')}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={runAnalyze} disabled={busy || !jd.trim()}>
              {t('jd.analyze')}
            </Button>
            <Button variant="secondary" onClick={runGenerate} disabled={busy || !jd.trim()}>
              {t('jd.generate')}
            </Button>
          </div>

          {result && (
            <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 text-xs">
              {result.score != null && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-2xl font-bold text-indigo-600 font-mono">{result.score}</div>
                  <div className="text-gray-400 text-[10px] uppercase tracking-widest">/ 100 {t('jd.score')}</div>
                </div>
              )}
              {result.strengths?.length ? (
                <div className="mb-2">
                  <div className="panel-title mb-1">{t('jd.strengths')}</div>
                  <ul className="list-disc ml-4 text-gray-700 space-y-0.5">
                    {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              ) : null}
              {result.missing_skills?.length ? (
                <div className="mb-2">
                  <div className="panel-title mb-1 text-red-500">{t('jd.missing')}</div>
                  <ul className="list-disc ml-4 text-gray-700 space-y-0.5">
                    {result.missing_skills.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              ) : null}
              {result.suggestions?.length ? (
                <div>
                  <div className="panel-title mb-1">{t('jd.suggestions')}</div>
                  <ul className="list-disc ml-4 text-gray-700 space-y-0.5">
                    {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AIPanel() {
  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4 app-scrollbar">
      <JobMatchPanel/>
    </div>
  )
}
