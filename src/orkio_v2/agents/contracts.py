from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class TargetKind(StrEnum):
    AGENT = "agent"


class ExecutionEngine(StrEnum):
    DIRECT_AGENT = "direct_agent"


@dataclass(frozen=True, slots=True)
class AgentDefinition:
    slug: str
    display_name: str
    system_instruction: str
    target_kind: TargetKind = TargetKind.AGENT
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class ExecutionContext:
    room_context: str
    requested_target: str
    resolved_target: str
    turn_owner: str
    display_agent: str
    execution_engine: ExecutionEngine
    orchestrator: str | None
    ownership_locked: bool
