FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml alembic.ini ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
RUN pip install --no-cache-dir .
EXPOSE 8080
CMD ["uvicorn","orkio_v2.main:app","--host","0.0.0.0","--port","8080"]
