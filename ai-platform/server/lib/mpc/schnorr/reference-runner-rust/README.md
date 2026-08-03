reference-runner-rust
=====================

Minimal Rust reference runner for JCS (RFC 8785-like) canonicalization and SHA-256 digest printing.

Usage:

```sh
# build
cargo build --release

# run (reads from stdin)
cat vector.json | target/release/reference-runner-rust

# or run with file path
target/release/reference-runner-rust vectors.json
```

This is a scaffolded runner. The canonicalization logic currently supports sorted keys, arrays, strings, booleans, nulls, and a `{"__bigint_hex":"..."}` marker for transporting big integers. Numeric formatting uses the `ryu` crate for deterministic float formatting; further numeric normalization (precision 21, -0 handling, trailing zero/mantissa rules) can be refined to match JS/Go exact rules.
