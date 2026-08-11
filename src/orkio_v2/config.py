from functools import lru_cache
from typing import Literal
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: Literal["development","test","staging","production"] = Field("development", alias="PLATFORM_ENVIRONMENT")
    release_sha: str = Field("local", alias="PLATFORM_RELEASE_SHA")
    database_url: str = Field("sqlite+pysqlite:///./orkio_v2.db", alias="DATABASE_URL")
    allowed_origins: str = Field("http://localhost:5173", alias="PLATFORM_ALLOWED_ORIGINS")

    auth_mode: Literal["test","external_required","oidc_introspection"] = Field("external_required", alias="PLATFORM_AUTH_MODE")
    demo_headers_enabled: bool = Field(False, alias="PLATFORM_DEMO_IDENTITY_HEADERS_ENABLED")
    oidc_issuer: str | None = Field(None, alias="PLATFORM_OIDC_ISSUER")
    oidc_audience: str | None = Field(None, alias="PLATFORM_OIDC_AUDIENCE")
    oidc_introspection_endpoint: str | None = Field(None, alias="PLATFORM_OIDC_INTROSPECTION_ENDPOINT")
    oidc_introspection_client_id: str | None = Field(None, alias="PLATFORM_OIDC_INTROSPECTION_CLIENT_ID")
    oidc_introspection_client_secret: str | None = Field(None, alias="PLATFORM_OIDC_INTROSPECTION_CLIENT_SECRET")
    oidc_user_claim: str = Field("sub", alias="PLATFORM_OIDC_USER_CLAIM")
    oidc_tenant_claim: str = Field("tenant_id", alias="PLATFORM_OIDC_TENANT_CLAIM")
    oidc_roles_claim: str = Field("roles", alias="PLATFORM_OIDC_ROLES_CLAIM")
    oidc_http_timeout_seconds: float = Field(5, alias="PLATFORM_OIDC_HTTP_TIMEOUT_SECONDS")

    openai_api_key: str | None = Field(None, alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o-mini", alias="OPENAI_DEFAULT_MODEL")
    openai_api_base: str | None = Field(None, alias="OPENAI_API_BASE")
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

    voice_enabled: bool = Field(False, alias="PLATFORM_REALTIME_VOICE_ENABLED")
    voice_provider: str = Field("disabled", alias="PLATFORM_VOICE_PROVIDER")

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
        if self.voice_enabled and self.voice_provider == "disabled":
            raise ValueError("VOICE_PROVIDER_REQUIRED")
        if self.evolution_execution_allowed:
            raise ValueError("AUTOEVOLUTION_EXECUTION_FORBIDDEN_BY_DEFAULT")
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
