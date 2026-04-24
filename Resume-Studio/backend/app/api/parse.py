"""Upload a PDF or image resume; get structured JSON back."""
from __future__ import annotations
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.services import parser, storage

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), save: bool = True):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    token = uuid4().hex
    dest = UPLOAD_DIR / f"{token}{suffix}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        resume, raw_text = parser.parse_resume_file(dest)
    except Exception as e:
        raise HTTPException(500, f"Parse failed: {e}")

    saved = None
    if save:
        saved = storage.save_resume(resume)

    return {
        "resume": (saved or resume).model_dump(),
        "raw_text_preview": raw_text[:2000],
        "file_url": f"/uploads/{dest.name}",
    }


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    allowed = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
    if suffix not in allowed:
        raise HTTPException(
            400,
            f"Unsupported image type '{suffix}'. Allowed: {', '.join(sorted(allowed))}"
        )
    token = uuid4().hex
    dest = UPLOAD_DIR / f"photo_{token}{suffix}"
    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(500, f"Failed to write file: {e}")
    return {"url": f"/uploads/{dest.name}"}
