"""Canonical resume schema. All resume data flows through these types."""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
from uuid import uuid4


def _uid() -> str:
    return uuid4().hex[:12]


# ---------------- Module entries ----------------

class PersonalDetails(BaseModel):
    full_name: str = ""
    job_title: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    website: str = ""
    linkedin: str = ""
    github: str = ""
    wechat: str = ""
    qq: str = ""
    date_of_birth: str = ""
    summary_line: str = ""  # one-line tagline
    photo_url: str = ""     # e.g. /uploads/abc.png
    # Which fields to show, and in what order (first = top). Empty list => use default.
    visible_fields: list[str] = []
    # Which fields are hidden in the rendered resume, while still editable in the UI.
    hidden_fields: list[str] = []


class EducationEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    school: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_date: str = ""    # "YYYY-MM" or free text
    end_date: str = ""
    is_full_time: bool = True
    gpa: str = ""
    location: str = ""
    description: str = ""   # HTML (rich text)
    hidden: bool = False


class ExperienceEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    company: str = ""
    position: str = ""
    start_date: str = ""
    end_date: str = ""
    currently_working: bool = False
    location: str = ""
    description: str = ""   # HTML
    hidden: bool = False


class ProjectEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    name: str = ""
    role: str = ""
    start_date: str = ""
    end_date: str = ""
    link: str = ""
    description: str = ""   # HTML
    hidden: bool = False


class SkillEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    category: str = ""      # e.g. "Programming Languages"
    items: list[str] = []   # ["Python", "TypeScript"]
    level: str = ""         # Beginner / Intermediate / Advanced / Expert
    hidden: bool = False


class AwardEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    title: str = ""
    issuer: str = ""
    date: str = ""
    description: str = ""
    hidden: bool = False


class SummaryEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    content: str = ""       # HTML
    hidden: bool = False


class GenericEntry(BaseModel):
    """Fallback for custom user-added modules."""
    id: str = Field(default_factory=_uid)
    title: str = ""
    subtitle: str = ""
    date: str = ""
    description: str = ""
    hidden: bool = False


# ---------------- Module & resume ----------------

ModuleType = Literal[
    "personal_details", "summary", "education", "experience",
    "projects", "skills", "awards", "custom", "page_break",
]


class ResumeModule(BaseModel):
    id: str = Field(default_factory=_uid)
    type: ModuleType
    name: str                       # user-editable display name
    icon: str = "circle"            # lucide-react icon name
    hidden: bool = False
    entries: list[dict[str, Any]] = Field(default_factory=list)   # entries shaped by module type


class Customize(BaseModel):
    # layout
    template: str = "flowcv-style"                         # classic | flowcv-style
    columns: Literal["single", "two", "mix"] = "single"
    page_breaks: list[str] = []                            # list of module ids after which to break

    # spacing — DISCRETE tokens. Strings map to px values via the template.
    # 'compact' | 'cozy' | 'normal' | 'relaxed' | 'spacious'
    spacing_preset: Literal["compact", "cozy", "normal", "relaxed", "spacious"] = "normal"

    # Font
    font_family: str = "Inter"
    font_size: float = 10.5                                # pt
    line_height: float = 1.4
    section_margin: float = 14
    entry_spacing: float = 8
    page_margin: float = 40                                # left & right margin (px)
    vertical_margin: float = 24                            # top & bottom margin (px)
    paper: Literal["A4", "Letter"] = "A4"

    # headings / subtitles
    subtitle_font: str = "Inter"
    subtitle_size: float = 11
    subtitle_case: Literal["none", "upper", "lower", "title"] = "upper"
    subtitle_weight: Literal["normal", "600", "700"] = "700"
    subtitle_color: str = "#111827"
    subtitle_style: Literal[
        "underline",
        "plain",
        "overline",
        "box",
        "pill",
        "left-bar",
        "double-line",
    ] = "underline"

    # Date format — how to render date ranges globally
    date_format: Literal[
        "iso", "slash", "dot", "short", "long", "year",
    ] = "slash"

    # Per-module entry layout (legacy, per-module overrides)
    entry_layouts: dict[str, str] = Field(default_factory=lambda: {
        "experience": "dates-left",
        "education":  "dates-left",
        "projects":   "dates-left",
    })

    # Global entry element positions: 'left' | 'center' | 'right' | 'inline'
    entry_date_pos: str = "inline"
    entry_loc_pos: str = "inline"
    entry_subtitle_pos: str = "inline"

    # Entry title/subtitle sizing
    entry_title_size: float = 11                           # pt, for entry-level title
    entry_subtitle_placement: str = "same"                 # 'same' | 'nextline'

    # personal details block
    personal_alignment: Literal["left", "center", "right"] = "left"
    personal_arrangement: Literal[
        "name-contact", "contact-name", "inline"
    ] = "name-contact"

    # photo
    show_photo: bool = True
    photo_shape: Literal["circle", "square", "rounded"] = "circle"
    photo_position: Literal["left", "right", "top"] = "right"
    photo_size: float = 90                                 # px

    # colors
    accent_color: str = "#2563eb"
    text_color: str = "#111827"

    # Contact block layout (single column / double column / inline row)
    contacts_columns: Literal["single", "double", "inline"] = "single"


class Resume(BaseModel):
    id: str = Field(default_factory=_uid)
    title: str = "Untitled Resume"
    language: Literal["en", "zh"] = "en"
    personal: PersonalDetails = Field(default_factory=PersonalDetails)
    modules: list[ResumeModule] = Field(default_factory=list)
    customize: Customize = Field(default_factory=Customize)
    created_at: str = ""
    updated_at: str = ""


# ---------------- Profile library ----------------

class ProfileLibrary(BaseModel):
    """A persistent pool of the user's history, used to assemble resumes."""
    personal: PersonalDetails = Field(default_factory=PersonalDetails)
    experiences: list[ExperienceEntry] = []
    projects: list[ProjectEntry] = []
    educations: list[EducationEntry] = []
    skills: list[SkillEntry] = []
    awards: list[AwardEntry] = []
    summaries: list[SummaryEntry] = []


# ---------------- Default modules ----------------

def default_modules() -> list[ResumeModule]:
    return [
        ResumeModule(type="summary", name="Summary", icon="file-text", entries=[]),
        ResumeModule(type="education", name="Education", icon="graduation-cap", entries=[]),
        ResumeModule(type="experience", name="Experience", icon="briefcase", entries=[]),
        ResumeModule(type="projects", name="Projects", icon="folder-git-2", entries=[]),
        ResumeModule(type="skills", name="Skills", icon="wrench", entries=[]),
        ResumeModule(type="awards", name="Awards & Certificates", icon="award", entries=[]),
    ]
