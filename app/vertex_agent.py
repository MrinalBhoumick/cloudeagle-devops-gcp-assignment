"""LLM: Vertex AI Gemini with per-model fallbacks, optional Google AI (API key) fallback."""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from dataclasses import dataclass
from typing import Optional

import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

from chat_store import get_bound_store, new_session_id
from recruiter_knowledge import RECRUITER_KNOWLEDGE

logger = logging.getLogger(__name__)

# Cache last model that worked (Vertex publisher id, e.g. gemini-1.5-flash)
_last_vertex_model_lock = threading.Lock()
_last_vertex_model_ok: str | None = None

_last_backend: str = "none"
_last_model_label: str = ""

_MAX_RUBRIC_CHARS = 16000

_SYSTEM = """You are a helpful, general-purpose assistant. \
You can discuss (appropriate) topics: software, DevOps, science, learning, and everyday questions. \
Be clear; if you do not know, say so. Do not invent private company data."""

# Tried in order until a Vertex publish succeeds. Short ids often work when -001/-002 404.
_VERTEX_MODEL_CANDIDATES: list[str] = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro-001",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-pro",
]

_GEMINI_API_MODELS: list[str] = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-pro",
    "gemini-1.0-pro",
]

# Filled on first `list_models()` call (per process); avoids hard‑coding names that 404 for some keys.
_GEMINI_LIST_CACHE: list[str] | None = None
_GEMINI_LIST_LOCK = threading.Lock()


def _candidates_vertex() -> list[str]:
    env = os.getenv("VERTEX_MODEL", "").strip()
    out: list[str] = []
    with _last_vertex_model_lock:
        ok = _last_vertex_model_ok
    if ok:
        out.append(ok)
    if env and env not in out:
        out.append(env)
    for m in _VERTEX_MODEL_CANDIDATES:
        if m not in out:
            out.append(m)
    return out


def _vertex_generate_one(model_id: str, user_prompt: str) -> str:
    out = GenerativeModel(model_id, system_instruction=_SYSTEM).generate_content(
        user_prompt,
        generation_config=GenerationConfig(temperature=0.5, max_output_tokens=2048),
    )
    text = ""
    if out.candidates and out.candidates[0].content.parts:
        for p in out.candidates[0].content.parts:
            if hasattr(p, "text") and p.text:
                text += p.text
    return (text or "").strip() or "(Empty response; try rephrasing.)"


def _generate_vertex(user_prompt: str) -> tuple[Optional[str], str]:
    global _last_vertex_model_ok, _last_backend, _last_model_label
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    location = os.getenv("VERTEX_LOCATION", "us-central1").strip()
    if not project:
        return None, "no_project"

    vertexai.init(project=project, location=location)
    errors: list[str] = []
    for mid in _candidates_vertex():
        try:
            reply = _vertex_generate_one(mid, user_prompt)
            with _last_vertex_model_lock:
                _last_vertex_model_ok = mid
            _last_backend = "vertex"
            _last_model_label = mid
            return reply, "ok"
        except Exception as e:
            s = str(e)
            errors.append(f"{mid}: {s[:120]}")
            if "404" not in s and "not found" not in s.lower():
                return None, s
            continue
    return None, "vertex_404: " + "; ".join(errors[:3])


def _extract_genai_text(out: object) -> str:
    text = ""
    if hasattr(out, "text") and out.text:
        text = (out.text or "").strip()
    if not text and getattr(out, "candidates", None) and out.candidates:
        cand = out.candidates[0]
        if getattr(cand, "content", None) and cand.content.parts:
            text = "".join(getattr(x, "text", "") or "" for x in cand.content.parts)
        fr = getattr(cand, "finish_reason", None)
        if not text and fr is not None:
            logger.warning("genai finish_reason=%s (no text)", fr)
    pfb = getattr(out, "prompt_feedback", None)
    if pfb and getattr(pfb, "block_reason", None) and not text:
        logger.warning("genai prompt_feedback.block_reason=%s", pfb.block_reason)
    return (text or "").strip()


def _discover_api_model_names() -> list[str]:
    global _GEMINI_LIST_CACHE
    with _GEMINI_LIST_LOCK:
        if _GEMINI_LIST_CACHE is not None:
            return _GEMINI_LIST_CACHE
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        return list(_GEMINI_API_MODELS)
    names: list[str] = []
    try:
        import google.generativeai as genai

        genai.configure(api_key=key)
        for m in genai.list_models():
            if "generateContent" not in (m.supported_generation_methods or []):
                continue
            n = m.name or ""
            if n.startswith("models/"):
                n = n[7:]
            if n and n not in names:
                names.append(n)
        flash = [x for x in names if "flash" in x.lower()]
        pro = [x for x in names if "pro" in x.lower() and x not in flash]
        rest = [x for x in names if x not in flash and x not in pro]
        ordered = flash + pro + rest
        if not ordered:
            ordered = list(_GEMINI_API_MODELS)
    except Exception as e:
        logger.warning("genai list_models: %s", e)
        ordered = list(_GEMINI_API_MODELS)
    with _GEMINI_LIST_LOCK:
        _GEMINI_LIST_CACHE = ordered[:32]
    return _GEMINI_LIST_CACHE


def _ordered_gemini_models() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in _discover_api_model_names() + _GEMINI_API_MODELS:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _generate_gemini_api_key(user_prompt: str) -> tuple[Optional[str], str]:
    global _last_backend, _last_model_label
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        return None, "no_key"
    try:
        import google.generativeai as genai
    except ImportError:
        return None, "google-generativeai not installed"
    genai.configure(api_key=key)
    full = f"{_SYSTEM}\n\n{user_prompt}"
    last_err = ""
    try:
        gen_cfg = genai.GenerationConfig(temperature=0.5, max_output_tokens=2048)
    except Exception:
        gen_cfg = None
    for name in _ordered_gemini_models():
        try:
            m = genai.GenerativeModel(name)
            out = m.generate_content(full, generation_config=gen_cfg) if gen_cfg is not None else m.generate_content(full)
            text = _extract_genai_text(out)
            if text:
                _last_backend = "gemini_api_key"
                _last_model_label = name
                return text, "ok"
        except Exception as e:
            last_err = f"{name}: {str(e)[:180]}"
            logger.warning("gemini API %s", last_err)
            continue
    return None, last_err or "all_models_failed"


def _friendly_error(msg: str) -> str:
    if "vertex_404" in msg or ("404" in msg and "model" in msg.lower()):
        return (
            "Vertex models are not available for this project in this region (common on new orgs).\n"
            "Quickest fix: in Cloud Run add env GEMINI_API_KEY from https://aistudio.google.com/apikey and enable "
            "the Generative Language API for the same Google Cloud project.\n"
            "Alternative: in Vertex → Model Garden pick a model ID your account can use, set VERTEX_MODEL, redeploy.\n"
            f"Details: {msg[:320]}"
        )
    return msg


def _llm_unavailable_text(v_stat: str) -> str:
    if v_stat == "no_project":
        return (
            "Set GOOGLE_CLOUD_PROJECT for Vertex, or set GEMINI_API_KEY (https://aistudio.google.com/apikey) on Cloud Run."
        )
    if v_stat and v_stat.startswith("vertex_404"):
        return _friendly_error(v_stat)
    if v_stat and ("404" in v_stat or "not found" in v_stat.lower()):
        return _friendly_error(v_stat)
    return v_stat or "LLM unavailable. Set GEMINI_API_KEY or a working Vertex model."


def _gemini_key_only_error(detail: str) -> str:
    """GEMINI_API_KEY is set: we use only the Generative Language API (no Vertex noise)."""
    parts = [
        "Gemini API (Generative Language) did not return usable text from this key.",
        "Cloud Run calls Google **server-to-server** — in GCP → APIs & Services → Credentials → your API key:",
        "• **Application restrictions:** set to “None” (or IP), NOT “HTTP referrers” (that blocks Cloud Run).",
        "• **API restrictions:** allow **Generative Language API** (or “Don’t restrict” for a dev key).",
        "Also: enable `generativelanguage.googleapis.com`, link billing, use a key **created in this GCP project** if possible.",
    ]
    if detail and detail not in ("no_key", "ok", "all_models_failed"):
        parts.append(f"Technical detail: {detail}")
    elif detail in ("all_models_failed",) or not detail:
        parts.append("All models in the list were tried; see detail above or Cloud Run logs.")
    return "\n".join(parts)


def _build_prompt(history_lines: str, message: str, assignment_mode: bool) -> str:
    blocks: list[str] = []
    if history_lines.strip():
        blocks.append("Previous turns:\n" + history_lines.strip())
    if assignment_mode:
        ref = RECRUITER_KNOWLEDGE[:_MAX_RUBRIC_CHARS]
        blocks.append(
            "Optional take-home style reference (use when relevant; ignore for unrelated questions):\n" + ref
        )
    blocks.append("User message:\n" + message)
    return "\n\n---\n\n".join(blocks)


@dataclass
class AgentResult:
    reply: str
    session_id: str
    mode: str
    store: str


async def run_agent_turn(
    message: str,
    session_id: str | None,
    assignment_mode: bool = False,
) -> AgentResult:
    sid = session_id or new_session_id()
    store = get_bound_store()
    prior = await store.recent(sid, 16)
    history_lines = ""
    for p in prior:
        history_lines += f"{p['role']}: {p['content']}\n"
    user_prompt = _build_prompt(history_lines, message, assignment_mode)

    r: str
    if os.getenv("GEMINI_API_KEY", "").strip():
        g, g_err = await asyncio.to_thread(_generate_gemini_api_key, user_prompt)
        if g is not None:
            r = g
        else:
            # Key present: do not call Vertex (avoids duplicate Vertex 404 messages).
            r = _gemini_key_only_error(g_err)
    else:
        v_reply, v_stat = _generate_vertex(user_prompt)
        if v_reply is not None:
            r = v_reply
        else:
            g, g_err = await asyncio.to_thread(_generate_gemini_api_key, user_prompt)
            r = g if g is not None else _llm_unavailable_text(v_stat)

    await store.append_message(sid, "user", message)
    await store.append_message(sid, "assistant", r)

    kind = "memory" if "MemoryStore" in type(store).__name__ else "mongodb"
    label = "assignment+general" if assignment_mode else "general"
    return AgentResult(reply=r, session_id=sid, mode=label, store=kind)


def agent_meta() -> dict:
    return {
        "llm_backend": _last_backend,
        "llm_model": _last_model_label,
        "vertex_configured": bool(os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()),
        "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "project": os.getenv("GOOGLE_CLOUD_PROJECT", ""),
        "location": os.getenv("VERTEX_LOCATION", "us-central1"),
        "vertex_model_env": os.getenv("VERTEX_MODEL", ""),
        "assistant_type": "general_llm (Vertex or GEMINI_API_KEY; optional rubric when assignment_mode)",
    }
