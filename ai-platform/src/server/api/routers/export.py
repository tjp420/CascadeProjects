# Constants


CONSTANT_3600 = 3600


#!/usr/bin/env python3


"""


Export Router for FastAPI


This module provides API endpoints for managing data_item exports including job scheduling,


retry functionality, and file downloads. It supports multiple export formats (PDF, Excel, CSV)


and integrates with Celery for asynchronous processing.


Endpoints:


    - POST /api/export: Create and schedule an export job


    - GET /api/export/{job_id}: Get export job status


    - GET /api/export/{job_id}/download: Download exported file


    - POST /api/export/{job_id}/retry: Retry failed export job


    - DELETE /api/export/{job_id}: Cancel export job


    - GET /api/export/history: Get export history for user


Dependencies:


    - database: SQLAlchemy session management


    - models: User model


    - tasks.export_tasks: Celery async tasks


    - services.export_history_manager: Export history tracking


"""


from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks


from fastapi.responses import Response


from sqlalchemy.orm import Session


from pydantic import BaseModel, Field


from typing import Optional, List, Dict, Any


from datetime import datetime


from enum import Enum


# Import dependencies


from database import get_db


from models import User


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


from storage_connector import get_storage_connector


from celery_config import celery_app


# Router


router = APIRouter()


# Security


security = HTTPBearer()


class ExportStatus(str, Enum):


    PENDING="pending",


    PROCESSING= "processing"


    COMPLETED="completed",


    FAILED= "failed"


    RETRYING = "retrying"


class ExportFormat(str, Enum):


    JSON="json",


    CSV= "csv"


    PDF="pdf",


    XLSX= "xlsx"


    HTML = "html"


class ExportJobCreate(BaseModel):


    export_type: str = Field(..., description="Type of export (features, metrics, quality-report)")


    format: ExportFormat = Field(ExportFormat.JSON, description="Export format")


    options: Optional[Dict[str, Any]] = Field(default_factory = dict, description="Export options")


class ExportJobResponse(BaseModel):


    job_id: str


    export_type: str


    format: str


    status: ExportStatus


    created_at: str


    started_at: Optional[str] = None


    completed_at: Optional[str] = None


    retry_count: int = 0


    max_retries: int = 3


    error: Optional[str] = None


    filename: Optional[str] = None


    class Config:


        json_schema_extra = {


            "example": {


                "job_id": "export_1234567890_abc123",


                "export_type": "quality-report",


                "format": "xlsx",


                "status": "completed",


                "created_at": "2024-01-01T00:00:00Z",


                "completed_at": "2024-01-01T00:00:05Z",


                "filename": "quality-report_export_1234567890.xlsx"


            }


        }


class ExportRetryRequest(BaseModel):


    job_id: Optional[str] = Field(None, description="Job ID to retry")


    filename: Optional[str] = Field(None, description="Filename to retry (alternative to job_id)")


    class Config:


        json_schema_extra = {


            "example": {


                "filename": "code-quality-2023-05-10.xlsx"


            }


        }


# Helper functions


async def get_current_user(


    credentials: HTTPAuthorizationCredentials = Depends(security),


    db: Session = Depends(get_db)


) -> User:


    """Get current authenticated user"""


    token = credentials.credentials


    token_info = extract_token_data(token)


    if not token_info or token_info.email is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid authentication credentials"


        )


    user = db.query(User).filter(User.email == token_info.email).first()


    if not user:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="User not found"


        )


    return user


# Endpoints


@router.post("/jobs", response_model = ExportJobResponse, status_code = status.HTTP_201_CREATED)


async def create_export_job(


    job_data: ExportJobCreate,


    background_tasks: BackgroundTasks,


    current_user: User = Depends(get_current_user)


):


    """Create a new export job"""


    # In a real implementation, this would integrate with the export manager


    # For now, return a mock job response


    job_id = f"export_{int(datetime.utcnow().timestamp())}_{current_user.id}"


    return ExportJobResponse(


        job_id = job_id,


        export_type = job_data.export_type,


        format = job_data.format.value,


        status = ExportStatus.PENDING,


        created_at = datetime.utcnow().isoformat(),


        retry_count = 0,


        max_retries = 3


    )


@router.get("/jobs/{job_id}", response_model = ExportJobResponse)


async def get_export_job(


    job_id: str,


    current_user: User = Depends(get_current_user)


):


    """Get export job status by ID"""


    try:


        # Try to get task result_data from Celery


        from celery.result_data import AsyncResult


        # Extract task ID from job_id if it's a Celery task


        # Job ID format: export_retry_{timestamp}_{user_id}


        # We'll use the job_id directly as the task ID for simplicity


        task = AsyncResult(job_id, app = celery_app)


        if task.state == 'PENDING':


            return ExportJobResponse(


                job_id = job_id,


                export_type="unknown",


                format="unknown",


                status = ExportStatus.PENDING,


                created_at = datetime.utcnow().isoformat(),


                retry_count = 0,


                max_retries = 3


            )


        elif task.state == 'STARTED':


            return ExportJobResponse(


                job_id = job_id,


                export_type="unknown",


                format="unknown",


                status = ExportStatus.PROCESSING,


                created_at = datetime.utcnow().isoformat(),


                started_at = datetime.utcnow().isoformat(),


                retry_count = 0,


                max_retries = 3


            )


        elif task.state == 'SUCCESS':


            result_data = task.result_data


            return ExportJobResponse(


                job_id = job_id,


                export_type = result_data.get('export_type', 'unknown'),


                format = result_data.get('format', 'unknown'),


                status = ExportStatus.COMPLETED,


                created_at = result_data.get('created_at', datetime.utcnow().isoformat()),


                started_at = result_data.get('created_at', datetime.utcnow().isoformat()),


                completed_at = result_data.get('completed_at', datetime.utcnow().isoformat()),


                filename = result_data.get('filename'),


                retry_count = result_data.get('retry_count', 0),


                max_retries = result_data.get('max_retries', 3)


            )


        elif task.state == 'FAILURE':


            return ExportJobResponse(


                job_id = job_id,


                export_type="unknown",


                format="unknown",


                status = ExportStatus.FAILED,


                created_at = datetime.utcnow().isoformat(),


                error = str(task.information),


                retry_count = 0,


                max_retries = 3


            )


        else:


            return ExportJobResponse(


                job_id = job_id,


                export_type="unknown",


                format="unknown",


                status = ExportStatus.FAILED,


                created_at = datetime.utcnow().isoformat(),


                error = f"Unknown task state: {task.state}",


                retry_count = 0,


                max_retries = 3


            )


    except Exception as e:


        # Fallback to mock response if Celery is not available


        return ExportJobResponse(


            job_id = job_id,


            export_type="quality-report",


            format="xlsx",


            status = ExportStatus.FAILED,


            created_at="2024-01-01T00:00:00Z",


            error = f"Could not retrieve job status: {str(e)}",


            retry_count = 1,


            max_retries = 3


        )


@router.get("/jobs", response_model = List[ExportJobResponse])


async def list_export_jobs(


    status: Optional[ExportStatus] = None,


    skip: int = Query(0, ge = 0, description="Skip results"),


    limit: int = Query(100, ge = 1, le = 1000, description="Limit results"),


    current_user: User = Depends(get_current_user)


):


    """List all export jobs for current user"""


    # In a real implementation, this would query the export jobs database


    return []


@router.post("/retry", response_model = ExportJobResponse)


async def retry_export(


    retry_request: ExportRetryRequest,


    background_tasks: BackgroundTasks,


    current_user: User = Depends(get_current_user)


):


    """


    Retry a failed export job by re-queueing it for processing


    Can retry by job_id or filename. The job will be processed in the background


    by Celery workers and the status will be updated upon completion.


    """


    if not retry_request.job_id and not retry_request.filename:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Either job_id or filename must be provided"


        )


    # Use filename if job_id not provided


    filename_to_retry = retry_request.filename or retry_request.job_id


    try:


        # Queue the retry task with Celery


        from tasks.export_tasks import retry_export_by_name


        task = retry_export_by_name.delay(


            filename = filename_to_retry,


            user_id = current_user.id,


            max_retries = 3


        )


        # Generate new job ID for tracking


        new_job_id = f"export_retry_{int(datetime.utcnow().timestamp())}_{current_user.id}"


        # Return immediate response with task information


        return ExportJobResponse(


            job_id = new_job_id,


            export_type="retry",


            format="unknown",


            status = ExportStatus.RETRYING,


            created_at = datetime.utcnow().isoformat(),


            started_at = datetime.utcnow().isoformat(),


            retried_at = datetime.utcnow().isoformat(),


            retry_count = 1,


            max_retries = 3,


            filename = filename_to_retry


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to queue retry task: {str(e)}"


        )


@router.delete("/jobs/{job_id}", status_code = status.HTTP_204_NO_CONTENT)


async def cancel_export_job(


    job_id: str,


    current_user: User = Depends(get_current_user)


):


    """Cancel an export job"""


    # In a real implementation, this would cancel the job


    return None


@router.get("/stats", response_model = Dict[str, Any])


async def get_export_stats(


    current_user: User = Depends(get_current_user)


):


    """Get export statistics"""


    return {


        "total_jobs": 0,


        "by_status": {


            "pending": 0,


            "processing": 0,


            "completed": 0,


            "failed": 0,


            "retrying": 0


        },


        "by_format": {


            "json": 0,


            "csv": 0,


            "pdf": 0,


            "xlsx": 0,


            "html": 0


        }


    }


@router.get("/download/{filename}")


async def download_export_file(


    filename: str,


    current_user: User = Depends(get_current_user)


):


    """


    Download an exported file from storage


    Args:


        filename: Name of the file to download (e.g., project-history-2023-05-14.md)


    Returns:


        File download response with appropriate content type


    """


    try:


        storage = get_storage_connector()


        # Check if file exists


        if not storage.file_exists(filename):


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail = f"File not found: {filename}"


            )


        # Download file from storage


        content, content_type = storage.download_file(filename)


        # Return file as download response


        return Response(


            content = content,


            media_type = content_type,


            headers={


                "Content-Disposition": f"attachment; filename={filename}"


            }


        )


    except FileNotFoundError as e:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail = str(e)


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to download file: {str(e)}"


        )


@router.get("/files", response_model = List[Dict[str, Any]])


async def list_export_files(


    prefix: Optional[str] = None,


    current_user: User = Depends(get_current_user)


):


    """


    List all available export files in storage


    Args:


        prefix: Optional prefix to filter files (e.g., "project-history-")


    Returns:


        List of files with metadata


    """


    try:


        storage = get_storage_connector()


        # Get files from storage


        file_keys = storage.list_files(prefix or "")


        # Build file list with metadata


        files = []


        for file_key in file_keys:


            files.append({


                "filename": file_key,


                "exists": storage.file_exists(file_key),


                "download_url": f"/api/export/download/{file_key}"


            })


        return files


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to list files: {str(e)}"


        )


@router.get("/download-url/{filename}")


async def get_download_url(


    filename: str,


    expires_in: int = CONSTANT_3600,


    current_user: User = Depends(get_current_user)


):


    """


    Generate a presigned download URL for cloud storage (S3/GCS)


    Args:


        filename: Name of the file


        expires_in: URL expiration time in seconds (default 1 hour)


    Returns:


        Presigned URL for direct download


    """


    try:


        storage = get_storage_connector()


        # Check if file exists


        if not storage.file_exists(filename):


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail = f"File not found: {filename}"


            )


        # Generate download URL


        download_url = storage.get_download_url(filename, expires_in)


        return {


            "filename": filename,


            "download_url": download_url,


            "expires_in": expires_in


        }


    except FileNotFoundError as e:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail = str(e)


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to generate download URL: {str(e)}"


        )


