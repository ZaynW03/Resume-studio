import { useState } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import { Button, TextField, Toggle } from '../common/Fields'
import ModuleList from '../editor/ModuleList'
import { api } from '../../api'
import { Sparkles, ChevronDown, ChevronRight, User } from 'lucide-react'
import { useT } from '../../i18n'

const PERSONAL_CONTACT_FIELDS = [
  'location', 'email', 'phone', 'website', 'linkedin', 'github', 'wechat', 'qq',
]

/** * 已注释：这是第一个 Person Detail 模块的定义
 * 因为现在统一使用 ModuleList 里的动态模块，所以不再需要这个静态组件
 */
/*
function PersonDetailModule() {
  const t = useT()
  const personal = useResumeStore((s) => s.resume.personal)
  const updatePersonal = useResumeStore((s) => s.updatePersonal)

  const visible = new Set(
    Array.isArray(personal.visible_fields) && personal.visible_fields.length
      ? personal.visible_fields
      : PERSONAL_CONTACT_FIELDS
  )

  const setVisible = (field, on) => {
    const next = new Set(visible)
    if (on) next.add(field)
    else next.delete(field)
    updatePersonal({ visible_fields: PERSONAL_CONTACT_FIELDS.filter((f) => next.has(f)) })
  }

  const setField = (field, value) => updatePersonal({ [field]: value })

  return (
    <div className="overflow-hidden bg-zinc-900/50 rounded-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-cyan-400/5">
        <User size={14} className="text-cyan-400"/>
        <div className="text-[11px] font-semibold text-zinc-100 uppercase tracking-[0.18em]">
          Person Detail
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('field.full_name')} value={personal.full_name} onChange={(v) => setField('full_name', v)}/>
          <TextField label={t('field.job_title')} value={personal.job_title} onChange={(v) => setField('job_title', v)}/>
          <TextField label={t('field.location')}  value={personal.location}  onChange={(v) => setField('location', v)}/>
          <TextField label={t('field.email')}     value={personal.email}     onChange={(v) => setField('email', v)}/>
          <TextField label={t('field.phone')}     value={personal.phone}     onChange={(v) => setField('phone', v)}/>
          <TextField label={t('field.website')}   value={personal.website}   onChange={(v) => setField('website', v)}/>
          <TextField label={t('field.linkedin')}  value={personal.linkedin}  onChange={(v) => setField('linkedin', v)}/>
          <TextField label={t('field.github')}    value={personal.github}    onChange={(v) => setField('github', v)}/>
          <TextField label={t('field.wechat')}    value={personal.wechat}    onChange={(v) => setField('wechat', v)}/>
          <TextField label={t('field.qq')}        value={personal.qq}        onChange={(v) => setField('qq', v)}/>
        </div>

        <div>
          <div className="panel-title mb-2">Visible on resume</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {PERSONAL_CONTACT_FIELDS.map((field) => (
              <Toggle
                key={field}
                label={t(`field.${field}`, field)}
                value={visible.has(field)}
                onChange={(on) => setVisible(field, on)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
*/

function JobMatchPanel() {
  const t = useT()
  const resume   = useResumeStore((s) => s.resume)
  const save     = useResumeStore((s) => s.save)
  const replace  = useResumeStore((s) => s.replaceResume)
  const [open, setOpen] = useState(false)
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
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/5">
        <Sparkles size={14} className="text-cyan-400"/>
        <span className="text-sm font-medium text-zinc-100">{t('jd.heading')}</span>
        <div className="flex-1"/>
        {open ? <ChevronDown size={14} className="text-zinc-500"/> : <ChevronRight size={14} className="text-zinc-500"/>}
      </button>
      {open && (
        <div className="border-t border-white/5 p-4 flex flex-col gap-3">
          <textarea
            className="input-dark font-mono text-xs"
            rows={5}
            placeholder={t('jd.placeholder')}
            value={jd}
            onChange={(e) => setJd(e.target.value)}/>
          <div className="flex gap-2">
            <Button onClick={runAnalyze} disabled={busy || !jd.trim()}>{t('jd.analyze')}</Button>
            <Button variant="secondary" onClick={runGenerate} disabled={busy || !jd.trim()}>
              {t('jd.generate')}
            </Button>
          </div>

          {result && (
            <div className="bg-ink-900 rounded border border-white/5 p-3 text-xs">
              {result.score != null && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-cyan-400 font-mono text-lg">{result.score}</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest">/ 100 {t('jd.score')}</div>
                </div>
              )}
              {result.strengths?.length ? (
                <div className="mb-2">
                  <div className="panel-title mb-1">{t('jd.strengths')}</div>
                  <ul className="list-disc ml-4 text-zinc-300 space-y-0.5">{result.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul>
                </div>
              ) : null}
              {result.missing_skills?.length ? (
                <div className="mb-2">
                  <div className="panel-title mb-1 text-red-400">{t('jd.missing')}</div>
                  <ul className="list-disc ml-4 text-zinc-300 space-y-0.5">{result.missing_skills.map((s,i)=><li key={i}>{s}</li>)}</ul>
                </div>
              ) : null}
              {result.suggestions?.length ? (
                <div>
                  <div className="panel-title mb-1">{t('jd.suggestions')}</div>
                  <ul className="list-disc ml-4 text-zinc-300 space-y-0.5">{result.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ContentPanel() {
  const t = useT()
  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4">
      {/* 已注释：删掉重复展示的第一个 Person Detail */}
      {/* <PersonDetailModule/> */}

      {/* <JobMatchPanel/> */}
      
      {/* <div className="panel-title pt-2">{t('section.sections')}</div>
       */}
      {/* 保留下方 ModuleList 里的 Person Detail */}
      <ModuleList/>
    </div>
  )
}