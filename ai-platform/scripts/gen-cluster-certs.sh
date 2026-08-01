#!/usr/bin/env bash
#
# gen-cluster-certs.sh — Generate self-signed mTLS certificates for the
# cluster keyring sync transport (Tracks 6-8).
#
# Produces:
#   certs/cluster-ca.crt       — CA certificate
#   certs/cluster-ca.key       — CA private key
#   certs/cluster-server.crt   — server certificate (signed by CA)
#   certs/cluster-server.key   — server private key
#   certs/cluster-client.crt   — client certificate (signed by CA)
#   certs/cluster-client.key   — client private key
#
# Usage:
#   ./scripts/gen-cluster-certs.sh [output-dir]
#
# Default output dir: ./certs
#
# Environment variables:
#   CLUSTER_CERT_DAYS   — cert validity in days (default: 365)
#   CLUSTER_CERT_KEYLEN — RSA key length in bits (default: 2048)
#   CLUSTER_CERT_CN     — common name (default: cluster.simplebeacon.internal)
#
# WARNING: These are self-signed certificates for STAGING ONLY.
#          Production deployments MUST use a real CA (e.g. Vault PKI,
#          cert-manager, or an internal PKI service).
#
# Requirements: openssl 1.1.1+ or 3.x

set -euo pipefail

OUTPUT_DIR="${1:-./certs}"
DAYS="${CLUSTER_CERT_DAYS:-365}"
KEYLEN="${CLUSTER_CERT_KEYLEN:-2048}"
CN="${CLUSTER_CERT_CN:-cluster.simplebeacon.internal}"

mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"

echo "=== Generating cluster mTLS certificates in $(pwd) ==="
echo "    Validity: ${DAYS} days"
echo "    Key length: ${KEYLEN} bits"
echo "    Common Name: ${CN}"
echo ""

# ── 1. Generate CA ────────────────────────────────────────────────────────
echo "[1/3] Generating CA key and certificate..."
openssl genrsa -out cluster-ca.key "$KEYLEN" 2>/dev/null
openssl req -x509 -new -nodes \
  -key cluster-ca.key \
  -days "$DAYS" \
  -out cluster-ca.crt \
  -subj "/CN=SimpleBeacon Cluster CA/O=SimpleBeacon/OU=Cluster Sync" \
  2>/dev/null
echo "    ✓ cluster-ca.crt + cluster-ca.key"

# ── 2. Generate server certificate ────────────────────────────────────────
echo "[2/3] Generating server key and certificate..."
openssl genrsa -out cluster-server.key "$KEYLEN" 2>/dev/null

# Create a server CSR with SANs for localhost and the configured CN
cat > _server-ext.cnf <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${CN}
O = SimpleBeacon
OU = Cluster Sync

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = ${CN}
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

openssl req -new \
  -key cluster-server.key \
  -out cluster-server.csr \
  -config _server-ext.cnf \
  2>/dev/null

openssl x509 -req \
  -in cluster-server.csr \
  -CA cluster-ca.crt \
  -CAkey cluster-ca.key \
  -CAcreateserial \
  -out cluster-server.crt \
  -days "$DAYS" \
  -extensions v3_req \
  -extfile _server-ext.cnf \
  2>/dev/null

rm -f cluster-server.csr _server-ext.cnf cluster-ca.srl
echo "    ✓ cluster-server.crt + cluster-server.key"

# ── 3. Generate client certificate ────────────────────────────────────────
echo "[3/3] Generating client key and certificate..."
openssl genrsa -out cluster-client.key "$KEYLEN" 2>/dev/null

cat > _client-ext.cnf <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = cluster-client
O = SimpleBeacon
OU = Cluster Sync

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

openssl req -new \
  -key cluster-client.key \
  -out cluster-client.csr \
  -config _client-ext.cnf \
  2>/dev/null

openssl x509 -req \
  -in cluster-client.csr \
  -CA cluster-ca.crt \
  -CAkey cluster-ca.key \
  -CAcreateserial \
  -out cluster-client.crt \
  -days "$DAYS" \
  -extensions v3_req \
  -extfile _client-ext.cnf \
  2>/dev/null

rm -f cluster-client.csr _client-ext.cnf cluster-ca.srl
echo "    ✓ cluster-client.crt + cluster-client.key"

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "=== Certificate generation complete ==="
echo ""
echo "Files in $(pwd):"
ls -la cluster-*.crt cluster-*.key 2>/dev/null | awk '{print "  " $9 " (" $5 " bytes)"}'
echo ""
echo "To enable mTLS on the cluster keyring transport, set:"
echo "  export CLUSTER_CERT=$(pwd)/cluster-server.crt"
echo "  export CLUSTER_KEY=$(pwd)/cluster-server.key"
echo "  export CLUSTER_CA_CERT=$(pwd)/cluster-ca.crt"
echo ""
echo "To enable the quantum-resistant hybrid handshake (Track 6):"
echo "  export CLUSTER_QUANTUM_HYBRID=1"
echo ""
echo "⚠  WARNING: Self-signed certificates are for STAGING ONLY."
echo "   Use a real CA (Vault PKI, cert-manager, internal PKI) for production."
