#!/usr/bin/env sh
# Wrapper for legacy Husky wiring — delegates to Simplebeacon pre-push checks.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec sh "$ROOT/scripts/samplebeacon-pre-push.sh"
