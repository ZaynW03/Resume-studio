import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useResumeStore } from '../../store/resumeStore'
import {
  Loader2, ZoomIn, ZoomOut, Maximize2, AlertTriangle, Printer,
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

function splitHtmlDocument(fullHtml) {
  const headMatch    = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const bodyTagMatch = fullHtml.match(/<body[^>]*>/i)
  const bodyMatch    = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return {
    head:        headMatch    ? headMatch[1]    : '',
    bodyTag:     bodyTagMatch ? bodyTagMatch[0] : '<body>',
    bodyContent: bodyMatch    ? bodyMatch[1]    : fullHtml,
  }
}

function serializeHtmlPage({ head, bodyTag, bodyInnerHtml }) {
  return `<!DOCTYPE html><html><head>${head}</head>${bodyTag}${bodyInnerHtml}</body></html>`
}

function withBase(fullHtml) {
  return fullHtml.replace(
    /<head([^>]*)>/i,
    `<head$1><base href="${window.location.origin}/">`,
  )
}

async function waitForFrameAssets(doc, extraMs = 150) {
  const fontsReady   = doc.fonts?.ready?.catch?.(() => {}) || Promise.resolve()
  const imagesReady  = new Promise((resolve) => {
    const imgs = Array.from(doc.images || [])
    if (imgs.length === 0) { setTimeout(resolve, 80); return }
    let left = imgs.length
    const done = () => { if (--left <= 0) resolve() }
    imgs.forEach((img) => {
      if (img.complete) done()
      else {
        img.addEventListener('load',  done, { once: true })
        img.addEventListener('error', done, { once: true })
      }
    })
    setTimeout(resolve, 2500)
  })
  await Promise.all([fontsReady, imagesReady])
  await new Promise((resolve) => setTimeout(resolve, extraMs))
}

/**
 * Measurement iframe: positioned at (0,0) with opacity:0 so browsers compute
 * flex/SVG layout normally (off-screen elements skip some calculations).
 */
function makeHiddenFrame(w, h) {
  const frame = document.createElement('iframe')
  frame.setAttribute('scrolling', 'no')
  frame.style.cssText = [
    'position:fixed', 'left:0', 'top:0',
    `width:${w}px`, `height:${h}px`,
    'border:0', 'background:white', 'overflow:hidden',
    'pointer-events:none', 'opacity:0', 'z-index:-1',
  ].join(';')
  return frame
}

// Inline styles for page slices so there are no CSS-class conflicts when
// multiple pages share a document (print window), and so html2canvas sees
// standard positioned layout instead of CSS transforms.
function makePageHtml({ head, paper, paddingTop, paddingRight, paddingBottom, paddingLeft,
                        contentWidth, pageContentH, start, bodyContent }) {
  const minStyle = `<style>
    html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:white!important;}
    .page-break{visibility:hidden!important;height:0!important;margin:0!important;padding:0!important;}
  </style>`

  // Use position:absolute + top:-Npx (not CSS transform) — html2canvas handles
  // absolute positioning + overflow:hidden more reliably than transforms.
  const bodyInnerHtml =
    `<div style="box-sizing:border-box;width:${paper.w}px;height:${paper.h}px;` +
    `padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;` +
    `overflow:hidden;background:white;">` +
    `<div style="width:${contentWidth}px;height:${pageContentH}px;overflow:hidden;position:relative;">` +
    `<div style="width:${contentWidth}px;position:absolute;top:-${start}px;left:0;">` +
    bodyContent +
    `</div></div></div>`

  return serializeHtmlPage({
    head: head + minStyle,
    bodyTag: '<body>',
    bodyInnerHtml,
  })
}

async function paginateRenderedHtml(fullHtml, paper) {
  const iframe = makeHiddenFrame(paper.w, paper.h)
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) return []

    doc.open()
    doc.write(withBase(fullHtml).replace('</head>', '<style>html,body{overflow:hidden!important;}</style></head>'))
    doc.close()
    await waitForFrameAssets(doc)

    const iframeWin  = iframe.contentWindow
    const bodyStyle  = iframeWin.getComputedStyle(doc.body)
    const paddingTop    = parseFloat(bodyStyle.paddingTop    || '0') || 0
    const paddingRight  = parseFloat(bodyStyle.paddingRight  || '0') || 0
    const paddingBottom = parseFloat(bodyStyle.paddingBottom || '0') || 0
    const paddingLeft   = parseFloat(bodyStyle.paddingLeft   || '0') || 0
    const contentHeight = paper.h - paddingTop - paddingBottom
    const contentWidth  = paper.w - paddingLeft - paddingRight
    const bodyRect      = doc.body.getBoundingClientRect()
    const contentBottom = Math.max(0, (doc.body.scrollHeight || 0) - paddingTop - paddingBottom)

    const { head }   = splitHtmlDocument(doc.documentElement.outerHTML)
    const original   = splitHtmlDocument(fullHtml)

    const moduleRects = Array.from(doc.querySelectorAll('.resume-module')).map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        top:  Math.max(0, rect.top  - bodyRect.top - paddingTop),
        bottom: Math.max(0, rect.bottom - bodyRect.top - paddingTop),
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

    const blockRects = Array.from(doc.querySelectorAll(
      'h2, p, li, .entry, .entry-title, .entry-sub, .meta-row, .skills-group, .contact-item'
    )).map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top:    Math.max(0, rect.top    - bodyRect.top - paddingTop),
        bottom: Math.max(0, rect.bottom - bodyRect.top - paddingTop),
      }
    })

    const headingRects = Array.from(doc.querySelectorAll('h2.section')).map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top:    Math.max(0, rect.top    - bodyRect.top - paddingTop),
        bottom: Math.max(0, rect.bottom - bodyRect.top - paddingTop),
      }
    })

    const starts = [0]
    let cursor = 0
    while (cursor < contentBottom - 1) {
      const maxEnd      = cursor + contentHeight
      const nextForced  = forcedBreaks.find((v) => v > cursor + 1 && v <= maxEnd + 1)

      let next
      if (nextForced) {
        next = nextForced
      } else if (maxEnd >= contentBottom) {
        next = contentBottom
      } else {
        let walkBackTop = -1
        for (const r of blockRects) {
          if (r.top < maxEnd && r.bottom > maxEnd + 0.5 && r.top > cursor + 10) {
            walkBackTop = Math.max(walkBackTop, r.top)
          }
        }
        next = walkBackTop > cursor + 10 ? walkBackTop : maxEnd

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
      const end   = uniqueStarts[i + 1]
      const pageContentH = Math.min(end - start, contentHeight)

      const moduleNames = moduleRects
        .filter((m) => m.bottom > start + 1 && m.top < end - 1)
        .map((m) => m.name)

      pages.push({
        html: makePageHtml({
          head, paper, paddingTop, paddingRight, paddingBottom, paddingLeft,
          contentWidth, pageContentH, start,
          bodyContent: original.bodyContent,
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

// ─── PageFrame ────────────────────────────────────────────────────────────────
// forwardRef so PdfPreview can access the iframe DOM node directly for capture.

const PageFrame = forwardRef(function PageFrame({ html, paperW, paperH }, ref) {
  const iframeRef = useRef(null)
  useImperativeHandle(ref, () => iframeRef.current)

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame || !html) return
    const doc = frame.contentDocument
    if (!doc) return
    doc.open()
    doc.write(withBase(html))
    doc.close()
    const st = doc.createElement('style')
    st.textContent = 'body{pointer-events:none;user-select:none;overflow:hidden;}'
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
})

// ─── PdfPreview ───────────────────────────────────────────────────────────────

export default function PdfPreview() {
  const t         = useT()
  const resume    = useResumeStore((s) => s.resume)
  const debounced = useDebounce(resume, 350)
  const [pages, setPages]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [zoom, setZoom]       = useState(0.6)
  const [overflow, setOverflow] = useState({})

  // Refs to the live preview iframes — used by downloadClientPdf to capture
  // exactly what the user sees without re-rendering in a hidden iframe.
  const pageFrameRefs = useRef([])

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

  const fetchRef = useRef(fetchRenderedHtml)
  fetchRef.current = fetchRenderedHtml

  // Print: build a multi-page document from the same paginated pages the
  // preview shows, so page breaks are identical between preview and print.
  const openPrintWindow = useCallback(async () => {
    if (!pages.length) throw new Error('Preview is still loading — please try again.')
    const w = window.open('', '_blank')
    if (!w) throw new Error('Popup blocked — allow popups for localhost.')

    // All pages share the same <head> CSS (template styles + minimal overrides).
    const { head: sharedHead } = splitHtmlDocument(pages[0].html)

    // Stack pages vertically; each div is exactly one paper page with
    // page-break-after:always so the browser maps it to one printed page.
    const allPagesHtml = pages.map((page, i) => {
      const { bodyContent } = splitHtmlDocument(page.html)
      const notLast = i < pages.length - 1
      return (
        `<div style="width:${paper.w}px;height:${paper.h}px;overflow:hidden;` +
        (notLast ? 'page-break-after:always;break-after:page;' : '') +
        `">${bodyContent}</div>`
      )
    }).join('\n')

    const printHtml =
      `<!DOCTYPE html><html><head>${sharedHead}` +
      `<style>@page{size:${resume.customize.paper};margin:0;}` +
      `html,body{margin:0;padding:0;background:white;}</style>` +
      `</head><body>${allPagesHtml}</body></html>`

    w.document.open()
    w.document.write(withBase(printHtml))
    w.document.close()
    await waitForFrameAssets(w.document)
    w.focus()
    w.print()
  }, [pages, paper, resume.customize.paper])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const txt   = await fetchRef.current()
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
  }, [debounced, paper])

  const setOverflowFor = useCallback((i, v) => {
    setOverflow((prev) => prev[i] === v ? prev : { ...prev, [i]: v })
  }, [])

  const printPdf = async () => {
    setError('')
    try {
      await openPrintWindow()
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
            {Math.round(zoom * 100)}%
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
            className="btn-primary"
            title="Print or save the current preview as PDF">
            <Printer size={12}/> Print & Save
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
                    ref={(el) => { pageFrameRefs.current[i] = el }}
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
