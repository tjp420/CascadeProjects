# SimpleBeacon Automated Private Service

A headless background service that automatically processes files with 100% privacy guarantee using local Ollama.

## Privacy Architecture

- **Zero Internet Dependency**: All processing happens locally on `http://127.0.0.1:11434`
- **PII Sanitization**: Emails, IPs, and credentials are stripped before AI processing
- **Audit Trail**: Original files are archived (not deleted) for compliance
- **Offline Enforcement**: `SIMPLEBEACON_OFFLINE=true` blocks any remote connections

## Quick Start

### 1. Ensure Ollama is Running

```cmd
set OLLAMA_ORIGINS=http://127.0.0.1:60361
ollama serve
```

### 2. Start the Automated Service

**Interactive mode (for testing):**

```cmd
npm run auto:start
```

**Offline mode (recommended for production):**

```cmd
set SIMPLEBEACON_OFFLINE=true
npm run auto:start
```

**PM2 daemon (background service):**

```cmd
npm run auto:start:pm2
pm2 startup
pm2 save
```

### 3. Drop Files for Processing

Place any text file into the `incoming_user_data` directory. The service will:

1. Sanitize PII from the file
2. Analyze with local Ollama (`unbreakable-oracle:latest`)
3. Generate a JSON report in `processed_reports`
4. Archive the original file in `processed_archive`

## Directory Structure

```
ai-platform/
├── auto-processor.js              # Main automation script
├── incoming_user_data/            # Drop files here for processing
├── processed_reports/              # JSON analysis reports
└── processed_archive/              # Archived original files
    └── errors/                     # Failed processing attempts
```

## Configuration

### Environment Variables

| Variable               | Default                     | Description               |
| ---------------------- | --------------------------- | ------------------------- |
| `OLLAMA_BASE_URL`      | `http://127.0.0.1:11434`    | Local Ollama endpoint     |
| `OLLAMA_MODEL`         | `unbreakable-oracle:latest` | Model to use for analysis |
| `SIMPLEBEACON_OFFLINE` | `false`                     | Enforce offline-only mode |

### Example .env

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=unbreakable-oracle:latest
SIMPLEBEACON_OFFLINE=true
```

## PM2 Management

```cmd
# Start with PM2
npm run auto:start:pm2

# View logs
npm run auto:logs

# Restart service
npm run auto:restart

# Stop service
npm run auto:stop

# Monitor status
pm2 status
pm2 monit
```

## Report Format

Each processed file generates a JSON report:

```json
{
  "metadata": {
    "filename": "example.txt",
    "processedAt": "2026-06-01T19:00:00.000Z",
    "processingTimeMs": 1234,
    "ollamaModel": "unbreakable-oracle:latest",
    "offlineMode": true
  },
  "analysis": "AI analysis results...",
  "sanitization": {
    "piiRemoved": true,
    "originalLength": 5000,
    "sanitizedLength": 4850
  }
}
```

## Security Considerations

1. **Network Isolation**: The service only connects to `127.0.0.1:11434`
2. **PII Redaction**: Sensitive data is stripped before AI processing
3. **File Archiving**: Original files are preserved for audit trails
4. **Error Handling**: Failed files are moved to `processed_archive/errors/`

## Troubleshooting

### Ollama Connection Failed

Ensure Ollama is running:

```cmd
curl http://127.0.0.1:11434/api/tags
```

### Permission Denied on Windows

Run as Administrator or adjust directory permissions for `incoming_user_data`.

### Files Not Processing

Check the service logs:

```cmd
npm run auto:logs
```

## Integration Examples

### Automated CI/CD Integration

```bash
# In your CI pipeline
cp build/logs/simplebeacon-report.json ../ai-platform/incoming_user_data/
npm run auto:start:offline
```

### External System Integration

```python
import shutil
import os

# Drop file for processing
shutil.copy('analysis_results.txt', '/path/to/ai-platform/incoming_user_data/')

# Wait for processing (or use webhook notification)
time.sleep(10)

# Read generated report
with open('/path/to/ai-platform/processed_reports/report_*.json') as f:
    report = json.load(f)
```

## Advanced: Webhook Notifications

To add webhook notifications when reports complete, modify `processFile()` in `auto-processor.js`:

```javascript
async function sendWebhook(report) {
  await fetch(process.env.WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
}
```

## License

MIT
