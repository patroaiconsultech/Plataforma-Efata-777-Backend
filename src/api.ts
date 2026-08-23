import { publicEnv } from "./config/runtime";

const BASE = publicEnv("VITE_API_BASE_URL").replace(/\/$/, "");

export const TOKEN_STORAGE_KEY = "orkio_access_token";
export const TOKEN_EXPIRY_STORAGE_KEY = "orkio_access_token_expires_at";
export const AUTH_REQUIRED_EVENT = "orkio:auth-required";

/** Erro de API com status e código legível, em vez de string concatenada. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiBaseConfigured(): boolean {
  return BASE.length > 0;
}

export function getToken(): string | null {
  return null;
}

export function setToken(token: string, expiresInSeconds?: number): void {
  void token;
  void expiresInSeconds;
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_STORAGE_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
  } catch {
    /* nada a fazer */
  }
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  return headers;
}

/** Extrai o código de erro do corpo, aceitando JSON ou texto. */
async function readError(response: Response): Promise<ApiError> {
  const raw = await response.text();
  let code = raw || `HTTP_${response.status}`;
  try {
    const parsed = JSON.parse(raw);
    const detail = parsed?.detail ?? parsed?.code ?? parsed?.message;
    if (typeof detail === "string") code = detail;
    else if (detail && typeof detail === "object")
      code = detail.code || detail.status || code;
  } catch {
    /* corpo não é JSON: mantém o texto */
  }
  return new ApiError(response.status, String(code).slice(0, 200));
}

function ensureConfigured(): void {
  if (!BASE)
    throw new ApiError(
      0,
      "API_BASE_URL_NOT_CONFIGURED",
      "VITE_API_BASE_URL não está configurada nesta implantação.",
    );
}

/** Requisição JSON. Só define Content-Type quando há corpo. */
export async function apiJson<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  ensureConfigured();
  const headers = authHeaders(init.headers);
  if (init.body !== undefined && init.body !== null)
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const error = await readError(response);
    if (response.status === 401) clearToken();
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Requisição multipart. Nunca define Content-Type manualmente: o
 * navegador precisa gerar o boundary.
 */
export async function apiForm<T = unknown>(
  path: string,
  form: FormData,
  init: RequestInit = {},
): Promise<T> {
  ensureConfigured();
  const headers = authHeaders(init.headers);
  headers.delete("Content-Type");
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    method: init.method || "POST",
    body: form,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const error = await readError(response);
    if (response.status === 401) clearToken();
    throw error;
  }
  return (await response.json()) as T;
}



export type AgentDefinition = {
  slug: string;
  display_name: string;
  target_kind: "agent" | string;
  canonical_name?: string;
  role_code?: string;
  role_label?: string;
  organizational_level?: string;
  department?: string;
  founder_direct_access?: boolean;
  localized_names?: Record<string, string>;
  localized_role_labels?: Record<string, string>;
  availability?: {
    status?: string;
    registered?: boolean;
    configured?: boolean;
    ready?: boolean;
    state?: string;
    reason?: string | null;
    chat?: CapabilityAvailability;
    team?: CapabilityAvailability;
    realtime?: CapabilityAvailability;
    voice_playback?: CapabilityAvailability;
    voice_message?: CapabilityAvailability;
    tools?: CapabilityAvailability;
  };
};

export type CapabilityAvailability = {
  status?: string;
  eligible?: boolean;
  reason_code?: string;
  source?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAgent(value: unknown, index: number): AgentDefinition | null {
  const record = asRecord(value);
  if (!record) return null;
  const slug = asText(record.slug, `agent-${index}`).trim();
  if (!slug) return null;
  const availability = asRecord(record.availability);
  return {
    slug,
    display_name: asText(record.display_name, slug),
    target_kind: asText(record.target_kind, "agent"),
    canonical_name: asText(record.canonical_name) || undefined,
    role_code: asText(record.role_code) || undefined,
    role_label: asText(record.role_label) || undefined,
    organizational_level: asText(record.organizational_level) || undefined,
    department: asText(record.department) || undefined,
    founder_direct_access: asBoolean(record.founder_direct_access),
    localized_names: asRecord(record.localized_names) as Record<string, string> | undefined,
    localized_role_labels: asRecord(record.localized_role_labels) as Record<string, string> | undefined,
    availability: availability
      ? {
          registered: asBoolean(availability.registered),
          configured: asBoolean(availability.configured),
          ready: asBoolean(availability.ready),
          state: asText(availability.state) || undefined,
          reason: typeof availability.reason === "string" ? availability.reason : null,
        }
      : undefined,
  };
}

export function listAgents(): Promise<AgentDefinition[]> {
  return apiJson<unknown>("/api/v2/agents").then((payload) => {
    const rows = Array.isArray(payload)
      ? payload
      : (asRecord(payload)?.items as unknown[] | undefined) || [];
    return rows.map(normalizeAgent).filter((agent): agent is AgentDefinition => Boolean(agent));
  });
}

export type TeamParticipantPolicy = {
  min_contributors: number;
  max_contributors: number;
  eligible_count: number;
  select_all_supported: boolean;
};

export type TeamDefinition = {
  team_id: string;
  display_name: string;
  description?: string;
  orchestrator_agent_id: string;
  candidate_contributor_agent_ids: string[];
  participant_policy: TeamParticipantPolicy;
  /** rolling-deploy compatibility; new UI uses contributor field */
  candidate_agent_ids?: string[];
  max_delegation_depth: number;
  enabled: boolean;
};

export function listTeams(): Promise<TeamDefinition[]> {
  return apiJson<TeamDefinition[]>("/api/v2/teams");
}

export type RealtimeCapabilityItem = {
  status?: string;
  eligible?: boolean;
  reason_code?: string;
};

export type RealtimeCapabilities = {
  text_streaming?: RealtimeCapabilityItem;
  streaming?: RealtimeCapabilityItem;
  realtime_session?: RealtimeCapabilityItem;
  voice_input?: RealtimeCapabilityItem;
  voice_output?: RealtimeCapabilityItem;
  voice_segment_streaming?: RealtimeCapabilityItem;
  agent_voice_binding?: RealtimeCapabilityItem;
  interruption?: RealtimeCapabilityItem;
  turn_detection?: RealtimeCapabilityItem;
  orchestration_bridge?: RealtimeCapabilityItem;
  runtime_proven?: boolean;
};

export function getRealtimeCapabilities(): Promise<RealtimeCapabilities> {
  return apiJson<RealtimeCapabilities>("/api/v2/realtime/capabilities");
}

export type Thread = {
  id: string;
  title: string;
  created_at: string;
  thread_role: string;
};

export type ThreadList = {
  items: Thread[];
  total: number;
  limit: number;
  offset: number;
};

export type ChatMessage = {
  id: string;
  author_type: "user" | "agent";
  agent_id?: string | null;
  agent_name: string | null;
  content: string;
  created_at: string;
};

function normalizeThread(value: unknown, index: number): Thread | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asText(record.id, `thread-${index}`).trim();
  if (!id) return null;
  return {
    id,
    title: asText(record.title, "Nova conversa"),
    created_at: asText(record.created_at, new Date(0).toISOString()),
    thread_role: asText(record.thread_role, "owner"),
  };
}

export function listThreads(limit = 50, offset = 0): Promise<ThreadList> {
  return apiJson<unknown>(`/api/v2/threads?limit=${limit}&offset=${offset}`).then((payload) => {
    const record = asRecord(payload);
    const rows = Array.isArray(payload)
      ? payload
      : (record?.items as unknown[] | undefined) || [];
    const items = rows
      .map(normalizeThread)
      .filter((thread): thread is Thread => Boolean(thread));
    return {
      items,
      total: typeof record?.total === "number" ? record.total : items.length,
      limit: typeof record?.limit === "number" ? record.limit : limit,
      offset: typeof record?.offset === "number" ? record.offset : offset,
    };
  });
}

export function createThread(title?: string): Promise<{ id: string; title: string }> {
  return apiJson(`/api/v2/threads`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export function updateThreadTitle(
  threadId: string,
  title: string,
): Promise<{ id: string; title: string }> {
  return apiJson(`/api/v2/threads/${encodeURIComponent(threadId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

function normalizeMessage(value: unknown, index: number): ChatMessage | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asText(record.id, `message-${index}`).trim();
  if (!id) return null;
  return {
    id,
    author_type: record.author_type === "agent" ? "agent" : "user",
    agent_id: typeof record.agent_id === "string" ? record.agent_id : null,
    agent_name: typeof record.agent_name === "string" ? record.agent_name : null,
    content: asText(record.content),
    created_at: asText(record.created_at, new Date(0).toISOString()),
  };
}

export function listMessages(threadId: string): Promise<ChatMessage[]> {
  return apiJson<unknown>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/messages`,
  ).then((payload) => {
    const rows = Array.isArray(payload)
      ? payload
      : (asRecord(payload)?.items as unknown[] | undefined) || [];
    return rows
      .map(normalizeMessage)
      .filter((message): message is ChatMessage => Boolean(message));
  });
}

export function createInvite(threadId: string, payload: object) {
  return apiJson<{ invitation_id: string; invitation_url: string; expires_at: string }>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/invitations`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function acceptInvite(token: string): Promise<{ status: string; thread_id: string }> {
  return apiJson(`/api/v2/invitations/accept`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function uploadAttachment(threadId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiForm<{ id: string; filename: string; sha256: string }>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/attachments`,
    form,
  );
}


export type DocumentSourceProvenance = {
  attachment_id: string;
  filename: string;
  extraction_status: string;
  source_chars: number;
  provided_chars: number;
  truncated: boolean;
};

export type DocumentContextProvenance = {
  available: boolean;
  sources: number;
  source_ids: string[];
  extraction_status: "ready" | "partial" | "failed" | "none" | string;
  source_chars: number;
  provided_chars: number;
  per_source_truncated: boolean;
  aggregate_truncated: boolean;
  truncated: boolean;
  context_version: string;
  source_provenance: DocumentSourceProvenance[];
};

export function getDocumentContextProvenance(
  threadId: string,
): Promise<DocumentContextProvenance> {
  return apiJson<DocumentContextProvenance>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/document-context`,
  );
}

export type MessageVoiceResult = {
  blob: Blob;
  agentId: string;
  bindingId: string;
  locale: string;
  cache: string;
};

export async function messageVoice(
  threadId: string,
  messageId: string,
  locale: "pt-BR" | "en-US" | "es-419" = "pt-BR",
  signal?: AbortSignal,
): Promise<MessageVoiceResult> {
  ensureConfigured();
  const headers = authHeaders();
  headers.set("Content-Type", "application/json");
  headers.set(
    "X-Request-Id",
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tts-${Date.now()}`,
  );
  const response = await fetch(
    `${BASE}/api/v2/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/voice`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ locale }),
      signal,
      cache: "no-store",
      credentials: "include",
    },
  );
  if (!response.ok) throw await readError(response);
  return {
    blob: await response.blob(),
    agentId: response.headers.get("X-Orkio-Voice-Agent-Id") || "",
    bindingId: response.headers.get("X-Orkio-Voice-Binding-Id") || "",
    locale: response.headers.get("X-Orkio-Voice-Locale") || locale,
    cache: response.headers.get("X-Orkio-TTS-Cache") || "",
  };
}

export type RealtimeCallRequest = {
  sdp: string;
  target_mode: "direct" | "team";
  agent?: string;
  team_id?: string;
  selection_mode?: "explicit" | "all_eligible";
  contributor_agent_ids?: string[];
  locale: "pt-BR" | "en-US" | "es-419";
};

export type RealtimeCall = {
  sdp: string;
  call_id: string | null;
  session_id: string;
  execution_id: string;
  agent_id: string;
  agent_name: string;
  ownership_locked: boolean;
  target_mode: "direct" | "team";
  orchestration_bridge: true;
};

export function createRealtimeCall(
  threadId: string,
  payload: RealtimeCallRequest,
): Promise<RealtimeCall> {
  return apiJson<RealtimeCall>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/realtime/calls`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export type RealtimeTurnResult = {
  status: "completed";
  reconciled: boolean;
  terminal_event: "done";
  message_id: string;
  execution_id: string;
  agent_id: string;
  agent_name?: string;
  target_mode?: "direct" | "team";
  content: string;
  tts_path?: string;
};

export function commitRealtimeTurn(
  threadId: string,
  payload: {
    session_id: string;
    provider_item_id: string;
    transcript_final_id: string;
    transcript: string;
  },
): Promise<RealtimeTurnResult> {
  return apiJson<RealtimeTurnResult>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/realtime/turns`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export type RealtimeStreamAudioSegment = {
  segmentId: string;
  segmentNumber: number;
  codec: string;
  blob: Blob;
};

export type RealtimeStreamHandlers = {
  onTurnStarted?: (data: Record<string, unknown>) => void;
  onTextDelta?: (text: string) => void;
  onSegmentStarted?: (data: Record<string, unknown>) => void;
  onAudioSegment?: (segment: RealtimeStreamAudioSegment) => void;
  onSegmentDone?: (data: Record<string, unknown>) => void;
  onError?: (code: string) => void;
  onDone?: (data: Record<string, unknown>) => void;
};

export type RealtimeStreamResult = {
  status: "completed" | "failed" | "aborted" | "closed";
  errorCode?: string;
};

function decodeRealtimeAudioSegment(
  encoded: string,
  codec: string,
): Blob {
  if (typeof atob !== "function") throw new ApiError(0, "AUDIO_DECODER_UNAVAILABLE");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: codec || "audio/mpeg" });
}

/**
 * Consome a ponte canônica incremental do Realtime. O texto chega por deltas
 * e cada frase chega como um segmento de áudio independente. O endpoint antigo
 * continua disponível como fallback quando esta rota ainda não foi publicada.
 */
export async function streamRealtimeTurn(
  threadId: string,
  payload: {
    session_id: string;
    provider_item_id: string;
    transcript_final_id: string;
    transcript: string;
    locale?: "pt-BR" | "en-US" | "es-419";
  },
  handlers: RealtimeStreamHandlers = {},
  signal?: AbortSignal,
): Promise<RealtimeStreamResult> {
  try {
    ensureConfigured();
    const headers = authHeaders();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "text/event-stream");
    const response = await fetch(
      `${BASE}/api/v2/threads/${encodeURIComponent(threadId)}/realtime/turns/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ locale: "pt-BR", ...payload }),
        signal,
        credentials: "include",
      },
    );
    if (!response.ok) throw await readError(response);
    if (!response.body) throw new ApiError(0, "STREAM_BODY_UNAVAILABLE");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal: RealtimeStreamResult = { status: "closed" };

    const consume = (block: string) => {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) return;
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      } catch {
        data = { raw: dataLines.join("\n") };
      }

      if (event === "turn_started") handlers.onTurnStarted?.(data);
      else if (event === "text_delta") handlers.onTextDelta?.(String(data.text ?? ""));
      else if (event === "segment_started") handlers.onSegmentStarted?.(data);
      else if (event === "audio_segment") {
        const encoded = String(data.data_base64 ?? "");
        if (!encoded) return;
        handlers.onAudioSegment?.({
          segmentId: String(data.segment_id ?? ""),
          segmentNumber: Number(data.segment_number ?? 0),
          codec: String(data.codec ?? "audio/mpeg"),
          blob: decodeRealtimeAudioSegment(
            encoded,
            String(data.codec ?? "audio/mpeg"),
          ),
        });
      } else if (event === "segment_done") handlers.onSegmentDone?.(data);
      else if (event === "error") {
        const code = String(data.code ?? "REALTIME_STREAM_FAILED");
        terminal = { status: "failed", errorCode: code };
        handlers.onError?.(code);
      } else if (event === "done") {
        handlers.onDone?.(data);
        terminal = {
          status: data.status === "failed" ? "failed" : "completed",
          errorCode: data.status === "failed" ? String(data.code ?? "") : undefined,
        };
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf("\n\n");
        consume(block);
      }
    }
    if (buffer.trim()) consume(buffer);
    return terminal;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return { status: "aborted" };
    }
    throw error;
  }
}

export type VoiceTranscript = {
  transcript: string;
  locale_requested: string;
  language_detected: string | null;
  language_probability: number | null;
  engine: string;
  model: string;
  persisted: false;
};

export type VoiceLocale = "auto" | "pt-BR" | "en-US" | "es-419";

export function transcribeVoice(
  threadId: string,
  audio: Blob,
  locale: VoiceLocale = "auto",
  signal?: AbortSignal,
): Promise<VoiceTranscript> {
  const form = new FormData();
  const extension =
    audio.type.includes("ogg") ? "ogg" :
    audio.type.includes("wav") ? "wav" :
    audio.type.includes("mp4") ? "m4a" :
    audio.type.includes("mpeg") ? "mp3" :
    "webm";
  form.append("audio", audio, `voice-message.${extension}`);
  form.append("locale", locale);
  return apiForm<VoiceTranscript>(
    `/api/v2/threads/${encodeURIComponent(threadId)}/voice/transcribe`,
    form,
    { signal },
  );
}

export type ArtifactMetadata = {
  artifact_id: string;
  filename: string;
  mime_type: string;
  sha256: string;
  version: number;
  download_path: string;
  created_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validArtifactFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

function canonicalArtifactDownloadPath(artifactId: string): string {
  return `/api/v2/artifacts/${artifactId}/download`;
}

/**
 * Converte apenas metadata de artefato entregue pelo evento terminal `done`.
 * Texto do LLM nunca é usado como fonte de verdade para ArtifactCard.
 *
 * O backend atual emite `artifact.id`; `artifact_id` também é aceito como
 * compatibilidade explícita de contrato, mas o caminho precisa corresponder ao ID.
 */
export function parseArtifactMetadata(
  donePayload: Record<string, unknown>,
): ArtifactMetadata | null {
  if (donePayload.status !== "completed") return null;
  const raw = donePayload.artifact;
  if (!isRecord(raw)) return null;

  const rawId = raw.artifact_id ?? raw.id;
  if (typeof rawId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(rawId))
    return null;
  if (!validArtifactFilename(raw.filename)) return null;
  if (
    typeof raw.mime_type !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9!#$&^_.+/-]{0,199}$/.test(raw.mime_type)
  )
    return null;
  if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(raw.sha256))
    return null;
  if (
    typeof raw.version !== "number" ||
    !Number.isSafeInteger(raw.version) ||
    raw.version < 1
  )
    return null;
  if (
    typeof raw.download_path !== "string" ||
    raw.download_path !== canonicalArtifactDownloadPath(rawId)
  )
    return null;
  if (
    raw.created_at !== null &&
    raw.created_at !== undefined &&
    typeof raw.created_at !== "string"
  )
    return null;

  return {
    artifact_id: rawId,
    filename: raw.filename,
    mime_type: raw.mime_type,
    sha256: raw.sha256.toLowerCase(),
    version: raw.version,
    download_path: raw.download_path,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
  };
}

/**
 * Download autenticado por cookie HttpOnly.
 * O caminho vem de metadata terminal validada e nunca aceita URL externa.
 */
export async function downloadArtifact(artifact: ArtifactMetadata): Promise<void> {
  ensureConfigured();
  if (
    artifact.download_path !==
    canonicalArtifactDownloadPath(artifact.artifact_id)
  )
    throw new ApiError(0, "ARTIFACT_DOWNLOAD_PATH_INVALID");

  const headers = authHeaders({ Accept: artifact.mime_type });
  const response = await fetch(`${BASE}${artifact.download_path}`, {
    method: "GET",
    headers,
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = artifact.filename;
    anchor.rel = "noopener";
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

export function technicalAgentTarget(agentId: string): string {
  const normalized = agentId.trim();
  if (!normalized) throw new Error("AGENT_ID_REQUIRED");
  if (normalized.startsWith("id:")) return normalized;
  return `id:${normalized}`;
}

export type StreamHandlers = {
  onStatus?: (data: Record<string, unknown>) => void;
  onChunk?: (text: string) => void;
  onAgentStarted?: (data: Record<string, unknown>) => void;
  onAgentChunk?: (data: Record<string, unknown>) => void;
  onAgentDone?: (data: Record<string, unknown>) => void;
  onError?: (code: string) => void;
  onDone?: (data: Record<string, unknown>) => void;
};

/**
 * Consome SSE por fetch, em vez de EventSource, porque o endpoint é POST
 * e usa a sessão HttpOnly criada pelo backend.
 *
 * Garante terminal: onDone é sempre invocado, inclusive em falha de rede
 * ou quando o servidor encerra sem enviar done, para que a interface nunca
 * fique travada.
 */
export async function streamMessage(
  threadId: string,
  content: string,
  agent: string,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<void> {
  let terminated = false;
  const finish = (data: Record<string, unknown>) => {
    if (terminated) return;
    terminated = true;
    handlers.onDone?.(data);
  };

  try {
    ensureConfigured();
    const headers = authHeaders();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "text/event-stream");
    const response = await fetch(
      `${BASE}/api/v2/threads/${encodeURIComponent(threadId)}/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ content, agent }),
        signal,
        credentials: "include",
      },
    );
    if (!response.ok) {
      const error = await readError(response);
      handlers.onError?.(error.code);
      finish({ status: "failed" });
      return;
    }
    if (!response.body) {
      handlers.onError?.("STREAM_BODY_UNAVAILABLE");
      finish({ status: "failed" });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf("\n\n");
        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          payload = { raw: dataLines.join("\n") };
        }
        if (event === "status") handlers.onStatus?.(payload);
        else if (event === "chunk") handlers.onChunk?.(String(payload.text ?? ""));
        else if (event === "agent_started") handlers.onAgentStarted?.(payload);
        else if (event === "agent_chunk") handlers.onAgentChunk?.(payload);
        else if (event === "agent_done") handlers.onAgentDone?.(payload);
        else if (event === "error")
          handlers.onError?.(String(payload.code ?? "STREAM_ERROR"));
        else if (event === "done") finish(payload);
      }
    }
    finish({ status: "closed" });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      finish({ status: "aborted" });
      return;
    }
    handlers.onError?.(
      error instanceof ApiError ? error.code : "NETWORK_ERROR",
    );
    finish({ status: "failed" });
  } finally {
    finish({ status: "closed" });
  }
}


export type TeamStreamRequest = {
  team_id: string;
  selection_mode: "explicit" | "all_eligible";
  contributor_agent_ids?: string[];
};

export async function streamTeamMessage(
  threadId: string,
  content: string,
  team: TeamStreamRequest,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<void> {
  let terminated = false;
  const finish = (data: Record<string, unknown>) => {
    if (terminated) return;
    terminated = true;
    handlers.onDone?.(data);
  };

  try {
    ensureConfigured();
    const headers = authHeaders();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "text/event-stream");
    const response = await fetch(
      `${BASE}/api/v2/threads/${encodeURIComponent(threadId)}/team/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ content, ...team }),
        signal,
        credentials: "include",
      },
    );
    if (!response.ok) {
      const error = await readError(response);
      handlers.onError?.(error.code);
      finish({ status: "failed" });
      return;
    }
    if (!response.body) {
      handlers.onError?.("STREAM_BODY_UNAVAILABLE");
      finish({ status: "failed" });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf("\n\n");
        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          payload = { raw: dataLines.join("\n") };
        }
        if (event === "status") handlers.onStatus?.(payload);
        else if (event === "chunk") handlers.onChunk?.(String(payload.text ?? ""));
        else if (event === "agent_started") handlers.onAgentStarted?.(payload);
        else if (event === "agent_chunk") handlers.onAgentChunk?.(payload);
        else if (event === "agent_done") handlers.onAgentDone?.(payload);
        else if (event === "error")
          handlers.onError?.(String(payload.code ?? "STREAM_ERROR"));
        else if (event === "done") finish(payload);
      }
    }
    finish({ status: "closed" });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      finish({ status: "aborted" });
      return;
    }
    handlers.onError?.(
      error instanceof ApiError ? error.code : "NETWORK_ERROR",
    );
    finish({ status: "failed" });
  } finally {
    finish({ status: "closed" });
  }
}

/** Compatibilidade com o consumo anterior. */
export const api = apiJson;

export type NativeSession = {
  authenticated: boolean;
  user_id?: string | null;
  tenant_id?: string | null;
  email?: string | null;
  roles: string[];
};

export async function nativeLogin(input: {
  email: string;
  password: string;
}): Promise<NativeSession> {
  return apiJson<NativeSession>("/api/v2/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function nativeBootstrapOwner(input: {
  bootstrap_secret: string;
  tenant_id: string;
  tenant_name: string;
  email: string;
  display_name: string;
  password: string;
}): Promise<NativeSession> {
  return apiJson<NativeSession>("/api/v2/auth/bootstrap-owner", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function nativeRegister(input: {
  grant: string;
  email: string;
  display_name: string;
  password: string;
  co_creator_name: string;
  onboarding_goal?: string | null;
}): Promise<NativeSession> {
  return apiJson<NativeSession>("/api/v2/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function nativeForgotPassword(input: {
  email: string;
}): Promise<{ status: string; reset_token?: string | null }> {
  return apiJson("/api/v2/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function nativeResetPassword(input: {
  token: string;
  password: string;
  password_confirm: string;
}): Promise<NativeSession> {
  return apiJson("/api/v2/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function nativeLogout(): Promise<NativeSession> {
  const response = await apiJson<NativeSession>("/api/v2/auth/logout", {
    method: "POST",
  });
  clearToken();
  return response;
}

export async function getNativeSession(): Promise<NativeSession> {
  return apiJson<NativeSession>("/api/v2/auth/session");
}


export type HyperCocreatorMe = {
  user_id: string;
  tenant_id: string;
  email?: string | null;
  roles: string[];
  admin_access: boolean;
  co_creator_name: string;
  onboarding_goal?: string | null;
};

export type AccessGrantResponse = {
  grant: string;
  expires_at: number;
  onboarding_required: boolean;
};

export type AdminOverview = {
  tenant_id: string;
  users: number;
  threads: number;
  messages: number;
  co_creator_profiles: number;
  environment: string;
  release_sha: string;
};

export async function validateAccessCode(
  code: string,
): Promise<AccessGrantResponse> {
  return apiJson<AccessGrantResponse>("/api/v2/access/validate", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function completeHyperCocreatorOnboarding(input: {
  grant: string;
  co_creator_name: string;
  onboarding_goal?: string | null;
}): Promise<{
  status: string;
  user_id: string;
  tenant_id: string;
  co_creator_name: string;
  onboarding_goal?: string | null;
}> {
  return apiJson("/api/v2/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getMe(): Promise<HyperCocreatorMe> {
  return apiJson<HyperCocreatorMe>("/api/v2/me");
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return apiJson<AdminOverview>("/api/v2/admin/overview");
}


export type AdminSecurityStatus = {
  auth_mode: string;
  demo_headers_enabled: boolean;
  github_read_only: boolean;
  evolution_execution_allowed: boolean;
  access_gate_enabled: boolean;
  access_gate_code_hash_count: number;
  access_gate_tenant_configured: boolean;
  access_gate_signing_secret_configured: boolean;
};

export async function updateCoCreatorName(
  co_creator_name: string,
): Promise<{
  status: string;
  co_creator_name: string;
  onboarding_goal?: string | null;
}> {
  return apiJson("/api/v2/me/co-creator", {
    method: "PATCH",
    body: JSON.stringify({ co_creator_name }),
  });
}

export async function getAdminSecurityStatus(): Promise<AdminSecurityStatus> {
  return apiJson<AdminSecurityStatus>("/api/v2/admin/security/status");
}
