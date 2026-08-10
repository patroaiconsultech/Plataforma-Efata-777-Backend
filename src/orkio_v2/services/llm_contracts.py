from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from ..agents.registry import resolve_agent_by_id


SYSTEM_PROMPT = (
    "Você opera como um agente da Plataforma Efatá 777. "
    "Responda com precisão, de forma profissional e concisa, no idioma solicitado "
    "pelo usuário ou, na ausência de instrução explícita, no idioma dominante do turno."
)


class LLMNotConfigured(RuntimeError):
    """O provedor solicitado não está configurado."""


class LLMUpstreamError(RuntimeError):
    """O provedor solicitado respondeu com erro ou ficou indisponível."""


class ProviderName(str, Enum):
    openai = "openai"
    anthropic = "anthropic"
    google = "google"


class ProviderConfigurationState(str, Enum):
    registered = "REGISTERED"
    unconfigured = "UNCONFIGURED"
    configured = "CONFIGURED"


class ProviderHealthState(str, Enum):
    unconfigured = "UNCONFIGURED"
    ready = "READY"
    unavailable = "UNAVAILABLE"


@dataclass(frozen=True)
class LLMUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    cached_input_tokens: int | None = None


@dataclass(frozen=True)
class LLMResult:
    content: str
    provider: ProviderName
    model: str
    usage: LLMUsage


@dataclass(frozen=True)
class ProviderDescriptor:
    provider: ProviderName
    model: str
    state: ProviderConfigurationState


@dataclass(frozen=True)
class ProviderHealth:
    provider: ProviderName
    model: str
    state: ProviderHealthState
    code: str | None = None


def agent_system_prompt(agent: str) -> str:
    resolved = resolve_agent_by_id(agent)
    return (
        f"{SYSTEM_PROMPT} Seu nome nesta conversa é {resolved.canonical_name}. "
        f"{resolved.system_instruction} "
        "Não alegue ter usado ferramentas que não foram explicitamente disponibilizadas."
    )


def split_system_and_history(agent: str, history: list[dict[str, Any]]) -> tuple[str, list[dict[str, str]]]:
    """Normaliza histórico para provedores que usam system fora de messages.

    Mensagens system auxiliares, como contexto documental canônico, são preservadas
    no system prompt do request. Somente user/assistant entram no histórico.
    """
    system_parts = [agent_system_prompt(agent)]
    normalized: list[dict[str, str]] = []
    for item in history:
        role = str(item.get("role") or "").strip()
        content = str(item.get("content") or "")
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
            continue
        if role in {"user", "assistant"}:
            normalized.append({"role": role, "content": content})
    return "\n\n".join(system_parts), normalized
