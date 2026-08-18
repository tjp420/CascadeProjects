#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CERT_DIR="$ROOT_DIR/certs"
IMAGE_NAME=${IMAGE_NAME:-simplebeacon-agent-capabilities}
CONTAINER_NAME=${CONTAINER_NAME:-agent-capabilities}
HOST_PORT=${HOST_PORT:-3007}
CONTAINER_PORT=${CONTAINER_PORT:-3007}
TOKEN=${TOKEN:-supersecret}
TLS_CERT_ENV=${TLS_CERT_ENV:-/etc/simplebeacon/tls/cert.pem}
TLS_KEY_ENV=${TLS_KEY_ENV:-/etc/simplebeacon/tls/key.pem}

echo "Using cert dir: $CERT_DIR"
mkdir -p "$CERT_DIR"

# Ensure Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Please install/start Docker and re-run." >&2
  exit 2
fi

# Build image
echo "Building Docker image $IMAGE_NAME..."
docker build -f tools/Dockerfile.agent-capabilities -t "$IMAGE_NAME" .

# Generate certs if missing (uses lightweight OpenSSL Docker image)
if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
  echo "Generating self-signed certs into $CERT_DIR using temporary OpenSSL container..."
  docker run --rm -v "$CERT_DIR":/out frapsoft/openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /out/key.pem -out /out/cert.pem -subj "/CN=localhost"
fi

# Stop+remove any existing container
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Run container
echo "Starting container $CONTAINER_NAME..."
docker run -d --name "$CONTAINER_NAME" -p ${HOST_PORT}:${CONTAINER_PORT} \
  -v "$CERT_DIR":/etc/simplebeacon/tls:ro \
  -e AGENT_CAPABILITIES_PORT=${CONTAINER_PORT} \
  -e METRICS_AUTH_TOKEN=${TOKEN} \
  -e AGENT_CAPABILITIES_TLS_CERT=${TLS_CERT_ENV} \
  -e AGENT_CAPABILITIES_TLS_KEY=${TLS_KEY_ENV} \
  "$IMAGE_NAME"

echo "Waiting for HTTPS metrics endpoint to become healthy (https://localhost:${HOST_PORT}/metrics)..."
i=0
done
docker logs -n 200 "$CONTAINER_NAME" >&2 || true
echo "Waiting for HTTPS metrics endpoint to become healthy (https://localhost:${HOST_PORT}/metrics)..."
MAX_ATTEMPTS=${MAX_ATTEMPTS:-8}
attempt=0
delay=1
while [ $attempt -lt $MAX_ATTEMPTS ]; do
  http_code=$(curl -k -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "https://localhost:${HOST_PORT}/metrics" || true)
  if [ "$http_code" = "200" ]; then
    echo "Endpoint is healthy."
    echo "You can query: curl -k -H \"Authorization: Bearer ${TOKEN}\" https://localhost:${HOST_PORT}/metrics?format=prometheus"
    exit 0
  fi
  echo "Attempt $((attempt+1))/$MAX_ATTEMPTS: endpoint not ready (http $http_code). Retrying in ${delay}s..."
  sleep $delay
  attempt=$((attempt+1))
  # exponential backoff with jitter
  delay=$((delay * 2))
  if [ $delay -gt 30 ]; then delay=30; fi
done

echo "Timed out waiting for healthy endpoint after ${MAX_ATTEMPTS} attempts. See container logs:" >&2
docker logs -n 200 "$CONTAINER_NAME" >&2 || true
exit 3
