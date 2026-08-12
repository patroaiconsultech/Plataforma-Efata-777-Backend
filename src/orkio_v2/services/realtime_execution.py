from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..config import Settings
from ..runtime.contracts import RuntimeChannel
from . import llm
from .direct_runtime import build_turn as build_direct_turn, persist_agent_response
from .execution_router import resolve_direct_target_decision
from .team_runtime import (
    build_team_plan,
    build_team_turn,
    persist_team_contribution,
    persist_team_final,
    persist_user_message,
    team_history,
)


class RealtimeExecutionError(RuntimeError):
    def __init__(
        self,
        code: str,
        *,
        stage: str | None = None,
        exception_type: str | None = None,
        request_id: str | None = None,
        execution_id: str | None = None,
    ):
        super().__init__(code)
        self.code = code
        self.stage = stage
        self.exception_type = exception_type
        self.request_id = request_id
        self.execution_id = execution_id


def _unexpected_execution_error(
    *,
    stage: str,
    exc: Exception,
    turn=None,
) -> RealtimeExecutionError:
    return RealtimeExecutionError(
        "REALTIME_EXECUTION_FAILED",
        stage=stage,
        exception_type=type(exc).__name__,
        request_id=getattr(turn, "request_id", None),
        execution_id=getattr(turn, "execution_id", None),
    )


@dataclass(frozen=True, slots=True)
class RealtimeExecutionResult:
    message_id: str
    execution_id: str
    agent_id: str
    agent_name: str
    content: str
    target_mode: str


async def execute_realtime_direct(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    user_id: str,
    thread_id: str,
    agent_id: str,
    transcript: str,
) -> RealtimeExecutionResult:
    try:
        decision = resolve_direct_target_decision(f"id:{agent_id}", settings)
    except Exception as exc:
        raise _unexpected_execution_error(stage="resolve_target", exc=exc) from exc

    try:
        turn = build_direct_turn(
            execution=decision.execution,
            thread_id=thread_id,
            tenant_id=tenant_id,
            user_id=user_id,
            requested_target=agent_id,
            channel=RuntimeChannel.REALTIME,
        )
    except Exception as exc:
        raise _unexpected_execution_error(stage="build_turn", exc=exc) from exc

    try:
        persist_user_message(db, turn=turn, content=transcript)
    except Exception as exc:
        raise _unexpected_execution_error(stage="persist_user", exc=exc, turn=turn) from exc

    try:
        history = team_history(
            db,
            thread_id=thread_id,
            tenant_id=tenant_id,
            settings=settings,
        )
    except Exception as exc:
        raise _unexpected_execution_error(stage="history", exc=exc, turn=turn) from exc

    try:
        answer = (await llm.generate(settings, turn.turn_owner_agent_id, history)).strip()
    except llm.LLMNotConfigured as exc:
        raise RealtimeExecutionError(
            "LLM_NOT_CONFIGURED",
            stage="llm",
            exception_type=type(exc).__name__,
            request_id=turn.request_id,
            execution_id=turn.execution_id,
        ) from exc
    except Exception as exc:
        raise RealtimeExecutionError(
            "LLM_UPSTREAM_ERROR",
            stage="llm",
            exception_type=type(exc).__name__,
            request_id=turn.request_id,
            execution_id=turn.execution_id,
        ) from exc
    if not answer:
        raise RealtimeExecutionError(
            "LLM_EMPTY_RESPONSE",
            stage="llm",
            request_id=turn.request_id,
            execution_id=turn.execution_id,
        )
    try:
        row, _ = persist_agent_response(db, turn=turn, content=answer)
    except Exception as exc:
        raise _unexpected_execution_error(stage="persist_agent", exc=exc, turn=turn) from exc
    return RealtimeExecutionResult(
        message_id=row.id,
        execution_id=turn.execution_id,
        agent_id=turn.turn_owner_agent_id,
        agent_name=turn.display_agent_name,
        content=row.content,
        target_mode="direct",
    )


async def execute_realtime_team(
    db: Session,
    *,
    settings: Settings,
    tenant_id: str,
    user_id: str,
    thread_id: str,
    team_id: str,
    selection_mode: str,
    contributor_agent_ids: tuple[str, ...],
    transcript: str,
) -> RealtimeExecutionResult:
    plan = build_team_plan(
        team_id=team_id,
        settings=settings,
        selection_mode=selection_mode,
        contributor_agent_ids=contributor_agent_ids,
    )
    try:
        turn = build_team_turn(
            thread_id=thread_id,
            tenant_id=tenant_id,
            user_id=user_id,
            requested_target=f"team:{team_id}",
            orchestrator_agent_id=plan.orchestrator_agent_id,
            channel=RuntimeChannel.REALTIME,
        )
    except Exception as exc:
        raise _unexpected_execution_error(stage="build_turn", exc=exc) from exc

    try:
        persist_user_message(db, turn=turn, content=transcript)
    except Exception as exc:
        raise _unexpected_execution_error(stage="persist_user", exc=exc, turn=turn) from exc

    try:
        base_history = team_history(
            db,
            thread_id=thread_id,
            tenant_id=tenant_id,
            settings=settings,
        )
    except Exception as exc:
        raise _unexpected_execution_error(stage="history", exc=exc, turn=turn) from exc

    contributions: list[tuple[str, str]] = []
    for agent_id in plan.contributor_agent_ids:
        try:
            content = (await llm.generate(settings, agent_id, list(base_history))).strip()
        except Exception:
            continue
        if not content:
            continue
        try:
            persist_team_contribution(
                db,
                turn=turn,
                agent_id=agent_id,
                content=content,
            )
        except Exception as exc:
            raise _unexpected_execution_error(
                stage="persist_contribution",
                exc=exc,
                turn=turn,
            ) from exc
        contributions.append((agent_id, content))

    if not contributions:
        raise RealtimeExecutionError("TEAM_ALL_CONTRIBUTORS_FAILED")

    synthesis_history = list(base_history)
    from ..agents.registry import resolve_agent_by_id
    for agent_id, content in contributions:
        agent = resolve_agent_by_id(agent_id)
        synthesis_history.append(
            {
                "role": "assistant",
                "content": (
                    f"[ContextContribution · {agent.display_name} · id:{agent.slug}] "
                    f"{content}"
                ),
            }
        )
    synthesis_history.append(
        {
            "role": "user",
            "content": (
                "Consolide as contribuições do Team em uma resposta única para a solicitação "
                "do usuário. Preserve divergências relevantes, não invente consenso e não "
                "atribua ao chair trabalho executado pelos especialistas."
            ),
        }
    )
    try:
        answer = (
            await llm.generate(settings, plan.orchestrator_agent_id, synthesis_history)
        ).strip()
    except llm.LLMNotConfigured as exc:
        raise RealtimeExecutionError(
            "LLM_NOT_CONFIGURED",
            stage="llm_synthesis",
            exception_type=type(exc).__name__,
            request_id=turn.request_id,
            execution_id=turn.execution_id,
        ) from exc
    except Exception as exc:
        raise RealtimeExecutionError(
            "LLM_UPSTREAM_ERROR",
            stage="llm_synthesis",
            exception_type=type(exc).__name__,
            request_id=turn.request_id,
            execution_id=turn.execution_id,
        ) from exc
    if not answer:
        raise RealtimeExecutionError(
            "LLM_EMPTY_RESPONSE",
            stage="llm_synthesis",
            request_id=turn.request_id,
            execution_id=turn.execution_id,
        )

    try:
        row, _ = persist_team_final(db, turn=turn, content=answer)
    except Exception as exc:
        raise _unexpected_execution_error(stage="persist_agent", exc=exc, turn=turn) from exc
    return RealtimeExecutionResult(
        message_id=row.id,
        execution_id=turn.execution_id,
        agent_id=turn.turn_owner_agent_id,
        agent_name=turn.display_agent_name,
        content=row.content,
        target_mode="team",
    )
