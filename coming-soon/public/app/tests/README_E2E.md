# 🎭 SimpleBeacon Storage Engine Playwright E2E Suites

This directory contains automation to stress-test the dashboard's quota-safe storage fallback (IndexedDB) used for very large scan reports.

## 🛠️ Prerequisites

Install test dependencies and the browser drivers:

```bash
cd ai-platform/web/simplebeacon-dashboard
npm install
npx playwright install --with-deps
```

Ensure the dashboard web app is available locally (the test navigates to `/`). You can serve the built app or run the dev server:

```bash
# Serve the production build from the project root (example using a simple static server)
npm run build
npx serve -s dist

# OR run the Vite dev server (hot reload)
npm run dev
```

## 🚀 Running the Quota Stress Tests

Execute the single test file (headless):

```bash
cd ai-platform/web/simplebeacon-dashboard
npx playwright test tests/storage-quota-fallback.spec.ts
```

Run with the Playwright UI to observe the browser session interactively:

```bash
npx playwright test tests/storage-quota-fallback.spec.ts --ui
```

## 🧩 Notes & Troubleshooting

- The test attempts to simulate localStorage pressure by writing a large string into `localStorage`. Different browsers and CI runners have varying quotas — the test also writes a marker into IndexedDB as a fallback to assert the UI behavior.
- If your app exposes a test helper `window.SimpleBeaconStorage.saveReport`, the test will use that to invoke the application's real save pipeline; otherwise it performs a best-effort simulation.
- CI integration: add `npx playwright install --with-deps` as a setup step in your workflow, and run the test against a deployed preview or a started local server in the job.

## ✅ Next steps

- Integrate this spec into your GitHub Actions workflow matrix for PR validation.
- Extend the spec to simulate different quota sizes and ensure robust behavior across browsers.
