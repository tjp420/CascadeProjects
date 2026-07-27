SimpleBeacon upload endpoint

Purpose
- Describe how to POST a Simplebeacon scan JSON to the running ai-platform server for server-side ingestion.

Endpoint
- POST /api/simplebeacon/report/upload

Security
- By default (when `SIMPLEBEACON_UPLOAD_SECRET` is unset) uploads are restricted to loopback addresses only (127.0.0.1, ::1).
- To enable remote uploads, set `SIMPLEBEACON_UPLOAD_SECRET` in your `.env` to a strong secret and include it in requests via the header `x-sb-upload-secret` or query `?token=`.

Example (local POST using curl.exe on Windows)

curl.exe -i -X POST "http://127.0.0.1:58000/api/simplebeacon/report/upload" \
  -H "Content-Type: application/json" \
  --data-binary @C:\\Users\\Trevor\\scan-output-agent.json

Example (remote POST with secret)

curl -i -X POST "https://your-server.example/api/simplebeacon/report/upload?token=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @scan-output-agent.json

Notes
- The server writes the report to `.simplebeacon/report.json` under the ai-platform project root.
- The dashboard reads the saved report immediately; no additional steps required to surface the data in the UI.
- Keep `SIMPLEBEACON_UPLOAD_SECRET` private; rotate if compromised.
