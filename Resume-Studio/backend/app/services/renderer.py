"""Render a Resume to HTML and/or PDF."""
from __future__ import annotations
import re
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.schema import Resume

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


# --------------- Date formatter ---------------

_MONTH_NAMES_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_MONTH_NAMES_FULL  = ["", "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]


def _parse_ymd(s: str) -> tuple[int, int] | None:
    """Best-effort: extract (year, month) from common forms. Returns None if
    the input doesn't look like a parseable date."""
    if not s:
        return None
    s = s.strip()
    # YYYY-MM, YYYY/MM, YYYY.MM
    m = re.match(r"^(\d{4})[-/.](\d{1,2})$", s)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    # MM/YYYY, MM-YYYY, MM.YYYY
    m = re.match(r"^(\d{1,2})[-/.](\d{4})$", s)
    if m:
        return (int(m.group(2)), int(m.group(1)))
    # YYYY
    m = re.match(r"^(\d{4})$", s)
    if m:
        return (int(m.group(1)), 0)
    return None


def format_date(s: str, fmt: str) -> str:
    """Reformat a date string according to the user's chosen format."""
    if not s:
        return ""
    low = s.strip().lower()
    if low in ("present", "now", "至今", "现在"):
        return "Present"
    p = _parse_ymd(s)
    if not p:
        return s  # leave free-text dates alone
    y, m = p
    if fmt == "iso":    return f"{y}-{m:02d}" if m else str(y)
    if fmt == "slash":  return f"{m:02d}/{y}" if m else str(y)
    if fmt == "dot":    return f"{m:02d}.{y}" if m else str(y)
    if fmt == "short":
        return f"{_MONTH_NAMES_SHORT[m]} {y}" if m else str(y)
    if fmt == "long":
        return f"{_MONTH_NAMES_FULL[m]} {y}" if m else str(y)
    if fmt == "year":   return str(y)
    return s


def format_range(start: str, end: str, currently: bool, fmt: str) -> str:
    s = format_date(start, fmt)
    e = "Present" if currently else format_date(end, fmt)
    if s and e:   return f"{s} – {e}"
    return s or e


# --------------- Spacing preset -> token values ---------------

SPACING_PRESETS = {
    "compact":   {"section_margin": 8,  "entry_spacing": 3,  "line_height": 1.25},
    "cozy":      {"section_margin": 11, "entry_spacing": 5,  "line_height": 1.35},
    "normal":    {"section_margin": 14, "entry_spacing": 8,  "line_height": 1.4},
    "relaxed":   {"section_margin": 18, "entry_spacing": 12, "line_height": 1.55},
    "spacious":  {"section_margin": 24, "entry_spacing": 16, "line_height": 1.7},
}


def resolved_spacing(customize) -> dict:
    """Return the stored numeric values directly so UI controls take effect immediately."""
    return {
        "section_margin": getattr(customize, "section_margin", 14),
        "entry_spacing":  getattr(customize, "entry_spacing",  8),
        "line_height":    getattr(customize, "line_height",    1.4),
    }


# --------------- Jinja env ---------------

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)
_env.filters["date_fmt"] = format_date
_env.globals["format_range"] = format_range
_env.globals["format_date"] = format_date


def render_html(resume: Resume, base_url: str = "") -> str:
    template_name = f"{resume.customize.template}.html"
    try:
        tpl = _env.get_template(template_name)
    except Exception:
        tpl = _env.get_template("flowcv-style.html")

    # Spacing: preset takes precedence unless user explicitly overrode numerics.
    # Templates read from `s` (spacing) for clarity.
    s = resolved_spacing(resume.customize)
    return tpl.render(
        resume=resume,
        c=resume.customize,
        s=s,
        date_fmt=resume.customize.date_format,
    )


def render_pdf(resume: Resume, base_url: str = "") -> bytes:
    html = render_html(resume, base_url=base_url)
    try:
        from weasyprint import HTML
    except Exception as e:
        raise RuntimeError(
            f"WeasyPrint is not available: {e}. "
            "On Windows, install the GTK3 runtime (see README). "
            "Visit /api/diagnostics for more details."
        ) from e
    try:
        return HTML(string=html, base_url=base_url or ".").write_pdf()
    except Exception as e:
        raise RuntimeError(f"PDF rendering failed: {e}") from e
