from __future__ import annotations

from .catalog import AGENTS
from .contracts import AgentDefinition


class AgentNotFound(ValueError):
    pass


def _key(value: str) -> str:
    return value.strip().casefold()


_BY_SLUG = {_key(agent.slug): agent for agent in AGENTS if agent.enabled}
_BY_NAME = {_key(agent.display_name): agent for agent in AGENTS if agent.enabled}


def resolve_agent(requested: str) -> AgentDefinition:
    key = _key(requested or "")
    agent = _BY_SLUG.get(key) or _BY_NAME.get(key)
    if agent is None:
        raise AgentNotFound("AGENT_NOT_FOUND")
    return agent


def list_agents() -> tuple[AgentDefinition, ...]:
    return tuple(agent for agent in AGENTS if agent.enabled)
