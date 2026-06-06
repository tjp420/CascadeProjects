# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| < 1.3.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in SimpleBeacon, please report it responsibly:

1. **Email**: security@simplebeacon.dev
2. **Do not** open a public issue before the vulnerability is patched.
3. Include a detailed description, steps to reproduce, and potential impact.
4. Allow up to 72 hours for an initial response.

We will coordinate disclosure and credit reporters who follow responsible disclosure practices.

## Security Features

- Client-side only processing — no source code or AST leaves the browser during scans.
- SHA-256 cryptographic verification seals on all certificates.
- Zero-retention safeguard: scan reports are compiled locally inside the browser sandbox.
