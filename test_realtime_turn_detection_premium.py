from __future__ import annotations

import pytest

from orkio_v2.config import Settings, get_settings
from orkio_v2.services.realtime_session import (
    _turn_detection_config,
    realtime_capability,
)


def test_server_vad_defaults_are_deliberate_and_provider_cannot_answer():
    settings = Settings(
        _env_file=None,
        PLATFORM_REALTIME_TURN_DETECTION_MODE="server_vad",
        PLATFORM_REALTIME_VAD_THRESHOLD=0.5,
        PLATFORM_REALTIME_VAD_PREFIX_PADDING_MS=300,
        PLATFORM_REALTIME_VAD_SILENCE_DURATION_MS=1200,
    )

    assert _turn_detection_config(settings) == {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 1200,
        "create_response": False,
        "interrupt_response": False,
    }


def test_semantic_vad_low_is_available_without_transferring_response_ownership():
    settings = Settings(
        _env_file=None,
        PLATFORM_REALTIME_TURN_DETECTION_MODE="semantic_vad",
        PLATFORM_REALTIME_SEMANTIC_VAD_EAGERNESS="low",
    )

    assert _turn_detection_config(settings) == {
        "type": "semantic_vad",
        "eagerness": "low",
        "create_response": False,
        "interrupt_response": False,
    }


def test_capability_reports_effective_turn_detection_mode(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "voice_enabled", True, raising=False)
    monkeypatch.setattr(settings, "voice_provider", "openai", raising=False)
    monkeypatch.setattr(settings, "openai_api_key", "synthetic-not-real", raising=False)
    monkeypatch.setattr(settings, "realtime_turn_detection_mode", "semantic_vad", raising=False)
    monkeypatch.setattr(settings, "realtime_semantic_vad_eagerness", "low", raising=False)

    turn = realtime_capability(settings)["turn_detection"]

    assert turn["eligible"] is True
    assert turn["mode"] == "semantic_vad"
    assert turn["reason_code"] == "SEMANTIC_VAD_TRANSCRIPTION_ONLY"


@pytest.mark.parametrize(
    ("field", "value", "error_code"),
    (
        ("PLATFORM_REALTIME_VAD_THRESHOLD", 0, "REALTIME_VAD_THRESHOLD_INVALID"),
        ("PLATFORM_REALTIME_VAD_THRESHOLD", 1.01, "REALTIME_VAD_THRESHOLD_INVALID"),
        ("PLATFORM_REALTIME_VAD_PREFIX_PADDING_MS", -1, "REALTIME_VAD_PREFIX_PADDING_INVALID"),
        ("PLATFORM_REALTIME_VAD_PREFIX_PADDING_MS", 5001, "REALTIME_VAD_PREFIX_PADDING_INVALID"),
        ("PLATFORM_REALTIME_VAD_SILENCE_DURATION_MS", 199, "REALTIME_VAD_SILENCE_DURATION_INVALID"),
        ("PLATFORM_REALTIME_VAD_SILENCE_DURATION_MS", 5001, "REALTIME_VAD_SILENCE_DURATION_INVALID"),
    ),
)
def test_realtime_turn_detection_guardrails_fail_closed(field, value, error_code):
    with pytest.raises(ValueError, match=error_code):
        Settings(_env_file=None, **{field: value})
