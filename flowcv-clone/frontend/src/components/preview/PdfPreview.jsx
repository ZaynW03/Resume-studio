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

function splitHtmlDocument(fullHtml) {
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const bodyTagMatch = fullHtml.match(/<body[^>]*>/i)
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return {
    head: headMatch ? headMatch[1] : '',
    bodyTag: bodyTagMatch ? bodyTagMatch[0] : '<body>',
    bodyContent: bodyMatch ? bodyMatch[1] : fullHtml,
  }
}

function serializeHtmlPage({ head, bodyTag, bodyInnerHtml }) {
  return `<!DOCTYPE html><html><head>${head}</head>${bodyTag}${bodyInnerHtml}</body></html>`
}

function withBase(fullHtml, extraHead = '') {
  return fullHtml.replace(
    /<head([^>]*)>/i,
    `<head$1><base href="${window.location.origin}/">${extraHead}`,
  )
}

async function waitForFrameAssets(doc) {
  const fontsReady = doc.fonts?.ready?.catch?.(() => {}) || Promise.resolve()
  const imagesReady = new Promise((resolve) => {
    const imgs = Array.from(doc.images || [])
    if (imgs.length === 0) {
      setTimeout(resolve, 120)
      return
    }
    let left = imgs.length
    const done = () => {
      left -= 1
      if (left <= 0) resolve()
    }
    imgs.forEach((img) => {
      if (img.complete) done()
      else {
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
      }
    })
    setTimeout(resolve, 2500)
  })
  await Promise.all([fontsReady, imagesReady])
  await new Promise((resolve) => setTimeout(resolve, 120))
}

async function paginateRenderedHtml(fullHtml, paper) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = `${paper.w}px`
  iframe.style.height = `${paper.h}px`
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) return []

    doc.open()
    doc.write(withBase(fullHtml))
    doc.close()
    await waitForFrameAssets(doc)

    const bodyStyle = window.getComputedStyle(doc.body)
    const paddingTop = parseFloat(bodyStyle.paddingTop || '0') || 0
    const paddingRight = parseFloat(bodyStyle.paddingRight || '0') || 0
    const paddingBottom = parseFloat(bodyStyle.paddingBottom || '0') || 0
    const paddingLeft = parseFloat(bodyStyle.paddingLeft || '0') || 0
    const contentHeight = paper.h - paddingTop - paddingBottom
    const contentWidth = paper.w - paddingLeft - paddingRight
    const bodyRect = doc.body.getBoundingClientRect()
    const contentBottom = Math.max(0, (doc.body.scrollHeight || 0) - paddingTop - paddingBottom)

    const { head } = splitHtmlDocument(doc.documentElement.outerHTML)
    const original = splitHtmlDocument(fullHtml)

    const moduleRects = Array.from(doc.querySelectorAll('.resume-module')).map((node) => {
      const rect = node.getBoundingClientRect()
      const top = Math.max(0, rect.top - bodyRect.top - paddingTop)
      const bottom = Math.max(top, rect.bottom - bodyRect.top - paddingTop)
      return {
        top,
        bottom,
        name: node.dataset.moduleName || '',
      }
    })

    const forcedBreaks = Array.from(doc.querySelectorAll('.page-break'))
      .map((node) => {
        const rect = node.getBoundingClientRect()
        return Math.max(0, rect.top - bodyRect.top - paddingTop)
      })
      .filter((v) => v > 1 && v < contentBottom - 1)
      .sort((a, b) => a - b)

    const starts = [0]
    let cursor = 0
    while (cursor < contentBottom - 1) {
      const nextForced = forcedBreaks.find((v) => v > cursor + 1 && v <= cursor + contentHeight + 1)
      const next = nextForced || Math.min(cursor + contentHeight, contentBottom)
      if (next <= cursor + 1) break
      starts.push(next)
      cursor = next
    }

    const uniqueStarts = starts.filter((v, idx) => idx === 0 || Math.abs(v - starts[idx - 1]) > 1)
    const pages = []
    for (let i = 0; i < uniqueStarts.length - 1; i += 1) {
      const start = uniqueStarts[i]
      const end = uniqueStarts[i + 1]
      const moduleNames = moduleRects
        .filter((m) => m.bottom > start + 1 && m.top < end - 1)
        .map((m) => m.name)

      const sliceStyle = `
        <style>
          html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: white !important; }
          .page-viewport {
            box-sizing: border-box;
            width: ${paper.w}px;
            height: ${paper.h}px;
            padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;
            overflow: hidden;
            background: white;
          }
          .page-content {
            width: ${contentWidth}px;
            height: ${contentHeight}px;
            overflow: hidden;
            position: relative;
          }
          .page-canvas {
            width: ${contentWidth}px;
            position: absolute;
            top: 0;
            left: 0;
            transform: translateY(-${start}px);
            transform-origin: top left;
          }
          .page-canvas .page-break { visibility: hidden !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }
        </style>
      `

      pages.push({
        html: serializeHtmlPage({
          head: `${head}${sliceStyle}`,
          bodyTag: '<body>',
          bodyInnerHtml: `<div class="page-viewport"><div class="page-content"><div class="page-canvas">${original.bodyContent}</div></div></div>`,
        }),
        moduleNames,
        overflow: false,
      })
    }

    return pages
  } finally {
    iframe.remove()
  }
}

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

function PageFrame({ html, paperW, paperH }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame || !html) return
    const doc = frame.contentDocument
    if (!doc) return

    doc.open()
    doc.write(withBase(html))
    doc.close()

    const st = doc.createElement('style')
    st.textContent = 'body { pointer-events:none; user-select:none; overflow:hidden; }'
    doc.head.appendChild(st)
  }, [html, paperH])

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
  const [overflow, setOverflow] = useState({})

  const paper = PAPER[resume.customize.paper] || PAPER.A4

  const fetchRenderedHtml = useCallback(async () => {
    const r = await fetch('/api/export/html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume }),
    })
    if (!r.ok) throw new Error(await r.text())
    return r.text()
  }, [resume])

  const openPrintWindow = useCallback(async (html) => {
    const w = window.open('', '_blank')
    if (!w) throw new Error('Popup blocked — allow popups for localhost.')

    const pageCss = `
      <style>
        @page { size: ${resume.customize.paper}; margin: 0; }
        html, body { margin: 0; padding: 0; background: white; }
      </style>
    `
    w.document.open()
    w.document.write(withBase(html, pageCss))
    w.document.close()
    await waitForFrameAssets(w.document)
    w.focus()
    w.print()
  }, [resume.customize.paper])

  const downloadClientPdf = useCallback(async () => {
    const [{ jsPDF }, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ])
    const html2canvas = html2canvasModule.default
    const renderPages = pages.length ? pages : await paginateRenderedHtml(await fetchRenderedHtml(), paper)
    if (!renderPages.length) throw new Error('Nothing to export yet.')

    const pdf = new jsPDF({
      orientation: paper.mm.w > paper.mm.h ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [paper.mm.w, paper.mm.h],
      compress: true,
    })

    for (let i = 0; i < renderPages.length; i += 1) {
      const frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.left = '-10000px'
      frame.style.top = '0'
      frame.style.width = `${paper.w}px`
      frame.style.height = `${paper.h}px`
      frame.style.border = '0'
      frame.style.background = 'white'
      document.body.appendChild(frame)

      try {
        const doc = frame.contentDocument
        if (!doc) throw new Error('Unable to create preview frame for PDF download.')
        doc.open()
        doc.write(withBase(renderPages[i].html))
        doc.close()
        await waitForFrameAssets(doc)

        const canvas = await html2canvas(doc.body, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          width: paper.w,
          height: paper.h,
          windowWidth: paper.w,
          windowHeight: paper.h,
        })
        const imgData = canvas.toDataURL('image/jpeg', 0.98)
        if (i > 0) pdf.addPage([paper.mm.w, paper.mm.h], paper.mm.w > paper.mm.h ? 'landscape' : 'portrait')
        pdf.addImage(imgData, 'JPEG', 0, 0, paper.mm.w, paper.mm.h, undefined, 'FAST')
      } finally {
        frame.remove()
      }
    }

    pdf.save(`${resume.title || 'resume'}.pdf`)
  }, [fetchRenderedHtml, pages, paper, resume.title])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    ;(async () => {
      try {
        const txt = await fetchRenderedHtml()
        const paged = await paginateRenderedHtml(txt, paper)
        if (cancelled) return
        setPages(paged)
        setOverflow({})
      } catch (e) {
        if (!cancelled) setError(e.message || 'Preview failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [debounced, fetchRenderedHtml, paper])

  const setOverflowFor = useCallback((i, v) => {
    setOverflow((prev) => prev[i] === v ? prev : { ...prev, [i]: v })
  }, [])

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
      a.href = url
      a.download = `${resume.title || 'resume'}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      try {
        await downloadClientPdf()
        setError('')
      } catch (fallbackErr) {
        setError(
          'WeasyPrint PDF failed: ' + String(e.message || e) +
          '\nBrowser PDF fallback also failed: ' + String(fallbackErr.message || fallbackErr)
        )
      }
    }
  }

  const printPdf = async () => {
    setError('')
    try {
      const html = await fetchRenderedHtml()
      await openPrintWindow(html)
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
            title="Print to PDF using browser's print dialog">
            <Printer size={12}/> Print
          </button>
          <button onClick={downloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-black text-xs font-semibold shadow-[0_0_12px_-2px_rgba(34,211,238,0.6)]">
            <Download size={12}/> PDF
          </button>
        </div>
      </div>

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

      <div className="relative flex-1 overflow-auto z-10">
        <div className="min-h-full flex flex-col items-center py-12 px-6 gap-14">
          {pages.map((page, i) => {
            const w = paper.w * zoom
            const h = paper.h * zoom
            const pageOverflow = overflow[i] ?? page.overflow
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
                      <span className="text-amber-400" title="Use the page planner in Customize to start a new page before a module.">
                        ⚠ exceeds page
                      </span>
                    ) : (
                      <span className="text-zinc-600">{i + 1} / {pages.length}</span>
                    )}
                  </div>
                </div>

                {page.moduleNames.length > 0 && (
                  <div className="absolute -bottom-8 left-0 right-0 text-[10px] text-zinc-600 font-mono truncate">
                    {page.moduleNames.join(' · ')}
                  </div>
                )}

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
                    html={page.html}
                    paperW={paper.w}
                    paperH={paper.h}
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
