from __future__ import annotations

import hashlib
import io
import json
import logging
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Attachment


class DocumentContextError(RuntimeError):
    code = "DOCUMENT_CONTEXT_ERROR"


class DocumentStorageError(DocumentContextError):
    code = "DOCUMENT_STORAGE_ERROR"


class DocumentIntegrityError(DocumentContextError):
    code = "DOCUMENT_INTEGRITY_ERROR"


class DocumentExtractionUnsupported(DocumentContextError):
    code = "DOCUMENT_EXTRACTION_UNSUPPORTED"


class DocumentExtractionFailed(DocumentContextError):
    code = "DOCUMENT_EXTRACTION_FAILED"


_TRUNCATION_MARKER = "\n[document context truncated]"


@dataclass(frozen=True)
class ExtractedDocument:
    attachment_id: str
    filename: str
    mime_type: str
    text: str


@dataclass(frozen=True)
class DocumentSourceProvenance:
    attachment_id: str
    filename: str
    extraction_status: str
    source_chars: int
    provided_chars: int
    truncated: bool
    content_sha256: str
    selection_mode: str = "full"
    selected_ranges: tuple[str, ...] = ()
    priority_reason: str = "legacy_oldest"


@dataclass(frozen=True)
class DocumentContextProvenance:
    available: bool
    sources: int
    source_ids: tuple[str, ...]
    extraction_status: str
    source_chars: int
    provided_chars: int
    per_source_truncated: bool
    aggregate_truncated: bool
    truncated: bool
    context_version: str = "2.0"
    source_provenance: tuple[DocumentSourceProvenance, ...] = ()


@dataclass(frozen=True)
class DocumentContextBundle:
    message: dict[str, str]
    provenance: DocumentContextProvenance
    errors: tuple[dict[str, str], ...]


@dataclass(frozen=True)
class SelectedExcerpt:
    text: str
    provided_chars: int
    selection_mode: str
    selected_ranges: tuple[str, ...]


_TEXT_MIME_TYPES = {
    "text/plain",
    "text/csv",
    "application/json",
}
_PDF_MIME = "application/pdf"
_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

document_context_logger = logging.getLogger("uvicorn.error")

_QUERY_STOPWORDS = {
    "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em",
    "esse", "esta", "este", "isso", "me", "o", "os", "para", "por", "que", "se",
    "um", "uma", "analise", "analisar", "analisa", "documento", "arquivo", "anexo",
    "favor", "please", "analyze", "analyse", "document", "file", "attachment",
}


def _search_tokens(value: str) -> set[str]:
    folded = (
        unicodedata.normalize("NFKD", value or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    return {
        item
        for item in re.findall(r"[a-z0-9]{2,}", folded)
        if item not in _QUERY_STOPWORDS
    }


def _distributed_indices(total: int, slots: int) -> list[int]:
    if total <= 0 or slots <= 0:
        return []
    if slots >= total:
        return list(range(total))
    if slots == 1:
        return [0]
    return sorted({
        round(index * (total - 1) / (slots - 1))
        for index in range(slots)
    })


def _select_excerpt(
    text: str,
    *,
    query: str,
    max_chars: int,
    chunk_chars: int,
) -> SelectedExcerpt:
    if max_chars <= 0:
        return SelectedExcerpt("", 0, "none_budget_exhausted", ())
    if len(text) <= max_chars:
        return SelectedExcerpt(text, len(text), "full", (f"0:{len(text)}",))
    if not query.strip():
        return SelectedExcerpt(text[:max_chars], max_chars, "head", (f"0:{max_chars}",))

    effective_chunk = max(500, min(int(chunk_chars), max_chars))
    ranges = [
        (start, min(start + effective_chunk, len(text)))
        for start in range(0, len(text), effective_chunk)
    ]
    slots = max(1, (max_chars + effective_chunk - 1) // effective_chunk)
    query_tokens = _search_tokens(query)
    selected: set[int]
    mode: str

    if query_tokens:
        scores: list[tuple[int, int]] = []
        for index, (start, end) in enumerate(ranges):
            chunk_tokens = _search_tokens(text[start:end])
            scores.append((len(query_tokens.intersection(chunk_tokens)), index))
        positive = [item for item in scores if item[0] > 0]
        if positive:
            ranked = [
                index
                for _, index in sorted(
                    positive,
                    key=lambda item: (item[0], -item[1]),
                    reverse=True,
                )
            ]
            selected = {0}
            for index in ranked:
                if len(selected) >= slots:
                    break
                selected.add(index)
            for index in _distributed_indices(len(ranges), slots):
                if len(selected) >= slots:
                    break
                selected.add(index)
            mode = "query_retrieval"
        else:
            selected = set(_distributed_indices(len(ranges), slots))
            mode = "overview_sample"
    else:
        selected = set(_distributed_indices(len(ranges), slots))
        mode = "overview_sample"

    remaining = max_chars
    pieces: list[str] = []
    selected_ranges: list[str] = []
    provided_chars = 0
    for index in sorted(selected):
        if remaining <= 0:
            break
        start, end = ranges[index]
        take = min(end - start, remaining)
        if take <= 0:
            continue
        actual_end = start + take
        pieces.append(text[start:actual_end])
        selected_ranges.append(f"{start}:{actual_end}")
        provided_chars += take
        remaining -= take

    return SelectedExcerpt(
        text="\n[document excerpt gap]\n".join(pieces),
        provided_chars=provided_chars,
        selection_mode=mode,
        selected_ranges=tuple(selected_ranges),
    )


def _attachment_priority(
    attachment: Attachment,
    *,
    query_tokens: set[str],
    focus_attachment_id: str | None,
) -> tuple[int, int, str]:
    focused = int(bool(focus_attachment_id and attachment.id == focus_attachment_id))
    filename_score = len(query_tokens.intersection(_search_tokens(attachment.filename)))
    reason = "focus_attachment" if focused else ("filename_query" if filename_score else "recent")
    return focused, filename_score, reason



def _safe_storage_path(settings: Settings, storage_key: str) -> Path:
    root = Path(settings.artifact_storage_path).resolve()
    target = (root / storage_key).resolve()
    if target != root and root not in target.parents:
        raise DocumentStorageError("DOCUMENT_STORAGE_PATH_INVALID")
    return target


def _normalise_text(value: str, *, max_chars: int | None = None) -> str:
    cleaned = value.replace("\x00", "")
    cleaned = re.sub(r"\r\n?", "\n", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if max_chars is not None and len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars].rstrip() + _TRUNCATION_MARKER
    return cleaned


def _validate_magic(mime_type: str, raw: bytes) -> None:
    if mime_type == _PDF_MIME and not raw.startswith(b"%PDF-"):
        raise DocumentIntegrityError("DOCUMENT_MAGIC_MISMATCH")
    if mime_type == _DOCX_MIME:
        if not raw.startswith(b"PK\x03\x04"):
            raise DocumentIntegrityError("DOCUMENT_MAGIC_MISMATCH")
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                names = set(archive.namelist())
        except zipfile.BadZipFile as exc:
            raise DocumentIntegrityError("DOCUMENT_CONTAINER_INVALID") from exc
        if "[Content_Types].xml" not in names or "word/document.xml" not in names:
            raise DocumentIntegrityError("DOCUMENT_CONTAINER_INVALID")
    if mime_type in _TEXT_MIME_TYPES and b"\x00" in raw[:4096]:
        raise DocumentIntegrityError("DOCUMENT_BINARY_CONTENT_REJECTED")


def _extract_text_plain(raw: bytes, *, mime_type: str) -> str:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise DocumentExtractionFailed("DOCUMENT_TEXT_ENCODING_UNSUPPORTED") from exc
    if mime_type == "application/json":
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise DocumentExtractionFailed("DOCUMENT_JSON_INVALID") from exc
        return json.dumps(parsed, ensure_ascii=False, indent=2)
    return text


def _extract_docx(raw: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            xml = archive.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise DocumentExtractionFailed("DOCUMENT_DOCX_INVALID") from exc
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        raise DocumentExtractionFailed("DOCUMENT_DOCX_XML_INVALID") from exc
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    paragraphs: list[str] = []
    for paragraph in root.iter(namespace + "p"):
        parts = [node.text or "" for node in paragraph.iter(namespace + "t")]
        line = "".join(parts).strip()
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs)


def _extract_pdf(raw: bytes, *, max_pages: int) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise DocumentExtractionUnsupported("DOCUMENT_PDF_READER_UNAVAILABLE") from exc
    try:
        reader = PdfReader(io.BytesIO(raw), strict=True)
        pages: list[str] = []
        for index, page in enumerate(reader.pages):
            if index >= max_pages:
                break
            pages.append(page.extract_text() or "")
        return "\n".join(pages)
    except Exception as exc:
        raise DocumentExtractionFailed("DOCUMENT_PDF_EXTRACTION_FAILED") from exc


def _extract_document_text_unbounded(
    *,
    filename: str,
    mime_type: str,
    raw: bytes,
    max_pdf_pages: int,
) -> str:
    del filename  # filename is retained in the public signature for auditability/future adapters.
    _validate_magic(mime_type, raw)
    if mime_type in _TEXT_MIME_TYPES:
        text = _extract_text_plain(raw, mime_type=mime_type)
    elif mime_type == _DOCX_MIME:
        text = _extract_docx(raw)
    elif mime_type == _PDF_MIME:
        text = _extract_pdf(raw, max_pages=max_pdf_pages)
    else:
        raise DocumentExtractionUnsupported("DOCUMENT_EXTRACTION_UNSUPPORTED")

    text = _normalise_text(text)
    if len(text) < 1:
        raise DocumentExtractionFailed("DOCUMENT_EXTRACTION_EMPTY")
    return text


def extract_document_text(
    *,
    filename: str,
    mime_type: str,
    raw: bytes,
    max_chars: int,
    max_pdf_pages: int,
) -> str:
    """Backward-compatible extraction API.

    The legacy function still returns a prompt-ready string and therefore keeps the
    historical truncation marker. Provenance-aware callers use build_document_context(),
    where diagnostic marker characters are never counted as provided source characters.
    """
    text = _extract_document_text_unbounded(
        filename=filename,
        mime_type=mime_type,
        raw=raw,
        max_pdf_pages=max_pdf_pages,
    )
    if len(text) > max_chars:
        return text[:max_chars].rstrip() + _TRUNCATION_MARKER
    return text


def _status_for(*, successful_sources: int, errors: int, truncated: bool) -> str:
    if successful_sources == 0:
        return "failed" if errors else "none"
    if errors or truncated:
        return "partial"
    return "ready"


def build_document_context(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    thread_id: str,
    query: str = "",
    focus_attachment_id: str | None = None,
) -> DocumentContextBundle | None:
    """Build bounded document material plus truthful provenance for a canonical turn.

    source_chars is measured after extraction/normalisation but before character
    context limits. provided_chars counts only actual source characters supplied
    to the model; diagnostic and excerpt-gap marker text is excluded.

    When a query or focus attachment is present, the current turn gets a bounded
    candidate set ordered by explicit focus, filename relevance, then recency.
    Legacy callers with neither query nor focus retain the historical oldest-first
    source selection and head-excerpt behavior.
    """
    if not settings.document_context_enabled:
        return None

    max_files = max(1, int(settings.document_context_max_files))
    priority_reasons: dict[str, str] = {}

    if query.strip() or focus_attachment_id:
        candidate_limit = max(
            max_files,
            max(1, int(settings.document_context_candidate_files)),
        )
        candidates = list(
            db.scalars(
                select(Attachment)
                .where(
                    Attachment.tenant_id == tenant_id,
                    Attachment.thread_id == thread_id,
                )
                .order_by(Attachment.created_at.desc(), Attachment.id.desc())
                .limit(candidate_limit)
            ).all()
        )

        if focus_attachment_id and not any(
            item.id == focus_attachment_id for item in candidates
        ):
            focused = db.scalar(
                select(Attachment).where(
                    Attachment.id == focus_attachment_id,
                    Attachment.tenant_id == tenant_id,
                    Attachment.thread_id == thread_id,
                )
            )
            if focused is not None:
                candidates.insert(0, focused)

        query_tokens = _search_tokens(query)
        decorated = [
            (
                *_attachment_priority(
                    item,
                    query_tokens=query_tokens,
                    focus_attachment_id=focus_attachment_id,
                ),
                item,
            )
            for item in candidates
        ]
        # Python's sort is stable, so ties retain the newest-first candidate order.
        decorated.sort(key=lambda item: (item[0], item[1]), reverse=True)
        rows = [item[3] for item in decorated[:max_files]]
        priority_reasons = {item[3].id: item[2] for item in decorated}
    else:
        rows = db.scalars(
            select(Attachment)
            .where(
                Attachment.tenant_id == tenant_id,
                Attachment.thread_id == thread_id,
            )
            .order_by(Attachment.created_at.asc(), Attachment.id.asc())
            .limit(max_files)
        ).all()
        priority_reasons = {item.id: "legacy_oldest" for item in rows}

    if not rows:
        return None

    remaining = max(0, int(settings.document_context_max_chars))
    chunk_chars = max(500, int(settings.document_context_chunk_chars))
    blocks: list[str] = [
        "DOCUMENT CONTEXT — successfully extracted document excerpts supplied below are "
        "available as source material for this turn. You may use the supplied excerpts. "
        "Do not claim that no document content is available when content is supplied. "
        "Do not claim full-document review when a source is marked truncated or sampled. "
        "Do not claim access to omitted portions, original file bytes, or attachments "
        "whose extraction failed."
    ]
    errors: list[dict[str, str]] = []
    source_provenance: list[DocumentSourceProvenance] = []
    source_ids: list[str] = []
    total_source_chars = 0
    total_provided_chars = 0
    any_per_file_truncated = False
    any_aggregate_truncated = False
    successful_sources = 0

    for attachment in rows:
        try:
            target = _safe_storage_path(settings, attachment.storage_key)
            raw = target.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            if digest != attachment.sha256:
                raise DocumentIntegrityError("DOCUMENT_SHA256_MISMATCH")

            full_text = _extract_document_text_unbounded(
                filename=attachment.filename,
                mime_type=attachment.mime_type,
                raw=raw,
                max_pdf_pages=settings.document_context_max_pdf_pages,
            )
            source_chars = len(full_text)
            per_limit = max(0, int(settings.document_context_max_chars_per_file))
            per_file_target = min(source_chars, per_limit)
            aggregate_target = min(per_file_target, remaining)

            excerpt = _select_excerpt(
                full_text,
                query=query,
                max_chars=aggregate_target,
                chunk_chars=chunk_chars,
            )
            provided_text = excerpt.text
            provided_chars = excerpt.provided_chars
            per_file_truncated = source_chars > per_file_target
            aggregate_cut_this_source = aggregate_target < per_file_target

            successful_sources += 1
            source_ids.append(attachment.id)
            total_source_chars += source_chars
            total_provided_chars += provided_chars
            any_per_file_truncated = any_per_file_truncated or per_file_truncated
            any_aggregate_truncated = any_aggregate_truncated or aggregate_cut_this_source

            content_sha = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
            source_truncated = per_file_truncated or aggregate_cut_this_source
            priority_reason = priority_reasons.get(attachment.id, "recent")
            source_provenance.append(
                DocumentSourceProvenance(
                    attachment_id=attachment.id,
                    filename=attachment.filename,
                    extraction_status="ready",
                    source_chars=source_chars,
                    provided_chars=provided_chars,
                    truncated=source_truncated,
                    content_sha256=content_sha,
                    selection_mode=excerpt.selection_mode,
                    selected_ranges=excerpt.selected_ranges,
                    priority_reason=priority_reason,
                )
            )

            if provided_chars:
                marker = _TRUNCATION_MARKER if source_truncated else ""
                blocks.append(
                    f"\n--- attachment:{attachment.id} filename:{attachment.filename} "
                    f"mime:{attachment.mime_type} selection:{excerpt.selection_mode} "
                    f"ranges:{','.join(excerpt.selected_ranges)} ---\n"
                    f"{provided_text}{marker}"
                )
                remaining -= provided_chars

            document_context_logger.info(
                "DOCUMENT_CONTEXT_EXTRACTED %s",
                json.dumps(
                    {
                        "event": "document_context_extracted",
                        "tenant_id": tenant_id,
                        "thread_id": thread_id,
                        "attachment_id": attachment.id,
                        "filename": attachment.filename,
                        "mime_type": attachment.mime_type,
                        "sha256": attachment.sha256,
                        "source_chars": source_chars,
                        "provided_chars": provided_chars,
                        "per_source_truncated": per_file_truncated,
                        "aggregate_truncated": aggregate_cut_this_source,
                        "truncated": source_truncated,
                        "selection_mode": excerpt.selection_mode,
                        "selected_ranges": list(excerpt.selected_ranges),
                        "priority_reason": priority_reason,
                        "query_used": bool(query.strip()),
                    },
                    sort_keys=True,
                ),
            )
        except FileNotFoundError:
            code = "DOCUMENT_STORAGE_MISSING"
            errors.append({"attachment_id": attachment.id, "code": code})
            document_context_logger.warning(
                "DOCUMENT_CONTEXT_FAILED %s",
                json.dumps(
                    {
                        "event": "document_context_failed",
                        "tenant_id": tenant_id,
                        "thread_id": thread_id,
                        "attachment_id": attachment.id,
                        "filename": attachment.filename,
                        "mime_type": attachment.mime_type,
                        "sha256": attachment.sha256,
                        "error_code": code,
                    },
                    sort_keys=True,
                ),
            )
        except DocumentContextError as exc:
            code = str(exc) or exc.code
            errors.append({"attachment_id": attachment.id, "code": code})
            document_context_logger.warning(
                "DOCUMENT_CONTEXT_FAILED %s",
                json.dumps(
                    {
                        "event": "document_context_failed",
                        "tenant_id": tenant_id,
                        "thread_id": thread_id,
                        "attachment_id": attachment.id,
                        "filename": attachment.filename,
                        "mime_type": attachment.mime_type,
                        "sha256": attachment.sha256,
                        "error_code": code,
                    },
                    sort_keys=True,
                ),
            )

    # A source successfully extracted after the aggregate limit is exhausted is still
    # evidence of aggregate truncation, even though it contributes zero model chars.
    if successful_sources and any(
        item.provided_chars == 0 and item.source_chars > 0
        for item in source_provenance
    ):
        any_aggregate_truncated = True

    truncated = any_per_file_truncated or any_aggregate_truncated
    available = total_provided_chars > 0
    extraction_status = _status_for(
        successful_sources=successful_sources,
        errors=len(errors),
        truncated=truncated,
    )

    if errors:
        blocks.append("\nDOCUMENT EXTRACTION ERRORS:")
        for error in errors:
            blocks.append(f"- attachment:{error['attachment_id']} code:{error['code']}")

    provenance = DocumentContextProvenance(
        available=available,
        sources=successful_sources,
        source_ids=tuple(source_ids),
        extraction_status=extraction_status,
        source_chars=total_source_chars,
        provided_chars=total_provided_chars,
        per_source_truncated=any_per_file_truncated,
        aggregate_truncated=any_aggregate_truncated,
        truncated=truncated,
        source_provenance=tuple(source_provenance),
    )
    return DocumentContextBundle(
        message={"role": "system", "content": "\n".join(blocks)},
        provenance=provenance,
        errors=tuple(errors),
    )


def load_thread_documents(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    thread_id: str,
    query: str = "",
) -> tuple[list[ExtractedDocument], list[dict[str, str]]]:
    """Compatibility wrapper for existing callers/tests.

    New code should use build_document_context() for provenance.
    """
    bundle = build_document_context(
        db,
        settings=settings,
        tenant_id=tenant_id,
        thread_id=thread_id,
        query=query,
    )
    if bundle is None:
        return [], []

    docs: list[ExtractedDocument] = []
    for source in bundle.provenance.source_provenance:
        # Reconstruct prompt-visible text only. This wrapper is not a provenance API.
        prefix = f"--- attachment:{source.attachment_id} filename:{source.filename} "
        content = bundle.message["content"]
        at = content.find(prefix)
        if at < 0:
            continue
        start = content.find("\n", at)
        if start < 0:
            continue
        end = content.find("\n--- attachment:", start + 1)
        if end < 0:
            end = content.find("\nDOCUMENT EXTRACTION ERRORS:", start + 1)
        if end < 0:
            end = len(content)
        text = content[start + 1:end]
        docs.append(
            ExtractedDocument(
                attachment_id=source.attachment_id,
                filename=source.filename,
                mime_type="",
                text=text,
            )
        )
    return docs, list(bundle.errors)


def document_context_message(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    thread_id: str,
    query: str = "",
    focus_attachment_id: str | None = None,
) -> dict | None:
    bundle = build_document_context(
        db,
        settings=settings,
        tenant_id=tenant_id,
        thread_id=thread_id,
        query=query,
        focus_attachment_id=focus_attachment_id,
    )
    return bundle.message if bundle is not None else None
