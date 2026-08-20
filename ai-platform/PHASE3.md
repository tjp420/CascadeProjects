# Phase 3: Optional GGUF Semantic Hints

Phase 3 adds an optional semantic-hints surface to the code roadmap. The
filesystem scan always measures fuzzy token-similarity pairs. When
`LLAMA_CPP_BIN` is configured, the roadmap marks the optional GGUF path as
available and exposes advisory review hints for eligible pairs. The roadmap
scan does not run an embedding model during the filesystem pass.

## Enable the optional path

Set the llama.cpp executable and, where local model services are used, the
model registry directory:

```dotenv
LLAMA_CPP_BIN=/usr/local/bin/llama-cli
LOCAL_MODELS_DIR=/path/to/local-models
LLAMA_CPP_MAX_TOKENS=512
LLAMA_CPP_TIMEOUT_MS=45000
MAX_GGUF_UPLOAD_BYTES=8589934592
```

`LLAMA_CPP_MAX_TOKENS` and `LLAMA_CPP_TIMEOUT_MS` apply to llama.cpp
inference services. `LOCAL_MODELS_DIR` selects the local model registry and
upload location, and `MAX_GGUF_UPLOAD_BYTES` controls GGUF upload size.
`ENABLE_GGUF_ISSUES_API` controls the optional GGUF issues API. The local
model helper can be checked with:

```bash
node ai-platform/scripts/setup-local-model.cjs --verify
```

## Run a roadmap scan

From the repository root:

```bash
node ai-platform/scripts/run-roadmap-generator.cjs
node ai-platform/scripts/run-roadmap-generator.cjs --path /path/to/project --out /path/to/roadmap.json
```

The default output is
`ai-platform/data/roadmap/dynamic-roadmap-last-scan.json`. Without
`LLAMA_CPP_BIN`, the summary reports for example:

```text
semanticHints: enabled=false mode=filesystem-only hint count=0
```

With a configured executable it reports `enabled=true` and either
`mode=llama-cpp-ready` or `mode=llama-cpp-path-missing`, along with the
number of advisory hints:

```text
semanticHints: enabled=true mode=llama-cpp-ready hint count=2
```

Hints are advisory review candidates, not model-generated similarity scores or
refactoring instructions. The fuzzy threshold remains intentionally
conservative at `0.92` so generated boilerplate test files do not flood the
results.
