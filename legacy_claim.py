from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import Any

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from ..auth import Principal
from ..legacy_claim_models import LegacyAccountLink, LegacyClaimException, LegacyClaimRun, LegacyIdMapping
from ..models import AuditEvent, Message, Thread, ThreadParticipant, User
from .attachment_service import AttachmentIdentityConflict, persist_attachment
from .blob_storage import BlobStorageError, build_blob_storage


class LegacyClaimError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


_ALLOWED_MIME = {
    "application/pdf", "text/plain", "text/csv", "text/markdown", "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
_SUFFIX_MIME = {
    ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".md": "text/markdown",
    ".markdown": "text/markdown", ".json": "application/json",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def _legacy_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return datetime.now(timezone.utc)


def _mapping(settings, legacy_org_slug: str) -> str:
    try:
        values = json.loads(settings.legacy_claim_tenant_map_json or "{}")
    except json.JSONDecodeError as exc:
        raise LegacyClaimError("LEGACY_TENANT_MAP_INVALID") from exc
    if not isinstance(values, dict):
        raise LegacyClaimError("LEGACY_TENANT_MAP_INVALID")
    target = values.get(legacy_org_slug, legacy_org_slug)
    if not isinstance(target, str) or not target.strip():
        raise LegacyClaimError("LEGACY_TENANT_NOT_MAPPED")
    return target.strip()


def _source_connection(settings):
    if not settings.legacy_claim_enabled:
        raise LegacyClaimError("LEGACY_CLAIM_DISABLED")
    if not settings.legacy_database_url.strip():
        raise LegacyClaimError("LEGACY_DATABASE_NOT_CONFIGURED")
    engine = create_engine(settings.legacy_database_url, pool_pre_ping=True)
    connection = engine.connect()
    transaction = connection.begin()
    try:
        if engine.dialect.name == "postgresql":
            connection.execute(text("SET TRANSACTION READ ONLY"))
        return engine, connection, transaction
    except Exception:
        transaction.rollback()
        connection.close()
        engine.dispose()
        raise


def _close_source(engine, connection, transaction) -> None:
    try:
        transaction.rollback()
    finally:
        connection.close()
        engine.dispose()


def _find_legacy_user(connection, email: str) -> dict[str, Any] | None:
    rows = connection.execute(
        text("SELECT id, org_slug, email FROM users WHERE lower(email) = lower(:email) ORDER BY created_at ASC"),
        {"email": email},
    ).mappings().all()
    if len(rows) > 1:
        raise LegacyClaimError("LEGACY_EMAIL_AMBIGUOUS")
    return dict(rows[0]) if rows else None


def _require_target_identity(db: Session, principal: Principal, settings) -> User:
    user = db.get(User, principal.user_id)
    if user is None or user.email.strip().lower() != principal.email.strip().lower():
        raise LegacyClaimError("CLAIM_IDENTITY_NOT_PROVISIONED")
    if settings.legacy_claim_require_verified_email and user.email_verified_at is None:
        raise LegacyClaimError("CLAIM_EMAIL_VERIFICATION_REQUIRED")
    return user


def _existing_mapping(db: Session, *, settings, legacy_org: str, resource_type: str, legacy_id: str) -> LegacyIdMapping | None:
    return db.scalar(select(LegacyIdMapping).where(
        LegacyIdMapping.source_name == settings.legacy_claim_source_name,
        LegacyIdMapping.legacy_org_slug == legacy_org,
        LegacyIdMapping.resource_type == resource_type,
        LegacyIdMapping.legacy_resource_id == legacy_id,
    ))


def _exception(db: Session, run: LegacyClaimRun, *, resource_type: str, legacy_id: str | None, code: str, metadata: dict[str, Any] | None = None) -> None:
    run.exception_count += 1
    db.add(LegacyClaimException(
        claim_run_id=run.id,
        resource_type=resource_type,
        legacy_resource_id=legacy_id,
        code=code,
        metadata_json=metadata or {},
    ))


def claim_status(db: Session, *, principal: Principal, settings) -> dict[str, Any]:
    if not settings.legacy_claim_enabled:
        return {"enabled": False, "available": False, "status": "LEGACY_CLAIM_DISABLED"}
    user = _require_target_identity(db, principal, settings)
    engine, connection, transaction = _source_connection(settings)
    try:
        legacy = _find_legacy_user(connection, user.email)
    finally:
        _close_source(engine, connection, transaction)
    if legacy is None:
        return {"enabled": True, "available": False, "status": "LEGACY_ACCOUNT_NOT_FOUND"}
    target_tenant = _mapping(settings, str(legacy["org_slug"] or ""))
    if target_tenant != principal.tenant_id:
        return {"enabled": True, "available": False, "status": "LEGACY_TENANT_NOT_MAPPED"}
    link = db.scalar(select(LegacyAccountLink).where(
        LegacyAccountLink.source_name == settings.legacy_claim_source_name,
        LegacyAccountLink.legacy_org_slug == str(legacy["org_slug"] or ""),
        LegacyAccountLink.legacy_user_id == str(legacy["id"]),
    ))
    return {
        "enabled": True,
        "available": link is None,
        "status": "LEGACY_CONTEXT_AVAILABLE" if link is None else "LEGACY_CONTEXT_ALREADY_CLAIMED",
    }


def _eligible_threads(connection, *, legacy_user_id: str, legacy_org: str, max_threads: int) -> list[dict[str, Any]]:
    rows = connection.execute(text("""
        SELECT DISTINCT t.id, t.title, t.created_at
        FROM threads t
        JOIN thread_members tm ON tm.thread_id = t.id
        WHERE tm.user_id = :user_id AND t.org_slug = :org_slug
        ORDER BY t.created_at ASC
        LIMIT :limit
    """), {"user_id": legacy_user_id, "org_slug": legacy_org, "limit": max_threads + 1}).mappings().all()
    return [dict(row) for row in rows]


def _is_shared_thread(connection, *, thread_id: str) -> bool:
    count = connection.execute(text("SELECT COUNT(DISTINCT user_id) FROM thread_members WHERE thread_id = :thread_id"), {"thread_id": thread_id}).scalar_one()
    return int(count or 0) > 1


def import_context(db: Session, *, principal: Principal, settings, consent_version: str) -> dict[str, Any]:
    user = _require_target_identity(db, principal, settings)
    engine, connection, transaction = _source_connection(settings)
    try:
        legacy = _find_legacy_user(connection, user.email)
        if legacy is None:
            raise LegacyClaimError("LEGACY_ACCOUNT_NOT_FOUND")
        legacy_id = str(legacy["id"])
        legacy_org = str(legacy["org_slug"] or "")
        if _mapping(settings, legacy_org) != principal.tenant_id:
            raise LegacyClaimError("LEGACY_TENANT_NOT_MAPPED")

        link = db.scalar(select(LegacyAccountLink).where(
            LegacyAccountLink.source_name == settings.legacy_claim_source_name,
            LegacyAccountLink.legacy_org_slug == legacy_org,
            LegacyAccountLink.legacy_user_id == legacy_id,
        ))
        if link is not None and link.target_user_id != principal.user_id:
            raise LegacyClaimError("LEGACY_ACCOUNT_ALREADY_LINKED")
        if link is None:
            link = LegacyAccountLink(
                source_name=settings.legacy_claim_source_name,
                legacy_org_slug=legacy_org,
                legacy_user_id=legacy_id,
                target_tenant_id=principal.tenant_id,
                target_user_id=principal.user_id,
            )
            db.add(link)
            db.flush()

        run = LegacyClaimRun(
            link_id=link.id,
            tenant_id=principal.tenant_id,
            user_id=principal.user_id,
            consent_version=consent_version,
        )
        db.add(run)
        db.commit()

        candidates = _eligible_threads(
            connection,
            legacy_user_id=legacy_id,
            legacy_org=legacy_org,
            max_threads=settings.legacy_claim_max_threads,
        )
        if len(candidates) > settings.legacy_claim_max_threads:
            candidates = candidates[:settings.legacy_claim_max_threads]
            _exception(db, run, resource_type="claim", legacy_id=None, code="THREAD_LIMIT_REACHED")

        imported_bytes = 0
        processed_messages = 0
        processed_files = 0
        message_limit_reached = False
        file_limit_reached = False
        for legacy_thread in candidates:
            legacy_thread_id = str(legacy_thread["id"])
            if _is_shared_thread(connection, thread_id=legacy_thread_id):
                _exception(db, run, resource_type="thread", legacy_id=legacy_thread_id, code="SHARED_THREAD_REQUIRES_REVIEW")
                continue
            mapped_thread = _existing_mapping(db, settings=settings, legacy_org=legacy_org, resource_type="thread", legacy_id=legacy_thread_id)
            if mapped_thread is None:
                thread = Thread(
                    tenant_id=principal.tenant_id,
                    title=str(legacy_thread.get("title") or "Conversa migrada")[:240],
                    created_by=principal.user_id,
                    created_at=_legacy_datetime(legacy_thread.get("created_at")),
                )
                db.add(thread)
                db.flush()
                db.add(ThreadParticipant(
                    tenant_id=principal.tenant_id,
                    thread_id=thread.id,
                    user_id=principal.user_id,
                    thread_role="owner",
                    history_access="full_thread",
                    can_view_attachments=True,
                    can_download_artifacts=True,
                    can_upload_files=True,
                    can_generate_artifacts=True,
                ))
                mapped_thread = LegacyIdMapping(
                    source_name=settings.legacy_claim_source_name,
                    legacy_org_slug=legacy_org,
                    resource_type="thread",
                    legacy_resource_id=legacy_thread_id,
                    target_resource_id=thread.id,
                    claim_run_id=run.id,
                )
                db.add(mapped_thread)
                run.imported_threads += 1
                db.commit()

            target_thread_id = mapped_thread.target_resource_id
            messages = connection.execute(text("""
                SELECT id, role, content, agent_id, agent_name, created_at
                FROM messages
                WHERE org_slug = :org_slug AND thread_id = :thread_id
                ORDER BY created_at ASC, id ASC
                LIMIT :limit
            """), {
                "org_slug": legacy_org,
                "thread_id": legacy_thread_id,
                "limit": settings.legacy_claim_max_messages + 1,
            }).mappings().all()
            for legacy_message in messages:
                if processed_messages >= settings.legacy_claim_max_messages:
                    _exception(db, run, resource_type="message", legacy_id=None, code="MESSAGE_LIMIT_REACHED")
                    message_limit_reached = True
                    break
                legacy_message_id = str(legacy_message["id"])
                if _existing_mapping(db, settings=settings, legacy_org=legacy_org, resource_type="message", legacy_id=legacy_message_id):
                    continue
                role = str(legacy_message.get("role") or "user").lower()
                if role == "assistant":
                    author_type, author_id, agent_name = "agent", "legacy-agent", str(legacy_message.get("agent_name") or "Co-Criador")[:80]
                elif role == "system":
                    author_type, author_id, agent_name = "system", "legacy-system", None
                else:
                    author_type, author_id, agent_name = "user", principal.user_id, None
                message = Message(
                    tenant_id=principal.tenant_id,
                    thread_id=target_thread_id,
                    author_type=author_type,
                    author_id=author_id,
                    agent_name=agent_name,
                    content=str(legacy_message.get("content") or ""),
                    created_at=_legacy_datetime(legacy_message.get("created_at")),
                )
                db.add(message)
                db.flush()
                db.add(LegacyIdMapping(
                    source_name=settings.legacy_claim_source_name,
                    legacy_org_slug=legacy_org,
                    resource_type="message",
                    legacy_resource_id=legacy_message_id,
                    target_resource_id=message.id,
                    claim_run_id=run.id,
                ))
                run.imported_messages += 1
                processed_messages += 1
                db.commit()

            if message_limit_reached:
                break
            if not settings.artifacts_enabled:
                _exception(db, run, resource_type="attachment", legacy_id=legacy_thread_id, code="ARTIFACTS_DISABLED")
                continue
            files = connection.execute(text("""
                SELECT id, filename, original_filename, mime_type, size_bytes, content, created_at
                FROM files
                WHERE org_slug = :org_slug AND thread_id = :thread_id
                ORDER BY created_at ASC, id ASC
                LIMIT :limit
            """), {
                "org_slug": legacy_org,
                "thread_id": legacy_thread_id,
                "limit": settings.legacy_claim_max_files + 1,
            }).mappings().all()
            for legacy_file in files:
                legacy_file_id = str(legacy_file["id"])
                if processed_files >= settings.legacy_claim_max_files:
                    _exception(db, run, resource_type="attachment", legacy_id=None, code="FILE_LIMIT_REACHED")
                    file_limit_reached = True
                    break
                if _existing_mapping(db, settings=settings, legacy_org=legacy_org, resource_type="attachment", legacy_id=legacy_file_id):
                    continue
                raw = legacy_file.get("content")
                if raw is None:
                    _exception(db, run, resource_type="attachment", legacy_id=legacy_file_id, code="LEGACY_FILE_BINARY_MISSING")
                    continue
                data = bytes(raw)
                if len(data) > settings.max_upload_bytes or imported_bytes + len(data) > settings.legacy_claim_max_bytes:
                    _exception(db, run, resource_type="attachment", legacy_id=legacy_file_id, code="FILE_SIZE_LIMIT_REACHED")
                    continue
                filename = PurePosixPath(str(legacy_file.get("original_filename") or legacy_file.get("filename") or "file").replace("\\", "/")).name
                mime_type = str(legacy_file.get("mime_type") or _SUFFIX_MIME.get(PurePosixPath(filename).suffix.lower(), ""))
                if not filename or filename in {".", ".."} or mime_type not in _ALLOWED_MIME:
                    _exception(db, run, resource_type="attachment", legacy_id=legacy_file_id, code="FILE_TYPE_NOT_ALLOWED")
                    continue
                digest = hashlib.sha256(data).hexdigest()
                key = f"legacy/{settings.legacy_claim_source_name}/{legacy_org}/{legacy_file_id}-{digest}-{filename}"
                try:
                    result = persist_attachment(
                        db,
                        tenant_id=principal.tenant_id,
                        thread_id=target_thread_id,
                        uploaded_by=principal.user_id,
                        filename=filename,
                        mime_type=mime_type,
                        data=data,
                        sha256=digest,
                        storage_key=key,
                        storage=build_blob_storage(settings),
                    )
                except (AttachmentIdentityConflict, BlobStorageError):
                    _exception(db, run, resource_type="attachment", legacy_id=legacy_file_id, code="ATTACHMENT_IMPORT_FAILED")
                    continue
                result.attachment.created_at = _legacy_datetime(legacy_file.get("created_at"))
                db.add(LegacyIdMapping(
                    source_name=settings.legacy_claim_source_name,
                    legacy_org_slug=legacy_org,
                    resource_type="attachment",
                    legacy_resource_id=legacy_file_id,
                    target_resource_id=result.attachment.id,
                    claim_run_id=run.id,
                ))
                run.imported_attachments += 1
                processed_files += 1
                imported_bytes += len(data)
                db.commit()
            if file_limit_reached:
                break

        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        db.add(AuditEvent(
            tenant_id=principal.tenant_id,
            actor_id=principal.user_id,
            action="legacy_claim.completed",
            resource_type="legacy_claim_run",
            resource_id=run.id,
            outcome="success",
            metadata_json={
                "threads": run.imported_threads,
                "messages": run.imported_messages,
                "attachments": run.imported_attachments,
                "exceptions": run.exception_count,
            },
        ))
        db.commit()
        return {
            "status": "completed",
            "run_id": run.id,
            "threads": run.imported_threads,
            "messages": run.imported_messages,
            "attachments": run.imported_attachments,
            "exceptions": run.exception_count,
        }
    except LegacyClaimError:
        raise
    except Exception as exc:
        db.rollback()
        raise LegacyClaimError("LEGACY_CLAIM_IMPORT_FAILED") from exc
    finally:
        _close_source(engine, connection, transaction)
