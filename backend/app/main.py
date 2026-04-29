"""FastAPI application entry point."""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.api import resume, parse, llm, export, profile

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent   # backend/
UPLOAD_DIR = BASE_DIR / "uploads"
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Resume Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(parse.router, prefix="/api/parse", tags=["parse"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
app.include_router(export.router, prefix="/api/export", tags=["export"])


@app.get("/")
def root():
    return {"status": "ok", "service": "resume-studio"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/diagnostics")
def diagnostics():
    """Check that every optional native dependency is present.

    Surfaces the exact import/initialisation error from each library so the
    user can see why e.g. PDF export or OCR is failing on their machine
    (common on Windows without GTK3 runtime or Tesseract installed).
    """
    import shutil
    out = {}

    # WeasyPrint (PDF export)
    try:
        from weasyprint import HTML  # noqa: F401
        out["weasyprint"] = {"ok": True, "message": "PDF export ready"}
    except Exception as e:
        out["weasyprint"] = {
            "ok": False,
            "message": f"{type(e).__name__}: {e}",
            "hint": (
                "Install GTK3 runtime (Windows) or pango/cairo (mac/linux). "
                "See README 'Windows setup' section."
            ),
        }

    # Tesseract OCR
    tess = shutil.which("tesseract")
    if tess:
        try:
            import pytesseract
            ver = pytesseract.get_tesseract_version()
            langs = pytesseract.get_languages(config="")
            out["tesseract"] = {
                "ok": True,
                "path": tess,
                "version": str(ver),
                "languages": langs,
                "zh_supported": "chi_sim" in langs,
            }
        except Exception as e:
            out["tesseract"] = {"ok": False, "path": tess, "message": str(e)}
    else:
        out["tesseract"] = {
            "ok": False,
            "message": "tesseract not found on PATH",
            "hint": "Install Tesseract and add its folder to PATH.",
        }

    # Poppler (used by pdf2image for OCR fallback)
    popp = shutil.which("pdftoppm")
    out["poppler"] = {
        "ok": bool(popp),
        "path": popp or "",
        "hint": None if popp else "Install poppler-utils (scanned PDFs won't OCR without it).",
    }

    # pdfplumber (normal PDF text extraction)
    try:
        import pdfplumber  # noqa: F401
        out["pdfplumber"] = {"ok": True}
    except Exception as e:
        out["pdfplumber"] = {"ok": False, "message": str(e)}

    # python-multipart (needed for file uploads / FastAPI UploadFile)
    try:
        import multipart  # noqa: F401
        out["python-multipart"] = {"ok": True}
    except Exception as e:
        out["python-multipart"] = {
            "ok": False,
            "message": str(e),
            "hint": "Install with: pip install python-multipart",
        }

    # Check the uploads directory is writable
    try:
        test = UPLOAD_DIR / ".probe"
        test.write_text("ok", encoding="utf-8")
        test.unlink()
        out["uploads_dir"] = {
            "ok": True,
            "path": str(UPLOAD_DIR),
            "writable": True,
        }
    except Exception as e:
        out["uploads_dir"] = {
            "ok": False,
            "path": str(UPLOAD_DIR),
            "writable": False,
            "message": str(e),
            "hint": "Check directory permissions.",
        }

    return out
