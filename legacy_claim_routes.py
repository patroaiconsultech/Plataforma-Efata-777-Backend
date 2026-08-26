from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import Principal, require_principal
from .config import Settings, get_settings
from .database import get_db
from .schemas import LegacyClaimImportRequest
from .services.legacy_claim import LegacyClaimError, claim_status, import_context


router = APIRouter(prefix="/api/v2/legacy-claim", tags=["legacy-claim"])


def _status_for(code: str) -> int:
    if code in {"LEGACY_CLAIM_DISABLED", "LEGACY_ACCOUNT_NOT_FOUND"}:
        return 404
    if code in {"CLAIM_EMAIL_VERIFICATION_REQUIRED", "LEGACY_ACCOUNT_ALREADY_LINKED", "LEGACY_TENANT_NOT_MAPPED"}:
        return 409
    if code in {"LEGACY_DATABASE_NOT_CONFIGURED", "LEGACY_CLAIM_IMPORT_FAILED"}:
        return 503
    return 403


@router.get("/status")
def legacy_claim_status(
    principal: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    try:
        return claim_status(db, principal=principal, settings=settings)
    except LegacyClaimError as exc:
        raise HTTPException(_status_for(exc.code), exc.code) from exc


@router.post("/import")
def legacy_claim_import(
    payload: LegacyClaimImportRequest,
    principal: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    try:
        return import_context(
            db,
            principal=principal,
            settings=settings,
            consent_version=payload.consent_version,
        )
    except LegacyClaimError as exc:
        raise HTTPException(_status_for(exc.code), exc.code) from exc
