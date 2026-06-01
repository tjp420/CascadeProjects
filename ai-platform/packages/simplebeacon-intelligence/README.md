# @simplebeacon/intelligence

Opt-in **Hybrid Local Intelligence** for SimpleBeacon. Runs entirely on the developer machine — no source upload, no API keys.

## Tiers

| Tier | Engine | When |
|------|--------|------|
| **1a** | Deterministic structural scanner | Always (zero extra deps) |
| **1b** | Tree-sitter WASM | When `web-tree-sitter` + grammar `.wasm` files are present |
| **2** | Local SLM (`LLAMA_CPP_BIN`) | High-risk snippets only, opt-in |

## Install

```bash
npm install -D @simplebeacon/intelligence
```

Enable in `.simplebeacon/config.json`:

```json
{
  "intelligence": {
    "enabled": true,
    "languages": ["javascript", "typescript", "python"],
    "genericVarThreshold": 0.6
  }
}
```

## Tree-sitter grammars (optional)

```bash
cd node_modules/@simplebeacon/intelligence && npm run fetch-grammars
```

Grammars land in `grammars/*.wasm`. Without them, Tier 1a structural analysis still runs.

## Local SLM (optional)

Set `LLAMA_CPP_BIN` or configure `intelligence.slm.binPath`. Only flagged snippets are sent to the model.

## Privacy

- No telemetry
- No network calls during scan
- Compatible with `simplebeacon scan --offline`
