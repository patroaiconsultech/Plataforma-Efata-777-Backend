from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import hashlib

from sqlalchemy.orm import Session

from conftest import Testing
from orkio_v2.config import get_settings
from orkio_v2.models import Attachment
from orkio_v2.services.document_context import build_document_context


def _attach_text(
    db: Session,
    *,
    root: Path,
    thread_id: str,
    attachment_id: str,
    filename: str,
    text: str,
    created_at: datetime,
    tenant_id: str = "tenant-1",
) -> None:
    raw = text.encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    storage_key = f"{tenant_id}/{thread_id}/{digest}-{attachment_id}.txt"
    target = root / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    db.add(
        Attachment(
            id=attachment_id,
            tenant_id=tenant_id,
            thread_id=thread_id,
            uploaded_by="user-1",
            filename=filename,
            mime_type="text/plain",
            size_bytes=len(raw),
            sha256=digest,
            storage_key=storage_key,
            status="ready",
            created_at=created_at,
        )
    )
    db.commit()


def _premium_settings(monkeypatch, tmp_path):
    settings = get_settings()
    monkeypatch.setattr(settings, "artifact_storage_path", str(tmp_path), raising=False)
    monkeypatch.setattr(settings, "document_context_enabled", True, raising=False)
    monkeypatch.setattr(settings, "document_context_max_files", 6, raising=False)
    monkeypatch.setattr(settings, "document_context_candidate_files", 24, raising=False)
    monkeypatch.setattr(settings, "document_context_max_chars_per_file", 20_000, raising=False)
    monkeypatch.setattr(settings, "document_context_max_chars", 48_000, raising=False)
    monkeypatch.setattr(settings, "document_context_chunk_chars", 4_000, raising=False)
    return settings


def test_newest_document_is_not_starved_by_older_thread_history(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-starvation-thread"
    base = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)

    with Testing() as db:
        for index in range(4):
            _attach_text(
                db,
                root=tmp_path,
                thread_id=thread_id,
                attachment_id=f"old-{index}",
                filename=f"old-{index}.txt",
                text=f"OLDER-{index}-" + ("x" * 24_000),
                created_at=base + timedelta(minutes=index),
            )
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="master-starve",
            filename="Master Plan Chris_24.02.26.docx",
            text="MASTER-PLAN-OPENING\n" + ("m" * 579_000) + "\nMASTER-PLAN-TAIL",
            created_at=base + timedelta(hours=1),
        )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
            query="Analise o Master Plan que acabei de compartilhar.",
        )

    assert bundle is not None
    master = next(
        item for item in bundle.provenance.source_provenance
        if item.attachment_id == "master-starve"
    )
    assert master.provided_chars > 0
    assert master.provided_chars <= 20_000
    assert master.priority_reason in {"filename_query", "recent"}
    assert bundle.provenance.provided_chars <= 48_000


def test_focus_attachment_id_has_priority_even_with_generic_query(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-focus-thread"
    base = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)

    with Testing() as db:
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="focused",
            filename="strategic-plan.txt",
            text="FOCUSED-CONTENT\n" + ("a" * 25_000),
            created_at=base,
        )
        for index in range(8):
            _attach_text(
                db,
                root=tmp_path,
                thread_id=thread_id,
                attachment_id=f"recent-{index}",
                filename=f"recent-{index}.txt",
                text="r" * 25_000,
                created_at=base + timedelta(hours=index + 1),
            )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
            query="analise o documento",
            focus_attachment_id="focused",
        )

    assert bundle is not None
    assert bundle.provenance.source_provenance[0].attachment_id == "focused"
    assert bundle.provenance.source_provenance[0].priority_reason == "focus_attachment"
    assert bundle.provenance.source_provenance[0].provided_chars > 0


def test_named_older_document_beats_unrelated_newer_candidates(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-filename-thread"
    base = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)

    with Testing() as db:
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="master-name",
            filename="Master Plan Pathway AI.txt",
            text="PATHWAY-STRATEGY\n" + ("p" * 30_000),
            created_at=base,
        )
        for index in range(5):
            _attach_text(
                db,
                root=tmp_path,
                thread_id=thread_id,
                attachment_id=f"new-{index}",
                filename=f"random-{index}.txt",
                text="n" * 30_000,
                created_at=base + timedelta(hours=index + 1),
            )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
            query="Faça uma análise do Master Plan da Pathway AI.",
        )

    assert bundle is not None
    assert bundle.provenance.source_provenance[0].attachment_id == "master-name"
    assert bundle.provenance.source_provenance[0].priority_reason == "filename_query"


def test_generic_analysis_uses_distributed_overview_for_large_document(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-overview-thread"
    chunks = [
        f"SECTION-{index:03d}\n" + (chr(65 + (index % 26)) * 3_900)
        for index in range(40)
    ]
    text = "\n".join(chunks)

    with Testing() as db:
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="large",
            filename="large-plan.txt",
            text=text,
            created_at=datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc),
        )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
            query="Analise este documento por favor.",
        )

    assert bundle is not None
    source = bundle.provenance.source_provenance[0]
    assert source.selection_mode == "overview_sample"
    assert len(source.selected_ranges) >= 2
    assert source.selected_ranges[0].startswith("0:")
    assert int(source.selected_ranges[-1].split(":")[0]) > 100_000
    assert source.provided_chars <= 20_000


def test_query_retrieval_can_select_relevant_content_outside_document_head(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-query-thread"
    text = (
        ("intro " * 12_000)
        + "\nQUANTUM-PATHWAY-MARKET-ENTRY decisive evidence\n"
        + ("tail " * 12_000)
    )

    with Testing() as db:
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="strategy",
            filename="strategy.txt",
            text=text,
            created_at=datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc),
        )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
            query="Onde o documento trata de quantum pathway market entry?",
        )

    assert bundle is not None
    source = bundle.provenance.source_provenance[0]
    assert source.selection_mode == "query_retrieval"
    assert "QUANTUM-PATHWAY-MARKET-ENTRY" in bundle.message["content"]


def test_empty_query_preserves_legacy_head_excerpt_contract(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-legacy-thread"
    text = "HEAD-SENTINEL" + ("x" * 25_000) + "TAIL-SENTINEL"

    with Testing() as db:
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="legacy",
            filename="legacy.txt",
            text=text,
            created_at=datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc),
        )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
        )

    assert bundle is not None
    source = bundle.provenance.source_provenance[0]
    assert source.selection_mode == "head"
    assert "HEAD-SENTINEL" in bundle.message["content"]
    assert "TAIL-SENTINEL" not in bundle.message["content"]


def test_focus_attachment_cannot_cross_tenant_boundary(monkeypatch, tmp_path):
    settings = _premium_settings(monkeypatch, tmp_path)
    thread_id = "premium-tenant-thread"
    base = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)

    with Testing() as db:
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="safe",
            filename="safe.txt",
            text="TENANT-ONE",
            created_at=base,
        )
        _attach_text(
            db,
            root=tmp_path,
            thread_id=thread_id,
            attachment_id="foreign",
            filename="foreign.txt",
            text="TENANT-TWO-SECRET",
            created_at=base + timedelta(minutes=1),
            tenant_id="tenant-2",
        )
        bundle = build_document_context(
            db,
            settings=settings,
            tenant_id="tenant-1",
            thread_id=thread_id,
            query="analise",
            focus_attachment_id="foreign",
        )

    assert bundle is not None
    assert "foreign" not in bundle.provenance.source_ids
    assert "TENANT-TWO-SECRET" not in bundle.message["content"]
