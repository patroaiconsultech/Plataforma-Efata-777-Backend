from __future__ import annotations

import json

import httpx
import pytest
from sqlalchemy import select

from conftest import Testing, headers
from orkio_v2.config import get_settings
from orkio_v2.models import AuditEvent
from orkio_v2.runtime.contracts import RuntimeChannel
from orkio_v2.services.direct_runtime import build_turn
from orkio_v2.services.execution_router import resolve_direct_target_decision
from orkio_v2.services.realtime_session import (
    RealtimeSessionError,
    create_realtime_call,
    realtime_capability,
)


def _configured(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "voice_enabled", True, raising=False)
    monkeypatch.setattr(settings, "voice_provider", "openai", raising=False)
    monkeypatch.setattr(settings, "openai_api_key", "test-realtime-key-not-real", raising=False)
    return settings


def test_realtime_capability_is_fail_closed_by_default(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "voice_enabled", False, raising=False)
    monkeypatch.setattr(settings, "voice_provider", "disabled", raising=False)
    monkeypatch.setattr(settings, "openai_api_key", None, raising=False)
    cap = realtime_capability(settings)
    assert cap["text_streaming"]["eligible"] is True
    assert cap["realtime_session"]["eligible"] is False
    assert cap["realtime_session"]["reason_code"] == "REALTIME_VOICE_DISABLED"
    assert cap["voice_input"]["eligible"] is False
    assert cap["voice_output"]["eligible"] is False
    assert cap["interruption"]["eligible"] is False
    assert cap["turn_detection"]["eligible"] is False
    assert cap["orchestration_bridge"]["eligible"] is False


def test_realtime_signaling_can_be_configured_without_claiming_runtime_or_voice_ready(monkeypatch):
    settings = _configured(monkeypatch)
    cap = realtime_capability(settings)
    assert cap["realtime_session"]["status"] == "CONFIGURED"
    assert cap["realtime_session"]["eligible"] is True
    assert cap["realtime_session"]["runtime_proven"] is False
    assert cap["realtime_session"]["output_modalities"] == ["text"]
    assert cap["voice_input"]["eligible"] is False
    assert cap["voice_output"]["eligible"] is False
    assert cap["orchestration_bridge"]["status"] == "NOT_IMPLEMENTED"


def test_realtime_capabilities_endpoint_requires_authorization(client):
    response = client.get("/api/v2/realtime/capabilities")
    assert response.status_code in {401, 403}


def test_realtime_capabilities_endpoint_is_sanitized(client, monkeypatch):
    settings = _configured(monkeypatch)
    response = client.get("/api/v2/realtime/capabilities", headers=headers())
    assert response.status_code == 200
    raw = response.text
    assert "test-realtime-key-not-real" not in raw
    assert "Authorization" not in raw
    assert response.json()["orchestration_bridge"]["eligible"] is False


@pytest.mark.asyncio
async def test_realtime_session_creation_keeps_provider_key_server_side(monkeypatch):
    settings = _configured(monkeypatch)
    decision = resolve_direct_target_decision("Joseph", settings)
    turn = build_turn(
        execution=decision.execution,
        thread_id="thread-1",
        tenant_id="tenant-1",
        user_id="user-1",
        requested_target="Joseph",
        channel=RuntimeChannel.REALTIME,
    )
    captured = {}

    class FakeResponse:
        text = "v=0\\r\\nanswer"
        headers = {"Location": "https://api.openai.com/v1/realtime/calls/call_123"}

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            captured["timeout"] = kwargs.get("timeout")

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, endpoint, *, headers, files):
            captured["endpoint"] = endpoint
            captured["headers"] = dict(headers)
            captured["files"] = files
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    result = await create_realtime_call(
        settings=settings,
        turn=turn,
        sdp_offer="v=0\\r\\no=- 1 1 IN IP4 127.0.0.1",
    )
    assert result.call_id == "call_123"
    assert result.model == "gpt-realtime"
    assert result.output_modalities == ("text",)
    assert captured["headers"]["Authorization"] == "Bearer test-realtime-key-not-real"
    session_json = json.loads(captured["files"]["session"][1])
    assert session_json["output_modalities"] == ["text"]
    assert session_json["tools"] == []
    assert "test-realtime-key-not-real" not in json.dumps(session_json)
    assert result.sdp_answer == "v=0\\r\\nanswer" + "\r\n"



@pytest.mark.asyncio
async def test_realtime_sdp_terminal_line_break_is_preserved(monkeypatch):
    settings = _configured(monkeypatch)
    decision = resolve_direct_target_decision("Joseph", settings)
    turn = build_turn(
        execution=decision.execution,
        thread_id="thread-1",
        tenant_id="tenant-1",
        user_id="user-1",
        requested_target="Joseph",
        channel=RuntimeChannel.REALTIME,
    )

    class FakeResponse:
        text = "v=0\r\na=ice-pwd:synthetic\r\n"
        headers = {"Location": "https://api.openai.com/v1/realtime/calls/call_123"}

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    result = await create_realtime_call(
        settings=settings,
        turn=turn,
        sdp_offer="v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
    )
    assert result.sdp_answer == FakeResponse.text
    assert result.sdp_answer.endswith("\r\n")


@pytest.mark.asyncio
async def test_realtime_sdp_missing_terminal_line_break_is_normalized(monkeypatch):
    settings = _configured(monkeypatch)
    decision = resolve_direct_target_decision("Joseph", settings)
    turn = build_turn(
        execution=decision.execution,
        thread_id="thread-1",
        tenant_id="tenant-1",
        user_id="user-1",
        requested_target="Joseph",
        channel=RuntimeChannel.REALTIME,
    )

    class FakeResponse:
        text = "v=0\r\na=ice-pwd:synthetic"
        headers = {"Location": "https://api.openai.com/v1/realtime/calls/call_123"}

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    result = await create_realtime_call(
        settings=settings,
        turn=turn,
        sdp_offer="v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
    )
    assert result.sdp_answer == FakeResponse.text + "\r\n"
    assert result.sdp_answer.endswith("\r\n")


@pytest.mark.asyncio
async def test_realtime_sdp_whitespace_only_answer_is_rejected(monkeypatch):
    settings = _configured(monkeypatch)
    decision = resolve_direct_target_decision("Joseph", settings)
    turn = build_turn(
        execution=decision.execution,
        thread_id="thread-1",
        tenant_id="tenant-1",
        user_id="user-1",
        requested_target="Joseph",
        channel=RuntimeChannel.REALTIME,
    )

    class FakeResponse:
        text = " \r\n\t "
        headers = {}

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    with pytest.raises(RealtimeSessionError) as exc:
        await create_realtime_call(
            settings=settings,
            turn=turn,
            sdp_offer="v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
        )
    assert exc.value.code == "REALTIME_SDP_ANSWER_EMPTY"


def test_realtime_route_is_fail_closed_when_voice_disabled(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "voice_enabled", False, raising=False)
    monkeypatch.setattr(settings, "voice_provider", "disabled", raising=False)
    monkeypatch.setattr(settings, "openai_api_key", None, raising=False)

    thread = client.post("/api/v2/threads", json={}, headers=headers()).json()
    response = client.post(
        f"/api/v2/threads/{thread['id']}/realtime/calls",
        json={
            "sdp": "v=0\\r\\no=- 1 1 IN IP4 127.0.0.1",
            "agent": "Joseph",
        },
        headers=headers(),
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "REALTIME_VOICE_DISABLED"

    with Testing() as db:
        rows = db.scalars(select(AuditEvent)).all()
    actions = [
        row.action
        for row in rows
        if isinstance(row.metadata_json, dict)
        and row.metadata_json.get("thread_id") == thread["id"]
    ]
    assert "realtime_requested" in actions
    assert "realtime_authorized" in actions
    assert "realtime_failed" in actions



def test_realtime_route_stays_fail_closed_when_signaling_is_configured_but_bridge_is_missing(
    client, monkeypatch
):
    _configured(monkeypatch)

    async def must_not_create(*args, **kwargs):
        pytest.fail("provider session must not be created before ORKIO orchestration bridge is eligible")

    monkeypatch.setattr(
        "orkio_v2.realtime_routes.create_realtime_call",
        must_not_create,
    )
    thread = client.post("/api/v2/threads", json={}, headers=headers()).json()
    response = client.post(
        f"/api/v2/threads/{thread['id']}/realtime/calls",
        json={
            "sdp": "v=0\\r\\no=- 1 1 IN IP4 127.0.0.1",
            "agent": "Joseph",
        },
        headers=headers(),
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "REALTIME_ORCHESTRATION_BRIDGE_REQUIRED"


def test_realtime_route_rejects_cross_tenant_before_provider(client, monkeypatch):
    _configured(monkeypatch)
    thread = client.post("/api/v2/threads", json={}, headers=headers()).json()
    response = client.post(
        f"/api/v2/threads/{thread['id']}/realtime/calls",
        json={
            "sdp": "v=0\\r\\no=- 1 1 IN IP4 127.0.0.1",
            "agent": "Joseph",
        },
        headers=headers(tenant="tenant-other"),
    )
    assert response.status_code in {401, 403, 404}


@pytest.mark.asyncio
async def test_realtime_upstream_failure_is_sanitized(monkeypatch):
    settings = _configured(monkeypatch)
    decision = resolve_direct_target_decision("Joseph", settings)
    turn = build_turn(
        execution=decision.execution,
        thread_id="thread-1",
        tenant_id="tenant-1",
        user_id="user-1",
        requested_target="Joseph",
        channel=RuntimeChannel.REALTIME,
    )

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            return False
        async def post(self, *args, **kwargs):
            raise RuntimeError("provider exploded with synthetic secret")

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    with pytest.raises(RealtimeSessionError) as exc:
        await create_realtime_call(
            settings=settings,
            turn=turn,
            sdp_offer="v=0\\r\\no=- 1 1 IN IP4 127.0.0.1",
        )
    assert exc.value.code == "REALTIME_UPSTREAM_UNAVAILABLE"
    assert "synthetic secret" not in str(exc.value)


def test_realtime_service_source_never_serializes_openai_key():
    source = (
        __import__("pathlib").Path(__file__).parents[1]
        / "src/orkio_v2/services/realtime_session.py"
    ).read_text(encoding="utf-8")
    assert '"openai_api_key":' not in source
    assert "'openai_api_key':" not in source
    assert "Authorization" in source  # server-side provider request is intentional
