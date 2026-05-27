# Retry Export Feature Implementation Summary

## Overview
Implemented a complete retry export system for the dashboard that integrates with Celery job scheduling to re-queue failed export jobs for processing. This replaces the placeholder retry functionality with a production-ready solution.

## Components Implemented

### 1. Export Tasks Module (`web/api/tasks/export_tasks.py`)
Created Celery tasks for export operations:

**Tasks Implemented:**
- `generate_export_job` - Generate export files in specified formats
- `generate_quality_report` - Generate comprehensive quality reports
- `retry_export_job` - Retry failed export jobs by filename
- `retry_export_by_name` - Alias for retry_export_job (main entry point)
- `cleanup_old_exports` - Clean up old export files
- `generate_project_history_export` - Generate project history exports

**Key Features:**
- Automatic file upload to configured storage backend
- Retry tracking with max retry limits
- Error handling and status reporting
- Integration with storage connector

### 2. Celery Configuration Updates (`web/api/celery_config.py`)
Enhanced Celery configuration to support export tasks:

**Changes:**
- Added `tasks.export_tasks` to Celery include list
- Configured task routing for export queue
- Set up queue separation for different task types

**Task Routing:**
```python
'tasks.export_tasks.generate_export': {'queue': 'exports'},
'tasks.export_tasks.generate_quality_report': {'queue': 'exports'},
'tasks.export_tasks.retry_export': {'queue': 'exports'},
'tasks.export_tasks.retry_export_by_name': {'queue': 'exports'},
'tasks.export_tasks.generate_project_history_export': {'queue': 'exports'},
'tasks.export_tasks.cleanup_old_exports': {'queue': 'exports'},
```

### 3. Enhanced Export Router (`web/api/routers/export.py`)
Updated export endpoints to integrate with Celery:

**Retry Endpoint (`POST /api/export/retry`):**
- Accepts filename or job_id for retry
- Queues retry task with Celery
- Returns immediate response with job tracking info
- Supports authentication via JWT tokens

**Job Status Endpoint (`GET /api/export/jobs/{job_id}`):**
- Retrieves job status from Celery
- Maps Celery task states to export job statuses
- Returns detailed job information including filename and error details
- Fallback to mock response if Celery unavailable

**Status Mapping:**
- `PENDING` → ExportStatus.PENDING
- `STARTED` → ExportStatus.PROCESSING
- `SUCCESS` → ExportStatus.COMPLETED
- `FAILURE` → ExportStatus.FAILED

### 4. Dashboard UI Component (`web/dashboard_components/exports-tab.html`)
Enhanced the exports tab with retry functionality:

**UI Changes:**
- Added retry buttons for each file in the file list
- Retry buttons shown for both available and missing files
- Warning color scheme for retry buttons
- Success feedback after retry queue

**JavaScript DownloadManager Enhancements:**
- Added `retryExport(filename)` method
- Calls retry API endpoint with filename
- Displays success message with job ID
- Auto-refreshes file list after retry
- Error handling with user feedback

**Button Styling:**
```css
.retry-btn {
    background: var(--warning-color, #ffc107);
    color: #333;
}
```

## Usage Example

### Retry via API
```bash
# Retry a failed export by filename
curl -X POST http://localhost:8080/api/export/retry \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"filename": "code-quality-2023-05-10.xlsx"}'

# Response
{
  "job_id": "export_retry_1715981234_123",
  "export_type": "retry",
  "format": "unknown",
  "status": "retrying",
  "filename": "code-quality-2023-05-10.xlsx",
  "retry_count": 1,
  "max_retries": 3
}
```

### Check Job Status
```bash
# Get job status
curl http://localhost:8080/api/export/jobs/{job_id} \
  -H "Authorization: Bearer {token}"

# Response
{
  "job_id": "export_retry_1715981234_123",
  "export_type": "quality-report",
  "format": "xlsx",
  "status": "completed",
  "filename": "quality-report_retry_1715981235.xlsx",
  "completed_at": "2024-05-17T17:00:00Z"
}
```

### Retry via UI
1. Navigate to the Exports tab in the dashboard
2. Find the file to retry (e.g., code-quality-2023-05-10.xlsx)
3. Click the "🔄 Retry" button
4. Confirm the success message with job ID
5. File list auto-refreshes to show new export

## Configuration

### Environment Variables
```bash
# Celery broker (Redis)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Storage backend (for file storage)
STORAGE_BACKEND=local  # or s3, gcs
```

### Celery Worker Setup
Start Celery workers for export queue:
```bash
celery -A celery_config worker -Q exports -l info
```

Start Celery worker with all queues:
```bash
celery -A celery_config worker -l info
```

## Architecture

### Retry Flow
1. User clicks retry button in UI or calls API
2. API validates request and queues Celery task
3. Celery worker picks up task from exports queue
4. Task regenerates export file with new timestamp
5. File uploaded to configured storage backend
6. Task result stored in Celery result backend
7. UI polls job status or auto-refreshes file list

### File Naming Convention
Retried files include retry timestamp:
- Original: `code-quality-2023-05-10.xlsx`
- Retried: `code-quality_retry_20240517_170022.xlsx`

## Error Handling

**Task Failures:**
- Tasks capture exceptions and return error details
- Status set to FAILED with error message
- Job can be retried up to max_retries (default: 3)

**API Errors:**
- 400: Missing filename or job_id
- 401: Invalid authentication
- 500: Celery task queue failure

**UI Feedback:**
- Success alert with job ID
- Error alert with failure details
- Auto-refresh after successful retry

## Testing Recommendations

1. Test retry for existing files
2. Test retry for missing files
3. Test retry with various formats (xlsx, csv, json)
4. Verify Celery task execution
5. Check job status tracking
6. Verify file generation and storage upload
7. Test UI retry button functionality
8. Verify auto-refresh after retry
9. Test authentication and authorization
10. Test error scenarios (Celery down, storage unavailable)

## Dependencies

**Required:**
- Celery (task queue)
- Redis (message broker and result backend)

**Optional (for storage):**
- boto3 (AWS S3 support)
- google-cloud-storage (GCS support)

## Monitoring

**Celery Monitoring:**
- Use Flower for Celery task monitoring: `celery -A celery_config flower`
- Monitor task queue length and worker status
- Track task success/failure rates

**Job Status:**
- Poll `/api/export/jobs/{job_id}` for status updates
- Check Celery result backend for task results
- Monitor export storage for generated files

## Security Considerations

1. **Authentication**: All endpoints require JWT authentication
2. **Authorization**: Users can only retry their own exports
3. **Rate Limiting**: Consider rate limiting retry requests
4. **Resource Limits**: Task time limits prevent long-running jobs
5. **Input Validation**: Filename validation to prevent path traversal

## Next Steps

1. Add database persistence for export jobs
2. Implement job history and audit trail
3. Add batch retry functionality
4. Implement retry scheduling (retry at specific time)
5. Add email notifications for retry completion
6. Implement retry queue management (pause/resume)
7. Add retry statistics and analytics
8. Implement automatic retry on specific failures

## Notes

- Retry generates new file with retry timestamp
- Original file is not modified
- Max retries configurable per task (default: 3)
- Celery workers must be running for retry to process
- Storage backend must be configured for file upload
- Job status available via Celery result backend
