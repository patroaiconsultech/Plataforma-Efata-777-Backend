
from __future__ import annotations

import hashlib
import io
import zipfile

import pytest

from orkio_v2.services.artifact_generation import (
    ArtifactValidationFailed,
    detect_artifact_intent,
    artifact_generation_system_message,
    render_and_validate,
)


def test_detect_docx_intent_pt_and_doc_alias():
    intent = detect_artifact_intent("vc consegue gerar esse documento resumido em .doc?")
    assert intent is not None
    assert intent.requested_format == "docx"
    assert intent.extension == ".docx"


def test_non_artifact_message_is_not_intercepted():
    assert detect_artifact_intent("explique o documento em um parágrafo") is None


def test_docx_render_reopens_and_has_semantic_content():
    intent = detect_artifact_intent("gere em .docx")
    assert intent is not None
    out = render_and_validate(
        intent=intent,
        content="Resumo executivo\nConteúdo validado.",
        filename="resumo.docx",
    )
    assert out.filename == "resumo.docx"
    assert out.sha256 == hashlib.sha256(out.data).hexdigest()
    with zipfile.ZipFile(io.BytesIO(out.data)) as z:
        assert z.testzip() is None
        assert "word/document.xml" in z.namelist()
        xml = z.read("word/document.xml").decode("utf-8")
        assert "Resumo executivo" in xml
        assert "Conteúdo validado." in xml


def test_empty_content_fails_closed():
    intent = detect_artifact_intent("generate a docx")
    assert intent is not None
    with pytest.raises(ArtifactValidationFailed):
        render_and_validate(intent=intent, content="   ", filename="x.docx")


def test_artifact_system_message_does_not_invent_download_url():
    intent = detect_artifact_intent("gere docx")
    msg = artifact_generation_system_message(intent)
    assert msg["role"] == "system"
    assert "Do not invent a download URL" in msg["content"]


def test_routes_expose_list_and_download_contract():
    from pathlib import Path
    routes = Path(__file__).parents[1] / "src/orkio_v2/routes.py"
    text = routes.read_text(encoding="utf-8")
    assert '@router.get("/threads/{thread_id}/artifacts")' in text
    assert '@router.get("/artifacts/{artifact_id}/download")' in text
    assert "ARTIFACT_INTEGRITY_MISMATCH" in text


def test_stream_done_includes_artifact_only_after_generation():
    from pathlib import Path
    routes = Path(__file__).parents[1] / "src/orkio_v2/routes.py"
    text = routes.read_text(encoding="utf-8")
    assert 'done_payload["artifact"]=artifact_payload(generated_artifact)' in text
    assert "persist_validated_artifact(" in text
    assert "source_message_sha256=hashlib.sha256(payload.content.encode" in text


def test_stream_injects_artifact_capability_message_when_allowed():
    from pathlib import Path
    routes = Path(__file__).parents[1] / "src/orkio_v2/routes.py"
    text = routes.read_text(encoding="utf-8")
    assert "runtime_system_messages = list(github_messages)" in text
    assert "if artifact_allowed and artifact_intent is not None:" in text
    assert "runtime_system_messages.append(" in text
    assert "artifact_generation_system_message(artifact_intent)" in text
    assert "extra_system_messages=runtime_system_messages" in text
