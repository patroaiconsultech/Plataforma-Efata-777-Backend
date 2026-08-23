from __future__ import annotations

from orkio_v2.services.platform_knowledge import (
    platform_knowledge_message,
    resolve_platform_knowledge,
)


def test_orkio_query_returns_identity_and_capability_boundary():
    entries = resolve_platform_knowledge("O que é a plataforma Orkio?")
    keys = [entry.key for entry in entries]
    assert keys == ["orkio", "capabilities"]


def test_patroai_query_returns_institutional_context_and_boundary():
    entries = resolve_platform_knowledge("Quem é a Patroai Consultech?")
    keys = [entry.key for entry in entries]
    assert keys == ["patroai", "capabilities"]


def test_unrelated_query_does_not_inject_platform_context():
    assert platform_knowledge_message("Explique fluxo de caixa descontado.") is None


def test_capability_context_never_claims_unproven_artifact_generation_ready():
    message = platform_knowledge_message("A plataforma gera documentos e tem voz?")
    assert message is not None
    content = message["content"]
    assert "Não declarar como READY" in content
    assert "geração de artefatos DOCX/PDF" in content
    assert "voz/realtime voice" in content


def test_platform_context_preserves_source_classification():
    message = platform_knowledge_message("Quem é a Patroai?")
    assert message is not None
    assert "FOUNDER_SUPPLIED_INSTITUTIONAL_CONTEXT" in message["content"]
    assert "CURRENT_CODE_CAPABILITY_SNAPSHOT" in message["content"]
