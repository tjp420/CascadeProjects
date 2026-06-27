# The Physics of AI Slop: Reverse-Engineering LLM Artifacts in Source Code

Generative AI models (Cursor, Copilot, Claude) do not write code like humans. Humans write incrementally, rewriting variable structures and refactoring inline comments as mental models evolve. LLMs operate as probabilistic autocompletes, outputting tokens in highly predictable patterns based on matching vector weights.

When left unmonitored, this structural pattern results in "AI Slop" — conversational leakage, bloated styling boilerplate, and ghost dependencies.

Here is how SimpleBeacon detects these machine signatures completely offline.

---

## 1. The Conversational Leak (SB-FICTION-001)

The most glaring footprint is conversational leakage. Because LLMs are trained to behave as helpful assistants, they wrap code outputs in polite framing structures. When a developer copy-pastes blindly, or an agent auto-applies a diff incorrectly, these markdown fences leak into production files.

### The Signature

```javascript
/(As an AI|Here is the implementation|I hope this helps)/gi
```

### The Fix

SimpleBeacon monitors file buffer states. It triggers warning diagnostics the second a conversational substring appears inside a valid programming syntax context.

---

## 2. Structural Boilerplate Bloat (SB-FICTION-004)

LLMs tend to generate verbose, heavily commented code to explain their outputs. This pattern is easy to track. Humans rarely write standard comments matching these rigid structures:

```javascript
// This function calculates user conversion vectors
// This method handles outbound webhook processing loops
```

### The Distribution Match

AI commentary exhibits suspiciously uniform indentation and highly repetitive token starters. SimpleBeacon tracks the density of continuous inline comments. If comment clusters scale past an 8-line window with an invariant structure, the file density score degrades.

---

## 3. The Hallucinated Dependency Moat (SB-FICTION-003)

The most dangerous issue with AI generation is the hallucination of non-existent software packages. Because LLMs prioritize language plausibility over external registry truths, they frequently invent plausible-sounding dependency names inside files like `package.json`:

```json
"dependencies": {
  "mock-auth-utils-secure": "^1.1.0"
}
```

### Direct Detection

SimpleBeacon checks these entries against known AI placeholders (`fake-*`, `test-api-*`). It can also check the local workspace cache against the live public npm registry to catch 404 package lookups before an attacker registers that hallucinated name for a supply-chain exploit.

---

## 4. Architectural Isolation: Zero-Upload Profiling

Traditional scanning tools compromise privacy by passing entire software repositories to external cloud servers to parse syntax trees. SimpleBeacon approaches this problem differently.

By utilizing local regular expression processing and decentralized cryptographic tokens, SimpleBeacon evaluates repository state entirely within your local terminal. Your source code never leaves your computer, ensuring total privacy.
