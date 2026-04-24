import { useEffect, useRef, useState, useCallback } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import {
  Download, Loader2, ZoomIn, ZoomOut, Maximize2, AlertTriangle, Printer,
} from 'lucide-react'
import { useT } from '../../i18n'

function useDebounce(value, ms = 400) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const PAPER = {
  A4:     { w: 794,  h: 1123, mm: { w: 210, h: 297 } },
  Letter: { w: 816,  h: 1056, mm: { w: 216, h: 279 } },
}

function toRoman(n) {
  if (n < 1) return ''
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
               [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]
  let out = ''
  for (const [v, s] of map) { while (n >= v) { out += s; n -= v } }
  return out
}

/**
 * Split the rendered HTML at every <div class="page-break"></div>.
 * Each resulting fragment is wrapped back into a full HTML document (head+body)
 * so it can be rendered in its own iframe.
 */
function splitByPageBreaks(fullHtml) {
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const bodyTagMatch = fullHtml.match(/<body[^>]*>/i)
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const head = headMatch ? headMatch[1] : ''
  const bodyStyle = bodyTagMatch ? bodyTagMatch[0] : '<body>'
  const bodyContent = bodyMatch ? bodyMatch[1] : fullHtml

  const parts = bodyContent.split(/<div class="page-break"[^>]*><\/div>/)
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((pageContent) => (
      `<!DOCTYPE html><html><head>${head}</head>${bodyStyle}${pageContent}</body></html>`
    ))
}

/** Corner registration crosshairs on each paper corner. */
function CornerMarks({ w, h }) {
  const size = 12
  const stroke = 'rgba(34,211,238,0.55)'
  const o = -5
  const mk = (cx, cy, key) => (
    <g key={key}>
      <line x1={cx-size} x2={cx+size} y1={cy} y2={cy} stroke={stroke} strokeWidth="0.6"/>
      <line y1={cy-size} y2={cy+size} x1={cx} x2={cx} stroke={stroke} strokeWidth="0.6"/>
      <circle cx={cx} cy={cy} r="2.5" fill="none" stroke={stroke} strokeWidth="0.6"/>
    </g>
  )
  return (
    <svg width={w - 2 * o} height={h - 2 * o} className="absolute pointer-events-none"
         style={{ top: o, left: o }}>
      {mk(-o, -o, 'tl')}{mk(w-o, -o, 'tr')}
      {mk(-o, h-o, 'bl')}{mk(w-o, h-o, 'br')}
    </svg>
  )
}

/** Millimeter ruler ticks on the left edge. */
function RulerTicks({ height }) {
  const pxPerMm = 96 / 25.4
  const totalMm = Math.floor(height / pxPerMm)
  const marks = []
  for (let mm = 0; mm <= totalMm; mm += 5) {
    const len = mm % 10 === 0 ? 5 : 2.5
    marks.push(<line key={mm} x1={0} x2={len} y1={mm*pxPerMm} y2={mm*pxPerMm}
      stroke="rgba(34,211,238,0.3)" strokeWidth={mm%10===0?0.7:0.4}/>)
  }
  const labels = []
  for (let cm = 3; cm*10 < totalMm; cm += 3) {
    labels.push(<text key={'l'+cm} x={8} y={cm*10*pxPerMm+3}
      fontSize="7" fontFamily="ui-monospace, monospace" fill="rgba(34,211,238,0.45)">{cm}</text>)
  }
  return <svg width={16} height={height} className="absolute top-0 -left-5 pointer-events-none select-none">
    {marks}{labels}
  </svg>
}

function CompassRose() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" className="inline-block">
      <g stroke="rgba(34,211,238,0.7)" fill="none" strokeWidth="0.6">
        <circle cx="7" cy="7" r="5.5"/>
        <circle cx="7" cy="7" r="1.2"/>
        <line x1="7" y1="0.5" x2="7" y2="13.5"/>
        <line x1="0.5" y1="7" x2="13.5" y2="7"/>
        <polygon points="7,1 7.8,5 7,7 6.2,5" fill="rgba(34,211,238,0.7)"/>
      </g>
    </svg>
  )
}

/**
 * One page iframe. Renders its fragment at TRUE paper size. We measure
 * content height and report whether the content overflows so the parent
 * can display a warning.
 */
function PageFrame({ html, paperW, paperH, onOverflow }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame || !html) return
    const doc = frame.contentDocument
    if (!doc) return

    doc.open(); doc.write(html); doc.close()

    // <base> so /uploads/photo_xxx.png resolves against the backend (via Vite proxy)
    const base = doc.createElement('base')
    base.href = window.location.origin + '/'
    if (doc.head.firstChild) doc.head.insertBefore(base, doc.head.firstChild)
    else doc.head.appendChild(base)

    // Preview-only styles: no interaction, clip overflow
    const st = doc.createElement('style')
    st.textContent = `body { pointer-events:none; user-select:none; overflow:hidden; }`
    doc.head.appendChild(st)

    // Measure content height ONCE per HTML update.
    // We don't loop on overflow change — that was the flicker source.
    let cancelled = false
    const measure = () => {
      if (cancelled) return
      const h = Math.max(
        doc.documentElement.scrollHeight || 0,
        doc.body.scrollHeight || 0,
      )
      onOverflow?.(h > paperH + 2)
    }
    measure()
    const timers = [100, 400, 800].map((t) => setTimeout(measure, t))
    Array.from(doc.images || []).forEach((img) => {
      if (!img.complete) img.addEventListener('load', measure, { once: true })
    })
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [html, paperH, onOverflow])

  return (
    <iframe
      ref={iframeRef}
      title="resume-page"
      sandbox="allow-same-origin"
      style={{
        width: paperW, height: paperH,
        border: 0, display: 'block', background: 'white',
      }}
    />
  )
}

export default function PdfPreview() {
  const t         = useT()
  const resume    = useResumeStore((s) => s.resume)
  const debounced = useDebounce(resume, 350)
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom]   = useState(0.6)
  const [overflow, setOverflow] = useState({})  // { pageIdx: bool }

  const paper = PAPER[resume.customize.paper] || PAPER.A4

  // Fetch and split once per meaningful change.
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    fetch('/api/export/html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: debounced }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 400)}`)
        return r.text()
      })
      .then((txt) => {
        if (cancelled) return
        const split = splitByPageBreaks(txt)
        setPages(split)
        setOverflow({})
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Preview failed') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debounced])

  const setOverflowFor = useCallback((i, v) => {
    setOverflow((prev) => prev[i] === v ? prev : { ...prev, [i]: v })
  }, [])

  // --------- PDF download via backend (WeasyPrint) ----------
  const downloadPdf = async () => {
    setError('')
    try {
      const r = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      })
      if (!r.ok) {
        let msg = `${r.status} ${r.statusText}`
        try {
          const body = await r.text()
          try { const j = JSON.parse(body); if (j.detail) msg = j.detail } catch { msg = body || msg }
        } catch {}
        throw new Error(msg)
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${resume.title || 'resume'}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError('WeasyPrint PDF failed: ' + String(e.message || e) +
               '\nFall back to "Print to PDF" (button next to Download).')
    }
  }

  // --------- Browser-side PDF via print dialog (fallback) ----------
  // Renders the full HTML into a hidden window and calls window.print().
  // User picks "Save as PDF" in the print dialog. Works on any machine
  // without WeasyPrint / GTK3.
  const printPdf = async () => {
    setError('')
    try {
      const r = await fetch('/api/export/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      })
      if (!r.ok) throw new Error(await r.text())
      const html = await r.text()

      // Open a new window, inject HTML with <base> for /uploads/, wait for
      // images to load, then print.
      const w = window.open('', '_blank')
      if (!w) throw new Error('Popup blocked — allow popups for localhost.')
      // Inject @page size so the print dialog respects the user's paper choice
      const pageCss = `
        <style>
          @page { size: ${resume.customize.paper}; margin: 0; }
          html, body { margin: 0; padding: 0; background: white; }
        </style>
      `
      // Rewrite the source to include our base href and @page rule in head
      const patched = html.replace(
        /<head([^>]*)>/i,
        `<head$1><base href="${window.location.origin}/">${pageCss}`,
      )
      w.document.open()
      w.document.write(patched)
      w.document.close()

      // Wait for images
      const waitForImages = () => new Promise((resolve) => {
        const imgs = Array.from(w.document.images || [])
        if (imgs.length === 0) return resolve()
        let left = imgs.length
        const done = () => { if (--left <= 0) resolve() }
        imgs.forEach((img) => {
          if (img.complete) done()
          else { img.addEventListener('load', done, { once: true })
                 img.addEventListener('error', done, { once: true }) }
        })
        setTimeout(resolve, 2500)  // safety timeout
      })
      await waitForImages()
      w.focus()
      w.print()
      // Don't close — user may want to cancel and re-try
    } catch (e) {
      setError('Print-to-PDF failed: ' + String(e.message || e))
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(34,211,238,0.08) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, rgba(0,0,0,0.4) 60%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, rgba(0,0,0,0.4) 60%, transparent 90%)',
        }}/>

      {/* top bar */}
      <div className="relative flex items-center justify-between px-4 h-11 border-b border-white/10 bg-zinc-950/90 backdrop-blur flex-shrink-0 z-10">
        <div className="text-xs text-zinc-400 flex items-center gap-2 uppercase tracking-widest">
          <span className="font-mono">Codex</span>
          <span className="text-zinc-600">·</span>
          <span className="text-cyan-400 font-mono normal-case tracking-normal">
            {paper.mm.w}×{paper.mm.h}mm
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-cyan-400 font-mono normal-case tracking-normal">
            {pages.length} {pages.length === 1 ? t('preview.folio') : t('preview.folios')}
          </span>
          {loading && <Loader2 size={12} className="animate-spin text-cyan-400"/>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white" title="Zoom out">
            <ZoomOut size={14}/>
          </button>
          <span className="tabular-nums text-xs text-zinc-400 w-10 text-center font-mono">
            {Math.round(zoom*100)}%
          </span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white" title="Zoom in">
            <ZoomIn size={14}/>
          </button>
          <button onClick={() => setZoom(0.6)}
            className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white" title="Reset zoom">
            <Maximize2 size={14}/>
          </button>
          <div className="w-px h-5 bg-white/10 mx-2"/>
          <button onClick={printPdf}
            className="btn-secondary"
            title="Print to PDF using browser's print dialog (works without WeasyPrint)">
            <Printer size={12}/> Print
          </button>
          <button onClick={downloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-black text-xs font-semibold shadow-[0_0_12px_-2px_rgba(34,211,238,0.6)]">
            <Download size={12}/> PDF
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="relative z-10 mx-6 mt-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <div className="font-semibold text-red-300 mb-0.5">Error</div>
            <div className="text-red-300/80 break-words whitespace-pre-wrap">{error}</div>
            <a
              href="http://localhost:8000/api/diagnostics"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 text-cyan-400 hover:text-cyan-300 underline"
            >{t('preview.diagnostics')} → /api/diagnostics</a>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 text-xs">×</button>
        </div>
      )}

      {/* viewport */}
      <div className="relative flex-1 overflow-auto z-10">
        <div className="min-h-full flex flex-col items-center py-12 px-6 gap-14">
          {pages.map((html, i) => {
            const w = paper.w * zoom
            const h = paper.h * zoom
            const pageOverflow = overflow[i]
            return (
              <div key={i} className="relative" style={{ width: w, height: h }}>
                <div className="absolute -top-9 left-0 right-0 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-400/70 font-mono">
                    <CompassRose/>
                    <span>Folio {toRoman(i + 1)}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-500 tracking-widest">{paper.mm.w}×{paper.mm.h} MM</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.3em] font-mono">
                    {pageOverflow ? (
                      <span className="text-amber-400" title="Add a Page Break module in Content to split here">
                        ⚠ exceeds page
                      </span>
                    ) : (
                      <span className="text-zinc-600">{i + 1} / {pages.length}</span>
                    )}
                  </div>
                </div>

                <CornerMarks w={w} h={h}/>
                <RulerTicks height={h}/>

                <div className="origin-top-left relative"
                  style={{
                    width: paper.w, height: paper.h,
                    transform: `scale(${zoom})`,
                    boxShadow:
                      '0 0 0 1px rgba(255,255,255,0.06), ' +
                      '0 30px 80px -20px rgba(0,0,0,0.9), ' +
                      '0 0 40px -10px rgba(34,211,238,0.12)',
                    background: 'white',
                    overflow: 'hidden',
                  }}>
                  <PageFrame
                    html={html}
                    paperW={paper.w}
                    paperH={paper.h}
                    onOverflow={(v) => setOverflowFor(i, v)}
                  />
                </div>
              </div>
            )
          })}

          {pages.length > 0 && (
            <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.3em] text-center pt-2">
              {t('preview.end')}
              <div className="text-zinc-700 normal-case tracking-normal italic mt-2">
                {t('preview.ex_libris')} {resume.customize.paper}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
