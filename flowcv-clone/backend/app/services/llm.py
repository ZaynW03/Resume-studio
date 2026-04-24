"""LLM integration. Optional: only used when an API key is set.

Supports OpenAI (or any OpenAI-compatible endpoint) and Anthropic Claude.
Use env vars:
    LLM_PROVIDER = "openai" | "anthropic"
    OPENAI_API_KEY, OPENAI_BASE_URL (optional), OPENAI_MODEL
    ANTHROPIC_API_KEY, ANTHROPIC_MODEL
"""
from __future__ import annotations
import os
import json
from typing import Any


def _provider() -> str:
    return os.getenv("LLM_PROVIDER", "openai").lower()


def is_configured() -> bool:
    if _provider() == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    if _provider() == "anthropic":
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    return False


def _call(system: str, user: str) -> str:
    prov = _provider()
    if prov == "openai":
        from openai import OpenAI
        client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL") or None,
        )
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.4,
        )
        return resp.choices[0].message.content or ""
    if prov == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
        msg = client.messages.create(
            model=model,
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        # Concat text blocks
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    raise RuntimeError(f"Unknown LLM_PROVIDER: {prov}")


def _extract_json(text: str) -> Any:
    """LLMs sometimes wrap JSON in fences; strip them."""
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        # drop leading 'json\n'
        if t.lower().startswith("json"):
            t = t[4:].lstrip()
    # find first { or [
    for i, c in enumerate(t):
        if c in "{[":
            t = t[i:]
            break
    # find last } or ]
    for i in range(len(t) - 1, -1, -1):
        if t[i] in "}]":
            t = t[: i + 1]
            break
    return json.loads(t)


# ---------- Features ----------

def analyze_match(resume_json: dict, jd: str) -> dict:
    """Score and explain match between a resume and JD."""
    if not is_configured():
        return {
            "score": None,
            "missing_skills": [],
            "strengths": [],
            "suggestions": ["LLM not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY."],
        }
    system = (
        "You are a resume analyst. Compare the resume to the job description. "
        "Respond ONLY with JSON. Schema: "
        '{"score":0-100,"strengths":[],"missing_skills":[],"suggestions":[]}'
    )
    user = f"RESUME_JSON:\n{json.dumps(resume_json, ensure_ascii=False)}\n\nJD:\n{jd}"
    raw = _call(system, user)
    try:
        return _extract_json(raw)
    except Exception:
        return {"score": None, "raw": raw, "suggestions": ["Failed to parse LLM output."]}


def recommend_entries(
    profile_library: dict, jd: str, module_type: str, language: str = "en"
) -> list[dict]:
    """Rank the user's existing profile entries by relevance to a JD."""
    if not is_configured():
        return []
    lang_hint = "Respond in Chinese." if language == "zh" else "Respond in English."
    system = (
        f"You help a candidate pick the best entries from their profile library for a given JD. "
        f"{lang_hint} Respond ONLY with JSON: "
        '{"ranked":[{"id":"...","reason":"...","score":0-100}]}'
    )
    pool_key = {
        "experience": "experiences",
        "projects": "projects",
        "education": "educations",
        "skills": "skills",
        "awards": "awards",
        "summary": "summaries",
    }.get(module_type, module_type)
    pool = profile_library.get(pool_key, [])
    user = (
        f"POOL:\n{json.dumps(pool, ensure_ascii=False)}\n\nJD:\n{jd}\n\n"
        f"Rank entries by relevance for module '{module_type}'."
    )
    raw = _call(system, user)
    try:
        data = _extract_json(raw)
        return data.get("ranked", [])
    except Exception:
        return []


def generate_from_scratch(profile_library: dict, jd: str, language: str = "en") -> dict:
    """Produce a full Resume-shaped JSON (modules only) tailored to a JD."""
    if not is_configured():
        return {}
    lang_hint = "Write the content in Chinese." if language == "zh" else "Write in English."
    system = (
        "You generate a tailored resume from a user's profile library and a job description. "
        f"{lang_hint} Return ONLY JSON with this shape:\n"
        "{\n"
        '  "personal": {"full_name":"","job_title":"","email":"","phone":"","location":"","website":"","linkedin":"","github":"","summary_line":""},\n'
        '  "modules": [\n'
        '    {"type":"summary","name":"Summary","icon":"file-text","entries":[{"content":"<p>...</p>"}]},\n'
        '    {"type":"experience","name":"Experience","icon":"briefcase","entries":[{"company":"","position":"","start_date":"","end_date":"","description":"<ul><li>...</li></ul>"}]}\n'
        "  ]\n"
        "}\n"
        "Descriptions are HTML. Choose entries most relevant to the JD; rewrite bullets to mirror its keywords without fabricating facts."
    )
    user = f"PROFILE:\n{json.dumps(profile_library, ensure_ascii=False)}\n\nJD:\n{jd}"
    raw = _call(system, user)
    try:
        return _extract_json(raw)
    except Exception:
        return {"error": "parse_failed", "raw": raw}


def improve_bullet(text: str, jd: str = "", language: str = "en") -> str:
    if not is_configured():
        return text
    lang_hint = "Respond in Chinese." if language == "zh" else "Respond in English."
    system = (
        "Rewrite the bullet to be more impactful: strong action verb, quantified impact when possible, "
        f"concise. Keep facts unchanged. {lang_hint} Return plain text, one line."
    )
    user = f"BULLET: {text}\nJD (optional context): {jd}"
    return _call(system, user).strip()
