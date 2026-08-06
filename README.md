# ORKIO v2 Premium Backend

Secure modular-monolith foundation for staging. It includes fail-closed authentication,
tenant-scoped collaborative threads, single-use e-mail-bound invitations, attachments,
canonical SSE terminal events, proposal-only autoevolution, audit-ready models and an
initial Alembic schema.

## Local validation

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e '.[test]'
pytest
uvicorn orkio_v2.main:app --reload
```

Production requires OIDC introspection and must never use test identity headers.
