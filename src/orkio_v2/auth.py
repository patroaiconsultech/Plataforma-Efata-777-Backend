from dataclasses import dataclass, replace
import logging

from fastapi import Depends, Header, HTTPException
import httpx
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .database import get_db
from .services.authorization import (
    ProvisionedAuthorizationError,
    resolve_provisioned_roles,
)
from .services.oidc_identity import (
    OIDCIdentityMappingError,
    normalize_oidc_identity,
    safe_oidc_diagnostics,
)

logger = logging.getLogger("orkio.oidc")


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    roles: tuple[str, ...]
    email: str | None = None
    external_subject: str | None = None


def require_principal(
    authorization: str | None = Header(None),
    x_test_user: str | None = Header(None, alias="X-Test-User"),
    x_test_tenant: str | None = Header(None, alias="X-Test-Tenant"),
    x_test_roles: str | None = Header(None, alias="X-Test-Roles"),
    x_test_email: str | None = Header(None, alias="X-Test-Email"),
    x_test_subject: str | None = Header(None, alias="X-Test-Subject"),
    settings: Settings = Depends(get_settings),
) -> Principal:
    if settings.auth_mode == "test":
        if settings.environment not in {"test", "development"}:
            raise HTTPException(500, "TEST_AUTH_FORBIDDEN")
        if not x_test_user or not x_test_tenant:
            raise HTTPException(401, "TEST_IDENTITY_REQUIRED")
        if not x_test_subject:
            raise HTTPException(401, "TEST_SUBJECT_REQUIRED")
        return Principal(
            x_test_user,
            x_test_tenant,
            tuple(filter(None, (x_test_roles or "member").split(","))),
            x_test_email,
            x_test_subject,
        )
    if settings.auth_mode == "external_required":
        raise HTTPException(status_code=401, detail="AUTH_PROVIDER_REQUIRED")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="BEARER_TOKEN_REQUIRED")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        response = httpx.post(
            settings.oidc_introspection_endpoint,
            data={"token": token},
            auth=(
                settings.oidc_introspection_client_id,
                settings.oidc_introspection_client_secret,
            ),
            timeout=settings.oidc_http_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="IDENTITY_PROVIDER_UNAVAILABLE"
        ) from exc

    if not data.get("active"):
        raise HTTPException(status_code=401, detail="TOKEN_INACTIVE")
    issuer = data.get("iss")
    if not issuer or str(issuer) != str(settings.oidc_issuer):
        raise HTTPException(status_code=401, detail="TOKEN_ISSUER_INVALID")
    audience = data.get("aud", [])
    audience = [audience] if isinstance(audience, str) else audience
    if settings.oidc_audience not in audience:
        raise HTTPException(status_code=401, detail="TOKEN_AUDIENCE_INVALID")

    try:
        identity = normalize_oidc_identity(
            data,
            user_claim=settings.oidc_user_claim,
            tenant_claim=settings.oidc_tenant_claim,
            roles_claim=settings.oidc_roles_claim,
        )
    except OIDCIdentityMappingError as exc:
        diagnostic = safe_oidc_diagnostics(
            data,
            user_claim=settings.oidc_user_claim,
            tenant_claim=settings.oidc_tenant_claim,
            roles_claim=settings.oidc_roles_claim,
        )
        logger.warning(
            "oidc_identity_mapping_rejected code=%s "
            "user_claim_present=%s tenant_claim_present=%s "
            "roles_claim_present=%s roles_claim_type=%s "
            "subject_claim_present=%s resourceowner_id_claim_present=%s "
            "project_roles_claim_present=%s",
            exc.code,
            diagnostic["user_claim_present"],
            diagnostic["tenant_claim_present"],
            diagnostic["roles_claim_present"],
            diagnostic["roles_claim_type"],
            diagnostic["subject_claim_present"],
            diagnostic["resourceowner_id_claim_present"],
            diagnostic["project_roles_claim_present"],
        )
        raise HTTPException(
            status_code=403, detail="IDENTITY_CLAIMS_INCOMPLETE"
        ) from exc

    return Principal(
        identity.user_id,
        identity.tenant_id,
        identity.roles,
        identity.email,
        identity.external_subject,
    )


def require_admin(
    principal: Principal = Depends(require_principal),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
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
    canonical = replace(principal, roles=roles)
    if not {"admin", "platform_owner"}.intersection(canonical.roles):
        raise HTTPException(403, "ADMIN_ROLE_REQUIRED")
    return canonical
