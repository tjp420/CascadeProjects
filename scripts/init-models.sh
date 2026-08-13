#!/bin/bash
set -e

echo "[SimpleBeacon] Starting Ollama initialization..."

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "[SimpleBeacon] Waiting for Ollama daemon..."
for i in $(seq 1 60); do
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[SimpleBeacon] Ollama daemon is ready."
    break
  fi
  if [ $i -eq 60 ]; then
    echo "[SimpleBeacon] WARN: Ollama daemon not ready after 60s — continuing anyway."
    break
  fi
  sleep 1
done

# Pull base models (requires internet on build machine)
# In air-gapped mode, base models should be pre-loaded before packaging
# Skip pulling if SIMPLEBEACON_OFFLINE is set or if models already exist
if [ "${SIMPLEBEACON_OFFLINE:-false}" = "true" ]; then
  echo "[SimpleBeacon] SIMPLEBEACON_OFFLINE=true — skipping base model pulls (air-gapped mode)."
  echo "[SimpleBeacon] Models should be pre-loaded in the ollama-models volume."
else
  echo "[SimpleBeacon] Pulling base models from Ollama registry..."
  for model in llama3.2 mistral qwen2.5-coder; do
    # Check if model already exists before pulling
    if curl -s http://localhost:11434/api/tags | grep -q "\"$model\""; then
      echo "[SimpleBeacon]   $model already exists — skipping pull."
    else
      echo "[SimpleBeacon]   Pulling $model..."
      ollama pull "$model" 2>&1 || echo "[SimpleBeacon]   WARN: Failed to pull $model — it may need to be pulled manually."
    fi
  done
fi

# Create SimpleBeacon-optimized models from Modelfiles
echo "[SimpleBeacon] Creating SimpleBeacon-optimized models from Modelfiles..."

# Create unbreakable-oracle (default model — based on llama3.2)
if curl -s http://localhost:11434/api/tags | grep -q "unbreakable-oracle"; then
  echo "[SimpleBeacon] unbreakable-oracle already exists — skipping."
else
  echo "[SimpleBeacon] Creating unbreakable-oracle..."
  ollama create unbreakable-oracle -f /models/Modelfile 2>&1 || \
    echo "[SimpleBeacon] WARN: Failed to create unbreakable-oracle — base model may need to be pulled first."
fi

# Create simplebeacon-llama32
if curl -s http://localhost:11434/api/tags | grep -q "simplebeacon-llama32"; then
  echo "[SimpleBeacon] simplebeacon-llama32 already exists — skipping."
else
  echo "[SimpleBeacon] Creating simplebeacon-llama32..."
  ollama create simplebeacon-llama32 -f /models/Modelfile.llama32 2>&1 || \
    echo "[SimpleBeacon] WARN: Failed to create simplebeacon-llama32."
fi

# Create simplebeacon-mistral
if curl -s http://localhost:11434/api/tags | grep -q "simplebeacon-mistral"; then
  echo "[SimpleBeacon] simplebeacon-mistral already exists — skipping."
else
  echo "[SimpleBeacon] Creating simplebeacon-mistral..."
  ollama create simplebeacon-mistral -f /models/Modelfile.mistral 2>&1 || \
    echo "[SimpleBeacon] WARN: Failed to create simplebeacon-mistral."
fi

# Create simplebeacon-qwen-coder
if curl -s http://localhost:11434/api/tags | grep -q "simplebeacon-qwen-coder"; then
  echo "[SimpleBeacon] simplebeacon-qwen-coder already exists — skipping."
else
  echo "[SimpleBeacon] Creating simplebeacon-qwen-coder..."
  ollama create simplebeacon-qwen-coder -f /models/Modelfile.qwen25-coder 2>&1 || \
    echo "[SimpleBeacon] WARN: Failed to create simplebeacon-qwen-coder."
fi

echo "[SimpleBeacon] Model initialization complete."
echo "[SimpleBeacon] Available models:"
ollama list

# Bring Ollama to foreground
wait $OLLAMA_PID
