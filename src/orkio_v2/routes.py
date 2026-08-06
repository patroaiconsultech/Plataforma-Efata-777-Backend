import asyncio, hashlib, json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from .auth import Principal, require_principal, require_admin
from .config import Settings, get_settings
from .database import get_db
from .models import *
from .schemas import *
from .services.invitations import create_invitation, accept_invitation

router=APIRouter(prefix="/api/v2")

def thread_access(db: Session, thread_id: str, p: Principal) -> tuple[Thread, ThreadParticipant]:
    thread=db.get(Thread, thread_id)
    if not thread or thread.tenant_id != p.tenant_id: raise HTTPException(404, "THREAD_NOT_FOUND")
    member=db.scalar(select(ThreadParticipant).where(
        ThreadParticipant.thread_id==thread_id, ThreadParticipant.user_id==p.user_id,
        ThreadParticipant.active.is_(True)))
    if not member: raise HTTPException(403, "THREAD_ACCESS_DENIED")
    return thread, member

@router.get("/health")
def health(settings: Settings=Depends(get_settings)):
    return {"status":"ok","release":"2.0.0a1","sha":settings.release_sha,"environment":settings.environment}

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
    }

@router.post("/threads")
def create_thread(payload: ThreadCreate, p: Principal=Depends(require_principal), db: Session=Depends(get_db)):
    thread=Thread(tenant_id=p.tenant_id,title=payload.title,created_by=p.user_id)
    db.add(thread); db.flush()
    db.add(ThreadParticipant(tenant_id=p.tenant_id,thread_id=thread.id,user_id=p.user_id,thread_role="owner",
                             can_view_attachments=True,can_download_artifacts=True,can_upload_files=True,can_generate_artifacts=True))
    db.commit()
    return {"id":thread.id,"title":thread.title}

@router.get("/threads/{thread_id}/messages")
def list_messages(thread_id: str,p:Principal=Depends(require_principal),db:Session=Depends(get_db)):
    thread_access(db,thread_id,p)
    rows=db.scalars(select(Message).where(Message.thread_id==thread_id,Message.tenant_id==p.tenant_id).order_by(Message.created_at)).all()
    return [{"id":m.id,"author_type":m.author_type,"agent_name":m.agent_name,"content":m.content,"created_at":m.created_at} for m in rows]

@router.post("/threads/{thread_id}/messages")
def send_message(thread_id:str,payload:MessageCreate,p:Principal=Depends(require_principal),db:Session=Depends(get_db)):
    _,member=thread_access(db,thread_id,p)
    if member.thread_role=="viewer": raise HTTPException(403,"THREAD_READ_ONLY")
    user=Message(tenant_id=p.tenant_id,thread_id=thread_id,author_type="user",author_id=p.user_id,content=payload.content)
    answer=f"{payload.agent}: mensagem recebida com segurança. Integração LLM será usada quando OPENAI_API_KEY estiver habilitada no staging."
    assistant=Message(tenant_id=p.tenant_id,thread_id=thread_id,author_type="agent",author_id=payload.agent.lower(),agent_name=payload.agent,content=answer)
    db.add_all([user,assistant]); db.commit()
    return {"message_id":assistant.id,"agent_name":payload.agent,"content":answer}

@router.post("/threads/{thread_id}/stream")
async def stream_message(thread_id:str,payload:MessageCreate,p:Principal=Depends(require_principal),db:Session=Depends(get_db)):
    thread_access(db,thread_id,p)
    async def events():
        yield "event: status\ndata: {\"status\":\"started\"}\n\n"
        for part in ["ORKIO ","v2 ","processou ","a solicitação."]:
            await asyncio.sleep(0)
            yield f"event: chunk\ndata: {json.dumps({'text':part})}\n\n"
        yield "event: done\ndata: {\"status\":\"completed\"}\n\n"
    return StreamingResponse(events(),media_type="text/event-stream")

@router.post("/threads/{thread_id}/invitations",response_model=InvitationOut)
def invite(thread_id:str,payload:InvitationCreate,p:Principal=Depends(require_principal),
           settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    thread,_=thread_access(db,thread_id,p)
    invitation,token=create_invitation(db,thread,payload,p,settings)
    db.commit()
    return InvitationOut(invitation_id=invitation.id,invitation_url=f"{settings.invitation_base_url}/{token}",expires_at=invitation.expires_at)

@router.post("/invitations/accept")
def accept(payload:InvitationAccept,p:Principal=Depends(require_principal),settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
    invitation=accept_invitation(db,payload.token,p,settings); db.commit()
    return {"status":"accepted","thread_id":invitation.thread_id}

@router.get("/threads/{thread_id}/participants")
def participants(thread_id:str,p:Principal=Depends(require_principal),db:Session=Depends(get_db)):
    thread_access(db,thread_id,p)
    rows=db.scalars(select(ThreadParticipant).where(ThreadParticipant.thread_id==thread_id,ThreadParticipant.active.is_(True))).all()
    return [{"id":x.id,"user_id":x.user_id,"role":x.thread_role,"membership_type":x.membership_type} for x in rows]

@router.post("/threads/{thread_id}/attachments")
async def upload_attachment(thread_id:str,file:UploadFile=File(...),p:Principal=Depends(require_principal),
                            settings:Settings=Depends(get_settings),db:Session=Depends(get_db)):
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
    safe=Path(file.filename or "file").name
    key=f"{p.tenant_id}/{thread_id}/{digest}-{safe}"
    target=Path(settings.artifact_storage_path)/key; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
    row=Attachment(tenant_id=p.tenant_id,thread_id=thread_id,uploaded_by=p.user_id,filename=safe,
                   mime_type=file.content_type,size_bytes=len(data),sha256=digest,storage_key=key)
    db.add(row); db.commit()
    return {"id":row.id,"filename":safe,"sha256":digest}

@router.post("/evolution/proposals")
def create_proposal(payload:EvolutionProposalCreate,p:Principal=Depends(require_admin),db:Session=Depends(get_db)):
    row=EvolutionProposal(tenant_id=p.tenant_id,created_by=p.user_id,**payload.model_dump())
    db.add(row); db.commit()
    return {"id":row.id,"status":row.status,"proposal_only":True,"human_approval_required":True,
            "write_executed":False,"commit_executed":False,"merge_executed":False,"deploy_executed":False}

@router.get("/admin/security/status")
def security_status(p:Principal=Depends(require_admin),settings:Settings=Depends(get_settings)):
    return {"auth_mode":settings.auth_mode,"demo_headers_enabled":settings.demo_headers_enabled,
            "github_read_only":settings.github_read_only,"evolution_execution_allowed":settings.evolution_execution_allowed}
