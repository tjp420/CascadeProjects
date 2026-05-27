# VSCode Extension Integration for Enhanced Dashboard

This integration allows the Enhanced Dashboard to export data directly to your VSCode extension, providing seamless data transfer and report generation within your development environment.

## Features

- **Direct Export**: Export dashboard data directly to VSCode extension
- **Comprehensive Reports**: Generate detailed JSON, Markdown, and CSV reports
- **Automatic Processing**: Monitor and process export requests automatically
- **Download Server**: Built-in web server for accessing exported reports
- **Real-time Monitoring**: Continuous monitoring of export requests

## Setup

### 1. Dashboard Integration

The Enhanced Dashboard already includes the necessary JavaScript functions for VSCode integration:

- `exportToVSCode()` - Export current dashboard data
- `exportAllToVSCode()` - Export comprehensive report with all data

### 2. VSCode Extension Integration

Create the following directory structure in your workspace:

```
.vscode/
├── dashboard_exports/     # Generated reports
├── temp/                 # Temporary export files
└── settings.json         # VSCode settings (optional)
```

### 3. Start the Integration Server

```bash
# Start the VSCode extension server
python vscode_extension_monitor.py

# Or specify workspace and port
python vscode_extension_monitor.py /path/to/workspace 8081
```

The server will start at `http://localhost:8081`

## Usage

### From the Dashboard

1. Open the Enhanced Dashboard (`http://localhost:8080`)
2. Click the "Export to VSCode" button in the header
3. Or click "Export All Reports" for comprehensive data
4. The data will be automatically processed and saved to your workspace

### Direct API Usage

#### Export Dashboard Data

```bash
curl -X POST http://localhost:8081/api/export \
  -H "Content-Type: application/json" \
  -d '{
    "type": "vscode-export-dashboard",
    "detail": {
      "action": "export-dashboard-report",
      "data": {
        "summary": {"total_features": 100, "total_files": 25},
        "quality_metrics": {"average_feature_quality": 85},
        "complexity_metrics": {"average_feature_complexity": 4.2}
      },
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }'
```

#### Process Pending Exports

```bash
curl -X POST http://localhost:8081/api/process-pending
```

#### Get Export History

```bash
curl http://localhost:8081/api/exports
```

#### Get Server Status

```bash
curl http://localhost:8081/api/status
```

## Export Types

### Dashboard Report
- **Content**: Current dashboard data with analysis
- **Formats**: JSON report, Markdown summary
- **Location**: `.vscode/dashboard_exports/`

### Comprehensive Report
- **Content**: Dashboard + Health + Metrics data
- **Formats**: JSON report, Markdown report, CSV files
- **Location**: `.vscode/dashboard_exports/`

## Generated Files

### JSON Reports
- Complete data in structured format
- Machine-readable
- Contains all metrics and analysis

### Markdown Reports
- Human-readable summaries
- Formatted for easy viewing
- Includes recommendations and insights

### CSV Files
- Tabular data for spreadsheet analysis
- Features list, metrics summary
- Compatible with Excel, Google Sheets

## File Naming Convention

- Dashboard reports: `dashboard_report_YYYYMMDD_HHMMSS.json`
- Comprehensive reports: `comprehensive_report_YYYYMMDD_HHMMSS.json`
- Markdown summaries: `{type}_summary_YYYYMMDD_HHMMSS.md`
- CSV exports: `{data_type}_YYYYMMDD_HHMMSS.csv`

## Integration with VSCode Extension

### Extension Configuration

Add this to your VSCode extension's `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "dashboard.export",
        "title": "Export Dashboard Data"
      },
      {
        "command": "dashboard.viewReports",
        "title": "View Export Reports"
      }
    ]
  }
}
```

### Extension Code Example

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    // Export command
    const exportCommand = vscode.commands.registerCommand('dashboard.export', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            // Trigger export via HTTP API
            fetch('http://localhost:8081/api/process-pending', {
                method: 'POST'
            }).then(response => response.json())
              .then(data => {
                  vscode.window.showInformationMessage(
                      `Exported ${data.total_processed} reports successfully`
                  );
              });
        }
    });

    // View reports command
    const viewReportsCommand = vscode.commands.registerCommand('dashboard.viewReports', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const reportsPath = path.join(workspaceRoot, '.vscode', 'dashboard_exports');
            
            // Open reports directory in VSCode
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(reportsPath));
        }
    });

    context.subscriptions.push(exportCommand, viewReportsCommand);
}
```

## Monitoring and Status

### Server Status
- Check server status at `http://localhost:8081/api/status`
- View export history at `http://localhost:8081/api/exports`
- Download reports from `http://localhost:8081`

### Automatic Processing
- Server monitors `.vscode/temp/` for export requests
- Processes files every 2 seconds (configurable)
- Cleans up temporary files after processing

## Troubleshooting

### Common Issues

1. **Server not starting**
   - Check if port 8081 is available
   - Verify Python dependencies are installed

2. **Exports not processing**
   - Ensure `.vscode/` directory exists
   - Check file permissions
   - Verify server is running

3. **Reports not appearing**
   - Check `.vscode/dashboard_exports/` directory
   - Review server logs for errors
   - Verify export request format

### Debug Mode

Enable debug logging by setting environment variable:

```bash
export DEBUG=1
python vscode_extension_monitor.py
```

## API Reference

### Endpoints

#### GET /api/status
Returns server and monitor status.

**Response:**
```json
{
  "server_running": true,
  "port": 8081,
  "monitor_status": {
    "running": true,
    "workspace_root": "/path/to/workspace",
    "temp_directory": "/path/to/.vscode/temp",
    "exports_directory": "/path/to/.vscode/dashboard_exports"
  }
}
```

#### GET /api/exports
Returns list of all exported files.

**Response:**
```json
{
  "exports": [
    {
      "filename": "dashboard_report_20240101_120000.json",
      "path": "/path/to/.vscode/dashboard_exports/dashboard_report_20240101_120000.json",
      "size": 2048,
      "created": "2024-01-01T12:00:00Z",
      "type": "json_report"
    }
  ]
}
```

#### POST /api/export
Direct export request processing.

**Request Body:**
```json
{
  "type": "vscode-export-dashboard",
  "detail": {
    "action": "export-dashboard-report",
    "data": {...},
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### POST /api/process-pending
Process all pending export requests.

**Response:**
```json
{
  "processed": [...],
  "failed": [...],
  "total_processed": 3,
  "total_failed": 0
}
```

## Configuration

### Environment Variables

- `DASHBOARD_PORT`: Dashboard server port (default: 8080)
- `EXTENSION_PORT`: Extension server port (default: 8081)
- `WORKSPACE_ROOT`: Workspace root directory
- `DEBUG`: Enable debug logging

### VSCode Settings

Add to `.vscode/settings.json`:

```json
{
  "dashboard.export.autoProcess": true,
  "dashboard.export.interval": 2000,
  "dashboard.export.format": ["json", "markdown", "csv"]
}
```

## Security Considerations

- Server runs on localhost only
- No external API access required
- Temporary files are automatically cleaned up
- Export files are stored in workspace directory

## Performance

- Minimal resource usage
- Asynchronous processing
- Configurable polling interval
- Efficient file handling

## Support

For issues and support:
1. Check the troubleshooting section
2. Review server logs for error messages
3. Verify network connectivity between dashboard and extension
4. Ensure file permissions are correct
