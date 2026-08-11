from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Literal

class ThreadCreate(BaseModel):
    title: str = Field("Nova conversa", max_length=240)

class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=100000)
    agent: str = Field("Josué", max_length=160)

class InvitationCreate(BaseModel):
    email: EmailStr
    role: Literal["moderator","participant","viewer"] = "participant"
    history_access: Literal["from_join","full_thread"] = "from_join"
    can_view_attachments: bool = False
    can_download_artifacts: bool = False
    can_upload_files: bool = False
    can_generate_artifacts: bool = False

class InvitationOut(BaseModel):
    invitation_id: str
    invitation_url: str
    expires_at: datetime

class InvitationAccept(BaseModel):
    token: str = Field(min_length=32)

class EvolutionProposalCreate(BaseModel):
    title: str
    issue_map: dict
    patch_plan: dict
    diff_preview: str = ""
    risk_assessment: dict
    rollback_plan: dict
    smoke_plan: dict


class GitHubSnapshotRequest(BaseModel):
    repository: str = Field(min_length=3, max_length=240)
    paths: list[str] = Field(default_factory=list, max_length=20)

class PythonExecuteRequest(BaseModel):
    code: str = Field(min_length=1, max_length=100000)


class ExternalReadRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)

