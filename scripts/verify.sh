#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.." || exit 1

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

annotate_failures() {
  [ -n "${GITHUB_ACTIONS:-}" ] || return 0
  grep -E 'error TS[0-9]+' "$LOG" | head -20 | sed 's/^/::error::/'
  awk '
    /^[[:space:]]*not ok/ { block = $0; open = 1; next }
    open && /^[[:space:]]*\.\.\./ { gsub(/[[:space:]]+/, " ", block); print "::error::" substr(block, 1, 900); open = 0; next }
    open && !/duration_ms|^[[:space:]]*type:|^[[:space:]]*---|failureType|^[[:space:]]*code:|^[[:space:]]*stack:/ { block = block " | " $0 }
  ' "$LOG" | head -20
}

stage() {
  "$@" 2>&1 | tee "$LOG"
  local status="${PIPESTATUS[0]}"
  if [ "$status" -ne 0 ]; then
    annotate_failures
    echo "GATE FAIL"
    exit "$status"
  fi
}

cd apps/mobile || exit 1
stage npx tsc --noEmit
stage node --test "src/**/*.test.ts"

cd ../../catalog-data || exit 1
stage npx tsc -p .
stage node --test "test/**/*.test.ts"

echo "GATE OK"
