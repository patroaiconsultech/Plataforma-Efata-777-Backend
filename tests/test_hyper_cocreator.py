import hashlib
import hmac

import pytest

from orkio_v2.auth import Principal
from orkio_v2.config import Settings
from orkio_v2.services.hyper_cocreator import (
    AccessGateError,
    hyper_cocreator_system_message,
    is_allowlisted_admin,
    validate_access_code,
    verify_access_grant,
)


SECRET = "test-access-gate-signing-secret-32chars"


def _digest(code: str) -> str:
    return hmac.new(
        SECRET.encode(),
        code.strip().lower().encode(),
        hashlib.sha256,
    ).hexdigest()


def settings(**overrides):
    values = {
        "PLATFORM_ENVIRONMENT": "test",
        "PLATFORM_ACCESS_GATE_ENABLED": True,
        "PLATFORM_ACCESS_GATE_CODE_HASHES": f"{_digest('first-code')},{_digest('second-code')}",
        "PLATFORM_ACCESS_GATE_SIGNING_SECRET": SECRET,
        "PLATFORM_ACCESS_GATE_TENANT_ID": "tenant-hyper",
        "PLATFORM_ADMIN_EMAIL_ALLOWLIST": "daniel@patroai.com,patroaiconsultech@gmail.com",
    }
    values.update(overrides)
    return Settings(**values)


def test_access_code_is_case_normalized_and_exchanged_for_signed_short_lived_grant():
    cfg = settings()
    grant = validate_access_code(cfg, "  FIRST-CODE ")
    payload = verify_access_grant(cfg, grant.token)
    assert payload["tenant_id"] == "tenant-hyper"
    assert grant.expires_at - int(payload["iat"]) == cfg.access_gate_ttl_seconds
    assert "first-code" not in grant.token


def test_invalid_access_code_fails_closed():
    with pytest.raises(AccessGateError) as exc:
        validate_access_code(settings(), "wrong")
    assert exc.value.code == "ACCESS_CODE_INVALID"


def test_admin_requires_role_and_exact_allowlisted_email():
    cfg = settings()
    assert is_allowlisted_admin(
        Principal("u1", "tenant-hyper", ("admin",), "DANIEL@PATROAI.COM", "s1"),
        cfg,
    )
    assert not is_allowlisted_admin(
        Principal("u2", "tenant-hyper", ("member",), "daniel@patroai.com", "s2"),
        cfg,
    )
    assert not is_allowlisted_admin(
        Principal("u3", "tenant-hyper", ("admin",), "other@example.com", "s3"),
        cfg,
    )


def test_hyper_cocreator_prompt_preserves_canonical_owner_and_blocks_platform_evolution():
    message = hyper_cocreator_system_message(
        co_creator_name="Atlas",
        onboarding_goal="Criar uma nova oferta",
    )["content"]
    assert "agent_id=orkio" in message
    assert "Atlas" in message
    assert "Criar uma nova oferta" in message
    for forbidden in ("commit", "merge", "deploy", "migrate", "GitHub"):
        assert forbidden.lower() in message.lower()
    assert "restricted" in message.lower() or "restrit" in message.lower()
