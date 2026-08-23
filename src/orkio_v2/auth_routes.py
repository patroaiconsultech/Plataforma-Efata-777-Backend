from __future__ import annotations

import hmac
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import Principal, require_principal
from .config import Settings, get_settings
from .database import get_db
from .schemas import (
    NativeForgotPasswordOut,
    NativeForgotPasswordRequest,
    NativeBootstrapOwnerRequest,
    NativeLoginRequest,
    NativeRegisterWithGrantRequest,
    NativeResetPasswordRequest,
    NativeSessionOut,
)
from .services.native_auth import (
    NativeAuthError,
    bootstrap_owner,
    create_or_update_credential,
    create_password_reset,
    login,
    reset_password,
    revoke_password_reset,
    revoke_session,
)
from .services.email_delivery import EmailDeliveryError, send_resend_email
from .models import NativeCredential, User
from .services.hyper_cocreator import AccessGateError, complete_onboarding

router = APIRouter(prefix="/api/v2/auth", tags=["native-auth"])


def _session_out(principal: Principal | None) -> NativeSessionOut:
    if principal is None:
        return NativeSessionOut(authenticated=False)
    return NativeSessionOut(
        authenticated=True,
        user_id=principal.user_id,
        tenant_id=principal.tenant_id,
        email=principal.email,
        roles=list(principal.roles),
    )


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.native_session_cookie_name,
        value=token,
        max_age=settings.native_session_ttl_hours * 3600,
        path="/",
        secure=settings.native_session_cookie_secure,
        httponly=True,
        samesite=settings.native_session_cookie_samesite,
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    for name in {settings.native_session_cookie_name, "__Host-patroai_session", "patroai_session"}:
        response.delete_cookie(
            key=name,
            path="/",
            secure=settings.native_session_cookie_secure,
            httponly=True,
            samesite=settings.native_session_cookie_samesite,
        )


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else ""


def _password_reset_url(token: str, settings: Settings) -> str:
    base_url = settings.native_password_reset_base_url.strip().rstrip("/")
    token_q = quote(token.strip(), safe="")
    if not base_url:
        return token
    return f"{base_url}/access?mode=reset&token={token_q}"


def _send_password_reset_email(to_email: str, token: str, settings: Settings) -> None:
    reset_url = _password_reset_url(token, settings)
    subject = "PatroAI | Redefinicao de senha"
    text_body = (
        "Recebemos uma solicitacao para redefinir sua senha da PatroAI.\n\n"
        f"Use este link dentro de {settings.native_password_reset_ttl_minutes} minutos:\n"
        f"{reset_url}\n\n"
        "Se voce nao solicitou essa alteracao, ignore esta mensagem."
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#06100d;color:#f4f0df">
      <div style="font-size:24px;font-weight:800;color:#e2c06c;margin-bottom:16px">PatroAI</div>
      <div style="font-size:16px;line-height:1.6;color:#d8e6df">
        Recebemos uma solicitacao para redefinir sua senha.
      </div>
      <div style="margin:24px 0">
        <a href="{reset_url}" style="display:inline-block;padding:14px 18px;border-radius:10px;background:#e2c06c;color:#06100d;font-weight:800;text-decoration:none">
          Redefinir senha
        </a>
      </div>
      <div style="font-size:13px;line-height:1.7;color:#a8bab3">
        Este link expira em {settings.native_password_reset_ttl_minutes} minutos.<br/>
        Se voce nao solicitou essa alteracao, ignore este e-mail.
      </div>
      <div style="margin-top:18px;font-size:12px;color:#91a69d;word-break:break-all">{reset_url}</div>
    </div>
    """
    send_resend_email(
        settings=settings,
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        idempotency_key=f"native-password-reset:{token[:18]}",
    )


@router.post("/bootstrap-owner", response_model=NativeSessionOut)
def bootstrap_native_owner(
    payload: NativeBootstrapOwnerRequest,
    response: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    if settings.auth_mode not in {"native_session", "native_or_oidc"}:
        raise HTTPException(404, "NATIVE_AUTH_DISABLED")
    if not settings.native_bootstrap_secret:
        raise HTTPException(403, "NATIVE_BOOTSTRAP_DISABLED")
    if not hmac.compare_digest(payload.bootstrap_secret, settings.native_bootstrap_secret):
        raise HTTPException(403, "NATIVE_BOOTSTRAP_FORBIDDEN")
    if len(payload.password) < settings.native_password_min_length:
        raise HTTPException(422, "PASSWORD_TOO_SHORT")

    try:
        principal = bootstrap_owner(
            db,
            tenant_id=payload.tenant_id,
            tenant_name=payload.tenant_name,
            email=str(payload.email),
            display_name=payload.display_name,
            password=payload.password,
            settings=settings,
        )
        result = login(
            db,
            email=str(payload.email),
            password=payload.password,
            settings=settings,
            user_agent=request.headers.get("user-agent", ""),
            client_ip=_client_ip(request),
        )
    except NativeAuthError as exc:
        db.rollback()
        raise HTTPException(409, exc.code) from exc

    db.commit()
    _set_session_cookie(response, result.token, settings)
    return _session_out(principal)


@router.post("/login", response_model=NativeSessionOut)
def native_login(
    payload: NativeLoginRequest,
    response: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    if settings.auth_mode not in {"native_session", "native_or_oidc"}:
        raise HTTPException(404, "NATIVE_AUTH_DISABLED")
    try:
        result = login(
            db,
            email=str(payload.email),
            password=payload.password,
            settings=settings,
            user_agent=request.headers.get("user-agent", ""),
            client_ip=_client_ip(request),
        )
    except NativeAuthError as exc:
        db.commit()
        status = 423 if exc.code == "ACCOUNT_TEMPORARILY_LOCKED" else 401
        raise HTTPException(status, exc.code) from exc
    db.commit()
    _set_session_cookie(response, result.token, settings)
    return _session_out(result.principal)


@router.post("/register", response_model=NativeSessionOut)
def native_register(
    payload: NativeRegisterWithGrantRequest,
    response: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    if settings.auth_mode not in {"native_session", "native_or_oidc"}:
        raise HTTPException(404, "NATIVE_AUTH_DISABLED")
    if len(payload.password) < settings.native_password_min_length:
        raise HTTPException(422, "PASSWORD_TOO_SHORT")
    tenant_id = settings.access_gate_tenant_id.strip()
    if not tenant_id:
        raise HTTPException(503, "ACCESS_GATE_NOT_CONFIGURED")

    email = str(payload.email).strip().lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        credential = db.scalar(
            select(NativeCredential).where(NativeCredential.user_id == existing_user.id)
        )
        if credential is not None:
            raise HTTPException(409, "NATIVE_ACCOUNT_ALREADY_EXISTS")
        user_id = existing_user.id
        subject = existing_user.external_subject
    else:
        user_id = str(uuid.uuid4())
        subject = f"native:{email}"

    principal = Principal(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=("member",),
        email=email,
        external_subject=subject,
    )
    try:
        complete_onboarding(
            db,
            settings=settings,
            principal=principal,
            grant_token=payload.grant,
            co_creator_name=payload.co_creator_name,
            onboarding_goal=payload.onboarding_goal,
        )
        create_or_update_credential(
            db,
            user_id=user_id,
            password=payload.password,
            settings=settings,
        )
        result = login(
            db,
            email=email,
            password=payload.password,
            settings=settings,
            user_agent=request.headers.get("user-agent", ""),
            client_ip=_client_ip(request),
        )
    except AccessGateError as exc:
        db.rollback()
        status = 409 if exc.code in {"ACCESS_GRANT_ALREADY_USED", "ACCESS_ONBOARDING_CONFLICT"} else 403
        raise HTTPException(status, exc.code) from exc
    except NativeAuthError as exc:
        db.rollback()
        raise HTTPException(401, exc.code) from exc
    db.commit()
    _set_session_cookie(response, result.token, settings)
    return _session_out(result.principal)


@router.post("/password/forgot", response_model=NativeForgotPasswordOut)
def native_forgot_password(
    payload: NativeForgotPasswordRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    if settings.auth_mode not in {"native_session", "native_or_oidc"}:
        raise HTTPException(404, "NATIVE_AUTH_DISABLED")
    issue = create_password_reset(db, email=str(payload.email), settings=settings)
    db.commit()
    delivered = False
    if issue is not None and settings.resend_api_key.strip():
        try:
            _send_password_reset_email(issue.email, issue.token, settings)
            delivered = True
        except EmailDeliveryError:
            revoke_password_reset(db, reset_id=issue.reset_id, reason="email_delivery_failed")
            db.commit()
    return NativeForgotPasswordOut(
        status="accepted",
        reset_token=issue.token
        if issue is not None
        and not delivered
        and settings.environment in {"development", "test"}
        else None,
    )


@router.post("/password/reset", response_model=NativeSessionOut)
def native_reset_password(
    payload: NativeResetPasswordRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    if settings.auth_mode not in {"native_session", "native_or_oidc"}:
        raise HTTPException(404, "NATIVE_AUTH_DISABLED")
    if payload.password != payload.password_confirm:
        raise HTTPException(422, "PASSWORD_CONFIRMATION_MISMATCH")
    if len(payload.password) < settings.native_password_min_length:
        raise HTTPException(422, "PASSWORD_TOO_SHORT")
    try:
        reset_password(db, token=payload.token, password=payload.password, settings=settings)
    except NativeAuthError as exc:
        db.rollback()
        raise HTTPException(400, exc.code) from exc
    db.commit()
    _clear_session_cookie(response, settings)
    return NativeSessionOut(authenticated=False)


@router.post("/logout", response_model=NativeSessionOut)
def native_logout(
    response: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    token = request.cookies.get(settings.native_session_cookie_name) or request.cookies.get(
        "__Host-patroai_session"
    ) or request.cookies.get("patroai_session")
    revoke_session(db, token=token, settings=settings)
    db.commit()
    _clear_session_cookie(response, settings)
    return NativeSessionOut(authenticated=False)


@router.get("/session", response_model=NativeSessionOut)
def native_session(
    principal: Principal = Depends(require_principal),
):
    return _session_out(principal)
