from pathlib import Path


ROOT = Path(__file__).parents[1]
ROUTES = (ROOT / "src/orkio_v2/realtime_routes.py").read_text()
EXECUTION = (ROOT / "src/orkio_v2/services/realtime_execution.py").read_text()


def test_incremental_route_preserves_canonical_receipt_and_terminal_events():
    assert '@router.post("/threads/{thread_id}/realtime/turns/stream")' in ROUTES
    assert "reserve_receipt(" in ROUTES
    assert "complete_receipt(" in ROUTES
    assert '"type": "done"' in ROUTES
    assert "CLIENT_DISCONNECTED" in ROUTES
    assert "fail_receipt(" in ROUTES


def test_incremental_route_emits_text_and_audio_segment_events():
    assert '"type": "text_delta"' in EXECUTION
    assert '"type": "segment_ready"' in EXECUTION
    assert '"type": "audio_segment"' in ROUTES
    assert "data_base64" in ROUTES
    assert "SentenceSegmenter" in EXECUTION


def test_stream_route_keeps_limits_and_legacy_fallback_primitives():
    assert "_REALTIME_STREAM_MAX_SEGMENTS" in ROUTES
    assert "_enforce_realtime_segment_limits" in ROUTES
    assert '"/threads/{thread_id}/realtime/turns"' in ROUTES
    assert "synthesize_speech(" in ROUTES
