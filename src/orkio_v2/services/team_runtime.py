from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents.catalog import RAW_CATALOG
from ..agents.registry import AgentNotFound, resolve_agent_by_id
from ..models import AuditEvent, Message, Thread, ThreadParticipant, ThreadRole
from ..runtime.contracts import CanonicalTurnContext, RuntimeChannel, RuntimeRouteFamily
from ..runtime.identity import build_response_envelope, canonical_message
from .agent_availability import availability_for_id
from .direct_runtime import envelope_payload, history_item
from .document_context import document_context_message
from .platform_knowledge import platform_knowledge_message


MAX_TEAM_PARTICIPANTS = 8
MIN_TEAM_PARTICIPANTS = 2
TEAM_ALLOWED_THREAD_ROLES = {
    ThreadRole.owner.value,
    ThreadRole.moderator.value,
    ThreadRole.participant.value,
}


class TeamContractError(ValueError):
    def __init__(self, code: str, *, agent_id: str | None = None):
        super().__init__(code)
        self.code = code
        self.agent_id = agent_id


@dataclass(frozen=True, slots=True)
class TeamDefinition:
    team_id: str
    display_name: str
    orchestrator_agent_id: str
    candidate_agent_ids: tuple[str, ...]
    enabled: bool
    max_delegation_depth: int


@dataclass(frozen=True, slots=True)
class TeamPlan:
    definition: TeamDefinition
    orchestrator_agent_id: str
    participant_agent_ids: tuple[str, ...]


def _team_definitions() -> tuple[TeamDefinition, ...]:
    result: list[TeamDefinition] = []
    for row in RAW_CATALOG.get("teams") or []:
        chair = str(row.get("chair_agent_id") or row.get("orchestrator_agent_id") or "").strip()
        candidates = tuple(str(x).strip() for x in row.get("candidate_agent_ids") or () if str(x).strip())
        result.append(
            TeamDefinition(
                team_id=str(row.get("team_id") or "").strip(),
                display_name=str(row.get("display_name") or "").strip(),
                orchestrator_agent_id=chair,
                candidate_agent_ids=candidates,
                enabled=bool(row.get("enabled_in_catalog", False)),
                max_delegation_depth=int(row.get("max_delegation_depth") or 1),
            )
        )
    return tuple(result)


TEAM_DEFINITIONS = _team_definitions()
_TEAM_BY_ID = {item.team_id: item for item in TEAM_DEFINITIONS}


def list_team_definitions() -> tuple[TeamDefinition, ...]:
    return tuple(item for item in TEAM_DEFINITIONS if item.enabled)


def resolve_team_definition(team_id: str) -> TeamDefinition:
    item = _TEAM_BY_ID.get((team_id or "").strip())
    if item is None or not item.enabled:
        raise TeamContractError("TEAM_NOT_FOUND")
    return item


def _dedupe(values: Iterable[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = str(value or "").strip()
        if not normalized:
            raise TeamContractError("TEAM_PARTICIPANT_ID_REQUIRED")
        if normalized in seen:
            raise TeamContractError("TEAM_DUPLICATE_PARTICIPANT", agent_id=normalized)
        seen.add(normalized)
        result.append(normalized)
    return tuple(result)


def build_team_plan(
    *,
    team_id: str,
    orchestrator_agent_id: str,
    participant_agent_ids: Iterable[str],
    settings,
) -> TeamPlan:
    definition = resolve_team_definition(team_id)
    participants = _dedupe(participant_agent_ids)
    if len(participants) < MIN_TEAM_PARTICIPANTS:
        raise TeamContractError("TEAM_MIN_PARTICIPANTS_REQUIRED")
    if len(participants) > MAX_TEAM_PARTICIPANTS:
        raise TeamContractError("TEAM_MAX_PARTICIPANTS_EXCEEDED")

    orchestrator_id = str(orchestrator_agent_id or "").strip()
    if not orchestrator_id:
        raise TeamContractError("TEAM_ORCHESTRATOR_REQUIRED")
    if orchestrator_id != definition.orchestrator_agent_id:
        raise TeamContractError(
            "TEAM_ORCHESTRATOR_NOT_ALLOWED",
            agent_id=orchestrator_id,
        )
    if orchestrator_id not in participants:
        raise TeamContractError("TEAM_ORCHESTRATOR_MUST_BE_PARTICIPANT", agent_id=orchestrator_id)

    allowed = set(definition.candidate_agent_ids)
    allowed.add(definition.orchestrator_agent_id)
    for agent_id in participants:
        if agent_id not in allowed:
            raise TeamContractError("TEAM_AGENT_NOT_ALLOWED", agent_id=agent_id)
        try:
            resolve_agent_by_id(agent_id)
        except AgentNotFound as exc:
            raise TeamContractError("TEAM_AGENT_NOT_FOUND", agent_id=agent_id) from exc
        availability = availability_for_id(agent_id, settings)
        if not availability.team.eligible:
            raise TeamContractError(
                availability.team.reason_code or "TEAM_AGENT_UNAVAILABLE",
                agent_id=agent_id,
            )

    return TeamPlan(
        definition=definition,
        orchestrator_agent_id=orchestrator_id,
        participant_agent_ids=participants,
    )


def assert_team_thread_access(db: Session, *, thread_id: str, principal):
    thread = db.get(Thread, thread_id)
    if thread is None or thread.tenant_id != principal.tenant_id:
        raise TeamContractError("THREAD_NOT_FOUND")
    member = db.scalar(
        select(ThreadParticipant).where(
            ThreadParticipant.thread_id == thread_id,
            ThreadParticipant.tenant_id == principal.tenant_id,
            ThreadParticipant.user_id == principal.user_id,
            ThreadParticipant.active.is_(True),
        )
    )
    if member is None:
        raise TeamContractError("THREAD_ACCESS_DENIED")
    if member.thread_role not in TEAM_ALLOWED_THREAD_ROLES:
        raise TeamContractError("THREAD_READ_ONLY")
    return thread, member


def team_history(
    db: Session,
    *,
    thread_id: str,
    tenant_id: str,
    settings,
    limit: int = 40,
) -> list[dict]:
    rows = db.scalars(
        select(Message)
        .where(Message.thread_id == thread_id, Message.tenant_id == tenant_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    ).all()
    ordered = list(reversed(rows))
    history = [history_item(row) for row in ordered]
    latest_user_content = next(
        (str(row.content or "") for row in reversed(ordered) if row.author_type == "user"),
        "",
    )
    knowledge = platform_knowledge_message(latest_user_content)
    context = document_context_message(
        db,
        settings=settings,
        tenant_id=tenant_id,
        thread_id=thread_id,
    )
    system_messages: list[dict] = []
    if knowledge:
        system_messages.append(knowledge)
    if context:
        system_messages.append(context)
    return system_messages + history


def build_team_turn(
    *,
    thread_id: str,
    tenant_id: str,
    user_id: str,
    requested_target: str,
    orchestrator_agent_id: str,
    channel: RuntimeChannel = RuntimeChannel.CHAT_SSE,
) -> CanonicalTurnContext:
    orchestrator = resolve_agent_by_id(orchestrator_agent_id)
    return CanonicalTurnContext(
        execution_id=str(uuid.uuid4()),
        request_id=str(uuid.uuid4()),
        thread_id=thread_id,
        tenant_id=tenant_id,
        user_id=user_id,
        requested_target=requested_target,
        resolved_agent_id=orchestrator.slug,
        turn_owner_agent_id=orchestrator.slug,
        display_agent_id=orchestrator.slug,
        display_agent_name=orchestrator.display_name,
        technical_lead_agent_id=orchestrator.slug,
        route_family=RuntimeRouteFamily.TEAM,
        channel=channel,
        ownership_locked=True,
        governance_mode="normal",
        internal_persistence_allowed=True,
        external_write_allowed=False,
        execution_allowed=True,
        orchestrator_agent_id=orchestrator.slug,
    )


def persist_user_message(db: Session, *, turn: CanonicalTurnContext, content: str) -> Message:
    row = Message(
        tenant_id=turn.tenant_id,
        thread_id=turn.thread_id,
        author_type="user",
        author_id=turn.user_id,
        agent_name=None,
        content=content,
    )
    db.add(row)
    db.commit()
    return row


def persist_team_contribution(
    db: Session,
    *,
    turn: CanonicalTurnContext,
    agent_id: str,
    content: str,
) -> Message:
    agent = resolve_agent_by_id(agent_id)
    row = Message(
        tenant_id=turn.tenant_id,
        thread_id=turn.thread_id,
        author_type="agent",
        author_id=agent.slug,
        agent_name=agent.display_name,
        content=content,
    )
    db.add(row)
    db.commit()
    return row


def persist_team_final(
    db: Session,
    *,
    turn: CanonicalTurnContext,
    content: str,
):
    row = Message(
        tenant_id=turn.tenant_id,
        thread_id=turn.thread_id,
        author_type="agent",
        author_id=turn.turn_owner_agent_id,
        agent_name=turn.display_agent_name,
        content=content,
    )
    db.add(row)
    db.commit()
    canonical = canonical_message(
        message_id=row.id,
        context=turn,
        content=row.content,
        created_at=row.created_at,
    )
    envelope = build_response_envelope(context=turn, message=canonical)
    return row, envelope_payload(envelope)


def team_audit(
    db: Session,
    *,
    turn: CanonicalTurnContext,
    action: str,
    outcome: str,
    metadata: dict[str, object] | None = None,
) -> None:
    safe_metadata: dict[str, object] = {}
    for key, value in (metadata or {}).items():
        if key in {"content", "prompt", "token", "secret", "authorization"}:
            continue
        if value is None or isinstance(value, (str, int, float, bool)):
            safe_metadata[str(key)[:80]] = value
        elif isinstance(value, (list, tuple)):
            safe_metadata[str(key)[:80]] = [str(x)[:80] for x in value[:16]]
    safe_metadata.setdefault("execution_id", turn.execution_id)
    safe_metadata.setdefault("thread_id", turn.thread_id)
    safe_metadata.setdefault("turn_owner_agent_id", turn.turn_owner_agent_id)
    row = AuditEvent(
        tenant_id=turn.tenant_id,
        actor_id=turn.user_id,
        action=action,
        resource_type="team_execution",
        resource_id=turn.execution_id,
        outcome=outcome,
        metadata_json=safe_metadata,
    )
    db.add(row)
    db.commit()
