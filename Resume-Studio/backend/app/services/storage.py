"""File-based storage. Each resume is a JSON file under /data/resumes/."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.models.schema import Resume, ProfileLibrary, default_modules

BASE = Path(__file__).resolve().parent.parent.parent / "data"
RESUMES_DIR = BASE / "resumes"
PROFILE_FILE = BASE / "profile.json"

RESUMES_DIR.mkdir(parents=True, exist_ok=True)


def _now() -> str:
    return datetime.utcnow().isoformat()


# ---------------- Resumes ----------------

def list_resumes() -> list[dict[str, Any]]:
    out = []
    for p in sorted(RESUMES_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out.append({
                "id": data.get("id"),
                "title": data.get("title"),
                "updated_at": data.get("updated_at", ""),
            })
        except Exception:
            continue
    return out


def _migrate_resume_data(data: dict) -> dict:
    """Fix removed/renamed field values so old JSON files load without validation errors."""
    c = data.get("customize")
    if isinstance(c, dict) and c.get("columns") == "mix":
        c["columns"] = "single"
    return data


def get_resume(resume_id: str) -> Resume | None:
    p = RESUMES_DIR / f"{resume_id}.json"
    if not p.exists():
        return None
    return Resume(**_migrate_resume_data(json.loads(p.read_text(encoding="utf-8"))))


def save_resume(resume: Resume) -> Resume:
    if not resume.created_at:
        resume.created_at = _now()
    resume.updated_at = _now()
    if not resume.modules:
        resume.modules = default_modules()
    p = RESUMES_DIR / f"{resume.id}.json"
    p.write_text(resume.model_dump_json(indent=2), encoding="utf-8")
    return resume


def delete_resume(resume_id: str) -> bool:
    p = RESUMES_DIR / f"{resume_id}.json"
    if p.exists():
        p.unlink()
        return True
    return False


# ---------------- Profile library ----------------

def load_profile() -> ProfileLibrary:
    if not PROFILE_FILE.exists():
        return ProfileLibrary()
    return ProfileLibrary(**json.loads(PROFILE_FILE.read_text(encoding="utf-8")))


def save_profile(profile: ProfileLibrary) -> ProfileLibrary:
    PROFILE_FILE.write_text(profile.model_dump_json(indent=2), encoding="utf-8")
    return profile
