# FlowCV Clone — local resume builder

A local, FlowCV-style resume builder. Front / back separated.

- **Import** a PDF or image resume (EN / ZH) → auto-parse into structured JSON
- **Edit** with per-module shape-aware forms and a TipTap rich-text editor
- **Customize** templates, layout, spacing, headings, personal-block layout, photo
- **Preview** is the *exact* HTML that WeasyPrint will render to PDF (WYSIWYG)
- **Profile library** — a persistent pool of your history, reusable across resumes
- **Optional LLM** — paste a JD to get a match score, recommendations, a full
  tailored resume generated from your library, or “AI improve” on any bullet

Everything is stored as plain JSON files under `backend/data/`.
No external database. No account. Fully offline unless you add an API key.

---

## Quick start

### 1. System prerequisites

These three are the usual stumbling blocks — install once, then never think
about them again.

| Tool | macOS (Homebrew) | Ubuntu / Debian | Purpose |
|---|---|---|---|
| **Tesseract OCR** (with Chinese) | `brew install tesseract tesseract-lang` | `sudo apt install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng` | OCR fallback for scanned PDFs / images |
| **Poppler** | `brew install poppler` | `sudo apt install poppler-utils` | `pdf2image` backend |
| **WeasyPrint** native libs | `brew install pango cairo gdk-pixbuf libffi` | `sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libffi-dev` | PDF rendering |

Also required: **Python 3.10+**, **Node.js 18+**.

### 2. One command

From the project root:

```bash
./start.sh
```

This creates a Python venv, installs deps, copies `.env.example` to `.env` if
needed, and boots both servers:

- Backend (FastAPI): <http://localhost:8000>
- Frontend (Vite): <http://localhost:5173>

Open the frontend URL. Ctrl+C once to stop both.

### 3. Manual start (if you prefer separate terminals)

Terminal A — backend:
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit if you want LLM features
uvicorn app.main:app --reload --port 8000
```

Terminal B — frontend:
```bash
cd frontend
npm install
npm run dev
```

### 4. (Optional) enable LLM features

Edit `backend/.env`:

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Or OpenAI / any OpenAI-compatible endpoint (Ollama, LM Studio, …):

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=            # optional, e.g. http://localhost:11434/v1 for Ollama
OPENAI_MODEL=gpt-4o-mini
```

Restart the backend. In **Content → JD match & AI generate**, paste a JD and
use **Analyze** or **Generate from library**. Each entry editor gains an “AI
improve” button next to the description.

---

## How to use

### Import an existing resume
Top bar → **Import PDF/Image** → pick a file.
- Text-based PDFs are extracted with `pdfplumber` (fast, accurate).
- Scanned PDFs / images fall back to Tesseract OCR (`chi_sim+eng`).
- The text is section-matched (regex on both English and Chinese aliases:
  `工作经历`, `教育`, `项目`, `技能`, …) and each section is split into dated
  entries.

### Edit content
Left sidebar → **Content**. Top of the panel is the personal-details block;
below it, the module list. Click a module to open its entries; click an entry
to open the shape-aware editor. Every description field is a TipTap editor
with bold / italic / underline / alignment / bullet & numbered lists / links.

Drag the grip handles to reorder entries (inside a module) or modules
themselves. Each module and entry has an independent **hide** toggle —
hidden items disappear from the preview and PDF but are kept in the JSON.

Click the icon next to a module name to pick a different Lucide icon.
Double-click the module name to rename it.

### Reuse history across resumes
Left sidebar → **Profile**. This library is global and persisted in
`backend/data/profile.json`. Any entry here can be imported into the
currently-open resume with one click (**Use in resume**).

### Customize
Left sidebar → **Customize**.
- **Template** — `classic` is included; add more by dropping a Jinja2 file
  at `backend/app/templates/<name>.html` and referencing it by `id`.
- **Layout & Page breaks** — paper size, column count, per-module page breaks.
- **Spacing & Font** — font family, size, line height, section margin,
  space between entries, page margin.
- **Section headings** — font, size, case (UPPER / lower / Title), weight,
  heading and accent colors.
- **Personal details block** — alignment and arrangement.
- **Photo** — show/hide, shape (circle / square / rounded), position relative
  to personal details (left / right / top), size.

Every change is reflected in the right-side preview immediately, and the
preview *is* the HTML that WeasyPrint will turn into your PDF.

### Export
Preview top bar → **Download PDF**.

---

## API surface

All JSON, under `http://localhost:8000`:

```
GET    /api/health

# Resumes
GET    /api/resume                List all resumes (id, title, updated_at)
POST   /api/resume                Create (pass body to seed, or empty for default)
GET    /api/resume/{id}
PUT    /api/resume/{id}           Replace with full Resume JSON
DELETE /api/resume/{id}

# Profile library
GET    /api/profile
PUT    /api/profile

# Parse uploads
POST   /api/parse/upload          multipart/form-data file=<pdf|image>  -> {resume, raw_text_preview, file_url}
POST   /api/parse/photo           multipart/form-data file=<image>      -> {url}

# LLM (no-op without API key)
GET    /api/llm/status
POST   /api/llm/analyze           {resume_id, jd}
POST   /api/llm/recommend         {jd, module_type, language}
POST   /api/llm/generate          {jd, language}
POST   /api/llm/improve           {text, jd?, language}

# Export
GET    /api/export/{id}/html
GET    /api/export/{id}/pdf
POST   /api/export/html           {resume}           # live preview
POST   /api/export/pdf            {resume}           # download
```

Open <http://localhost:8000/docs> for the Swagger UI.

---

## Repo layout

```
flowcv-clone/
├── start.sh
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/                    # JSON storage (resumes + profile library)
│   ├── uploads/                 # imported PDFs/images, photos
│   └── app/
│       ├── main.py              # FastAPI app & CORS
│       ├── models/schema.py     # Pydantic schemas (source of truth)
│       ├── services/
│       │   ├── parser.py        # PDF/image -> Resume
│       │   ├── renderer.py      # Resume -> HTML / PDF
│       │   ├── storage.py       # JSON persistence
│       │   └── llm.py           # optional LLM features
│       ├── templates/
│       │   └── classic.html     # Jinja2 template
│       └── api/                 # FastAPI routers
│           ├── parse.py
│           ├── resume.py
│           ├── profile.py
│           ├── llm.py
│           └── export.py
└── frontend/
    ├── package.json, vite.config.js, tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx, api.js
        ├── store/resumeStore.js          # Zustand, single source of truth
        ├── styles/index.css
        └── components/
            ├── common/ (TopBar, Sidebar, Fields, Icon)
            ├── panels/ (ProfilePanel, ContentPanel, CustomizePanel)
            ├── editor/ (ModuleList, EntryList, EntryEditor, RichTextEditor)
            └── preview/PdfPreview.jsx    # iframe -> backend HTML render
```

---

## Extending

**Add a new template.** Create `backend/app/templates/modern.html` (copy
`classic.html` as a starting point — the context is `resume` and `c`
(customize)). Then add it to the `TEMPLATES` array in
`frontend/src/components/panels/CustomizePanel.jsx`.

**Add a new module type.**
1. Define an entry model in `backend/app/models/schema.py`.
2. Teach the parser to recognize it in `backend/app/services/parser.py`
   (add aliases to `SECTION_ALIASES` and a `_build_*` function).
3. Add a rendering branch in `backend/app/templates/classic.html`.
4. Register it in `MODULE_BLUEPRINTS` and `EMPTY_ENTRY` in
   `frontend/src/store/resumeStore.js`.
5. Add a `Fields` component in
   `frontend/src/components/editor/EntryEditor.jsx`.

**Swap storage.** Only `backend/app/services/storage.py` talks to disk —
replace its body with SQLite / Postgres / S3 without touching the API layer.

**Change the LLM provider.** `backend/app/services/llm.py` is dispatched on
`LLM_PROVIDER`. Add a new branch and you're done.

---

## Known limitations

- The rule-based parser is deliberately simple; exotic layouts (2-column
  PDFs with tables) will produce messy entries. With an LLM key you can
  feed the raw text back through `/api/llm/generate` for cleanup.
- WeasyPrint's CJK rendering depends on having CJK fonts installed on the
  host (`Noto Sans CJK SC` is listed in the stylesheet). Install a CJK
  font pack if your exported PDFs show tofu.
- Page-break previews are approximate — the iframe is one continuous page,
  while the PDF paginates. Use **Download PDF** to verify before printing.
- Auto-save waits ~1.5 s after your last edit, then POSTs the full resume.
  The store is the source of truth; a crash mid-edit costs at most that
  delta.
