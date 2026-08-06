from orkio_v2.config import Settings
import pytest
def test_production_rejects_demo_headers():
    with pytest.raises(ValueError):
        Settings(PLATFORM_ENVIRONMENT="production",PLATFORM_AUTH_MODE="external_required",
                 PLATFORM_DEMO_IDENTITY_HEADERS_ENABLED=True,
                 PLATFORM_INVITATION_TOKEN_SECRET="x"*40)
def test_external_required_is_fail_closed(monkeypatch):
    from orkio_v2.main import app
    from orkio_v2.auth import require_principal
def test_governance_defaults_safe(client):
    data=client.get("/api/v2/governance/status").json()
    assert data["evolution_execution_allowed"] is False
    assert data["human_approval_required"] is True
