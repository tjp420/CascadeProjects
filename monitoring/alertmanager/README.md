# SimpleBeacon Alertmanager templates & testing

This folder contains an Alertmanager notification template and a small PowerShell script to POST a test alert to an Alertmanager instance for template and routing verification.

Files:

- `templates/simplebeacon.tmpl` — Go template for notifications (Slack/email/webhook).
- `send-test-alert.ps1` — PowerShell script that posts a single test alert to Alertmanager's `/api/v1/alerts` endpoint.

Quick usage (PowerShell):

```powershell
# Post a test alert to local Alertmanager
cd monitoring/alertmanager
.\
send-test-alert.ps1 -AlertmanagerUrl "http://localhost:9093" -Instance "ci-runner" -AlertName "SimpleBeaconScanResourcePressure" -Severity "critical"
```

Template rendering locally with `amtool` (optional):

1. Download `amtool` from https://github.com/prometheus/alertmanager/releases and place it on PATH.
2. Create a sample JSON file `data.json` with the alert payload (same shape as `/api/v1/alerts` POST body).
3. Render template:

```bash
amtool template render --template.glob='templates/*.tmpl' --template.data=data.json --template='{{ template "simplebeacon.default" . }}'
```

Notes:

- Ensure Alertmanager is configured to load `templates/simplebeacon.tmpl` (see `alertmanager.yml` `templates:` setting).
- If Alertmanager is running in Docker, forward port 9093 or run the test script on the host network.
- To test routing and receivers (Slack, email), ensure Alertmanager `alertmanager.yml` defines the receivers and routing rules.

Next steps I can do for you:

- Add an Alertmanager template routing snippet (`alertmanager.yml`) to wire `service=simplebeacon-scan` alerts to a specific receiver.
- Generate a mock memory-pressure script to exercise `resource-guard.js` during a real scan run.
- Review and update log-formatting for the unlimited-scan warnings in the CLI.
