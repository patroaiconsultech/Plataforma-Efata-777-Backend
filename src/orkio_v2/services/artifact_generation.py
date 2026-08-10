from __future__ import annotations

import hashlib
import io
import json
import re
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Artifact

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TXT_MIME = "text/plain"

_ARTIFACT_INTENT_RE = re.compile(
    r"\b(?:gere|gerar|crie|criar|exporte|exportar|salve|salvar|produza|produzir|create|generate|export|save)\b",
    re.I,
)
_DOCX_RE = re.compile(r"(?:\.docx?\b|\bdocx?\b|\bword\b)", re.I)
_TXT_RE = re.compile(r"(?:\.txt\b|\btxt\b|\btexto simples\b|\bplain text\b)", re.I)


class ArtifactGenerationError(RuntimeError):
    code = "ARTIFACT_GENERATION_ERROR"


class ArtifactFormatUnsupported(ArtifactGenerationError):
    code = "ARTIFACT_FORMAT_UNSUPPORTED"


class ArtifactValidationFailed(ArtifactGenerationError):
    code = "ARTIFACT_VALIDATION_FAILED"


class ArtifactStorageError(ArtifactGenerationError):
    code = "ARTIFACT_STORAGE_ERROR"


@dataclass(frozen=True, slots=True)
class ArtifactIntent:
    requested_format: str
    extension: str
    mime_type: str


@dataclass(frozen=True, slots=True)
class ValidatedArtifactBytes:
    filename: str
    mime_type: str
    data: bytes
    sha256: str
    semantic_text: str
    renderer: str


@dataclass(frozen=True, slots=True)
class PersistedArtifact:
    artifact: Artifact
    download_path: str
    provenance_path: str


def detect_artifact_intent(message: str) -> ArtifactIntent | None:
    text = (message or "").strip()
    if not text or not _ARTIFACT_INTENT_RE.search(text):
        return None
    if _DOCX_RE.search(text):
        return ArtifactIntent("docx", ".docx", DOCX_MIME)
    if _TXT_RE.search(text):
        return ArtifactIntent("txt", ".txt", TXT_MIME)
    return None


def artifact_generation_system_message(intent: ArtifactIntent) -> dict[str, str]:
    return {
        "role": "system",
        "content": (
            "ARTIFACT CAPABILITY AVAILABLE FOR THIS TURN. "
            f"The runtime will render and persist the final answer as {intent.requested_format.upper()} "
            "after validation. Produce the complete document body that should be placed in the file. "
            "Do not claim that file generation is unavailable. Do not invent a download URL."
        ),
    }


def _safe_filename(name: str, extension: str) -> str:
    base = PurePosixPath((name or "").replace("\\", "/")).name.strip()
    if not base or base in {".", ".."}:
        base = "documento"
    base = re.sub(r"[^A-Za-z0-9._ -]+", "_", base).strip(" ._") or "documento"
    stem = base.rsplit(".", 1)[0] if "." in base else base
    return f"{stem[:120]}{extension}"


def default_filename(intent: ArtifactIntent, *, agent_name: str) -> str:
    label = re.sub(r"[^A-Za-z0-9_-]+", "-", (agent_name or "orkio").strip()).strip("-").lower()
    return _safe_filename(f"orkio-{label or 'artifact'}", intent.extension)


def _docx_bytes(text: str) -> bytes:
    paragraphs = [line.rstrip() for line in (text or "").replace("\r\n", "\n").split("\n")]
    if not any(p.strip() for p in paragraphs):
        raise ArtifactValidationFailed("ARTIFACT_EMPTY_CONTENT")

    body = []
    for paragraph in paragraphs:
        if not paragraph:
            body.append("<w:p/>")
            continue
        body.append(
            "<w:p><w:r><w:t xml:space=\"preserve\">"
            + escape(paragraph)
            + "</w:t></w:r></w:p>"
        )
    body.append(
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
        'w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>" + "".join(body) + "</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document_xml)
    return out.getvalue()


def _extract_docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if z.testzip() is not None:
                raise ArtifactValidationFailed("ARTIFACT_DOCX_CRC_FAILED")
            required = {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}
            if not required.issubset(set(z.namelist())):
                raise ArtifactValidationFailed("ARTIFACT_DOCX_STRUCTURE_INVALID")
            raw = z.read("word/document.xml")
    except ArtifactValidationFailed:
        raise
    except Exception as exc:
        raise ArtifactValidationFailed("ARTIFACT_DOCX_OPEN_FAILED") from exc

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ArtifactValidationFailed("ARTIFACT_DOCX_XML_INVALID") from exc
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    text = "\n".join((node.text or "") for node in root.iter(f"{ns}t")).strip()
    if not text:
        raise ArtifactValidationFailed("ARTIFACT_DOCX_SEMANTIC_EMPTY")
    return text


def render_and_validate(
    *,
    intent: ArtifactIntent,
    content: str,
    filename: str,
) -> ValidatedArtifactBytes:
    filename = _safe_filename(filename, intent.extension)
    normalized = (content or "").strip()
    if not normalized:
        raise ArtifactValidationFailed("ARTIFACT_EMPTY_CONTENT")

    if intent.requested_format == "docx":
        data = _docx_bytes(normalized)
        semantic_text = _extract_docx_text(data)
        renderer = "orkio_docx_minimal_v1"
    elif intent.requested_format == "txt":
        data = normalized.encode("utf-8")
        semantic_text = data.decode("utf-8").strip()
        if not semantic_text:
            raise ArtifactValidationFailed("ARTIFACT_TXT_SEMANTIC_EMPTY")
        renderer = "orkio_text_v1"
    else:
        raise ArtifactFormatUnsupported("ARTIFACT_FORMAT_UNSUPPORTED")

    # semantic guard: the validated output must retain meaningful source content
    probe = re.sub(r"\s+", " ", normalized).strip()[:80]
    if probe and probe not in re.sub(r"\s+", " ", semantic_text):
        raise ArtifactValidationFailed("ARTIFACT_SEMANTIC_MISMATCH")

    return ValidatedArtifactBytes(
        filename=filename,
        mime_type=intent.mime_type,
        data=data,
        sha256=hashlib.sha256(data).hexdigest(),
        semantic_text=semantic_text,
        renderer=renderer,
    )


def persist_validated_artifact(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    thread_id: str,
    created_by: str,
    validated: ValidatedArtifactBytes,
    source_message_sha256: str,
    source_response_message_id: str,
    agent_id: str,
) -> PersistedArtifact:
    root = Path(settings.artifact_storage_path).resolve()
    artifact_id = str(uuid.uuid4())
    key = f"{tenant_id}/{thread_id}/generated/{artifact_id}-{validated.filename}"
    target = (root / key).resolve()
    if not str(target).startswith(str(root) + "/"):
        raise ArtifactStorageError("ARTIFACT_STORAGE_PATH_INVALID")

    sidecar = target.with_suffix(target.suffix + ".provenance.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "artifact_id": artifact_id,
        "tenant_id": tenant_id,
        "thread_id": thread_id,
        "created_by": created_by,
        "agent_id": agent_id,
        "source_message_sha256": source_message_sha256,
        "source_response_message_id": source_response_message_id,
        "filename": validated.filename,
        "mime_type": validated.mime_type,
        "sha256": validated.sha256,
        "renderer": validated.renderer,
        "validated": True,
        "write_executed": True,
        "proposal_only": False,
    }

    tmp = target.with_suffix(target.suffix + ".tmp")
    try:
        tmp.write_bytes(validated.data)
        # Reopen exactly the final bytes before DB persistence.
        final_bytes = tmp.read_bytes()
        if hashlib.sha256(final_bytes).hexdigest() != validated.sha256:
            raise ArtifactValidationFailed("ARTIFACT_FINAL_BYTES_HASH_MISMATCH")
        if validated.mime_type == DOCX_MIME:
            _extract_docx_text(final_bytes)
        elif validated.mime_type == TXT_MIME:
            if not final_bytes.decode("utf-8").strip():
                raise ArtifactValidationFailed("ARTIFACT_FINAL_TEXT_EMPTY")
        tmp.replace(target)
        sidecar.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

        row = Artifact(
            id=artifact_id,
            tenant_id=tenant_id,
            thread_id=thread_id,
            created_by=created_by,
            filename=validated.filename,
            mime_type=validated.mime_type,
            storage_key=key,
            sha256=validated.sha256,
            version=1,
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        for path in (tmp, target, sidecar):
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass
        raise

    return PersistedArtifact(
        artifact=row,
        download_path=f"/api/v2/artifacts/{row.id}/download",
        provenance_path=str(sidecar),
    )


def artifact_payload(result: PersistedArtifact) -> dict[str, object]:
    row = result.artifact
    return {
        "id": row.id,
        "filename": row.filename,
        "mime_type": row.mime_type,
        "sha256": row.sha256,
        "version": row.version,
        "download_path": result.download_path,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
