from __future__ import annotations

import io
import json
import logging
import re
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


@dataclass(frozen=True)
class ExtractedDocument:
    attachment_id: str
    filename: str
    mime_type: str
    text: str


_TEXT_MIME_TYPES = {
    "text/plain",
    "text/csv",
    "application/json",
}
_PDF_MIME = "application/pdf"
_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

document_context_logger = logging.getLogger("uvicorn.error")


def _safe_storage_path(settings: Settings, storage_key: str) -> Path:
    root = Path(settings.artifact_storage_path).resolve()
    target = (root / storage_key).resolve()
    if target != root and root not in target.parents:
        raise DocumentStorageError("DOCUMENT_STORAGE_PATH_INVALID")
    return target


def _normalise_text(value: str, *, max_chars: int) -> str:
    cleaned = value.replace("\x00", "")
    cleaned = re.sub(r"\r\n?", "\n", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars].rstrip() + "\n[document context truncated]"
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
    except Exception as exc:  # provider/parser errors are normalized for callers
        raise DocumentExtractionFailed("DOCUMENT_PDF_EXTRACTION_FAILED") from exc


def extract_document_text(
    *,
    filename: str,
    mime_type: str,
    raw: bytes,
    max_chars: int,
    max_pdf_pages: int,
) -> str:
    _validate_magic(mime_type, raw)
    if mime_type in _TEXT_MIME_TYPES:
        text = _extract_text_plain(raw, mime_type=mime_type)
    elif mime_type == _DOCX_MIME:
        text = _extract_docx(raw)
    elif mime_type == _PDF_MIME:
        text = _extract_pdf(raw, max_pages=max_pdf_pages)
    else:
        raise DocumentExtractionUnsupported("DOCUMENT_EXTRACTION_UNSUPPORTED")

    text = _normalise_text(text, max_chars=max_chars)
    if len(text) < 1:
        raise DocumentExtractionFailed("DOCUMENT_EXTRACTION_EMPTY")
    return text


def load_thread_documents(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    thread_id: str,
) -> tuple[list[ExtractedDocument], list[dict[str, str]]]:
    rows = db.scalars(
        select(Attachment)
        .where(
            Attachment.tenant_id == tenant_id,
            Attachment.thread_id == thread_id,
        )
        .order_by(Attachment.created_at.asc(), Attachment.id.asc())
        .limit(settings.document_context_max_files)
    ).all()

    documents: list[ExtractedDocument] = []
    errors: list[dict[str, str]] = []
    remaining = settings.document_context_max_chars

    for attachment in rows:
        if remaining <= 0:
            break
        try:
            target = _safe_storage_path(settings, attachment.storage_key)
            raw = target.read_bytes()
            import hashlib
            digest = hashlib.sha256(raw).hexdigest()
            if digest != attachment.sha256:
                raise DocumentIntegrityError("DOCUMENT_SHA256_MISMATCH")
            per_file_limit = min(remaining, settings.document_context_max_chars_per_file)
            text = extract_document_text(
                filename=attachment.filename,
                mime_type=attachment.mime_type,
                raw=raw,
                max_chars=per_file_limit,
                max_pdf_pages=settings.document_context_max_pdf_pages,
            )
            documents.append(
                ExtractedDocument(
                    attachment_id=attachment.id,
                    filename=attachment.filename,
                    mime_type=attachment.mime_type,
                    text=text,
                )
            )
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
                        "chars": len(text),
                    },
                    sort_keys=True,
                ),
            )
            remaining -= len(text)
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

    return documents, errors


def document_context_message(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    thread_id: str,
) -> dict | None:
    if not settings.document_context_enabled:
        return None

    documents, errors = load_thread_documents(
        db,
        settings=settings,
        tenant_id=tenant_id,
        thread_id=thread_id,
    )
    if not documents and not errors:
        return None

    blocks: list[str] = [
        "DOCUMENT CONTEXT — use only as source material for this thread. "
        "Do not claim to have read attachments whose extraction failed."
    ]
    for document in documents:
        blocks.append(
            f"\n--- attachment:{document.attachment_id} filename:{document.filename} "
            f"mime:{document.mime_type} ---\n{document.text}"
        )
    if errors:
        blocks.append("\nDOCUMENT EXTRACTION ERRORS:")
        for error in errors:
            blocks.append(f"- attachment:{error['attachment_id']} code:{error['code']}")

    return {"role": "system", "content": "\n".join(blocks)}
