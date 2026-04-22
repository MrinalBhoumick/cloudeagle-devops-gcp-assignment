# sync-service — multi-stage, non-root, Cloud Run (listens on $PORT)
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN useradd -r -u 10001 -s /bin/false appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py recruiter_knowledge.py chat_store.py vertex_agent.py .
COPY web ./web

USER appuser
EXPOSE 8080
CMD ["/bin/sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
