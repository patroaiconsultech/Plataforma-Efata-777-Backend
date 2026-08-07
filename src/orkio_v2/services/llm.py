"""Serviço canônico de geração de resposta de agente.

Compartilhado pelos caminhos JSON e SSE para garantir que a mensagem
persistida e a exibida usem a mesma identidade e o mesmo conteúdo.

Regra fundamental: nunca devolver texto demonstrativo como se fosse
resposta de IA. Quando a integração não estiver configurada, o serviço
levanta LLMNotConfigured e o chamador responde 503 LLM_NOT_CONFIGURED.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx

from ..config import Settings

DEFAULT_OPENAI_BASE = "https://api.openai.com/v1"
CANONICAL_AGENT_ID = "orkio"
CANONICAL_AGENT_NAME = "Orkio"


def _endpoint(settings: Settings) -> str:
    """Resolve o endpoint de chat completions.

    A base e configuravel para permitir gateways corporativos, proxies e
    endpoints compativeis, em vez de ficar fixa no codigo.
    """
    base = (getattr(settings, "openai_api_base", "") or "").strip() or DEFAULT_OPENAI_BASE
    return f"{base.rstrip('/')}/chat/completions"

SYSTEM_PROMPT = (
    "Você é ORKIO, inteligência colaborativa da Plataforma Efatá 777. "
    "Responda com precisão, em português do Brasil, de forma profissional e concisa."
)


class LLMNotConfigured(RuntimeError):
    """A integração com o provedor de LLM não está configurada."""


class LLMUpstreamError(RuntimeError):
    """O provedor de LLM respondeu com erro ou ficou indisponível."""


def ensure_configured(settings: Settings) -> str:
    """Devolve a chave de API ou levanta LLMNotConfigured.

    Nunca registra a chave nem qualquer fragmento dela.
    """
    key = (settings.openai_api_key or "").strip()
    if not key:
        raise LLMNotConfigured("LLM_NOT_CONFIGURED")
    return key


def _payload(settings: Settings, agent: str, history: list[dict], stream: bool) -> dict:
    messages = [{"role": "system", "content": f"{SYSTEM_PROMPT} Seu nome nesta conversa é {CANONICAL_AGENT_NAME}."}]
    messages.extend(history)
    return {
        "model": settings.openai_model,
        "messages": messages,
        "stream": stream,
    }


async def generate(settings: Settings, agent: str, history: list[dict]) -> str:
    """Gera a resposta completa do agente.

    Não mantém transação de banco aberta: o chamador deve fechar a
    transação antes de invocar esta função.
    """
    key = ensure_configured(settings)
    try:
        async with httpx.AsyncClient(timeout=settings.oidc_http_timeout_seconds * 6) as client:
            response = await client.post(
                _endpoint(settings),
                headers={"Authorization": f"Bearer {key}"},
                json=_payload(settings, agent, history, stream=False),
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # noqa: BLE001 - normalizado para o chamador
        raise LLMUpstreamError("LLM_UPSTREAM_ERROR") from exc

    choices = data.get("choices") or []
    if not choices:
        raise LLMUpstreamError("LLM_EMPTY_RESPONSE")
    content = (choices[0].get("message") or {}).get("content")
    if not content:
        raise LLMUpstreamError("LLM_EMPTY_RESPONSE")
    return str(content)


async def stream(settings: Settings, agent: str, history: list[dict]) -> AsyncIterator[str]:
    """Emite os fragmentos de texto da resposta conforme chegam.

    Levanta LLMNotConfigured antes de abrir conexão quando não configurado,
    e LLMUpstreamError se o provedor falhar.
    """
    key = ensure_configured(settings)
    import json as _json

    try:
        async with httpx.AsyncClient(timeout=settings.oidc_http_timeout_seconds * 6) as client:
            async with client.stream(
                "POST",
                _endpoint(settings),
                headers={"Authorization": f"Bearer {key}"},
                json=_payload(settings, agent, history, stream=True),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    body = line.removeprefix("data: ").strip()
                    if body == "[DONE]":
                        return
                    try:
                        chunk = _json.loads(body)
                    except ValueError:
                        continue
                    for choice in chunk.get("choices") or []:
                        piece = (choice.get("delta") or {}).get("content")
                        if piece:
                            yield str(piece)
    except LLMNotConfigured:
        raise
    except Exception as exc:  # noqa: BLE001
        raise LLMUpstreamError("LLM_UPSTREAM_ERROR") from exc
