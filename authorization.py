"""Autorização canônica baseada no banco ORKIO.

Claims do provedor autenticam a identidade, mas privilégios efetivos vêm da
membership ativa do banco. PLATFORM_OWNER_SUBJECT apenas marca como
platform_owner um sujeito já provisionado com membership admin; não cria
tenant, usuário, membership nem concede admin sozinho.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Membership, Tenant, User


class ProvisionedAuthorizationError(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


_ADMIN_MEMBERSHIP_ROLES = frozenset({"admin", "orkio_admin", "owner", "superadmin", "super_admin"})
_SUPERADMIN_MEMBERSHIP_ROLES = frozenset({"superadmin", "super_admin"})


def resolve_provisioned_roles(
    db: Session,
    *,
    tenant_id: str,
    user_id: str,
    external_subject: str | None,
    settings: Settings,
) -> tuple[str, ...]:
    tenant = db.get(Tenant, tenant_id)
    user = db.get(User, user_id)
    if tenant is None or user is None:
        raise ProvisionedAuthorizationError("PRINCIPAL_NOT_PROVISIONED")
    if not external_subject or user.external_subject != external_subject:
        raise ProvisionedAuthorizationError("PRINCIPAL_NOT_PROVISIONED")
    membership = db.scalar(
        select(Membership).where(
            Membership.tenant_id == tenant_id,
            Membership.user_id == user_id,
            Membership.active.is_(True),
        )
    )
    if membership is None:
        raise ProvisionedAuthorizationError("PRINCIPAL_NOT_PROVISIONED")

    role = (membership.role or "").strip()
    if not role:
        raise ProvisionedAuthorizationError("PRINCIPAL_NOT_PROVISIONED")
    roles = {role}
    if role in _ADMIN_MEMBERSHIP_ROLES:
        # As rotas existentes reconhecem admin; a elevação só nasce de uma
        # Membership ativa e nunca de claims, cabeçalhos ou allowlist.
        roles.add("admin")
    if role in _SUPERADMIN_MEMBERSHIP_ROLES:
        roles.update({"owner", "superadmin"})

    owner_subject = (settings.platform_owner_subject or "").strip()
    if owner_subject and external_subject == owner_subject:
        if role not in _ADMIN_MEMBERSHIP_ROLES:
            raise ProvisionedAuthorizationError(
                "PLATFORM_OWNER_ADMIN_MEMBERSHIP_REQUIRED"
            )
        roles.add("platform_owner")

    return tuple(sorted(roles))
