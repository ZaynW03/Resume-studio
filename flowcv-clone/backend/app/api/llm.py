"""LLM-backed features: JD match, recommendations, generation."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import llm, storage

router = APIRouter()


class AnalyzeIn(BaseModel):
    resume_id: str
    jd: str


class RecommendIn(BaseModel):
    jd: str
    module_type: str
    language: str = "en"


class GenerateIn(BaseModel):
    jd: str
    language: str = "en"


class ImproveIn(BaseModel):
    text: str
    jd: str = ""
    language: str = "en"


@router.get("/status")
def status():
    return {"configured": llm.is_configured()}


@router.post("/analyze")
def analyze(body: AnalyzeIn):
    r = storage.get_resume(body.resume_id)
    if not r:
        raise HTTPException(404, "Resume not found")
    return llm.analyze_match(r.model_dump(), body.jd)


@router.post("/recommend")
def recommend(body: RecommendIn):
    profile = storage.load_profile().model_dump()
    return {"ranked": llm.recommend_entries(profile, body.jd, body.module_type, body.language)}


@router.post("/generate")
def generate(body: GenerateIn):
    profile = storage.load_profile().model_dump()
    return llm.generate_from_scratch(profile, body.jd, body.language)


@router.post("/improve")
def improve(body: ImproveIn):
    return {"text": llm.improve_bullet(body.text, body.jd, body.language)}
