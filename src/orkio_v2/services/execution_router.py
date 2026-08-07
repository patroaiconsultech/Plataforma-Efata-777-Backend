from __future__ import annotations

from ..agents.contracts import ExecutionContext, ExecutionEngine
from ..agents.registry import resolve_agent


def resolve_direct_execution(requested_target: str) -> ExecutionContext:
    agent = resolve_agent(requested_target)
    return ExecutionContext(
        room_context="direct",
        requested_target=requested_target,
        resolved_target=agent.slug,
        turn_owner=agent.slug,
        display_agent=agent.display_name,
        execution_engine=ExecutionEngine.DIRECT_AGENT,
        orchestrator=None,
        ownership_locked=True,
    )
