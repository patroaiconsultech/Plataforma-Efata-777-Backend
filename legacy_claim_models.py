from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LegacyAccountLink(Base):
    __tablename__ = "legacy_account_links"
    __table_args__ = (
        UniqueConstraint("source_name", "legacy_org_slug", "legacy_user_id", name="uq_legacy_account_source_user"),
        UniqueConstraint("source_name", "target_user_id", name="uq_legacy_account_source_target"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    source_name: Mapped[str] = mapped_column(String(80), index=True)
    legacy_org_slug: Mapped[str] = mapped_column(String(120), index=True)
    legacy_user_id: Mapped[str] = mapped_column(String(120), index=True)
    target_tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    target_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    claim_method: Mapped[str] = mapped_column(String(40), default="verified_email")
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class LegacyClaimRun(Base):
    __tablename__ = "legacy_claim_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    link_id: Mapped[str] = mapped_column(ForeignKey("legacy_account_links.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    consent_version: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="running")
    imported_threads: Mapped[int] = mapped_column(Integer, default=0)
    imported_messages: Mapped[int] = mapped_column(Integer, default=0)
    imported_attachments: Mapped[int] = mapped_column(Integer, default=0)
    exception_count: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LegacyIdMapping(Base):
    __tablename__ = "legacy_id_mappings"
    __table_args__ = (
        UniqueConstraint(
            "source_name", "legacy_org_slug", "resource_type", "legacy_resource_id",
            name="uq_legacy_id_mapping_source_resource",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    source_name: Mapped[str] = mapped_column(String(80), index=True)
    legacy_org_slug: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str] = mapped_column(String(40), index=True)
    legacy_resource_id: Mapped[str] = mapped_column(String(160), index=True)
    target_resource_id: Mapped[str] = mapped_column(String(160), index=True)
    claim_run_id: Mapped[str] = mapped_column(ForeignKey("legacy_claim_runs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class LegacyClaimException(Base):
    __tablename__ = "legacy_claim_exceptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    claim_run_id: Mapped[str] = mapped_column(ForeignKey("legacy_claim_runs.id", ondelete="CASCADE"), index=True)
    resource_type: Mapped[str] = mapped_column(String(40), index=True)
    legacy_resource_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    code: Mapped[str] = mapped_column(String(80), index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
