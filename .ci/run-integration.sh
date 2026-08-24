#!/usr/bin/env bash
set -euo pipefail

echo "CI integration runner: installing deps and running integration tests"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "Waiting for Postgres and Redis to be available..."
# wait for Postgres
for i in {1..30}; do
  if bash -c "</dev/tcp/${PGHOST:-postgres}/${PGPORT:-5432}" &>/dev/null; then
    echo "Postgres reachable"
    break
  fi
  echo "Waiting for Postgres... ($i)"
  sleep 2
done
# wait for Redis
for i in {1..30}; do
  if bash -c "</dev/tcp/${REDIS_HOST:-redis}/${REDIS_PORT:-6379}" &>/dev/null; then
    echo "Redis reachable"
    break
  fi
  echo "Waiting for Redis... ($i)"
  sleep 2
done

# Install lightweight runtime dependencies locally (no-save) for the connectivity check
npm install pg ioredis --no-save

if npm run | grep -q "test:integration"; then
  echo "Running npm run test:integration"
  npm run test:integration
else
  echo "No 'test:integration' script in package.json. Running connectivity check (.ci/check_services.js)."
  node .ci/check_services.js
fi

echo "Integration runner finished"
