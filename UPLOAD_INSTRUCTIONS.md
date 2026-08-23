# PATROAI NATIVE AUTH P0 — Upload Only V1

## Purpose
Contain AUTH-001: implicit account linking by email.

## Upload only these repository files
1. `src/orkio_v2/auth_routes.py`
2. `tests/test_native_auth_account_claim_p0.py`

Do not upload this ZIP as a standalone Railway application.
Do not delete any other repository files.
Do not run migrations.

## Expected code behavior
For an existing `User` with no `NativeCredential`, `/api/v2/auth/register`
must return:

`409 ACCOUNT_CLAIM_REQUIRED`

before onboarding, credential creation, membership mutation, grant redemption,
session creation or login.

Existing native accounts must remain:

`409 NATIVE_ACCOUNT_ALREADY_EXISTS`

Brand-new identities must keep the normal onboarding flow.

## Governance
Recommended target: a dedicated branch, not production/main first.
Run the repository CI / Python 3.12 suite before merge.

No migration is required for this containment patch.
