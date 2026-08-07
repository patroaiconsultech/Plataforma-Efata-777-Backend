"""Validação e canonização do provisionamento de identidade.

O token autentica a identidade. A autorização efetiva vem da membership ativa
do banco, fail-closed e tenant-scoped. Nenhum tenant, usuário ou membership é
criado automaticamente a partir de claims.
"""
from __future__ import annotations

from dataclasses import replace

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import Principal, require_principal
from ..config import Settings, get_settings
from ..database import get_db
from ..models import Tenant, User
from .authorization import (
    ProvisionedAuthorizationError,
    resolve_provisioned_roles,
)


def _canonicalize(
    db: Session,
    principal: Principal,
    settings: Settings,
) -> Principal:
    try:
        roles = resolve_provisioned_roles(
            db,
            tenant_id=principal.tenant_id,
            user_id=principal.user_id,
            external_subject=principal.external_subject,
            settings=settings,
        )
    except ProvisionedAuthorizationError as exc:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED") from exc
    return replace(principal, roles=roles)


def assert_provisioned(
    db: Session,
    principal: Principal,
    settings: Settings | None = None,
) -> None:
    effective_settings = settings or get_settings()
    _canonicalize(db, principal, effective_settings)


def assert_identity_known(db: Session, principal: Principal) -> None:
    tenant = db.get(Tenant, principal.tenant_id)
    user = db.get(User, principal.user_id)
    if tenant is None or user is None:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")
    if not principal.external_subject or (
        user.external_subject != principal.external_subject
    ):
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")


def require_provisioned_principal(
    principal: Principal = Depends(require_principal),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Principal:
    return _canonicalize(db, principal, settings)


def require_known_principal(
    principal: Principal = Depends(require_principal),
    db: Session = Depends(get_db),
) -> Principal:
    assert_identity_known(db, principal)
    return principal
