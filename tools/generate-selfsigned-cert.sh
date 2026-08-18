#!/usr/bin/env bash
set -euo pipefail
OUT_DIR=${1:-./certs}
PFX_PASS=${2:-}

mkdir -p "$OUT_DIR"

echo "Generating self-signed certs into $OUT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$OUT_DIR/key.pem" \
  -out "$OUT_DIR/cert.pem" \
  -subj "/CN=localhost"

if [ -n "$PFX_PASS" ]; then
  echo "Creating PKCS#12 (PFX) with passphrase"
  openssl pkcs12 -export -out "$OUT_DIR/cert.pfx" -inkey "$OUT_DIR/key.pem" -in "$OUT_DIR/cert.pem" -password pass:"$PFX_PASS"
fi

echo "Created:"
ls -l "$OUT_DIR" || true

echo "Instructions: copy $OUT_DIR/cert.pem and key.pem to /etc/simplebeacon/tls/ and set AGENT_CAPABILITIES_TLS_CERT and AGENT_CAPABILITIES_TLS_KEY accordingly."
