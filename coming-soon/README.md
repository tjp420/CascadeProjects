# SimpleBeacon Coming Soon

Privacy-first source code scanner web interface.

## Overview

This is the landing page and web dashboard for SimpleBeacon — a browser-based source code scanner that analyzes repositories for security, compliance, and quality issues entirely on-device.

## Features

- **Zero-data-leave scanning** — all analysis happens in your browser
- **Drag-and-drop report upload** — supports JSON and ZIP formats
- **Real-time certificate generation** — printable security clearance certificates
- **EU AI Act compliance assessment** — built-in regulatory readiness checks

## Tech Stack

- Vanilla HTML/CSS/JS frontend
- Node.js + Express backend (`server.cjs`)
- Playwright for E2E testing

## Development

```bash
npm install
npm run dev     # Start development server
npm test        # Run E2E tests
```

## Deployment

See [CLOUDFLARE-DEPLOYMENT-PLAN.md](CLOUDFLARE-DEPLOYMENT-PLAN.md) for production deployment instructions.

## License

See [LICENSE](LICENSE) for details.
