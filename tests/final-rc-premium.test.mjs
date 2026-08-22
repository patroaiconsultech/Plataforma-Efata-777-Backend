import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync("src/api.ts", "utf8");
const console_ = fs.readFileSync("src/routes/AppConsole.tsx", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

test("Team UI consumes server participant policy and contributor semantics", () => {
  assert.match(api, /candidate_contributor_agent_ids/);
  assert.match(api, /participant_policy/);
  assert.match(api, /max_contributors/);
  assert.match(console_, /activeTeam\?\.participant_policy\.max_contributors/);
  assert.doesNotMatch(console_, /const TEAM_MAX_PARTICIPANTS = 8/);
  assert.match(console_, /Selecionar todos/);
  assert.match(console_, /select_all_supported/);
  assert.match(api, /selection_mode: "explicit" \| "all_eligible"/);
  assert.doesNotMatch(api, /orchestrator_agent_id: string;\s*participant_agent_ids/);
});

test("document upload success is attachment-specific, never thread-aggregate false success", () => {
  assert.match(api, /getDocumentContextProvenance/);
  assert.match(api, /provided_chars/);
  assert.match(api, /source_chars/);
  assert.match(api, /aggregate_truncated/);
  assert.match(console_, /source_provenance\.find/);
  assert.match(console_, /source\.attachment_id === uploaded\.id/);
  assert.match(console_, /uploadedSource\?\.extraction_status === "ready"/);
  assert.match(console_, /provenance\.source_ids\.includes\(uploaded\.id\)/);
  const uploadBlock = console_.slice(
    console_.indexOf("async function handleFile"),
    console_.indexOf("async function invite"),
  );
  assert.doesNotMatch(uploadBlock, /if \(provenance\.available\)/);
  assert.match(uploadBlock, /Documento lido/);
  assert.match(uploadBlock, /Anexo armazenado · leitura do contexto pendente/);
  assert.match(uploadBlock, /DOCUMENT_CONTEXT_STATUS_UNAVAILABLE/);
});

test("persisted agent messages expose canonical speaker playback", () => {
  assert.match(api, /messageVoice/);
  assert.match(api, /messages\/\$\{encodeURIComponent\(messageId\)\}\/voice/);
  assert.match(console_, /handleMessageVoice/);
  assert.match(console_, /speaker-button/);
  assert.match(console_, /🔊/);
});

test("Realtime uses WebRTC, final transcript bridge, and releases microphone", () => {
  assert.match(api, /createRealtimeCall/);
  assert.match(api, /commitRealtimeTurn/);
  assert.match(console_, /new RTCPeerConnection/);
  assert.match(console_, /getUserMedia/);
  assert.match(console_, /conversation\.item\.input_audio_transcription\.completed/);
  assert.match(console_, /provider_item_id/);
  assert.match(console_, /transcript_final_id/);
  assert.match(console_, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(console_, /stopRealtimeSession/);
});

test("premium controls have explicit visual variants", () => {
  for (const cls of [
    ".realtime-button",
    ".attachment-button",
    ".voice-button",
    ".speaker-button",
  ]) {
    assert.match(styles, new RegExp(cls.replace(".", "\\.")));
  }
  assert.match(styles, /--electric/);
  assert.match(styles, /--gold/);
});


test("Realtime microphone capture requests browser noise suppression and avoids automatic gain amplification", () => {
  assert.match(console_, /const VOICE_INPUT_CONSTRAINTS: MediaStreamConstraints/);
  assert.match(console_, /echoCancellation: true/);
  assert.match(console_, /noiseSuppression: true/);
  assert.match(console_, /autoGainControl: false/);
  assert.match(console_, /getUserMedia\(VOICE_INPUT_CONSTRAINTS\)/);
});
