#!/usr/bin/env bash
# publish-image.sh IMAGE[:TAG] REGISTRY
# Requires DOCKER_USERNAME and DOCKER_PASSWORD (or uses existing docker login session)
set -euo pipefail
if [ "${1:-}" = "--slim" ]; then
  DOCKERFILE=tools/Dockerfile.agent-capabilities.slim
  IMAGE=${2:-simplebeacon-agent-capabilities-slim:latest}
  REGISTRY=${3:-}
  echo "Building slim image using $DOCKERFILE"
  docker build -f "$DOCKERFILE" -t "$IMAGE" .
else
  IMAGE=${1:-simplebeacon-agent-capabilities:latest}
  REGISTRY=${2:-}
fi

if [ -z "$REGISTRY" ]; then
  echo "Usage: $0 IMAGE[:TAG] REGISTRY" >&2
  echo "Example: $0 simplebeacon-agent-capabilities:latest registry.hub.docker.com/youruser" >&2
  exit 2
fi

TARGET="$REGISTRY/$(basename "$IMAGE")"

echo "Tagging $IMAGE -> $TARGET"
docker tag "$IMAGE" "$TARGET"

if [ -n "${DOCKER_USERNAME:-}" ] && [ -n "${DOCKER_PASSWORD:-}" ]; then
  echo "Logging in to $REGISTRY"
  echo "$DOCKER_PASSWORD" | docker login $REGISTRY -u "$DOCKER_USERNAME" --password-stdin
else
  echo "DOCKER_USERNAME/DOCKER_PASSWORD not set; attempting to push with existing docker session (ensure you are logged in)."
fi

echo "Pushing $TARGET"
docker push "$TARGET"

echo "Published $TARGET"
