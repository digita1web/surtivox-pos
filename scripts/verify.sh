#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.." || exit 1
cd apps/mobile || exit 1

npx tsc --noEmit
status=$?

if [ "$status" -ne 0 ]; then
  echo "GATE FAIL"
  exit "$status"
fi

node --test "src/**/*.test.ts"
status=$?

if [ "$status" -ne 0 ]; then
  echo "GATE FAIL"
  exit "$status"
fi

cd ../../catalog-data || exit 1

npx tsc -p .
status=$?

if [ "$status" -ne 0 ]; then
  echo "GATE FAIL"
  exit "$status"
fi

node --test "test/**/*.test.ts"
status=$?

if [ "$status" -ne 0 ]; then
  echo "GATE FAIL"
  exit "$status"
fi

echo "GATE OK"
