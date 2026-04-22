"""Chat persistence: MongoDB (Motor) or in-memory when URI is a placeholder / missing."""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

SESSION_COLLECTION = "agent_sessions"


def _use_memory() -> bool:
    u = os.getenv("MONGODB_URI", "").strip()
    if not u:
        return True
    low = u.lower()
    return "placeholder" in low or "127.0.0.1" in low


@dataclass
class MemoryStore:
    _sessions: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    async def append_message(self, session_id: str, role: str, content: str) -> None:
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        self._sessions[session_id].append(
            {
                "role": role,
                "content": content,
                "ts": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def recent(self, session_id: str, limit: int = 20) -> list[dict[str, str]]:
        rows = self._sessions.get(session_id, [])
        return [{"role": r["role"], "content": r["content"]} for r in rows[-limit:]]


class MongoStore:
    def __init__(self, uri: str) -> None:
        self._client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        dbn = os.getenv("MONGO_DB_NAME", "sync_service")
        self._db = self._client[dbn]

    async def append_message(self, session_id: str, role: str, content: str) -> None:
        await self._db[SESSION_COLLECTION].update_one(
            {"session_id": session_id},
            {
                "$push": {
                    "messages": {
                        "role": role,
                        "content": content,
                        "ts": datetime.now(timezone.utc),
                    }
                },
                "$setOnInsert": {"session_id": session_id},
            },
            upsert=True,
        )

    async def recent(self, session_id: str, limit: int = 20) -> list[dict[str, str]]:
        doc = await self._db[SESSION_COLLECTION].find_one({"session_id": session_id})
        if not doc or not doc.get("messages"):
            return []
        tail = doc["messages"][-limit:]
        return [{"role": m["role"], "content": m["content"]} for m in tail]


def new_session_id() -> str:
    return str(uuid.uuid4())


async def get_store() -> MemoryStore | MongoStore:
    if _use_memory():
        return MemoryStore()
    return MongoStore(os.environ["MONGODB_URI"])


# Singletons set at startup
_store: MemoryStore | MongoStore | None = None


def set_store(s: MemoryStore | MongoStore) -> None:
    global _store
    _store = s


def get_bound_store() -> MemoryStore | MongoStore:
    assert _store is not None
    return _store
