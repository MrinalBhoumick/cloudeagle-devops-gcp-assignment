"""sync-service — API + agentic DevOps coach (Vertex AI) aligned with the CloudEagle assignment rubric."""

from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from chat_store import get_store, set_store
from vertex_agent import agent_meta, run_agent_turn

APP_VERSION = "0.6.0"

WEB_DIR = Path(__file__).resolve().parent / "web"
ASSETS_DIR = WEB_DIR / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    store = await get_store()
    set_store(store)
    yield


app = FastAPI(
    title="sync-service",
    description=(
        "CloudEagle-style DevOps assignment reference: health/actuator, MongoDB, and an agentic "
        "Vertex AI (Gemini) coach grounded in the rubric in recruiter_knowledge.py."
    ),
    version=APP_VERSION,
    lifespan=lifespan,
)

# Browsers often cache /assets/* aggressively; keep responses easy to revalidate after deploys.
_ASSET_MAX_AGE = 120


@app.middleware("http")
async def cache_headers_for_static_assets(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/") and response.status_code < 400:
        response.headers["Cache-Control"] = f"public, max-age={_ASSET_MAX_AGE}, must-revalidate"
    return response


def _env() -> str:
    return os.getenv("SPRING_PROFILES_ACTIVE", os.getenv("ENVIRONMENT", "local"))


def _mask_mongo(uri: str) -> str:
    if not uri or not uri.strip():
        return ""
    if "@" in uri:
        return re.sub(r":([^:@/]+)@", r":***@", uri, count=1)
    return "***"


@app.get("/", include_in_schema=False)
def home():
    """Visitor-facing DevOps Q&A portal (static UI + chat to /api/v1/agent/chat)."""
    index = WEB_DIR / "index.html"
    if not index.is_file():
        return JSONResponse(
            {
                "service": "sync-service",
                "version": APP_VERSION,
                "error": "web UI not found on disk; use /api/v1/summary for JSON.",
            },
            status_code=404,
        )
    return FileResponse(
        index,
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@app.get("/api/v1/summary", tags=["api"])
def api_summary():
    """Service metadata (previous behaviour of `GET /` for API clients, CI, and curl -H Accept: application/json)."""
    uri = os.getenv("MONGODB_URI", "")
    meta = agent_meta()
    return {
        "service": "sync-service",
        "version": APP_VERSION,
        "environment": _env(),
        "mongodb_uri_configured": bool(uri and uri.strip()),
        "mongodb_uri_preview": _mask_mongo(uri) or "(not set)",
        "agent": {
            "llm_backend": meta.get("llm_backend"),
            "llm_model": meta.get("llm_model"),
            "vertex_project_set": meta.get("vertex_configured"),
            "gemini_api_key_set": meta.get("gemini_api_key_set"),
        },
    }


@app.get("/health", response_class=PlainTextResponse)
def health_get():
    return "OK"


@app.get("/actuator/health")
def actuator_health():
    return {"status": "UP"}


@app.get("/ready")
def ready():
    uri = os.getenv("MONGODB_URI", "").strip()
    secret_ok = bool(uri) and "placeholder" not in uri.lower()
    body = {
        "ready": secret_ok,
        "checks": {
            "secret_mongodb_uri": secret_ok,
            "note": "Agent still works in in-memory store mode when URI is a placeholder; use a real URI for production.",
        },
    }
    return JSONResponse(content=body, status_code=200 if secret_ok else 503)


@app.get("/api/v1/info")
def info():
    m = agent_meta()
    return {
        "version": APP_VERSION,
        "environment": _env(),
        "port": int(os.getenv("PORT", "8080")),
        "probes": {
            "liveness": "/actuator/health",
            "readiness": "/ready",
        },
        "agent": m,
    }


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    session_id: str | None = Field(
        default=None,
        description="Omit to start a new session; return value ties multi-turn chat.",
    )
    assignment_mode: bool = Field(
        default=False,
        description="If true, appends the take-home rubric as optional context (still general model).",
    )


@app.post("/api/v1/agent/chat")
async def agent_chat(body: ChatIn):
    try:
        r = await run_agent_turn(body.message, body.session_id, body.assignment_mode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {
        "reply": r.reply,
        "session_id": r.session_id,
        "mode": r.mode,
        "store": r.store,
    }


@app.get("/api/v1/agent/meta")
def agent_get_meta():
    return agent_meta()


# Mounted last so / and /api/* take precedence
if ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
