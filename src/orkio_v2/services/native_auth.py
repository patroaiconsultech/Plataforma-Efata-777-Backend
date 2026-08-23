from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta
from datetime import timezone
from typing import TYPE_CHECKING

from cryptography.exceptions import InvalidKey
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import (
    AuditEvent,
    Membership,
    NativeCredential,
    NativePasswordReset,
    NativeSession,
    Tenant,
    User,
    now,
)

if TYPE_CHECKING:
    from ..auth import Principal

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LENGTH = 32


@dataclass(frozen=True)
class NativeLoginResult:
    token: str
    session: NativeSession
    principal: Principal


@dataclass(frozen=True)
class NativePasswordResetIssue:
    token: str
    reset_id: str
    user_id: str
    email: str


class NativeAuthError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_email(value: str) -> str:
    return value.strip().lower()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _password_material(password: str, settings: Settings) -> bytes:
    return f"{settings.native_auth_pepper}:{password}".encode("utf-8")


def hash_password(password: str, settings: Settings) -> str:
    salt = secrets.token_bytes(16)
    kdf = Scrypt(salt=salt, length=KEY_LENGTH, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    digest = kdf.derive(_password_material(password, settings))
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str, settings: Settings) -> bool:
    try:
        scheme, n, r, p, salt, digest = encoded.split("$", 5)
        if scheme != "scrypt":
            return False
        kdf = Scrypt(
            salt=_unb64(salt),
            length=KEY_LENGTH,
            n=int(n),
            r=int(r),
            p=int(p),
        )
        kdf.verify(_password_material(password, settings), _unb64(digest))
        return True
    except (InvalidKey, ValueError):
        return False


def session_digest(token: str, settings: Settings) -> str:
    return hmac.new(
        settings.native_session_secret.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _client_ip_prefix(ip: str | None) -> str:
    if not ip:
        return ""
    parts = ip.split(".")
    if len(parts) == 4:
        return ".".join(parts[:3])
    return ip[:48]


def _aware(value):
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def audit(
    db: Session,
    *,
    action: str,
    outcome: str,
    tenant_id: str | None = None,
    actor_id: str | None = None,
    resource_type: str = "native_auth",
    resource_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditEvent(
            tenant_id=tenant_id,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            outcome=outcome,
            metadata_json=metadata or {},
        )
    )


def create_or_update_credential(
    db: Session,
    *,
    user_id: str,
    password: str,
    settings: Settings,
) -> NativeCredential:
    credential = db.scalar(
        select(NativeCredential).where(NativeCredential.user_id == user_id)
    )
    timestamp = now()
    password_hash = hash_password(password, settings)
    if credential is None:
        credential = NativeCredential(
            user_id=user_id,
            password_hash=password_hash,
            password_updated_at=timestamp,
            created_at=timestamp,
        )
        db.add(credential)
    else:
        credential.password_hash = password_hash
        credential.failed_login_count = 0
        credential.locked_until = None
        credential.password_updated_at = timestamp
    return credential


def bootstrap_owner(
    db: Session,
    *,
    tenant_id: str,
    tenant_name: str,
    email: str,
    display_name: str,
    password: str,
    settings: Settings,
) -> Principal:
    from ..auth import Principal

    email = normalize_email(email)
    existing_credential = db.scalar(select(NativeCredential.id).limit(1))
    if existing_credential is not None:
        raise NativeAuthError("NATIVE_BOOTSTRAP_ALREADY_COMPLETED")

    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        tenant = Tenant(id=tenant_id, name=tenant_name)
        db.add(tenant)
    else:
        tenant.name = tenant_name

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            external_subject=f"native:{email}",
            email=email,
            display_name=display_name,
        )
        db.add(user)
    else:
        user.display_name = display_name
    db.flush()

    membership = db.scalar(
        select(Membership).where(
            Membership.tenant_id == tenant.id,
            Membership.user_id == user.id,
        )
    )
    if membership is None:
        db.add(Membership(tenant_id=tenant.id, user_id=user.id, role="admin", active=True))
    else:
        membership.role = "admin"
        membership.active = True
    create_or_update_credential(db, user_id=user.id, password=password, settings=settings)
    audit(
        db,
        action="native_auth.bootstrap_owner",
        outcome="success",
        tenant_id=tenant.id,
        actor_id=user.id,
        resource_type="user",
        resource_id=user.id,
    )
    return Principal(
        user_id=user.id,
        tenant_id=tenant.id,
        roles=("admin",),
        email=user.email,
        external_subject=user.external_subject,
    )


def login(
    db: Session,
    *,
    email: str,
    password: str,
    settings: Settings,
    user_agent: str = "",
    client_ip: str | None = None,
) -> NativeLoginResult:
    from ..auth import Principal

    email = normalize_email(email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        audit(db, action="native_auth.login", outcome="failure", metadata={"reason": "unknown_email"})
        raise NativeAuthError("INVALID_CREDENTIALS")
    credential = db.scalar(
        select(NativeCredential).where(NativeCredential.user_id == user.id)
    )
    if credential is None:
        audit(
            db,
            action="native_auth.login",
            outcome="failure",
            actor_id=user.id,
            metadata={"reason": "missing_credential"},
        )
        raise NativeAuthError("INVALID_CREDENTIALS")

    timestamp = now()
    locked_until = _aware(credential.locked_until)
    if locked_until and locked_until > timestamp:
        audit(
            db,
            action="native_auth.login",
            outcome="failure",
            actor_id=user.id,
            metadata={"reason": "locked"},
        )
        raise NativeAuthError("ACCOUNT_TEMPORARILY_LOCKED")

    if not verify_password(password, credential.password_hash, settings):
        credential.failed_login_count += 1
        if credential.failed_login_count >= settings.native_login_max_failures:
            credential.locked_until = timestamp + timedelta(
                minutes=settings.native_login_lock_minutes
            )
        audit(
            db,
            action="native_auth.login",
            outcome="failure",
            actor_id=user.id,
            metadata={"reason": "bad_password"},
        )
        raise NativeAuthError("INVALID_CREDENTIALS")

    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.active.is_(True),
        )
    )
    if membership is None:
        audit(
            db,
            action="native_auth.login",
            outcome="failure",
            actor_id=user.id,
            metadata={"reason": "no_active_membership"},
        )
        raise NativeAuthError("PRINCIPAL_NOT_PROVISIONED")

    token = secrets.token_urlsafe(48)
    session = NativeSession(
        session_hash=session_digest(token, settings),
        token_prefix=token[:12],
        tenant_id=membership.tenant_id,
        user_id=user.id,
        created_at=timestamp,
        expires_at=timestamp + timedelta(hours=settings.native_session_ttl_hours),
        last_seen_at=timestamp,
        user_agent=user_agent[:240],
        ip_prefix=_client_ip_prefix(client_ip),
    )
    credential.failed_login_count = 0
    credential.locked_until = None
    credential.last_login_at = timestamp
    db.add(session)
    audit(
        db,
        action="native_auth.login",
        outcome="success",
        tenant_id=membership.tenant_id,
        actor_id=user.id,
        resource_type="native_session",
        resource_id=session.id,
    )
    return NativeLoginResult(
        token=token,
        session=session,
        principal=Principal(
            user_id=user.id,
            tenant_id=membership.tenant_id,
            roles=(membership.role,),
            email=user.email,
            external_subject=user.external_subject,
        ),
    )


def principal_from_session(
    db: Session,
    *,
    token: str | None,
    settings: Settings,
) -> Principal | None:
    from ..auth import Principal

    if not token:
        return None
    session = db.scalar(
        select(NativeSession).where(
            NativeSession.session_hash == session_digest(token, settings)
        )
    )
    timestamp = now()
    if (
        session is None
        or session.revoked_at is not None
        or _aware(session.expires_at) <= timestamp
    ):
        return None
    user = db.get(User, session.user_id)
    membership = db.scalar(
        select(Membership).where(
            Membership.tenant_id == session.tenant_id,
            Membership.user_id == session.user_id,
            Membership.active.is_(True),
        )
    )
    if user is None or membership is None:
        return None
    session.last_seen_at = timestamp
    return Principal(
        user_id=user.id,
        tenant_id=session.tenant_id,
        roles=(membership.role,),
        email=user.email,
        external_subject=user.external_subject,
    )


def revoke_session(
    db: Session,
    *,
    token: str | None,
    settings: Settings,
) -> bool:
    if not token:
        return False
    session = db.scalar(
        select(NativeSession).where(
            NativeSession.session_hash == session_digest(token, settings)
        )
    )
    if session is None or session.revoked_at is not None:
        return False
    session.revoked_at = now()
    audit(
        db,
        action="native_auth.logout",
        outcome="success",
        tenant_id=session.tenant_id,
        actor_id=session.user_id,
        resource_type="native_session",
        resource_id=session.id,
    )
    return True


def create_password_reset(
    db: Session,
    *,
    email: str,
    settings: Settings,
) -> NativePasswordResetIssue | None:
    email = normalize_email(email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        audit(
            db,
            action="native_auth.password_reset_requested",
            outcome="accepted",
            metadata={"known_user": False},
        )
        return None
    credential = db.scalar(
        select(NativeCredential).where(NativeCredential.user_id == user.id)
    )
    if credential is None:
        audit(
            db,
            action="native_auth.password_reset_requested",
            outcome="accepted",
            actor_id=user.id,
            metadata={"known_user": True, "has_credential": False},
        )
        return None
    timestamp = now()
    db.query(NativePasswordReset).filter(
        NativePasswordReset.user_id == user.id,
        NativePasswordReset.used_at.is_(None),
    ).update(
        {NativePasswordReset.used_at: timestamp},
        synchronize_session=False,
    )
    token = secrets.token_urlsafe(48)
    reset = NativePasswordReset(
        token_hash=session_digest(token, settings),
        token_prefix=token[:12],
        user_id=user.id,
        issued_at=timestamp,
        expires_at=timestamp + timedelta(minutes=settings.native_password_reset_ttl_minutes),
    )
    db.add(reset)
    db.flush()
    audit(
        db,
        action="native_auth.password_reset_requested",
        outcome="accepted",
        actor_id=user.id,
        metadata={"known_user": True, "has_credential": True},
    )
    return NativePasswordResetIssue(
        token=token,
        reset_id=reset.id,
        user_id=user.id,
        email=user.email,
    )


def revoke_password_reset(
    db: Session,
    *,
    reset_id: str,
    reason: str,
) -> None:
    timestamp = now()
    reset = db.get(NativePasswordReset, reset_id)
    if reset is not None and reset.used_at is None:
        reset.used_at = timestamp
        audit(
            db,
            action="native_auth.password_reset_revoked",
            outcome="success",
            actor_id=reset.user_id,
            resource_type="native_password_reset",
            resource_id=reset.id,
            metadata={"reason": reason},
        )


def reset_password(
    db: Session,
    *,
    token: str,
    password: str,
    settings: Settings,
) -> None:
    reset = db.scalar(
        select(NativePasswordReset).where(
            NativePasswordReset.token_hash == session_digest(token, settings)
        ).with_for_update()
    )
    timestamp = now()
    if (
        reset is None
        or reset.used_at is not None
        or _aware(reset.expires_at) <= timestamp
    ):
        raise NativeAuthError("PASSWORD_RESET_TOKEN_INVALID")
    create_or_update_credential(
        db,
        user_id=reset.user_id,
        password=password,
        settings=settings,
    )
    db.query(NativeSession).filter(NativeSession.user_id == reset.user_id).update(
        {NativeSession.revoked_at: timestamp},
        synchronize_session=False,
    )
    db.query(NativePasswordReset).filter(
        NativePasswordReset.user_id == reset.user_id,
        NativePasswordReset.used_at.is_(None),
    ).update(
        {NativePasswordReset.used_at: timestamp},
        synchronize_session=False,
    )
    audit(
        db,
        action="native_auth.password_reset_completed",
        outcome="success",
        actor_id=reset.user_id,
    )
