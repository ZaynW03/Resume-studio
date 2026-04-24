"""Resume CRUD."""
from fastapi import APIRouter, HTTPException
from app.models.schema import Resume, default_modules
from app.services import storage

router = APIRouter()


@router.get("")
def list_all():
    return storage.list_resumes()


@router.post("")
def create(resume: Resume | None = None):
    r = resume or Resume()
    if not r.modules:
        r.modules = default_modules()
    return storage.save_resume(r).model_dump()


@router.get("/{resume_id}")
def get_one(resume_id: str):
    r = storage.get_resume(resume_id)
    if not r:
        raise HTTPException(404, "Not found")
    return r.model_dump()


@router.put("/{resume_id}")
def update(resume_id: str, resume: Resume):
    if resume.id != resume_id:
        resume.id = resume_id
    return storage.save_resume(resume).model_dump()


@router.delete("/{resume_id}")
def remove(resume_id: str):
    ok = storage.delete_resume(resume_id)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"ok": True}
