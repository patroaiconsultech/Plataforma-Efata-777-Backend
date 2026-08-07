"""Validação de provisionamento de identidade.

Um token válido não significa que User, Tenant e Membership existam no
banco. Este módulo torna essa distinção explícita e fail-closed: nunca
cria tenant, usuário ou membership automaticamente a partir de claim
não confiável.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import Principal, require_principal
from ..config import Settings, get_settings
from ..database import get_db
from ..models import Membership, Tenant, User


def assert_provisioned(db: Session, principal: Principal) -> None:
    """Garante que o principal existe de fato no banco.

    Levanta 403 PRINCIPAL_NOT_PROVISIONED quando o tenant, o usuário ou o
    vínculo ativo entre ambos não existir. Não revela qual dos três está
    ausente, para não servir como oráculo de enumeração.
    """
    if db.get(Tenant, principal.tenant_id) is None:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")
    if db.get(User, principal.user_id) is None:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")
    membership = db.scalar(
        select(Membership).where(
            Membership.tenant_id == principal.tenant_id,
            Membership.user_id == principal.user_id,
            Membership.active.is_(True),
        )
    )
    if membership is None:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")


def assert_identity_known(db: Session, principal: Principal) -> None:
    """Garante que o tenant e o usuário existem, sem exigir membership.

    Usado exclusivamente pelo aceite de convite. Estabelecer o vínculo com
    o tenant é justamente a função daquele endpoint, então exigir
    membership prévio tornaria o fluxo de convite externo impossível.

    A permissão não vem de claim não confiável: vem de um token de convite
    assinado, emitido por um participante autorizado e validado à parte.
    Tenant e usuário, porém, continuam tendo de existir previamente.
    """
    if db.get(Tenant, principal.tenant_id) is None:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")
    if db.get(User, principal.user_id) is None:
        raise HTTPException(403, "PRINCIPAL_NOT_PROVISIONED")


def require_provisioned_principal(
    principal: Principal = Depends(require_principal),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Principal:
    """Dependência que exige principal autenticado e provisionado.

    No modo de teste o provisionamento continua sendo exigido, para que a
    suíte exercite o mesmo caminho de produção.
    """
    assert_provisioned(db, principal)
    return principal


def require_known_principal(
    principal: Principal = Depends(require_principal),
    db: Session = Depends(get_db),
) -> Principal:
    """Dependência para o aceite de convite: identidade conhecida."""
    assert_identity_known(db, principal)
    return principal
