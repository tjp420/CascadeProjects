# GGUF Integration Guide

## Overview

This guide covers configuring LLAMA_CPP_BIN or Ollama for live GGUF roadmap enhancement in Simplebeacon.

## Prerequisites

- Ollama installed locally or accessible via network
- GGUF model files downloaded
- Optional: llama.cpp compiled binary

## Configuration

### Option 1: Ollama (Recommended)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3

# Set environment variable
export OLLAMA_HOST=http://localhost:11434
```

### Option 2: llama.cpp Binary

```bash
# Clone and build llama.cpp
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
make

# Set environment variable
export LLAMA_CPP_BIN=/path/to/llama.cpp/main
```

## Environment Variables

Add to `.env.v1-internal` or `.env.production`:

```env
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

# OR llama.cpp Configuration
LLAMA_CPP_BIN=/path/to/llama.cpp/main
LLAMA_CPP_MODEL=/path/to/model.gguf
```

## Usage

Once configured, the roadmap generator will use GGUF for:

- Semantic similarity hints
- Fuzzy pair detection
- Code intelligence insights

## Verification

```bash
# Test Ollama connection
curl http://localhost:11434/api/tags

# Test llama.cpp
$LLAMA_CPP_BIN --version
```

## Troubleshooting

- **Connection refused**: Ensure Ollama service is running
- **Model not found**: Verify model is pulled via `ollama list`
- **Binary not found**: Check LLAMA_CPP_BIN path is correct
