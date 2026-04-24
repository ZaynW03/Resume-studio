// Thin fetch wrappers around the FastAPI backend.
const BASE = ''

async function json(url, opts = {}) {
  const r = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`)
  return r.json()
}

export const api = {
  // ---- resumes ----
  listResumes: () => json('/api/resume'),
  createResume: (resume) =>
    json('/api/resume', { method: 'POST', body: resume ? JSON.stringify(resume) : '' }),
  getResume: (id) => json(`/api/resume/${id}`),
  saveResume: (resume) =>
    json(`/api/resume/${resume.id}`, { method: 'PUT', body: JSON.stringify(resume) }),
  deleteResume: (id) => json(`/api/resume/${id}`, { method: 'DELETE' }),

  // ---- profile library ----
  getProfile: () => json('/api/profile'),
  saveProfile: (profile) =>
    json('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),

  // ---- parse ----
  uploadResume: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/parse/upload', { method: 'POST', body: fd })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  uploadPhoto: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/parse/photo', { method: 'POST', body: fd })
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`
      try {
        const body = await r.text()
        // FastAPI error bodies are usually {"detail": "..."}
        try { const j = JSON.parse(body); if (j.detail) msg = j.detail } catch { msg = body || msg }
      } catch {}
      throw new Error(msg)
    }
    return r.json()
  },

  // ---- llm ----
  llmStatus: () => json('/api/llm/status'),
  analyze: (resumeId, jd) =>
    json('/api/llm/analyze', { method: 'POST', body: JSON.stringify({ resume_id: resumeId, jd }) }),
  recommend: (jd, moduleType, language) =>
    json('/api/llm/recommend', {
      method: 'POST',
      body: JSON.stringify({ jd, module_type: moduleType, language }),
    }),
  generate: (jd, language) =>
    json('/api/llm/generate', { method: 'POST', body: JSON.stringify({ jd, language }) }),
  improve: (text, jd, language) =>
    json('/api/llm/improve', { method: 'POST', body: JSON.stringify({ text, jd, language }) }),

  // ---- export ----
  previewHtmlUrl: '/api/export/html', // POST body: {resume}
  exportPdf: async (resume) => {
    const r = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume }),
    })
    if (!r.ok) throw new Error(await r.text())
    return r.blob()
  },
}
