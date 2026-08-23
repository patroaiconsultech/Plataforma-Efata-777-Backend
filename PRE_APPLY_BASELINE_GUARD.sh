#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_BASE="d2ffe9a589cd6374beaffe0455fb084138ed6dd3"

CURRENT="$(git rev-parse HEAD)"
echo "CURRENT_HEAD=$CURRENT"
echo "EXPECTED_BASE=$EXPECTED_BASE"

if [[ "$CURRENT" != "$EXPECTED_BASE" ]]; then
  echo "ABORT: baseline commit mismatch"
  exit 71
fi

required=(
  "src/orkio_v2/main.py"
  "src/orkio_v2/models.py"
  "src/orkio_v2/database.py"
  "src/orkio_v2/config.py"
  "src/orkio_v2/routes.py"
  "src/orkio_v2/realtime_routes.py"
  "src/orkio_v2/team_routes.py"
  "src/orkio_v2/voice_routes.py"
  "src/orkio_v2/tts_routes.py"
  "src/orkio_v2/services"
)

for path in "${required[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "ABORT: missing critical backend path: $path"
    exit 72
  fi
done

python - <<'PY'
import sys
from pathlib import Path
required = [
    Path("src/orkio_v2/main.py"),
    Path("src/orkio_v2/models.py"),
    Path("src/orkio_v2/database.py"),
    Path("src/orkio_v2/config.py"),
]
for p in required:
    if not p.exists():
        raise SystemExit(f"ABORT: missing {p}")
print("FULL_BACKEND_BASELINE_GUARD=PASS")
PY
