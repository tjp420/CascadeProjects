# Storage Configuration Guide

This document explains how to configure the file storage system for the dashboard export/download feature.

## Overview

The dashboard supports multiple storage backends for storing and retrieving exported files:
- **Local File System** (default)
- **AWS S3**
- **Google Cloud Storage (GCS)**

## Environment Variables

### Common Configuration

```bash
# Storage backend selection (default: local)
STORAGE_BACKEND=local  # Options: local, s3, gcs
```

### Local Storage Configuration

```bash
# Local storage path (default: exports)
LOCAL_STORAGE_PATH=./exports
```

### AWS S3 Configuration

```bash
# Storage backend
STORAGE_BACKEND=s3

# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1

# S3 Bucket
S3_BUCKET_NAME=your-bucket-name
```

### Google Cloud Storage Configuration

```bash
# Storage backend
STORAGE_BACKEND=gcs

# GCS Bucket
GCS_BUCKET_NAME=your-bucket-name

# GCS Credentials (optional - uses default ADC if not provided)
GCS_CREDENTIALS_PATH=/path/to/service-account-key.json
```

## Installation Requirements

### Local Storage
No additional packages required.

### AWS S3
Install the boto3 package:
```bash
pip install boto3
```

### Google Cloud Storage
Install the google-cloud-storage package:
```bash
pip install google-cloud-storage
```

## Usage Examples

### Python API Usage

```python
from storage_connector import get_storage_connector

# Get configured storage connector
storage = get_storage_connector()

# Upload a file
object_key = storage.upload_file('/path/to/local/file.txt', 'exports/file.txt')

# Download a file
content, content_type = storage.download_file('exports/file.txt')

# List files
files = storage.list_files(prefix='exports/')

# Check if file exists
exists = storage.file_exists('exports/file.txt')

# Delete a file
storage.delete_file('exports/file.txt')

# Generate download URL (for cloud storage)
download_url = storage.get_download_url('exports/file.txt', expires_in=3600)
```

### API Endpoints

The following endpoints are available for file management:

#### Download File
```
GET /api/export/download/{filename}
```
Downloads a file from storage and initiates browser download.

#### List Files
```
GET /api/export/files?prefix=project-history-
```
Lists all available export files with optional prefix filter.

#### Get Download URL
```
GET /api/export/download-url/{filename}?expires_in=3600
```
Generates a presigned download URL for cloud storage (S3/GCS).

## Security Considerations

1. **Never commit credentials** to version control
2. Use environment variables or secret management services
3. For AWS S3, use IAM roles when running on EC2
4. For GCS, use Workload Identity when running on GKE
5. Set appropriate bucket permissions (least privilege)
6. Use presigned URLs with short expiration times for downloads

## Migration Guide

### Switching from Local to S3

1. Install boto3: `pip install boto3`
2. Set environment variables for AWS credentials and bucket
3. Change `STORAGE_BACKEND` to `s3`
4. Restart the application

### Switching from Local to GCS

1. Install google-cloud-storage: `pip install google-cloud-storage`
2. Set environment variables for GCS bucket and credentials
3. Change `STORAGE_BACKEND` to `gcs`
4. Restart the application

## Troubleshooting

### S3 Connection Issues

- Verify AWS credentials are correct
- Check that the bucket exists and is accessible
- Ensure IAM user has necessary permissions (s3:PutObject, s3:GetObject, s3:DeleteObject)
- Check region configuration matches bucket region

### GCS Connection Issues

- Verify service account key file is valid
- Check that the bucket exists and is accessible
- Ensure service account has necessary permissions (storage.objects.*)
- Verify ADC (Application Default Credentials) if not using key file

### Local Storage Issues

- Verify the storage directory has write permissions
- Check disk space availability
- Ensure the directory path is correct

## File Naming Conventions

Exported files follow this naming pattern:
- Full reports: `project_report_{timestamp}.{format}`
- Summary reports: `project_summary_{timestamp}.txt`
- Custom exports: `{export_type}_{timestamp}.{format}`

Example: `project_report_20240517_143022.json`
