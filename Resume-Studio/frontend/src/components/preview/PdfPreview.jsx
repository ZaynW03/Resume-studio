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
    // overflow:hidden prevents the scrollbar from appearing when content is taller
    // than the iframe, which would otherwise reduce content width ~15px on Windows
    // and cause text to reflow differently from the final render iframes.
    doc.write(withBase(fullHtml, '<style>html,body{overflow:hidden!important;}</style>'))
    doc.close()
    await waitForFrameAssets(doc)

    // Use the iframe's own window so getComputedStyle reads the iframe's CSS context
    const iframeWin = iframe.contentWindow
    const bodyStyle = iframeWin.getComputedStyle(doc.body)
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

    // Collect block-level element rects for safe-break detection
    const blockRects = Array.from(doc.querySelectorAll(
      'h2, p, li, .entry, .entry-title, .entry-sub, .meta-row, .skills-group, .contact-item'
    )).map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top: Math.max(0, rect.top - bodyRect.top - paddingTop),
        bottom: Math.max(0, rect.bottom - bodyRect.top - paddingTop),
      }
    })

    // Section headings measured separately for anti-orphan detection
    const headingRects = Array.from(doc.querySelectorAll('h2.section')).map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top: Math.max(0, rect.top - bodyRect.top - paddingTop),
        bottom: Math.max(0, rect.bottom - bodyRect.top - paddingTop),
      }
    })

    const starts = [0]
    let cursor = 0
    while (cursor < contentBottom - 1) {
      const maxEnd = cursor + contentHeight
      const nextForced = forcedBreaks.find((v) => v > cursor + 1 && v <= maxEnd + 1)

      let next
      if (nextForced) {
        next = nextForced
      } else if (maxEnd >= contentBottom) {
        next = contentBottom
      } else {
        // Walk back from maxEnd: among all block elements that straddle the
        // page boundary, pick the one with the LARGEST top (innermost element,
        // closest to maxEnd). This avoids cutting through the element while
        // minimising the blank space left at the bottom of the page.
        // Using Math.min (outermost) was the old behaviour; it went back to the
        // containing .entry div and left a large gap.
        let walkBackTop = -1
        for (const r of blockRects) {
          if (r.top < maxEnd && r.bottom > maxEnd + 0.5 && r.top > cursor + 10) {
            walkBackTop = Math.max(walkBackTop, r.top)
          }
        }
        // If no element straddles the boundary (gap between sections), fall back to
        // the natural page boundary rather than leaving `next` undefined (→ NaN).
        next = walkBackTop > cursor + 10 ? walkBackTop : maxEnd

        // Anti-orphan: if a section heading near the bottom of this page has no
        // block content following it before the break, push the break to before it.
        for (const hr of headingRects) {
          if (hr.top <= cursor + 10 || hr.top >= next) continue
          const hasContentAfter = blockRects.some(
            (br) => br.top > hr.bottom - 1 && br.top < next
          )
          if (!hasContentAfter && hr.top > cursor + 10) {
            next = Math.min(next, hr.top)
          }
        }
        next = Math.min(next, contentBottom)
      }

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

      // Clip exactly to this page's content range to prevent overlap with adjacent pages
      const pageContentH = Math.min(end - start, contentHeight)

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
            height: ${pageContentH}px;
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
    <div className="flex-1 flex flex-col h-full min-h-0 relative bg-ink-900 overflow-hidden">

      <div className="relative flex items-center justify-between px-4 h-11 border-b border-gray-200 bg-white flex-shrink-0 z-10">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="font-mono text-gray-400">{paper.mm.w}×{paper.mm.h} mm</span>
          <span className="text-gray-300">·</span>
          <span className="text-indigo-600 font-mono">
            {pages.length} {pages.length === 1 ? t('preview.folio') : t('preview.folios')}
          </span>
          {loading && <Loader2 size={12} className="animate-spin text-indigo-500"/>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Zoom out">
            <ZoomOut size={14}/>
          </button>
          <span className="tabular-nums text-xs text-gray-500 w-10 text-center font-mono">
            {Math.round(zoom*100)}%
          </span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Zoom in">
            <ZoomIn size={14}/>
          </button>
          <button onClick={() => setZoom(0.6)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Reset zoom">
            <Maximize2 size={14}/>
          </button>
          <div className="w-px h-5 bg-gray-200 mx-2"/>
          <button onClick={printPdf}
            className="btn-secondary"
            title="Print to PDF using browser's print dialog">
            <Printer size={12}/> Print
          </button>
          <button onClick={downloadPdf}
            className="btn-primary">
            <Download size={12}/> PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="relative z-10 mx-6 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <div className="font-semibold text-red-700 mb-0.5">Error</div>
            <div className="text-red-600 break-words whitespace-pre-wrap">{error}</div>
            <a
              href="http://localhost:8000/api/diagnostics"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 text-indigo-600 hover:text-indigo-500 underline"
            >{t('preview.diagnostics')} → /api/diagnostics</a>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-xs">×</button>
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
                <div className="absolute -top-7 left-0 right-0 flex items-center justify-between">
                  <div className="text-[10px] text-gray-400 font-mono">
                    Page {i + 1}
                  </div>
                  <div className="text-[10px] font-mono">
                    {pageOverflow ? (
                      <span className="text-amber-500" title="Use the page planner in Customize to start a new page before a module.">
                        ⚠ exceeds page
                      </span>
                    ) : (
                      <span className="text-gray-400">{i + 1} / {pages.length}</span>
                    )}
                  </div>
                </div>

                {page.moduleNames.length > 0 && (
                  <div className="absolute -bottom-7 left-0 right-0 text-[10px] text-gray-400 font-mono truncate">
                    {page.moduleNames.join(' · ')}
                  </div>
                )}

                <div className="origin-top-left relative"
                  style={{
                    width: paper.w, height: paper.h,
                    transform: `scale(${zoom})`,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
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
            <div className="text-[10px] text-gray-400 font-mono text-center pt-2">
              {t('preview.end')} · {resume.customize.paper}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
