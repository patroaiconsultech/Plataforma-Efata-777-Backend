from functools import lru_cache
from typing import Literal
from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: Literal["development","test","staging","production"] = Field("development", alias="PLATFORM_ENVIRONMENT")
    release_sha: str = Field("local", alias="PLATFORM_RELEASE_SHA")
    database_url: str = Field("sqlite+pysqlite:///./orkio_v2.db", alias="DATABASE_URL")
    allowed_origins: str = Field("http://localhost:5173", alias="PLATFORM_ALLOWED_ORIGINS")

    auth_mode: Literal["test","external_required","oidc_introspection"] = Field("external_required", alias="PLATFORM_AUTH_MODE")
    demo_headers_enabled: bool = Field(False, alias="PLATFORM_DEMO_IDENTITY_HEADERS_ENABLED")
    platform_owner_subject: str | None = Field(None, alias="PLATFORM_OWNER_SUBJECT")
    oidc_issuer: str | None = Field(None, alias="PLATFORM_OIDC_ISSUER")
    oidc_audience: str | None = Field(None, alias="PLATFORM_OIDC_AUDIENCE")
    oidc_introspection_endpoint: str | None = Field(None, alias="PLATFORM_OIDC_INTROSPECTION_ENDPOINT")
    oidc_introspection_client_id: str | None = Field(None, alias="PLATFORM_OIDC_INTROSPECTION_CLIENT_ID")
    oidc_introspection_client_secret: str | None = Field(None, alias="PLATFORM_OIDC_INTROSPECTION_CLIENT_SECRET")
    oidc_user_claim: str = Field("sub", alias="PLATFORM_OIDC_USER_CLAIM")
    oidc_tenant_claim: str = Field(
        "urn:zitadel:iam:user:resourceowner:id", alias="PLATFORM_OIDC_TENANT_CLAIM"
    )
    oidc_roles_claim: str = Field(
        "urn:zitadel:iam:org:project:roles", alias="PLATFORM_OIDC_ROLES_CLAIM"
    )
    oidc_http_timeout_seconds: float = Field(5, alias="PLATFORM_OIDC_HTTP_TIMEOUT_SECONDS")

    llm_primary_provider: Literal["openai","anthropic","google"] = Field(
        "openai", alias="PLATFORM_LLM_PRIMARY_PROVIDER"
    )
    llm_http_timeout_seconds: float = Field(30, alias="PLATFORM_LLM_HTTP_TIMEOUT_SECONDS")
    llm_provider_failover_enabled: bool = Field(
        False, alias="PLATFORM_LLM_PROVIDER_FAILOVER_ENABLED"
    )
    llm_auto_route_enabled: bool = Field(False, alias="PLATFORM_LLM_AUTO_ROUTE_ENABLED")

    openai_api_key: str | None = Field(None, alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-5", alias="OPENAI_DEFAULT_MODEL")
    openai_api_base: str | None = Field(None, alias="OPENAI_API_BASE")

    anthropic_api_key: str | None = Field(None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field("claude-sonnet-5", alias="ANTHROPIC_DEFAULT_MODEL")
    anthropic_api_base: str = Field(
        "https://api.anthropic.com/v1", alias="ANTHROPIC_API_BASE"
    )
    anthropic_max_tokens: int = Field(4096, alias="ANTHROPIC_MAX_TOKENS")

    google_api_key: str | None = Field(
        None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    )
    google_model: str = Field("gemini-3.6-flash", alias="GOOGLE_DEFAULT_MODEL")
    google_api_base: str = Field(
        "https://generativelanguage.googleapis.com/v1beta", alias="GOOGLE_API_BASE"
    )
    google_max_output_tokens: int = Field(4096, alias="GOOGLE_MAX_OUTPUT_TOKENS")

    founder_council_enabled: bool = Field(False, alias="PLATFORM_FOUNDER_COUNCIL_ENABLED")
    founder_council_min_configured_providers: int = Field(
        2, alias="PLATFORM_FOUNDER_COUNCIL_MIN_CONFIGURED_PROVIDERS"
    )
    realtime_streaming_enabled: bool = Field(True, alias="PLATFORM_REALTIME_STREAMING_ENABLED")

    invitation_secret: str = Field("development-only-change-me-32chars", alias="PLATFORM_INVITATION_TOKEN_SECRET")
    invitation_ttl_hours: int = Field(72, alias="PLATFORM_INVITATION_TTL_HOURS")
    invitation_base_url: str = Field("http://localhost:5173/invite", alias="PLATFORM_INVITATION_BASE_URL")

    artifacts_enabled: bool = Field(False, alias="PLATFORM_ARTIFACTS_ENABLED")
    artifact_storage_path: str = Field("./data/artifacts", alias="PLATFORM_ARTIFACT_STORAGE_PATH")
    max_upload_bytes: int = Field(10_000_000, alias="PLATFORM_MAX_UPLOAD_BYTES")

    document_context_enabled: bool = Field(True, alias="PLATFORM_DOCUMENT_CONTEXT_ENABLED")
    document_context_max_files: int = Field(6, alias="PLATFORM_DOCUMENT_CONTEXT_MAX_FILES")
    document_context_max_chars: int = Field(48_000, alias="PLATFORM_DOCUMENT_CONTEXT_MAX_CHARS")
    document_context_max_chars_per_file: int = Field(20_000, alias="PLATFORM_DOCUMENT_CONTEXT_MAX_CHARS_PER_FILE")
    document_context_max_pdf_pages: int = Field(40, alias="PLATFORM_DOCUMENT_CONTEXT_MAX_PDF_PAGES")

    github_enabled: bool = Field(False, alias="PLATFORM_GITHUB_INTEGRATION_ENABLED")
    github_read_only: bool = Field(True, alias="PLATFORM_GITHUB_READ_ONLY")
    github_allowed_repositories: str = Field("", alias="PLATFORM_GITHUB_ALLOWED_REPOSITORIES")
    github_api_base: str = Field("https://api.github.com", alias="PLATFORM_GITHUB_API_BASE")
    github_read_token: str = Field("", alias="PLATFORM_GITHUB_READ_TOKEN")
    github_http_timeout_seconds: float = Field(5.0, alias="PLATFORM_GITHUB_HTTP_TIMEOUT_SECONDS")
    github_max_file_bytes: int = Field(250000, alias="PLATFORM_GITHUB_MAX_FILE_BYTES")
    github_max_tree_entries: int = Field(5000, alias="PLATFORM_GITHUB_MAX_TREE_ENTRIES")
    github_snapshot_max_files: int = Field(8, alias="PLATFORM_GITHUB_SNAPSHOT_MAX_FILES")
    github_snapshot_max_chars: int = Field(60000, alias="PLATFORM_GITHUB_SNAPSHOT_MAX_CHARS")

    voice_enabled: bool = Field(False, alias="PLATFORM_REALTIME_VOICE_ENABLED")
    voice_provider: str = Field("disabled", alias="PLATFORM_VOICE_PROVIDER")

    stt_enabled: bool = Field(False, alias="PLATFORM_STT_ENABLED")
    stt_provider: Literal["disabled","faster_whisper"] = Field(
        "disabled", alias="PLATFORM_STT_PROVIDER"
    )
    stt_model: str = Field("small", alias="PLATFORM_STT_MODEL")
    stt_device: Literal["cpu","cuda","auto"] = Field("cpu", alias="PLATFORM_STT_DEVICE")
    stt_compute_type: str = Field("int8", alias="PLATFORM_STT_COMPUTE_TYPE")
    stt_max_upload_bytes: int = Field(8_000_000, alias="PLATFORM_STT_MAX_UPLOAD_BYTES")
    stt_allowed_languages: str = Field("pt,en,es", alias="PLATFORM_STT_ALLOWED_LANGUAGES")
    stt_model_cache_dir: str = Field(
        "/opt/orkio/models/faster-whisper",
        alias="PLATFORM_STT_MODEL_CACHE_DIR",
    )
    stt_local_files_only: bool = Field(False, alias="PLATFORM_STT_LOCAL_FILES_ONLY")
    stt_timeout_seconds: float = Field(0.0, alias="PLATFORM_STT_TIMEOUT_SECONDS")
    stt_concurrency_limit: int = Field(0, alias="PLATFORM_STT_CONCURRENCY_LIMIT")

    assisted_evolution_enabled: bool = Field(False, alias="PLATFORM_ASSISTED_EVOLUTION_ENABLED")
    evolution_execution_allowed: bool = Field(False, alias="PLATFORM_EVOLUTION_EXECUTION_ALLOWED")
    human_approval_required: bool = Field(True, alias="PLATFORM_EVOLUTION_HUMAN_APPROVAL_REQUIRED")

    @field_validator("invitation_secret")
    @classmethod
    def validate_secret(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("PLATFORM_INVITATION_TOKEN_SECRET must contain at least 32 characters")
        return value

    @model_validator(mode="after")
    def secure_modes(self):
        if self.environment == "production" and self.demo_headers_enabled:
            raise ValueError("DEMO_IDENTITY_HEADERS_FORBIDDEN_IN_PRODUCTION")
        if self.auth_mode == "oidc_introspection":
            required = [
                self.oidc_issuer, self.oidc_audience, self.oidc_introspection_endpoint,
                self.oidc_introspection_client_id, self.oidc_introspection_client_secret,
            ]
            if not all(required):
                raise ValueError("OIDC_CONFIGURATION_INCOMPLETE")
        if not self.github_read_only:
            raise ValueError("GITHUB_WRITE_MODE_FORBIDDEN")
        if self.github_enabled and not self.github_allowed_repositories.strip():
            raise ValueError("GITHUB_ALLOWED_REPOSITORIES_REQUIRED")
        if self.github_enabled and self.github_api_base.rstrip("/") != "https://api.github.com":
            raise ValueError("GITHUB_API_BASE_FORBIDDEN")
        if (
            self.github_http_timeout_seconds <= 0
            or self.github_max_file_bytes <= 0
            or self.github_max_tree_entries <= 0
            or self.github_snapshot_max_files <= 0
            or self.github_snapshot_max_chars <= 0
        ):
            raise ValueError("GITHUB_READ_LIMITS_INVALID")
        if self.voice_enabled and self.voice_provider == "disabled":
            raise ValueError("VOICE_PROVIDER_REQUIRED")
        if self.stt_enabled and self.stt_provider == "disabled":
            raise ValueError("STT_PROVIDER_REQUIRED")
        if self.stt_max_upload_bytes <= 0:
            raise ValueError("STT_MAX_UPLOAD_BYTES_INVALID")
        if not self.stt_model_cache_dir.strip():
            raise ValueError("STT_MODEL_CACHE_DIR_REQUIRED")
        if self.stt_enabled and self.stt_timeout_seconds <= 0:
            raise ValueError("STT_TIMEOUT_SECONDS_REQUIRED")
        if self.stt_enabled and self.stt_concurrency_limit <= 0:
            raise ValueError("STT_CONCURRENCY_LIMIT_REQUIRED")
        if self.environment == "production" and self.stt_enabled and not self.stt_local_files_only:
            raise ValueError("STT_PRODUCTION_REQUIRES_PREWARMED_LOCAL_MODEL")
        allowed_languages = {
            item.strip().lower()
            for item in self.stt_allowed_languages.split(",")
            if item.strip()
        }
        if not allowed_languages or not allowed_languages.issubset({"pt", "en", "es"}):
            raise ValueError("STT_ALLOWED_LANGUAGES_INVALID")
        if self.llm_provider_failover_enabled:
            raise ValueError("LLM_PROVIDER_FAILOVER_FORBIDDEN_UNTIL_GOVERNED")
        if self.llm_auto_route_enabled:
            raise ValueError("LLM_AUTO_ROUTE_FORBIDDEN_UNTIL_GOVERNED")
        if self.founder_council_min_configured_providers < 2:
            raise ValueError("FOUNDER_COUNCIL_REQUIRES_AT_LEAST_TWO_PROVIDERS")
        if self.anthropic_max_tokens <= 0 or self.google_max_output_tokens <= 0:
            raise ValueError("LLM_PROVIDER_MAX_TOKENS_INVALID")
        if self.llm_http_timeout_seconds <= 0:
            raise ValueError("PLATFORM_LLM_HTTP_TIMEOUT_SECONDS_INVALID")
        if self.evolution_execution_allowed:
            raise ValueError("AUTOEVOLUTION_EXECUTION_FORBIDDEN_BY_DEFAULT")
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
