# Recovery overlay — Backend documentos/Markdown

## Incident cause

The failed Railway build did not contain a complete backend source tree.
Its Docker smoke attempted:

`import orkio_v2.main`

but `src/orkio_v2/main.py` was absent, causing:

`ModuleNotFoundError: No module named 'orkio_v2.main'`.

## Important

This package is **incremental only**.

It contains exactly 3 files:

- `src/orkio_v2/routes.py`
- `src/orkio_v2/services/artifact_generation.py`
- `tests/test_artifact_generation_r037.py`

Do **not** upload this ZIP directly to Railway as a backend service source.
Do **not** delete or replace the existing repository tree with this package.

## Required base

Repository:

`https://github.com/patroaiconsultech/Plataforma-Efata-777-Backend`

Expected base commit:

`d2ffe9a589cd6374beaffe0455fb084138ed6dd3`

Before applying, the full repository must still contain at least:

- `src/orkio_v2/main.py`
- `src/orkio_v2/models.py`
- `src/orkio_v2/database.py`
- `src/orkio_v2/config.py`
- `src/orkio_v2/realtime_routes.py`
- `src/orkio_v2/team_routes.py`
- `src/orkio_v2/voice_routes.py`
- `src/orkio_v2/tts_routes.py`

## Safe application

Apply/overwrite only the three listed files in the existing full repository.

If working locally:

1. checkout the required base commit;
2. run `PRE_APPLY_BASELINE_GUARD.sh`;
3. copy the three overlay files preserving paths;
4. run compile/test/security gates;
5. commit to a controlled branch;
6. deploy from the full Git repository, not this overlay ZIP.

## Current incident status

The previously published Railway backend remains healthy; the new candidate build failed before replacing it.
No migration is included in this overlay.

## Acceptance before promotion

At minimum:

- `python -m compileall -q src tests`
- full pytest
- `python -c "import orkio_v2.main"`
- Docker build/import smoke
- `/api/v2/health` 200 after staged deploy
- release SHA present and correct
