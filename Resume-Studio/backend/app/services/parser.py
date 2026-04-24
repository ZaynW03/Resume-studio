"""Parse uploaded resumes (PDF / image, zh / en) into the canonical schema.

Approach (v2)
-------------
PDF text extraction is a sequence of linearized lines. We exploit two strong
signals:

1. SECTION HEADINGS: short all-caps lines matching a known alias list
   ("EDUCATION", "工作经历", ...).
2. DATE RANGES: lines that START with a date range (``MM/YYYY – MM/YYYY``,
   ``2021 – Present`` ...). Every work / education / project entry begins on
   such a line.

Text BEFORE the first heading is the personal/header block — we pull email,
phone, LinkedIn from it rather than letting it leak into "summary".

A post-processing pass also collapses the common pdfplumber artifact where
bullet glyphs (``•``) land on their own line *after* the text they belong to.
"""
from __future__ import annotations
import re
from pathlib import Path
from typing import Any

import pdfplumber
from PIL import Image

from app.models.schema import (
    Resume, PersonalDetails, ResumeModule,
    EducationEntry, ExperienceEntry, ProjectEntry,
    SkillEntry, AwardEntry, SummaryEntry, default_modules,
)


# =============================================================
#                      1. TEXT EXTRACTION
# =============================================================

def _extract_pdf_text(path: Path) -> str:
    parts: list[str] = []
    try:
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                parts.append(page.extract_text() or "")
    except Exception:
        pass
    return "\n".join(parts)


def _extract_pdf_text_ocr(path: Path) -> str:
    try:
        from pdf2image import convert_from_path
        import pytesseract
        pages = convert_from_path(str(path), dpi=200)
        return "\n".join(pytesseract.image_to_string(img, lang="chi_sim+eng") for img in pages)
    except Exception:
        return ""


def _extract_image_text(path: Path) -> str:
    try:
        import pytesseract
        return pytesseract.image_to_string(Image.open(path), lang="chi_sim+eng")
    except Exception:
        return ""


def extract_text(path: Path) -> str:
    suf = path.suffix.lower()
    if suf == ".pdf":
        txt = _extract_pdf_text(path)
        if len(txt.strip()) < 50:
            txt = _extract_pdf_text_ocr(path)
        return txt
    if suf in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"):
        return _extract_image_text(path)
    return ""


# =============================================================
#               2. LINE NORMALIZATION / BULLETS
# =============================================================

BULLET_GLYPHS = "•·●◦▪◆★*-–—"
_STANDALONE_BULLET_RE = re.compile(rf"^\s*[{re.escape(BULLET_GLYPHS)}]\s*$")
_LEADING_BULLET_RE    = re.compile(rf"^\s*[{re.escape(BULLET_GLYPHS)}]\s+")


def _normalize_lines(raw: str) -> list[str]:
    """Clean up pdfplumber artifacts.

    Two transforms:

    1. Some Chinese PDFs encode certain characters using the Kangxi Radicals
       block (U+2F00–U+2FDF) or CJK Radicals Supplement (U+2E80–U+2EFF)
       instead of the equivalent CJK Unified Ideograph. Visually identical,
       but breaks string comparison and search. We normalize ONLY these
       ranges via per-character NFKC, preserving full-width Chinese
       punctuation (e.g. `：`, `，`, `（`) that we want to keep.

    2. pdfplumber often outputs bullet glyphs on their OWN line. We drop
       those standalone bullets.

    Resulting lines have NO leading/trailing bullets; callers decide how to
    re-add bullets when rendering.
    """
    import unicodedata
    def _fix_char(ch: str) -> str:
        cp = ord(ch)
        if 0x2F00 <= cp <= 0x2FDF or 0x2E80 <= cp <= 0x2EFF:
            return unicodedata.normalize("NFKC", ch)
        return ch
    raw = "".join(_fix_char(c) for c in raw)

    lines = [l.rstrip() for l in raw.splitlines()]
    lines = [l for l in lines if l is not None]

    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if _STANDALONE_BULLET_RE.match(line):
            i += 1
            continue
        line = _LEADING_BULLET_RE.sub("", line)
        out.append(line)
        i += 1
    return out


# =============================================================
#                   3. HEADING DETECTION
# =============================================================

SECTION_ALIASES = {
    "summary": [
        "summary", "profile", "objective", "about me", "about",
        "个人简介", "自我介绍", "简介", "个人总结", "个人资料",
    ],
    "education": ["education", "academic", "academic background",
                  "教育", "教育背景", "学历", "教育经历"],
    "experience": [
        "experience", "work experience", "professional experience",
        "employment", "employment history", "work history",
        "工作经历", "工作经验", "职业经历", "实习经历", "职业", "工作",
    ],
    "projects": ["projects", "project", "project experience",
                 "项目", "项目经历", "项目经验"],
    "skills": [
        "skills", "technical skills", "technologies", "expertise",
        "core competencies",
        "技能", "专业技能", "技术栈",
    ],
    "awards": [
        "awards", "certificates", "certifications", "honors", "honours",
        "awards & certificates", "awards and certificates",
        "honors & awards", "accomplishments",
        "获奖", "奖项", "证书", "荣誉",
    ],
    "personal": ["personal details", "contact", "personal information",
                 "personal", "个人信息", "联系方式"],
}

# Alias -> section key, sorted by length desc so longer matches win first.
_FLAT_ALIASES: list[tuple[str, str]] = sorted(
    [(a.lower(), key) for key, aliases in SECTION_ALIASES.items() for a in aliases],
    key=lambda x: -len(x[0]),
)


def _match_heading(line: str) -> str | None:
    """Return section key if line looks like a heading, else None."""
    t = line.strip().rstrip(":：").strip().lower()
    if not t or len(t) > 40:
        return None
    for alias, key in _FLAT_ALIASES:
        if t == alias:
            return key
        # Allow a short suffix (e.g. "education background")
        if t.startswith(alias + " ") and len(t) - len(alias) <= 25:
            return key
    return None


# =============================================================
#                4. PERSONAL / HEADER EXTRACTION
# =============================================================

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Phone: stop when we hit a date-like continuation (e.g. "+86 13881968542 03/11/2001"
# shouldn't eat "03"). We match one contiguous phone cluster: optional +,
# digits with spaces/dashes/parens only, ending on a digit, NOT immediately
# followed by another phone-part that is actually a date.
PHONE_RE = re.compile(
    r"\+?\d[\d \-()]{6,}\d(?=$|[\n\r]|\s+[^\d\- ]|\s+\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})"
    r"|^\+?\d[\d \-()]{6,}\d$",
    re.MULTILINE,
)
LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/[\w/\-%]+", re.I)
GITHUB_RE   = re.compile(r"(?:https?://)?(?:www\.)?github\.com/[\w/\-%]+", re.I)
URL_RE      = re.compile(r"https?://[\w./\-?=&%#]+")
QQ_RE       = re.compile(r"(?:qq[:：]?\s*|(?:^|[^\w]))(\d{5,12})(?:@qq\.com)?", re.I)
WECHAT_RE   = re.compile(r"(?:wechat|weixin|微信)[:：]?\s*([A-Za-z][A-Za-z0-9_\-]{4,}|[A-Za-z0-9_\-]{5,})", re.I)
DOB_RE      = re.compile(r"\b\d{1,2}/\d{1,2}/\d{4}\b|\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b")
# Common city names (ASCII + CJK) — deliberately conservative so we don't false-match random short lines.
CITY_RE = re.compile(
    r"\b(singapore|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou|"
    r"hong\s*kong|taipei|tokyo|osaka|seoul|new\s*york|london|paris|"
    r"berlin|sydney|melbourne|toronto|vancouver|boston|san\s*francisco|"
    r"los\s*angeles|seattle|remote)\b",
    re.I,
)
CJK_CITY_RE = re.compile(
    r"(北京|上海|广州|深圳|成都|杭州|南京|武汉|西安|重庆|天津|苏州|厦门|青岛|"
    r"香港|澳门|台北|台湾|新加坡|东京|大阪|首尔|远程)"
)
# A "title-style" job line contains a role keyword.
JOB_TITLE_HINT_RE = re.compile(
    r"\b(engineer|developer|designer|researcher|scientist|manager|intern|"
    r"analyst|consultant|architect|lead|director|student|candidate|specialist)\b"
    r"|工程师|研究员|科学家|经理|实习生|分析师|顾问|架构师|负责人|总监|学生",
    re.I,
)


def _rejoin_wrapped_urls(lines: list[str]) -> list[str]:
    """pdfplumber often splits a long URL across two lines right after a hyphen
    or slash. Rejoin when we see:
      - A LinkedIn/GitHub URL ending in a hyphen somewhere on line N
      - A short lowercase token (looks like a URL-path fragment) on line N+1

    Handles the tricky case where line N holds MULTIPLE URLs and only the
    first one was wrapped, e.g.:
        line 5: 'www.linkedin.com/in/zayn-wang-  github.com/ZaynW03'
        line 6: 'zizhen'
    — we insert the continuation INTO line 5 at the wrap point, we don't
    simply concatenate.
    """
    out: list[str] = []
    i = 0
    while i < len(lines):
        curr = lines[i]
        if i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            # Is the next line a plausible URL-path continuation?
            is_cont = bool(re.fullmatch(r"[a-z0-9\-_.]{1,30}", nxt, re.I))
            # Find a URL-ish chunk on curr that ends with a hyphen right before whitespace or EOL.
            pattern = (
                r"((?:https?://)?(?:www\.)?"
                r"(?:linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com)/"
                r"[\w/\-.%]+-)"
                r"(?=\s|$)"
            )
            m = re.search(pattern, curr, re.I)
            if is_cont and m:
                # Insert the continuation in place of the hyphen-ending URL token
                new_curr = curr[:m.end()] + nxt + curr[m.end():]
                out.append(new_curr)
                i += 2
                continue
        out.append(curr)
        i += 1
    return out


def _extract_header(lines: list[str]) -> tuple[PersonalDetails, int]:
    """Extract personal details from the TOP of the resume (before any heading).

    Returns the personal object AND the index of the first line that belongs
    to the resume body (i.e. the first heading line).
    """
    p = PersonalDetails()

    # Find the first heading; everything before it is the header region.
    header_end = len(lines)
    for idx, line in enumerate(lines):
        if _match_heading(line):
            header_end = idx
            break
    header = _rejoin_wrapped_urls(lines[:header_end])

    # Pull contact atoms out of the header.
    joined = "\n".join(header)
    if (m := EMAIL_RE.search(joined)):    p.email = m.group(0)
    if (m := PHONE_RE.search(joined)):    p.phone = m.group(0).strip()
    if (m := LINKEDIN_RE.search(joined)): p.linkedin = _ensure_https(m.group(0))
    if (m := GITHUB_RE.search(joined)):   p.github   = _ensure_https(m.group(0))
    if (m := QQ_RE.search(joined)):       p.qq = m.group(1).strip()
    if (m := WECHAT_RE.search(joined)):   p.wechat = m.group(1).strip()
    if (m := URL_RE.search(joined)) and not p.linkedin and not p.github:
        p.website = m.group(0)

    # Name + job title: first line is typically the name; if the second line
    # looks like a job title, use it.
    content_lines: list[str] = []
    for l in header:
        t = l.strip()
        if not t:
            continue
        # skip DOB-only lines
        if DOB_RE.fullmatch(t):
            continue
        # skip pure contact lines
        if (EMAIL_RE.fullmatch(t) or PHONE_RE.fullmatch(t)
                or LINKEDIN_RE.fullmatch(t) or GITHUB_RE.fullmatch(t)
                or URL_RE.fullmatch(t)):
            continue
        content_lines.append(t)

    if content_lines:
        first = content_lines[0]
        # "Wang Zizhen(Zayn) Al Researcher & Engineer" — split when a job title hint appears.
        m = JOB_TITLE_HINT_RE.search(first)
        if m and m.start() > 0:
            p.full_name = first[:m.start()].strip(" -·|")
            p.job_title = first[m.start():].strip()
        else:
            p.full_name = first.strip(" -·|")
            if len(content_lines) > 1:
                second = content_lines[1]
                if (JOB_TITLE_HINT_RE.search(second) or
                    (len(second) < 60 and not any(ch.isdigit() for ch in second))):
                    # If the name didn't already contain a title, treat line 2 as title
                    # only when there was nothing yet.
                    if not p.job_title and second != p.full_name:
                        p.job_title = second

    # Location: look for city tokens anywhere in the header region. Many PDFs
    # pack multiple contact atoms onto one line (e.g. "Singapore 75530559@qq.com");
    # scan the full header text, not just lines without emails.
    for l in header:
        # Skip the name/title lines themselves
        if l.strip() in (p.full_name, p.job_title):
            continue
        # Strip emails/phones/urls from the line first so they don't shadow the city
        scrubbed = EMAIL_RE.sub(" ", l)
        scrubbed = PHONE_RE.sub(" ", scrubbed)
        scrubbed = URL_RE.sub(" ", scrubbed)
        scrubbed = re.sub(r"(?:linkedin|github)\.com/\S*", " ", scrubbed, flags=re.I)
        scrubbed = scrubbed.strip()
        if not scrubbed:
            continue
        m_cjk = CJK_CITY_RE.search(scrubbed)
        if m_cjk:
            p.location = m_cjk.group(0)
            break
        m_lat = CITY_RE.search(scrubbed)
        if m_lat:
            # If the scrubbed line IS just the city (maybe with trailing comma/country),
            # use the whole line; otherwise use only the match.
            if len(scrubbed) <= 30:
                p.location = scrubbed
            else:
                p.location = m_lat.group(0).title()
            break

    return p, header_end


def _ensure_https(url: str) -> str:
    if url.startswith(("http://", "https://")):
        return url
    return "https://" + url


# =============================================================
#                   5. SECTION SPLITTING
# =============================================================

def _split_sections(lines: list[str], start_idx: int) -> dict[str, list[str]]:
    """Group body lines under section keys. Unknown runs land under 'summary'."""
    sections: dict[str, list[str]] = {}
    current = "summary"
    for line in lines[start_idx:]:
        h = _match_heading(line)
        if h:
            current = h if h != "personal" else "summary"  # personal handled separately
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


# =============================================================
#                   6. DATE-ANCHORED ENTRIES
# =============================================================

# Date range detection. We keep MULTIPLE variants because resumes are diverse.
_DATE_TOKEN = r"(?:\d{1,2}/\d{4}|\d{4}[-/.]\d{1,2}|\d{4}|Present|present|Now|now|至今|现在)"
DATE_RANGE_RE = re.compile(rf"({_DATE_TOKEN})\s*[-–—~]\s*({_DATE_TOKEN})")
# A line that STARTS with a date range (rest of line is usually the title/company).
LINE_STARTS_WITH_RANGE_RE = re.compile(rf"^\s*({_DATE_TOKEN})\s*[-–—~]\s*({_DATE_TOKEN})\b")
# A line that CONTAINS a date range (anywhere). Used for right-aligned-dates layout.
LINE_HAS_RANGE_RE = re.compile(rf"({_DATE_TOKEN})\s*[-–—~]\s*({_DATE_TOKEN})")


def _has_date_anchor(line: str) -> bool:
    """True if this line has a date-range anywhere AND the non-date text on the
    line is short enough to look like a header (not buried in prose)."""
    m = LINE_HAS_RANGE_RE.search(line)
    if not m:
        return False
    # Strip the matched range and any trailing "| location" annotation, then
    # check that what's left is a short title (<=50 chars, no sentence
    # terminators). This rejects accidental year-in-prose matches like
    # "grew 2021 – 2023 revenue by 40%".
    non_date = (line[:m.start()] + line[m.end():]).strip(" |·-")
    if len(non_date) > 60:
        return False
    if any(ch in non_date for ch in "。；;"):
        return False
    return True


def _split_by_date_anchors(lines: list[str]) -> list[list[str]]:
    """Split a list of lines into entries, anchored on date-bearing header lines.

    An entry starts on any line where _has_date_anchor is True (date-range
    anywhere on a short line). This handles both:
      - English layout:  "01/2026 - 08/2026 Company Name"
      - Chinese layout:  "Company Name     2026/01 - 2026/08 | Location"
    """
    anchor_idxs = [i for i, l in enumerate(lines) if _has_date_anchor(l)]
    if not anchor_idxs:
        return [lines] if any(l.strip() for l in lines) else []

    entries: list[list[str]] = []
    for j, start in enumerate(anchor_idxs):
        end = anchor_idxs[j + 1] if j + 1 < len(anchor_idxs) else len(lines)
        chunk = lines[start:end]
        entries.append([l for l in chunk if l is not None])
    return entries


def _split_by_bold_titles(lines: list[str]) -> list[list[str]]:
    """Fallback splitter for sections without dates (projects are the common
    case). A "title" is a short line that does NOT look like a bullet body.

    Chinese bullets here look like "特征提取与映射：利用..." — they use a
    full-width colon (`：`) to separate the bullet label from the explanation.
    Any line that contains such a colon is TREATED AS A BULLET, not a title,
    even though it's short.
    """
    if not lines:
        return []
    entries: list[list[str]] = []
    current: list[str] = []

    def looks_like_title(i: int) -> bool:
        l = lines[i].strip()
        if not l or len(l) > 70:
            return False
        if l.endswith((".", "。", ";", "；")):
            return False
        # Chinese bullets use "：" (full-width colon) as label separator. Ascii ":" too.
        # If the colon appears reasonably early (<30 chars) AND the tail is long
        # enough to be an explanation, this is a BULLET, not a title.
        for colon in ("：", ":"):
            if colon in l:
                idx = l.index(colon)
                if idx <= 30 and len(l) - idx > 15:
                    return False
        # Next line should be substantive prose
        if i + 1 >= len(lines):
            return False
        nxt = lines[i + 1].strip()
        if not nxt or len(nxt) < 20:
            return False
        # current line shouldn't START with common bullet prose verbs
        verbish = ("designed ", "developed ", "built ", "led ", "created ",
                   "implemented ", "integrated ", "architected ", "deployed ",
                   "utilized ", "enabled ", "fine-tuned ",
                   # Chinese bullet verbs — if a line starts with these,
                   # it's prose, not a title.
                   "设计", "开发", "构建", "实现", "基于", "利用", "采用",
                   "通过", "支持", "集成", "部署", "负责", "完成")
        if any(l.lower().startswith(v) for v in verbish):
            return False
        return True

    for i, l in enumerate(lines):
        if looks_like_title(i) and current:
            entries.append(current)
            current = [l]
        else:
            current.append(l)
    if current:
        entries.append(current)
    return entries


# =============================================================
#            7. BULLETS -> HTML (for descriptions)
# =============================================================

def _lines_to_html(lines: list[str]) -> str:
    """Wrap a set of description lines in <ul>/<p>.

    Each non-empty line becomes one <li>. If there's only a single line, it
    becomes a <p>.
    """
    clean = [l.strip() for l in lines if l and l.strip()]
    if not clean:
        return ""
    if len(clean) == 1:
        return f"<p>{_escape_html(clean[0])}</p>"
    return "<ul>" + "".join(f"<li>{_escape_html(l)}</li>" for l in clean) + "</ul>"


def _escape_html(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
    )


# =============================================================
#          8. PER-MODULE ENTRY BUILDERS
# =============================================================

def _parse_date_line(line: str) -> tuple[str, str, str, str]:
    """Given a line that contains a date range anywhere, return
    (start, end, non_date_text, trailing_location).

    Handles both layouts:
      "01/2026 - 08/2026 Company Name" (dates at start)
      "Company Name       2026/01 - 2026/08 | Location" (dates with pipe-separated loc)
      "2020/09 - 2025/06 | Chengdu" (dates at start with trailing loc)
    """
    m = LINE_HAS_RANGE_RE.search(line)
    if not m:
        return ("", "", line.strip(), "")
    start_raw, end_raw = m.group(1), m.group(2)
    # Normalize YYYY/MM -> YYYY-MM for downstream consistency
    start = start_raw.replace("/", "-") if re.match(r"^\d{4}/\d{1,2}$", start_raw) else start_raw
    end   = end_raw.replace("/", "-")   if re.match(r"^\d{4}/\d{1,2}$", end_raw)   else end_raw

    before = line[:m.start()].strip()
    after  = line[m.end():].strip()

    # Extract trailing location from an "| Location" or "· Location" suffix
    location = ""
    m2 = re.search(r"[|｜]\s*(.+)$", after)
    if m2:
        location = m2.group(1).strip()
        after = after[:m2.start()].strip()

    # Non-date text is whatever's not the date or the trailing location.
    non_date = (before + " " + after).strip(" |·-")
    return (start, end, non_date, location)


# "Chengdu, China" style location — short, has a comma or is a known city pattern.
LOCATION_LINE_RE = re.compile(r"^[A-Za-z\u4e00-\u9fff][\w\s,.\-\u4e00-\u9fff]{1,40}$")


def _strip_location_prefix(line: str) -> tuple[str, str]:
    """English layout: 'Chengdu,China Dual Bachelor's Degree' -> ('Chengdu,China', rest).

    Returns ("", line) when the line doesn't look like it starts with a location.
    """
    parts = line.split(None, 1)
    if len(parts) == 2:
        loc_candidate, rest = parts
        # Accept either an ASCII city (English PDF) or a pure-CJK short token (Chinese PDF).
        if re.fullmatch(r"[A-Z][A-Za-z]+[,\-]?[A-Za-z]*", loc_candidate):
            return (loc_candidate.rstrip(","), rest)
    return ("", line)


def _build_education(body: list[str]) -> list[EducationEntry]:
    entries_lines = _split_by_date_anchors(body)
    out: list[EducationEntry] = []
    for chunk in entries_lines:
        if not chunk:
            continue
        start, end, header_rest, trailing_loc = _parse_date_line(chunk[0])
        school = header_rest
        location = trailing_loc
        degree = ""
        gpa = ""
        desc_lines: list[str] = []

        # Next line: degree (or location+degree in English layout).
        if len(chunk) > 1:
            if not location:
                loc, rest = _strip_location_prefix(chunk[1])
                if loc:
                    location = loc
                    degree = rest
                else:
                    degree = chunk[1]
            else:
                degree = chunk[1]

        # Remaining lines: GPA, coursework, description bullets.
        for line in chunk[2:]:
            if re.search(r"GPA[:\s]*[\d.]+", line, re.I):
                gpa_m = re.search(r"GPA[:\s]*([\d.]+)", line, re.I)
                if gpa_m:
                    gpa = gpa_m.group(1)
                extra = re.sub(r"GPA[:\s]*[\d.]+\s*", "", line, flags=re.I).strip(" ()")
                if extra:
                    desc_lines.append(extra)
            else:
                desc_lines.append(line)

        out.append(EducationEntry(
            school=school, degree=degree, location=location,
            start_date=start, end_date=end, gpa=gpa,
            description=_lines_to_html(desc_lines),
        ))
    return out


def _build_experience(body: list[str]) -> list[ExperienceEntry]:
    entries_lines = _split_by_date_anchors(body)
    out: list[ExperienceEntry] = []
    for chunk in entries_lines:
        if not chunk:
            continue
        start, end, header_rest, trailing_loc = _parse_date_line(chunk[0])
        company = header_rest
        location = trailing_loc
        position = ""
        desc_lines: list[str] = []

        if len(chunk) > 1:
            if not location:
                loc, rest = _strip_location_prefix(chunk[1])
                if loc:
                    location = loc
                    position = rest
                else:
                    position = chunk[1]
            else:
                position = chunk[1]

        desc_lines = chunk[2:]
        currently = end.lower() in ("present", "now", "至今", "现在")
        out.append(ExperienceEntry(
            company=company, position=position, location=location,
            start_date=start, end_date="" if currently else end,
            currently_working=currently,
            description=_lines_to_html(desc_lines),
        ))
    return out


def _build_projects(body: list[str]) -> list[ProjectEntry]:
    entries_lines = _split_by_date_anchors(body)
    # If no date anchors, fall back to title-based splitting.
    if len(entries_lines) <= 1:
        entries_lines = _split_by_bold_titles(body)
    out: list[ProjectEntry] = []
    for chunk in entries_lines:
        if not chunk:
            continue
        if LINE_HAS_RANGE_RE.search(chunk[0]):
            start, end, header_rest, _ = _parse_date_line(chunk[0])
            name = header_rest
            desc = chunk[1:]
        else:
            start = end = ""
            name = chunk[0].strip()
            desc = chunk[1:]
        out.append(ProjectEntry(
            name=name, start_date=start, end_date=end,
            description=_lines_to_html(desc),
        ))
    return out


def _build_skills(body: list[str]) -> list[SkillEntry]:
    """Skills are often category-on-line-N, items-on-line-N+1.

    Pattern:
        Machine Learning                             <- category
        PyTorch, TensorFlow, ...                     <- items

        Programming & Engineering                    <- category
        Python, Java, ...                            <- items
    """
    out: list[SkillEntry] = []
    lines = [l for l in body if l.strip()]
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Pattern A: "Category: item1, item2, ..."
        if ":" in line or "：" in line:
            sep = ":" if ":" in line else "："
            cat, items_str = line.split(sep, 1)
            items = [x.strip() for x in re.split(r"[,，、;；/]", items_str) if x.strip()]
            out.append(SkillEntry(category=cat.strip(), items=items))
            i += 1
            continue
        # Pattern B: "Category" on its own line, items on the next line.
        if (i + 1 < len(lines)
                and ("," in lines[i + 1] or "、" in lines[i + 1] or "，" in lines[i + 1])
                and "," not in line and "、" not in line and "，" not in line):
            category = line
            items_str = lines[i + 1].strip()
            items = [x.strip() for x in re.split(r"[,，、;；/]", items_str) if x.strip()]
            out.append(SkillEntry(category=category, items=items))
            i += 2
            continue
        # Pattern C: comma-separated list with no category
        items = [x.strip() for x in re.split(r"[,，、;；/]", line) if x.strip()]
        if items:
            out.append(SkillEntry(category="", items=items))
        i += 1
    return out


def _build_awards(body: list[str]) -> list[AwardEntry]:
    out: list[AwardEntry] = []
    for line in body:
        s = line.strip()
        if not s:
            continue
        date_m = re.search(rf"({_DATE_TOKEN})", s)
        date = date_m.group(1) if date_m else ""
        title = re.sub(rf"{_DATE_TOKEN}", "", s).strip(" -–—,，")
        out.append(AwardEntry(title=title, date=date))
    return out


def _build_summary(body: list[str]) -> list[SummaryEntry]:
    if not body or not any(l.strip() for l in body):
        return []
    return [SummaryEntry(content=_lines_to_html(body))]


# =============================================================
#                    9. PUBLIC ENTRY POINT
# =============================================================

def parse_resume_file(path: Path) -> tuple[Resume, str]:
    """Parse a file into a Resume. Returns (resume, raw_text)."""
    raw = extract_text(path)
    lines = _normalize_lines(raw)

    # 1. Header
    personal, body_start = _extract_header(lines)

    # 2. Sections
    sections = _split_sections(lines, body_start)

    # 3. Build modules
    modules = default_modules()
    for m in modules:
        body = sections.get(m.type, [])
        if m.type == "summary":
            m.entries = [e.model_dump() for e in _build_summary(body)]
        elif m.type == "education":
            m.entries = [e.model_dump() for e in _build_education(body)]
        elif m.type == "experience":
            m.entries = [e.model_dump() for e in _build_experience(body)]
        elif m.type == "projects":
            m.entries = [e.model_dump() for e in _build_projects(body)]
        elif m.type == "skills":
            m.entries = [e.model_dump() for e in _build_skills(body)]
        elif m.type == "awards":
            m.entries = [e.model_dump() for e in _build_awards(body)]

    resume = Resume(
        title=(personal.full_name + "'s Resume") if personal.full_name else "Imported Resume",
        language="zh" if re.search(r"[\u4e00-\u9fff]", raw) else "en",
        personal=personal,
        modules=modules,
    )
    return resume, raw
