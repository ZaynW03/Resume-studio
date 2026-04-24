"""Export a resume to HTML (for preview) or PDF (for download)."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel

from app.models.schema import Resume
from app.services import renderer, storage

router = APIRouter()


class ExportBody(BaseModel):
    resume: Resume


def _base_url(request: Request) -> str:
    # So <img src="/uploads/..."> works inside WeasyPrint
    return f"{request.url.scheme}://{request.url.netloc}"


@router.get("/{resume_id}/html", response_class=HTMLResponse)
def html_by_id(resume_id: str, request: Request):
    r = storage.get_resume(resume_id)
    if not r:
        raise HTTPException(404, "Not found")
    return renderer.render_html(r, base_url=_base_url(request))


@router.post("/html", response_class=HTMLResponse)
def html_from_body(body: ExportBody, request: Request):
    return renderer.render_html(body.resume, base_url=_base_url(request))


@router.get("/{resume_id}/pdf")
def pdf_by_id(resume_id: str, request: Request):
    r = storage.get_resume(resume_id)
    if not r:
        raise HTTPException(404, "Not found")
    try:
        pdf = renderer.render_pdf(r, base_url=_base_url(request))
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{r.title}.pdf"'},
    )


@router.post("/pdf")
def pdf_from_body(body: ExportBody, request: Request):
    try:
        pdf = renderer.render_pdf(body.resume, base_url=_base_url(request))
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{body.resume.title}.pdf"'},
    )
