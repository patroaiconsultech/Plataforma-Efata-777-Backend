import asyncio, hashlib, json
from pathlib import Path, PurePosixPath
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text, func
from sqlalchemy.orm import Session
from .auth import Principal, require_principal, require_admin
from .config import Settings, get_settings
from .database import Base, get_db, engine
from .models import *
from .schemas import *
from .services.invitations import create_invitation, accept_invitation
from .services.identity import require_provisioned_principal, require_known_principal, assert_provisioned
from .services import llm
from .agents.registry import AgentNotFound, list_agents
from .services.execution_router import resolve_direct_execution

router=APIRouter(prefix="/api/v2")

@router.get("/agents")
def agents_catalog(p:Principal=Depends(require_provisioned_principal)):
    return [{"slug": a.slug, "display_name": a.display_name, "target_kind": a.target_kind.value}
            for a in list_agents()]

def _resolve_execution_or_404(requested_target: str):
    try:
        return resolve_direct_execution(requested_target)
    except AgentNotFound as exc:
        raise HTTPException(404, "AGENT_NOT_FOUND") from exc

INVITE_ALLOWED_ROLES={ThreadRole.owner.value, ThreadRole.moderator.value}

def thread_access(db: Session, thread_id: str, p: Principal) -> tuple[Thread, ThreadParticipant]:
    thread=db.get(Thread, thread_id)
    if not thread or thread.tenant_id != p.tenant_id: raise HTTPException(404, "THREAD_NOT_FOUND")
    member=db.scalar(select(ThreadParticipant).where(
        ThreadParticipant.thread_id==thread_id, ThreadParticipant.user_id==p.user_id,
        ThreadParticipant.active.is_(True)))
    if not member: raise HTTPException(403, "THREAD_ACCESS_DENIED")
    return thread, member

def _history(db: Session, thread_id: str, tenant_id: str, limit: int = 40) -> list[dict]:
    rows=db.scalars(select(Message).where(Message.thread_id==thread_id,Message.tenant_id==tenant_id)
                    .order_by(Message.created_at.desc()).limit(limit)).all()
    return [{"role":"assistant" if m.author_type=="agent" else "user","content":m.content} for m in reversed(rows)]

@router.get("/health")
def health(settings: Settings=Depends(get_settings)):
    return {"status":"ok","release":"2.0.0a1","sha":settings.release_sha,"environment":settings.environment}

EXPECTED_MIGRATION_HEAD = "001_v2_foundation"


@router.get("/ready")
def ready(settings: Settings=Depends(get_settings), db: Session=Depends(get_db)):
    """Readiness estrito, separado do liveness.

    Retorna HTTP 200 somente quando banco, schema e migration estão prontos.
    Nunca expõe URL de conexão, usuário, host ou credencial.
    """
    checks: dict[str, object] = {}

    try:
        db.execute(text("SELECT 1"))
        checks["database_connect"] = True
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unavailable",
                "checks": {"database_connect": False},
            },
        ) from exc

    expected = set(Base.metadata.tables)
    try:
        from sqlalchemy import inspect as _inspect

        present = set(_inspect(db.get_bind()).get_table_names())
    except Exception:
        present = set()

    missing = sorted(expected - present)
    checks["schema_complete"] = not missing
    if missing:
        checks["missing_tables"] = missing

    try:
        current_heads = {
            str(row[0])
            for row in db.execute(
                text("SELECT version_num FROM alembic_version")
            ).all()
            if row[0]
        }
    except Exception:
        current_heads = set()

    checks["migration_head"] = (
        next(iter(current_heads)) if len(current_heads) == 1 else None
    )
    checks["migration_expected"] = EXPECTED_MIGRATION_HEAD
    checks["migration_current"] = (
        current_heads == {EXPECTED_MIGRATION_HEAD}
    )
    checks["driver"] = str(db.get_bind().dialect.name)

    ok = (
        checks["database_connect"] is True
        and checks["schema_complete"] is True
        and checks["migration_current"] is True
    )
    if not ok:
        raise HTTPException(
            status_code=503,
            detail={"status": "unavailable", "checks": checks},
        )
    return {"status": "ready", "checks": checks}

@router.get("/governance/status")
def governance(settings: Settings=Depends(get_settings)):
    return {
      "auth_mode": settings.auth_mode,
      "realtime_streaming_enabled": settings.realtime_streaming_enabled,
      "realtime_voice_enabled": settings.voice_enabled,
      "github_readonly_enabled": settings.github_enabled,
      "artifacts_enabled": settings.artifacts_enabled,
      "assisted_evolution_enabled": settings.assisted_evolution_enabled,
      "evolution_execution_allowed": settings.evolution_execution_allowed,
      "human_approval_required": settings.human_approval_required,
      "llm_configured": bool((settings.openai_api_key or "").strip()),
    }

@router.post("/threads")
def create_thread(payload: ThreadCreate, p: Principal=Depends(require_provisioned_principal), db: Session=Depends(get_db)):
    thread=Thread(tenant_id=p.tenant_id,title=payload.title,created_by=p.user_id)
    db.add(thread); db.flush()
    db.add(ThreadParticipant(tenant_id=p.tenant_id,thread_id=thread.id,user_id=p.user_id,thread_role="owner",
                             can_view_attachments=True,can_download_artifacts=True,can_upload_files=True,can_generate_artifacts=True))
    db.commit()
    return {"id":thread.id,"title":thread.title}

@router.get("/threads")
def list_threads(p: Principal=Depends(require_provisioned_principal), db: Session=Depends(get_db),
                 limit: int=Query(50, ge=1, le=200), offset: int=Query(0, ge=0)):
    """Lista apenas as threads do tenant nas quais o principal participa.

    Ordenação determinística por created_at desc e id desc, para que a
    paginação seja estável mesmo com timestamps iguais.
    """
    stmt=(select(Thread, ThreadParticipant.thread_role)
          .join(ThreadParticipant, ThreadParticipant.thread_id==Thread.id)
          .where(Thread.tenant_id==p.tenant_id,
                 ThreadParticipant.tenant_id==p.tenant_id,
                 ThreadParticipant.user_id==p.user_id,
                 ThreadParticipant.active.is_(True))
          .order_by(Thread.created_at.desc(), Thread.id.desc())
          .limit(limit).offset(offset))
    rows=db.execute(stmt).all()
    total=db.scalar(select(func.count()).select_from(ThreadParticipant)
                    .where(ThreadParticipant.tenant_id==p.tenant_id,
                           ThreadParticipant.user_id==p.user_id,
                           ThreadParticipant.active.is_(True))) or 0
    return {"items":[{"id":t.id,"title":t.title,"created_at":t.created_at,"thread_role":role} for t,role in rows],
            "total":int(total),"limit":limit,"offset":offset}

@router.get("/threads/{thread_id}/messages")
def list_messages(thread_id: str,p:Principal=Depends(require_provisioned_principal),db:Session=Depends(get_db)):
    thread_access(db,thread_id,p)
    rows=db.scalars(select(Message).where(Message.thread_id==thread_id,Message.tenant_id==p.tenant_id).order_by(Message.created_at)).all()
    return [{"id":m.id,"author_type":m.author_type,"agent_name":m.agent_name,"content":m.content,"created_at":m.created_at} for m in rows]

@router.post("/threads/{thread_id}/messages")
async def send_message(thread_id:str,payload:MessageCreate,p:Principal=Depends(require_provisioned_principal),
                       settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    _,member=thread_access(db,thread_id,p)
    if member.thread_role==ThreadRole.viewer.value: raise HTTPException(403,"THREAD_READ_ONLY")
    execution=_resolve_execution_or_404(payload.agent)
    try:
        llm.ensure_configured(settings)
    except llm.LLMNotConfigured:
        raise HTTPException(503,"LLM_NOT_CONFIGURED")

    user=Message(tenant_id=p.tenant_id,thread_id=thread_id,author_type="user",author_id=p.user_id,content=payload.content)
    db.add(user); db.commit()
    history=_history(db,thread_id,p.tenant_id)

    try:
        answer=await llm.generate(settings,execution.resolved_target,history)
    except llm.LLMNotConfigured:
        raise HTTPException(503,"LLM_NOT_CONFIGURED")
    except llm.LLMUpstreamError:
        raise HTTPException(502,"LLM_UPSTREAM_ERROR")

    assistant=Message(tenant_id=p.tenant_id,thread_id=thread_id,author_type="agent",
                      author_id=execution.turn_owner,agent_name=execution.display_agent,content=answer)
    db.add(assistant); db.commit()
    return {"message_id":assistant.id,"agent_name":execution.display_agent,"content":answer,
            "execution":{"resolved_target":execution.resolved_target,"turn_owner":execution.turn_owner,
                         "execution_engine":execution.execution_engine.value,"ownership_locked":execution.ownership_locked}}

@router.post("/threads/{thread_id}/stream")
async def stream_message(thread_id:str,payload:MessageCreate,p:Principal=Depends(require_provisioned_principal),
                         settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    """SSE com contrato terminal garantido.

    Todo caminho emite event: done, inclusive após event: error, para que
    o cliente nunca fique com o input travado. A transação de banco é
    fechada antes da chamada ao provedor de LLM.
    """
    _,member=thread_access(db,thread_id,p)
    if member.thread_role==ThreadRole.viewer.value: raise HTTPException(403,"THREAD_READ_ONLY")
    if not settings.realtime_streaming_enabled: raise HTTPException(403,"REALTIME_STREAMING_DISABLED")
    execution=_resolve_execution_or_404(payload.agent)

    configured=True
    try:
        llm.ensure_configured(settings)
    except llm.LLMNotConfigured:
        configured=False

    agent=execution.resolved_target
    tenant_id=p.tenant_id
    user_id=p.user_id

    if configured:
        db.add(Message(tenant_id=tenant_id,thread_id=thread_id,author_type="user",author_id=user_id,content=payload.content))
        db.commit()
        history=_history(db,thread_id,tenant_id)
    else:
        history=[]

    def sse(event:str,data:dict)->str:
        return f"event: {event}\ndata: {json.dumps(data,ensure_ascii=False)}\n\n"

    async def events():
        if not configured:
            yield sse("error",{"code":"LLM_NOT_CONFIGURED","message":"Integração de linguagem não configurada."})
            yield sse("done",{"status":"failed"})
            return
        yield sse("status",{"status":"started","agent":agent})
        parts:list[str]=[]
        try:
            async for piece in llm.stream(settings,agent,history):
                parts.append(piece)
                yield sse("chunk",{"text":piece})
        except llm.LLMNotConfigured:
            yield sse("error",{"code":"LLM_NOT_CONFIGURED"})
            yield sse("done",{"status":"failed"})
            return
        except Exception:
            yield sse("error",{"code":"LLM_UPSTREAM_ERROR"})
            yield sse("done",{"status":"failed"})
            return

        answer="".join(parts).strip()
        if not answer:
            yield sse("error",{"code":"LLM_EMPTY_RESPONSE"})
            yield sse("done",{"status":"failed"})
            return

        # Reutiliza a sessao injetada. Abrir SessionLocal aqui criaria um
        # caminho de acesso ao banco que escapa de dependency_overrides e
        # de qualquer configuracao aplicada por injecao.
        # A transacao nao fica aberta durante a chamada de rede porque o
        # commit da mensagem do usuario ocorre antes do streaming.
        message_id=None
        try:
            row=Message(tenant_id=tenant_id,thread_id=thread_id,author_type="agent",
                        author_id=execution.turn_owner,agent_name=execution.display_agent,content=answer)
            db.add(row); db.commit()
            message_id=row.id
        except Exception:
            db.rollback()
            yield sse("error",{"code":"PERSISTENCE_FAILED"})
            yield sse("done",{"status":"failed"})
            return

        yield sse("done",{"status":"completed","message_id":message_id,"agent_name":execution.display_agent,"resolved_target":execution.resolved_target,"turn_owner":execution.turn_owner,"execution_engine":execution.execution_engine.value,"ownership_locked":execution.ownership_locked})

    return StreamingResponse(events(),media_type="text/event-stream",
                             headers={"Cache-Control":"no-store","X-Accel-Buffering":"no"})

@router.post("/threads/{thread_id}/invitations",response_model=InvitationOut)
def invite(thread_id:str,payload:InvitationCreate,p:Principal=Depends(require_provisioned_principal),
           settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    thread,member=thread_access(db,thread_id,p)
    if member.thread_role not in INVITE_ALLOWED_ROLES:
        raise HTTPException(403,"INVITE_ROLE_REQUIRED")
    invitation,token=create_invitation(db,thread,payload,p,settings)
    db.commit()
    return InvitationOut(invitation_id=invitation.id,invitation_url=f"{settings.invitation_base_url}/{token}",expires_at=invitation.expires_at)

@router.post("/invitations/accept")
def accept(payload:InvitationAccept,p:Principal=Depends(require_known_principal),settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    invitation=accept_invitation(db,payload.token,p,settings); db.commit()
    return {"status":"accepted","thread_id":invitation.thread_id}

@router.get("/threads/{thread_id}/participants")
def participants(thread_id:str,p:Principal=Depends(require_provisioned_principal),db:Session=Depends(get_db)):
    thread_access(db,thread_id,p)
    rows=db.scalars(select(ThreadParticipant).where(ThreadParticipant.thread_id==thread_id,ThreadParticipant.active.is_(True))).all()
    return [{"id":x.id,"user_id":x.user_id,"role":x.thread_role,"membership_type":x.membership_type} for x in rows]

@router.post("/threads/{thread_id}/attachments")
async def upload_attachment(thread_id:str,file:UploadFile=File(...),p:Principal=Depends(require_provisioned_principal),
                            settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    if not settings.artifacts_enabled:
        raise HTTPException(403,"ARTIFACTS_DISABLED")
    _,member=thread_access(db,thread_id,p)
    if not member.can_upload_files: raise HTTPException(403,"UPLOAD_PERMISSION_REQUIRED")
    data=await file.read(settings.max_upload_bytes+1)
    if len(data)>settings.max_upload_bytes: raise HTTPException(413,"FILE_TOO_LARGE")
    allowed={"application/pdf","text/plain","text/csv","application/json",
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
             "application/vnd.openxmlformats-officedocument.presentationml.presentation"}
    if file.content_type not in allowed: raise HTTPException(415,"MIME_TYPE_NOT_ALLOWED")
    digest=hashlib.sha256(data).hexdigest()
    safe=PurePosixPath((file.filename or "file").replace("\\","/")).name
    if not safe or safe in {".",".."}: raise HTTPException(400,"FILENAME_INVALID")
    key=f"{p.tenant_id}/{thread_id}/{digest}-{safe}"
    root=Path(settings.artifact_storage_path).resolve()
    target=(root/key).resolve()
    if not str(target).startswith(str(root)+"/"): raise HTTPException(400,"STORAGE_PATH_INVALID")
    target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
    row=Attachment(tenant_id=p.tenant_id,thread_id=thread_id,uploaded_by=p.user_id,filename=safe,
                   mime_type=file.content_type,size_bytes=len(data),sha256=digest,storage_key=key)
    db.add(row); db.commit()
    return {"id":row.id,"filename":safe,"sha256":digest}

@router.post("/evolution/proposals")
def create_proposal(payload:EvolutionProposalCreate,p:Principal=Depends(require_admin),db:Session=Depends(get_db)):
    assert_provisioned(db,p)
    row=EvolutionProposal(tenant_id=p.tenant_id,created_by=p.user_id,**payload.model_dump())
    db.add(row); db.commit()
    return {"id":row.id,"status":row.status,"proposal_only":True,"human_approval_required":True,
            "write_executed":False,"commit_executed":False,"merge_executed":False,"deploy_executed":False}

@router.get("/admin/security/status")
def security_status(p:Principal=Depends(require_admin),settings:Settings=Depends(get_settings)):
    return {"auth_mode":settings.auth_mode,"demo_headers_enabled":settings.demo_headers_enabled,
            "github_read_only":settings.github_read_only,"evolution_execution_allowed":settings.evolution_execution_allowed}
