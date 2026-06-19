# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in SimpleBeacon, please report it responsibly:

1. **Email**: security@simplebeacon.ai
2. **Subject**: `[SECURITY] SimpleBeacon — <brief description>`
3. **Include**:
   - Affected version(s)
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Please do **not** open public GitHub issues for security vulnerabilities. We will respond within 48 hours and coordinate disclosure.

## Security Model

SimpleBeacon is designed with a **zero-upload, local-first** architecture:

- **CLI scans** run entirely on the local machine — no source code is transmitted
- **Browser scans** execute in the browser's isolated tab memory — no data leaves the machine
- **Certificates** are generated client-side via JSZip and html2canvas
- **Token validation** is structural only (JWT payload decode); real auth is server-side for payment verification

## Known Limitations

1. **Browser scan memory**: Large repositories (>20K files) may exhaust browser memory. Use the CLI for large repos.
2. **Credential pattern detection**: Heuristic regex matching may produce false positives. Always review findings manually.
3. **html2canvas rasterization**: The certificate PNG is generated from an off-screen DOM element. File paths are scrubbed before rasterization.
4. **Token parsing**: Client-side token parsing does not verify signatures. This is intentional — real validation happens server-side during payment.

## Data Handling

- No source code, ASTs, or file contents are ever uploaded to SimpleBeacon servers
- Scan reports are generated locally and downloaded as JSON
- Certificate ZIPs are assembled in-browser via JSZip
- `localStorage` is used only for session persistence (token + scan data) and is optional

## Dependencies

SimpleBeacon CLI has **zero runtime dependencies** (pure Node.js). Optional browser dependencies:
- [JSZip](https://stuk.github.io/jszip/) — client-side ZIP generation
- [html2canvas](https://html2canvas.hertzen.com/) — certificate rasterization

Both are loaded from CDN and can be self-hosted if desired.

