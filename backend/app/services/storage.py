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

def _is_blank_resume(data: dict[str, Any]) -> bool:
    title = (data.get("title") or "").strip()
    if title not in {"", "Untitled Resume"}:
        return False

    personal = data.get("personal") or {}
    personal_fields = (
        "full_name", "job_title", "email", "phone", "location", "website",
        "linkedin", "github", "wechat", "qq", "date_of_birth", "summary_line", "photo_url",
    )
    if any(str(personal.get(field) or "").strip() for field in personal_fields):
        return False
    if any(str((item or {}).get("value") or "").strip() for item in (personal.get("extra_fields") or [])):
        return False

    modules = data.get("modules") or []
    for module in modules:
        if module.get("type") == "personal_details":
            continue
        if module.get("entries"):
            return False

    return True

def list_resumes() -> list[dict[str, Any]]:
    all_items: list[dict[str, Any]] = []
    for p in sorted(RESUMES_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if _is_blank_resume(data):
                continue
            all_items.append({
                "id": data.get("id"),
                "title": data.get("title") or "Untitled Resume",
                "updated_at": data.get("updated_at", ""),
                "_path": p,
            })
        except Exception:
            continue

    # Deduplicate: for resumes with the same title keep the most recently updated,
    # then physically delete the older duplicates so they don't reappear.
    by_title: dict[str, dict[str, Any]] = {}
    for item in all_items:
        title = item["title"]
        if title not in by_title or item["updated_at"] > by_title[title]["updated_at"]:
            by_title[title] = item

    kept_ids = {v["id"] for v in by_title.values()}
    for item in all_items:
        if item["id"] not in kept_ids:
            try:
                item["_path"].unlink(missing_ok=True)
            except Exception:
                pass

    result = sorted(by_title.values(), key=lambda x: x["updated_at"], reverse=True)
    return [{"id": r["id"], "title": r["title"], "updated_at": r["updated_at"]} for r in result]


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
