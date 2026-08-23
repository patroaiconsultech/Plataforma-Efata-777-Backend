from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class PlatformKnowledgeEntry:
    key: str
    title: str
    content: str
    source_classification: str


_ENTRIES: tuple[PlatformKnowledgeEntry, ...] = (
    PlatformKnowledgeEntry(
        key="orkio",
        title="ORKIO / Plataforma Efatá 777",
        content=(
            "ORKIO é a plataforma de inteligência colaborativa da Patroai Consultech, "
            "organizada em agentes especializados com identidade técnica estável e papéis distintos. "
            "No baseline atual, a plataforma suporta conversas com seleção direta de agentes, "
            "threads, convites e leitura contextual de anexos compatíveis. "
            "Capacidades ainda não devem ser declaradas prontas sem evidência de runtime."
        ),
        source_classification="CANONICAL_PLATFORM_CONTEXT",
    ),
    PlatformKnowledgeEntry(
        key="patroai",
        title="Patroai Consultech Ltda.",
        content=(
            "Patroai Consultech Ltda. é apresentada no contexto institucional fornecido pelo Founder "
            "como núcleo tecnológico voltado à propriedade intelectual, know-how e desenvolvimento "
            "contínuo de tecnologia e agentes inteligentes de IA. "
            "Esse contexto institucional não deve ser usado como prova de que uma funcionalidade "
            "específica da plataforma está ativa em produção."
        ),
        source_classification="FOUNDER_SUPPLIED_INSTITUTIONAL_CONTEXT",
    ),
    PlatformKnowledgeEntry(
        key="capabilities",
        title="Estado de capacidades do baseline atual",
        content=(
            "Confirmado no código atual: seleção direta de agentes, threads, convites, upload de anexos, "
            "extração contextual de TXT/CSV/JSON/DOCX/PDF e rota SSE de chat. "
            "Não declarar como READY sem prova de runtime: geração de artefatos DOCX/PDF, Team runtime, "
            "Dream Team, voz/realtime voice, GitHub write integration e autoevolução executável."
        ),
        source_classification="CURRENT_CODE_CAPABILITY_SNAPSHOT",
    ),
)

_TRIGGERS = {
    "orkio": {
        "orkio", "efata", "efatá", "plataforma orkio", "plataforma efata",
        "plataforma efatá", "command center",
    },
    "patroai": {
        "patroai", "patroai consultech", "patroaai", "patroa ai",
    },
    "capabilities": {
        "capacidade", "capacidades", "funcao da plataforma", "função da plataforma",
        "o que a plataforma faz", "o que voces fazem", "o que vocês fazem",
        "realtime", "voz", "team", "dream team", "artifact", "artefato",
        "documento", "github",
    },
}


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", stripped.casefold()).strip()


def _matches(query: str, trigger: str) -> bool:
    normalized = _normalize(query)
    token = _normalize(trigger)
    if " " in token:
        return token in normalized
    return re.search(rf"(?<![\w]){re.escape(token)}(?![\w])", normalized) is not None


def resolve_platform_knowledge(query: str) -> tuple[PlatformKnowledgeEntry, ...]:
    """Return only platform knowledge relevant to the current user turn.

    The registry is deterministic and deliberately small. It is not a general
    RAG engine and must not be used as proof of production readiness.
    """
    selected: list[PlatformKnowledgeEntry] = []
    for entry in _ENTRIES:
        triggers = _TRIGGERS[entry.key]
        if any(_matches(query, trigger) for trigger in triggers):
            selected.append(entry)

    # Platform/company questions benefit from the current capability boundary,
    # preventing the model from inventing readiness.
    if selected and not any(item.key == "capabilities" for item in selected):
        selected.append(next(item for item in _ENTRIES if item.key == "capabilities"))
    return tuple(selected)


def platform_knowledge_message(query: str) -> dict[str, str] | None:
    entries = resolve_platform_knowledge(query)
    if not entries:
        return None

    blocks = [
        "PLATFORM KNOWLEDGE — governed institutional context for this turn. "
        "Use it for questions about ORKIO/Patroai and platform capabilities. "
        "Do not upgrade NOT_READY/NOT_PROVEN capabilities to READY."
    ]
    for entry in entries:
        blocks.append(
            f"\n--- {entry.title} [{entry.source_classification}] ---\n{entry.content}"
        )
    return {"role": "system", "content": "\n".join(blocks)}
