# Local Dashboard Server

This is a temporary standalone server that serves the SimpleBeacon dashboard and the scan report for `C:\Users\Trevor\CascadeProjects_BACKUP_20260521`.

## Start the API server

<!-- simplebeacon-ignore: markdown-fence-leak — code blocks in markdown documentation -->
	cd c:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged
	node dashboard-server.cjs

The server listens on `http://127.0.0.1:8081`.

## Start the React dashboard (Vite)

<!-- simplebeacon-ignore: markdown-fence-leak — code blocks in markdown documentation -->
	cd c:\Users\Trevor\CascadeProjects\ai-platform\web\simplebeacon-dashboard
	npm run dev

Then open `http://127.0.0.1:51369/` (or the port Vite reports). The dashboard reads the API base from `src/config.ts` (`http://127.0.0.1:8081/api` by default).

## Run a scan

1. Sign in with any email/password.
2. Go to **Analyze**.
3. Enter `C:\Users\Trevor\CascadeProjects_BACKUP_20260521`.
4. Click **Scan**.

The server returns the existing scan report from `.simplebeacon/report.json`.

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/analyze/flexible`
- `GET /api/simplebeacon/report`
- `GET /api/analyze/inventory`
- `GET /api/analyze/providers`
- `GET /api/platform/status`
- Static files under `/dashboard/`
