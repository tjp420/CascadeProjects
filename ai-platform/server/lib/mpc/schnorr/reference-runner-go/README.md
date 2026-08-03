Reference Runner (Go)

This small reference runner implements a RFC 8785-like JSON canonicalizer with numeric normalization and BigInt hex serialization.

Build:

```bash
cd ai-platform/server/lib/mpc/schnorr/reference-runner-go
go build -o reference-runner-go.exe
```

Usage:

```bash
# pipe JSON on stdin
echo '{"a":1,"b":"x"}' | ./reference-runner-go
# prints canonical string on first line, sha256 digest on second line
```

Notes on libraries:
- Uses only the Go standard library: `encoding/json`, `math/big`, `strconv`, `crypto/sha256`.
- `encoding/json` with `UseNumber()` is used to preserve numeric tokens for normalization.

Limitations:
- This runner is a reference implementation for cross-language vector generation and verification; it is not a production-grade high-performance canonicalizer.
- Numeric normalization attempts to mimic `toPrecision(21)` behavior but edge cases may differ slightly from JS; test vectors should be used to validate interoperability.
