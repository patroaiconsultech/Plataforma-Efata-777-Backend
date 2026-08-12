FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLATFORM_STT_MODEL_CACHE_DIR=/opt/orkio/models/faster-whisper
COPY pyproject.toml alembic.ini ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
RUN pip install --no-cache-dir '.[stt]' \
    && DATABASE_URL='sqlite+pysqlite:///:memory:' \
       PLATFORM_ENVIRONMENT=test \
       PLATFORM_AUTH_MODE=test \
       PLATFORM_INVITATION_TOKEN_SECRET='xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
       python -c "import faster_whisper; import orkio_v2.main; print('STT_DEPENDENCY_PRESENT')"
ARG ORKIO_STT_PREWARM_MODEL=""
RUN mkdir -p "${PLATFORM_STT_MODEL_CACHE_DIR}" \
    && if [ -n "${ORKIO_STT_PREWARM_MODEL}" ]; then \
         PLATFORM_STT_ENABLED=true \
         PLATFORM_STT_PROVIDER=faster_whisper \
         PLATFORM_STT_MODEL="${ORKIO_STT_PREWARM_MODEL}" \
         PLATFORM_STT_LOCAL_FILES_ONLY=false \
         python scripts/prewarm_stt.py; \
       else \
         echo "STT model prewarm skipped; set ORKIO_STT_PREWARM_MODEL at build time to bake a model cache."; \
       fi
EXPOSE 8080
CMD ["uvicorn","orkio_v2.main:app","--host","0.0.0.0","--port","8080"]
