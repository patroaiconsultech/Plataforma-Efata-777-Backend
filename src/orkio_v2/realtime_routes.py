from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import Principal
from .config import Settings, get_settings
from .database import get_db
from .models import AuditEvent, Thread, ThreadParticipant, ThreadRole
from .runtime.contracts import RuntimeChannel
from .services.direct_runtime import build_turn as build_direct_turn
from .services.execution_router import resolve_direct_target_decision
from .services.identity import require_provisioned_principal
from .services.realtime_session import (
    RealtimeSessionError,
    create_realtime_call,
    realtime_capability,
)
from .services.target_resolver import TargetAmbiguous, TargetNotFound


router = APIRouter(prefix="/api/v2", tags=["realtime"])


class RealtimeCallCreate(BaseModel):
    sdp: str = Field(min_length=16, max_length=131072)
    agent: str = Field(min_length=1, max_length=160)


def _thread_access(db: Session, *, thread_id: str, principal: Principal) -> ThreadParticipant:
    thread = db.get(Thread, thread_id)
    if thread is None or thread.tenant_id != principal.tenant_id:
        raise HTTPException(404, "THREAD_NOT_FOUND")
    member = db.scalar(
        select(ThreadParticipant).where(
            ThreadParticipant.thread_id == thread_id,
            ThreadParticipant.tenant_id == principal.tenant_id,
            ThreadParticipant.user_id == principal.user_id,
            ThreadParticipant.active.is_(True),
        )
    )
    if member is None:
        raise HTTPException(403, "THREAD_ACCESS_DENIED")
    if member.thread_role == ThreadRole.viewer.value:
        raise HTTPException(403, "THREAD_READ_ONLY")
    return member


def _audit(
    db: Session,
    *,
    principal: Principal,
    thread_id: str,
    action: str,
    outcome: str,
    execution_id: str | None = None,
    metadata: dict[str, object] | None = None,
):
    clean: dict[str, object] = {"thread_id": thread_id}
    for key, value in (metadata or {}).items():
        if key.casefold() in {"token", "secret", "authorization", "sdp", "content", "prompt"}:
            continue
        if value is None or isinstance(value, (str, int, float, bool)):
            clean[str(key)[:80]] = value
    if execution_id:
        clean["execution_id"] = execution_id
    row = AuditEvent(
        tenant_id=principal.tenant_id,
        actor_id=principal.user_id,
        action=action,
        resource_type="realtime_session",
        resource_id=execution_id,
        outcome=outcome,
        metadata_json=clean,
    )
    db.add(row)
    db.commit()


@router.get("/realtime/capabilities")
def realtime_capabilities(
    p: Principal = Depends(require_provisioned_principal),
    settings: Settings = Depends(get_settings),
):
    del p
    return realtime_capability(settings)


@router.post("/threads/{thread_id}/realtime/calls")
async def realtime_call(
    thread_id: str,
    payload: RealtimeCallCreate,
    p: Principal = Depends(require_provisioned_principal),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    _thread_access(db, thread_id=thread_id, principal=p)
    _audit(
        db,
        principal=p,
        thread_id=thread_id,
        action="realtime_requested",
        outcome="requested",
        metadata={"transport": "webrtc"},
    )

    try:
        decision = resolve_direct_target_decision(payload.agent, settings)
    except TargetAmbiguous as exc:
        raise HTTPException(409, detail={"code": exc.code, "candidates": list(exc.candidates)}) from exc
    except TargetNotFound as exc:
        raise HTTPException(404, detail={"code": exc.code}) from exc

    turn = build_direct_turn(
        execution=decision.execution,
        thread_id=thread_id,
        tenant_id=p.tenant_id,
        user_id=p.user_id,
        requested_target=payload.agent,
        channel=RuntimeChannel.REALTIME,
    )
    _audit(
        db,
        principal=p,
        thread_id=thread_id,
        action="realtime_authorized",
        outcome="success",
        execution_id=turn.execution_id,
        metadata={"agent_id": turn.turn_owner_agent_id, "ownership_locked": turn.ownership_locked},
    )

    capability = realtime_capability(settings)
    session_capability = capability["realtime_session"]
    if not bool(session_capability.get("eligible")):
        code = str(session_capability.get("reason_code") or "REALTIME_NOT_CONFIGURED")
        _audit(
            db,
            principal=p,
            thread_id=thread_id,
            action="realtime_failed",
            outcome="failed",
            execution_id=turn.execution_id,
            metadata={"error_code": code, "agent_id": turn.turn_owner_agent_id},
        )
        raise HTTPException(403, code)

    bridge_capability = capability["orchestration_bridge"]
    if not bool(bridge_capability.get("eligible")):
        code = str(
            bridge_capability.get("reason_code")
            or "REALTIME_ORCHESTRATION_BRIDGE_REQUIRED"
        )
        _audit(
            db,
            principal=p,
            thread_id=thread_id,
            action="realtime_failed",
            outcome="failed",
            execution_id=turn.execution_id,
            metadata={"error_code": code, "agent_id": turn.turn_owner_agent_id},
        )
        raise HTTPException(503, code)

    try:
        result = await create_realtime_call(
            settings=settings,
            turn=turn,
            sdp_offer=payload.sdp,
        )
    except RealtimeSessionError as exc:
        _audit(
            db,
            principal=p,
            thread_id=thread_id,
            action="realtime_failed",
            outcome="failed",
            execution_id=turn.execution_id,
            metadata={"error_code": exc.code, "agent_id": turn.turn_owner_agent_id},
        )
        status = 403 if exc.code == "REALTIME_VOICE_DISABLED" else 503
        raise HTTPException(status, exc.code) from exc

    _audit(
        db,
        principal=p,
        thread_id=thread_id,
        action="session_created",
        outcome="success",
        execution_id=turn.execution_id,
        metadata={
            "agent_id": turn.turn_owner_agent_id,
            "model": result.model,
            "output_modalities": ",".join(result.output_modalities),
        },
    )
    return {
        "sdp": result.sdp_answer,
        "call_id": result.call_id,
        "execution_id": turn.execution_id,
        "agent_id": turn.turn_owner_agent_id,
        "agent_name": turn.display_agent_name,
        "turn_owner": turn.turn_owner_agent_id,
        "ownership_locked": turn.ownership_locked,
        "transport": "webrtc",
        "model": result.model,
        "output_modalities": list(result.output_modalities),
        "orchestration_bridge": False,
        "persistence": "not_bound",
        "runtime_proven": False,
    }
