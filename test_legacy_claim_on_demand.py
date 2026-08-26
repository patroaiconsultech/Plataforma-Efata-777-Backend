import json
from datetime import datetime, timezone

from sqlalchemy import create_engine, select, text

from conftest import Testing
from orkio_v2.auth import Principal
from orkio_v2.config import get_settings
from orkio_v2.legacy_claim_models import (
    LegacyAccountLink,
    LegacyClaimException,
    LegacyClaimRun,
    LegacyIdMapping,
)
from orkio_v2.models import Membership, Message, Tenant, Thread, ThreadParticipant, User
from orkio_v2.services.legacy_claim import LegacyClaimError, claim_status, import_context


def _seed_legacy_source(path):
    engine = create_engine(f"sqlite+pysqlite:///{path}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id TEXT PRIMARY KEY, org_slug TEXT, email TEXT, created_at INTEGER)"))
        connection.execute(text("CREATE TABLE threads (id TEXT PRIMARY KEY, org_slug TEXT, title TEXT, created_at INTEGER)"))
        connection.execute(text("CREATE TABLE thread_members (id TEXT PRIMARY KEY, org_slug TEXT, thread_id TEXT, user_id TEXT)"))
        connection.execute(text("CREATE TABLE messages (id TEXT PRIMARY KEY, org_slug TEXT, thread_id TEXT, user_id TEXT, role TEXT, content TEXT, agent_id TEXT, agent_name TEXT, created_at INTEGER)"))
        connection.execute(text("CREATE TABLE files (id TEXT PRIMARY KEY, org_slug TEXT, thread_id TEXT, filename TEXT, original_filename TEXT, mime_type TEXT, size_bytes INTEGER, content BLOB, created_at INTEGER)"))
        connection.execute(text("INSERT INTO users VALUES ('legacy-user', 'legacy-org', 'tester@example.com', 1)"))
        connection.execute(text("INSERT INTO threads VALUES ('legacy-private', 'legacy-org', 'Conversa privada', 10)"))
        connection.execute(text("INSERT INTO thread_members VALUES ('member-1', 'legacy-org', 'legacy-private', 'legacy-user')"))
        connection.execute(text("INSERT INTO messages VALUES ('msg-user', 'legacy-org', 'legacy-private', 'legacy-user', 'user', 'Contexto do tester', NULL, NULL, 11)"))
        connection.execute(text("INSERT INTO messages VALUES ('msg-agent', 'legacy-org', 'legacy-private', NULL, 'assistant', 'Resposta histórica', 'agent-1', 'Co-Criador anterior', 12)"))
        connection.execute(text("INSERT INTO threads VALUES ('legacy-shared', 'legacy-org', 'Conversa compartilhada', 20)"))
        connection.execute(text("INSERT INTO thread_members VALUES ('member-2', 'legacy-org', 'legacy-shared', 'legacy-user')"))
        connection.execute(text("INSERT INTO thread_members VALUES ('member-3', 'legacy-org', 'legacy-shared', 'other-user')"))
        connection.execute(text("INSERT INTO messages VALUES ('msg-shared', 'legacy-org', 'legacy-shared', 'legacy-user', 'user', 'Não pode ser copiada automaticamente', NULL, NULL, 21)"))
    engine.dispose()


def _reset_target():
    with Testing() as db:
        for model in (
            LegacyClaimException,
            LegacyIdMapping,
            LegacyClaimRun,
            LegacyAccountLink,
            ThreadParticipant,
            Message,
            Thread,
            Membership,
            User,
            Tenant,
        ):
            db.query(model).delete()
        db.add(Tenant(id="tenant-claim", name="Claim target"))
        db.add(User(
            id="target-user",
            external_subject="native:tester@example.com",
            email="tester@example.com",
            display_name="Tester",
            email_verified_at=datetime.now(timezone.utc),
        ))
        db.add(Membership(tenant_id="tenant-claim", user_id="target-user", role="member", active=True))
        db.commit()


def _principal():
    return Principal(
        user_id="target-user",
        tenant_id="tenant-claim",
        roles=("member",),
        email="tester@example.com",
        external_subject="native:tester@example.com",
    )


def _configure_claim(monkeypatch, legacy_path):
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_ENABLED", "true")
    monkeypatch.setenv("LEGACY_DATABASE_URL", f"sqlite+pysqlite:///{legacy_path}")
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_SOURCE_NAME", "orkio_test_legacy")
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_TENANT_MAP_JSON", json.dumps({"legacy-org": "tenant-claim"}))
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_REQUIRE_VERIFIED_EMAIL", "true")
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_MAX_THREADS", "10")
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_MAX_MESSAGES", "10")
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_MAX_FILES", "10")
    monkeypatch.setenv("PLATFORM_LEGACY_CLAIM_MAX_BYTES", "1000000")
    get_settings.cache_clear()
    return get_settings()


def test_claim_imports_private_context_idempotently_and_skips_shared_thread(tmp_path, monkeypatch):
    _reset_target()
    source = tmp_path / "legacy.sqlite"
    _seed_legacy_source(source)
    settings = _configure_claim(monkeypatch, source)

    with Testing() as db:
        status = claim_status(db, principal=_principal(), settings=settings)
        assert status == {"enabled": True, "available": True, "status": "LEGACY_CONTEXT_AVAILABLE"}

        first = import_context(db, principal=_principal(), settings=settings, consent_version="2026-08")
        assert first["status"] == "completed"
        assert first["threads"] == 1
        assert first["messages"] == 2
        assert first["attachments"] == 0
        assert first["exceptions"] >= 2  # shared thread and artifacts disabled

        second = import_context(db, principal=_principal(), settings=settings, consent_version="2026-08")
        assert second["status"] == "completed"
        assert db.query(Thread).count() == 1
        assert db.query(Message).count() == 2
        assert db.query(LegacyAccountLink).count() == 1
        assert db.query(LegacyIdMapping).filter(LegacyIdMapping.resource_type == "message").count() == 2
        exception_codes = {row.code for row in db.scalars(select(LegacyClaimException)).all()}
        assert "SHARED_THREAD_REQUIRES_REVIEW" in exception_codes
        assert "ARTIFACTS_DISABLED" in exception_codes

    get_settings.cache_clear()


def test_claim_requires_verified_email(tmp_path, monkeypatch):
    _reset_target()
    source = tmp_path / "legacy.sqlite"
    _seed_legacy_source(source)
    settings = _configure_claim(monkeypatch, source)
    with Testing() as db:
        user = db.get(User, "target-user")
        user.email_verified_at = None
        db.commit()
        try:
            claim_status(db, principal=_principal(), settings=settings)
        except LegacyClaimError as exc:
            assert exc.code == "CLAIM_EMAIL_VERIFICATION_REQUIRED"
        else:
            raise AssertionError("claim must require a verified target email")
    get_settings.cache_clear()
