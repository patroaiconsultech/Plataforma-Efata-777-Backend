from dataclasses import dataclass
from fastapi import Depends, Header, HTTPException
import httpx
from .config import Settings, get_settings

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
    settings: Settings = Depends(get_settings),
) -> Principal:
    if settings.auth_mode == "test":
        if settings.environment not in {"test","development"}:
            raise HTTPException(500, "TEST_AUTH_FORBIDDEN")
        if not x_test_user or not x_test_tenant:
            raise HTTPException(401, "TEST_IDENTITY_REQUIRED")
        return Principal(x_test_user, x_test_tenant, tuple(filter(None,(x_test_roles or "member").split(","))), x_test_email)
    if settings.auth_mode == "external_required":
        raise HTTPException(status_code=401, detail="AUTH_PROVIDER_REQUIRED")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="BEARER_TOKEN_REQUIRED")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        response = httpx.post(
            settings.oidc_introspection_endpoint,
            data={"token": token},
            auth=(settings.oidc_introspection_client_id, settings.oidc_introspection_client_secret),
            timeout=settings.oidc_http_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="IDENTITY_PROVIDER_UNAVAILABLE") from exc
    if not data.get("active"):
        raise HTTPException(status_code=401, detail="TOKEN_INACTIVE")
    issuer = data.get("iss")
    if not issuer or str(issuer) != str(settings.oidc_issuer):
        raise HTTPException(status_code=401, detail="TOKEN_ISSUER_INVALID")
    audience = data.get("aud", [])
    audience = [audience] if isinstance(audience, str) else audience
    if settings.oidc_audience not in audience:
        raise HTTPException(status_code=401, detail="TOKEN_AUDIENCE_INVALID")
    user = data.get(settings.oidc_user_claim)
    tenant = data.get(settings.oidc_tenant_claim)
    roles = data.get(settings.oidc_roles_claim, [])
    roles = [roles] if isinstance(roles, str) else roles
    if not user or not tenant:
        raise HTTPException(status_code=403, detail="IDENTITY_CLAIMS_INCOMPLETE")
    return Principal(str(user), str(tenant), tuple(map(str, roles)), data.get("email"), data.get("sub"))

def require_admin(principal: Principal = Depends(require_principal)) -> Principal:
    if not {"admin","orkio_admin"}.intersection(principal.roles):
        raise HTTPException(403, "ADMIN_ROLE_REQUIRED")
    return principal
