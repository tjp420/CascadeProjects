#!/usr/bin/env python3
"""
Data Upload Monitoring API for AI Coding Intelligence Dashboard

RESTful API endpoints for data upload tracking, monitoring, analytics,
and alert management.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    UploadTrackingDB, UploadStatisticsDB, UploadAlertDB,
    UploadHistoryDB, UploadPatternDB
)
import logging
import uuid
import statistics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UploadTrackingResponse(BaseModel):
    """Upload tracking response model"""
    id: str
    upload_id: str
    file_name: str
    file_type: Optional[str] = None
    file_size_mb: float
    upload_status: str
    upload_progress: int
    upload_speed_mb_s: Optional[float] = None
    processing_time_seconds: Optional[float] = None
    records_processed: Optional[int] = None
    records_failed: Optional[int] = None
    error_message: Optional[str] = None
    user_id: Optional[str] = None
    upload_category: Optional[str] = None
    priority: str
    created_at: datetime
    updated_at: datetime

class UploadTrackingCreate(BaseModel):
    """Create upload tracking record"""
    file_name: str = Field(..., description="File name")
    file_type: str = Field(..., description="File type: csv, json, xlsx, etc.")
    file_size_mb: float = Field(..., description="File size in MB")
    upload_category: str = Field(default="data_import", description="Upload category")
    priority: str = Field(default="normal", description="Priority: low, normal, high, urgent")
    user_id: Optional[str] = Field(None, description="User ID")

class UploadTrackingUpdate(BaseModel):
    """Update upload tracking record"""
    upload_status: Optional[str] = None
    upload_progress: Optional[int] = None
    upload_speed_mb_s: Optional[float] = None
    processing_time_seconds: Optional[float] = None
    records_processed: Optional[int] = None
    records_failed: Optional[int] = None
    error_message: Optional[str] = None

class UploadStatisticsResponse(BaseModel):
    """Upload statistics response model"""
    id: str
    period_type: str
    period_start: datetime
    period_end: datetime
    total_uploads: int
    successful_uploads: int
    failed_uploads: int
    pending_uploads: int
    total_size_mb: float
    avg_size_mb: Optional[float] = None
    success_rate: Optional[float] = None
    avg_processing_time_seconds: Optional[float] = None
    uploads_trend: Optional[str] = None
    created_at: datetime

class UploadAlertResponse(BaseModel):
    """Upload alert response model"""
    id: str
    alert_name: str
    alert_type: str
    metric_name: str
    condition: str
    threshold_value: float
    severity: str
    is_active: bool
    last_triggered_at: Optional[datetime] = None
    trigger_count: int
    created_at: datetime
    updated_at: datetime

class UploadAlertCreate(BaseModel):
    """Create upload alert"""
    alert_name: str = Field(..., description="Alert name")
    alert_type: str = Field(..., description="Alert type: failure_rate, processing_time, file_size, custom")
    metric_name: str = Field(..., description="Metric to monitor")
    condition: str = Field(..., description="Condition: above, below, equals, changes_by")
    threshold_value: float = Field(..., description="Threshold value")
    severity: str = Field(default="warning", description="Severity: info, warning, critical")
    cooldown_minutes: int = Field(default=30, description="Cooldown period in minutes")

class UploadAnalyticsResponse(BaseModel):
    """Upload analytics response"""
    total_uploads: int
    successful_uploads: int
    failed_uploads: int
    pending_uploads: int
    success_rate: float
    total_size_mb: float
    avg_size_mb: float
    avg_processing_time_seconds: float
    uploads_per_day: float
    failed_uploads_count: int
    slow_uploads_count: int
    active_alerts_count: int

# ============================================================================
# UPLOAD TRACKING ENDPOINTS
# ============================================================================

@router.post("/track", response_model=UploadTrackingResponse)
async def create_upload_tracking(
    upload_data: UploadTrackingCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new upload tracking record
    """
    try:
        upload = UploadTrackingDB(
            upload_id=str(uuid.uuid4()),
            file_name=upload_data.file_name,
            file_type=upload_data.file_type,
            file_size_mb=upload_data.file_size_mb,
            upload_category=upload_data.upload_category,
            priority=upload_data.priority,
            user_id=upload_data.user_id,
            upload_status="pending",
            upload_progress=0
        )
        
        db.add(upload)
        db.commit()
        db.refresh(upload)
        
        # Create history snapshot
        await _create_upload_history_snapshot(db, upload)
        
        return upload
    except Exception as e:
        logger.error(f"Error creating upload tracking: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create upload tracking")

@router.put("/track/{upload_id}", response_model=UploadTrackingResponse)
async def update_upload_tracking(
    upload_id: str,
    update_data: UploadTrackingUpdate,
    db: Session = Depends(get_db)
):
    """
    Update upload tracking record
    """
    try:
        upload = db.query(UploadTrackingDB).filter(
            UploadTrackingDB.upload_id == upload_id
        ).first()
        
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(upload, key, value)
        
        # Set processing start/end times
        if update_data.upload_status == "processing" and not upload.processing_start_time:
            upload.processing_start_time = datetime.utcnow()
        elif update_data.upload_status in ["completed", "failed"] and not upload.processing_end_time:
            upload.processing_end_time = datetime.utcnow()
            # Calculate processing time
            if upload.processing_start_time:
                upload.processing_time_seconds = (
                    upload.processing_end_time - upload.processing_start_time
                ).total_seconds()
        
        upload.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(upload)
        
        # Create history snapshot
        await _create_upload_history_snapshot(db, upload)
        
        # Check for slow uploads
        if upload.processing_time_seconds and upload.processing_time_seconds > 60:  # 1 minute threshold
            await _check_slow_upload_alert(db, upload)
        
        # Check for failed uploads
        if upload.upload_status == "failed":
            await _check_failed_upload_alert(db, upload)
        
        return upload
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating upload tracking: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update upload tracking")

@router.get("/track", response_model=List[UploadTrackingResponse])
async def get_uploads(
    status: Optional[str] = None,
    file_type: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get uploads with optional filtering
    """
    try:
        query = db.query(UploadTrackingDB)
        
        if status:
            query = query.filter(UploadTrackingDB.upload_status == status)
        if file_type:
            query = query.filter(UploadTrackingDB.file_type == file_type)
        if user_id:
            query = query.filter(UploadTrackingDB.user_id == user_id)
        
        uploads = query.order_by(UploadTrackingDB.created_at.desc()).limit(limit).all()
        return uploads
    except Exception as e:
        logger.error(f"Error getting uploads: {e}")
        raise HTTPException(status_code=500, detail="Failed to get uploads")

@router.get("/track/{upload_id}", response_model=UploadTrackingResponse)
async def get_upload(
    upload_id: str,
    db: Session = Depends(get_db)
):
    """
    Get specific upload by ID
    """
    try:
        upload = db.query(UploadTrackingDB).filter(
            UploadTrackingDB.upload_id == upload_id
        ).first()
        
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        return upload
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to get upload")

# ============================================================================
# UPLOAD STATISTICS ENDPOINTS
# ============================================================================

@router.get("/statistics/current", response_model=UploadStatisticsResponse)
async def get_current_statistics(db: Session = Depends(get_db)):
    """
    Get current upload statistics (today)
    """
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        stats = db.query(UploadStatisticsDB).filter(
            UploadStatisticsDB.period_type == "daily",
            UploadStatisticsDB.period_start >= today,
            UploadStatisticsDB.period_end < tomorrow
        ).first()
        
        if not stats:
            # Generate real-time statistics
            stats = await _generate_realtime_statistics(db, "daily", today, tomorrow)
        
        return stats
    except Exception as e:
        logger.error(f"Error getting current statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")

@router.get("/statistics/history", response_model=List[UploadStatisticsResponse])
async def get_statistics_history(
    days: int = 30,
    db: Session = Depends(get_db)
):
    """
    Get upload statistics history
    """
    try:
        since = datetime.utcnow() - timedelta(days=days)
        history = db.query(UploadStatisticsDB).filter(
            UploadStatisticsDB.period_type == "daily",
            UploadStatisticsDB.period_start >= since
        ).order_by(UploadStatisticsDB.period_start.desc()).all()
        return history
    except Exception as e:
        logger.error(f"Error getting statistics history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get statistics history")

# ============================================================================
# UPLOAD ALERTS ENDPOINTS
# ============================================================================

@router.post("/alerts", response_model=UploadAlertResponse)
async def create_upload_alert(
    alert_data: UploadAlertCreate,
    db: Session = Depends(get_db)
):
    """
    Create an upload alert
    """
    try:
        alert = UploadAlertDB(
            alert_name=alert_data.alert_name,
            alert_type=alert_data.alert_type,
            metric_name=alert_data.metric_name,
            condition=alert_data.condition,
            threshold_value=alert_data.threshold_value,
            severity=alert_data.severity,
            cooldown_minutes=alert_data.cooldown_minutes
        )
        
        db.add(alert)
        db.commit()
        db.refresh(alert)
        
        return alert
    except Exception as e:
        logger.error(f"Error creating upload alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create alert")

@router.get("/alerts", response_model=List[UploadAlertResponse])
async def get_upload_alerts(
    alert_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Get upload alerts with optional filtering
    """
    try:
        query = db.query(UploadAlertDB)
        
        if alert_type:
            query = query.filter(UploadAlertDB.alert_type == alert_type)
        if is_active is not None:
            query = query.filter(UploadAlertDB.is_active == is_active)
        
        alerts = query.order_by(UploadAlertDB.created_at.desc()).all()
        return alerts
    except Exception as e:
        logger.error(f"Error getting upload alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to get alerts")

@router.put("/alerts/{alert_id}/activate")
async def activate_upload_alert(
    alert_id: str,
    db: Session = Depends(get_db)
):
    """
    Activate an upload alert
    """
    try:
        alert = db.query(UploadAlertDB).filter(
            UploadAlertDB.id == alert_id
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.is_active = True
        alert.updated_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Alert activated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to activate alert")

@router.put("/alerts/{alert_id}/deactivate")
async def deactivate_upload_alert(
    alert_id: str,
    db: Session = Depends(get_db)
):
    """
    Deactivate an upload alert
    """
    try:
        alert = db.query(UploadAlertDB).filter(
            UploadAlertDB.id == alert_id
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.is_active = False
        alert.updated_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Alert deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to deactivate alert")

# ============================================================================
# UPLOAD ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/analytics", response_model=UploadAnalyticsResponse)
async def get_upload_analytics(db: Session = Depends(get_db)):
    """
    Get comprehensive upload analytics
    """
    try:
        # Get all uploads
        uploads = db.query(UploadTrackingDB).all()
        
        total_uploads = len(uploads)
        successful_uploads = len([u for u in uploads if u.upload_status == "completed"])
        failed_uploads = len([u for u in uploads if u.upload_status == "failed"])
        pending_uploads = len([u for u in uploads if u.upload_status in ["pending", "uploading", "processing"]])
        
        success_rate = (successful_uploads / total_uploads * 100) if total_uploads > 0 else 0
        
        total_size_mb = sum(u.file_size_mb for u in uploads)
        avg_size_mb = total_size_mb / total_uploads if total_uploads > 0 else 0
        
        processing_times = [u.processing_time_seconds for u in uploads if u.processing_time_seconds]
        avg_processing_time_seconds = statistics.mean(processing_times) if processing_times else 0
        
        # Calculate uploads per day (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_uploads = [u for u in uploads if u.created_at >= seven_days_ago]
        uploads_per_day = len(recent_uploads) / 7 if recent_uploads else 0
        
        # Slow uploads (> 60 seconds)
        slow_uploads_count = len([u for u in uploads if u.processing_time_seconds and u.processing_time_seconds > 60])
        
        # Active alerts
        active_alerts_count = db.query(UploadAlertDB).filter(
            UploadAlertDB.is_active == True
        ).count()
        
        return UploadAnalyticsResponse(
            total_uploads=total_uploads,
            successful_uploads=successful_uploads,
            failed_uploads=failed_uploads,
            pending_uploads=pending_uploads,
            success_rate=success_rate,
            total_size_mb=total_size_mb,
            avg_size_mb=avg_size_mb,
            avg_processing_time_seconds=avg_processing_time_seconds,
            uploads_per_day=uploads_per_day,
            failed_uploads_count=failed_uploads,
            slow_uploads_count=slow_uploads_count,
            active_alerts_count=active_alerts_count
        )
    except Exception as e:
        logger.error(f"Error getting upload analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def _create_upload_history_snapshot(db: Session, upload: UploadTrackingDB):
    """
    Create a history snapshot for an upload (internal helper)
    """
    try:
        history = UploadHistoryDB(
            upload_id=upload.upload_id,
            snapshot_time=datetime.utcnow(),
            upload_status=upload.upload_status,
            upload_progress=upload.upload_progress,
            processing_time_seconds=upload.processing_time_seconds,
            file_size_mb=upload.file_size_mb
        )
        db.add(history)
        db.commit()
    except Exception as e:
        logger.error(f"Error creating upload history snapshot: {e}")
        db.rollback()

async def _check_slow_upload_alert(db: Session, upload: UploadTrackingDB):
    """
    Check if upload is slow and trigger alert if needed (internal helper)
    """
    try:
        # Check for existing slow upload alert
        alert = db.query(UploadAlertDB).filter(
            UploadAlertDB.alert_type == "processing_time",
            UploadAlertDB.is_active == True
        ).first()
        
        if alert and upload.processing_time_seconds > alert.threshold_value:
            # Update alert trigger count
            alert.last_triggered_at = datetime.utcnow()
            alert.trigger_count += 1
            db.commit()
    except Exception as e:
        logger.error(f"Error checking slow upload alert: {e}")
        db.rollback()

async def _check_failed_upload_alert(db: Session, upload: UploadTrackingDB):
    """
    Check if upload failed and trigger alert if needed (internal helper)
    """
    try:
        # Check for existing failure alert
        alert = db.query(UploadAlertDB).filter(
            UploadAlertDB.alert_type == "failure_rate",
            UploadAlertDB.is_active == True
        ).first()
        
        if alert:
            # Update alert trigger count
            alert.last_triggered_at = datetime.utcnow()
            alert.trigger_count += 1
            db.commit()
    except Exception as e:
        logger.error(f"Error checking failed upload alert: {e}")
        db.rollback()

async def _generate_realtime_statistics(
    db: Session,
    period_type: str,
    period_start: datetime,
    period_end: datetime
) -> UploadStatisticsDB:
    """
    Generate real-time statistics for a time period (internal helper)
    """
    try:
        # Get uploads in the period
        uploads = db.query(UploadTrackingDB).filter(
            UploadTrackingDB.created_at >= period_start,
            UploadTrackingDB.created_at < period_end
        ).all()
        
        total_uploads = len(uploads)
        successful_uploads = len([u for u in uploads if u.upload_status == "completed"])
        failed_uploads = len([u for u in uploads if u.upload_status == "failed"])
        pending_uploads = len([u for u in uploads if u.upload_status in ["pending", "uploading", "processing"]])
        
        total_size_mb = sum(u.file_size_mb for u in uploads)
        avg_size_mb = total_size_mb / total_uploads if total_uploads > 0 else 0
        
        processing_times = [u.processing_time_seconds for u in uploads if u.processing_time_seconds]
        avg_processing_time_seconds = statistics.mean(processing_times) if processing_times else 0
        
        success_rate = (successful_uploads / total_uploads * 100) if total_uploads > 0 else 0
        failure_rate = (failed_uploads / total_uploads * 100) if total_uploads > 0 else 0
        
        # File type breakdown
        file_type_counts = {}
        for upload in uploads:
            file_type_counts[upload.file_type] = file_type_counts.get(upload.file_type, 0) + 1
        
        # Create statistics record
        stats = UploadStatisticsDB(
            period_type=period_type,
            period_start=period_start,
            period_end=period_end,
            total_uploads=total_uploads,
            successful_uploads=successful_uploads,
            failed_uploads=failed_uploads,
            pending_uploads=pending_uploads,
            total_size_mb=total_size_mb,
            avg_size_mb=avg_size_mb,
            avg_processing_time_seconds=avg_processing_time_seconds,
            success_rate=success_rate,
            failure_rate=failure_rate,
            file_type_counts=file_type_counts
        )
        
        db.add(stats)
        db.commit()
        db.refresh(stats)
        
        return stats
    except Exception as e:
        logger.error(f"Error generating realtime statistics: {e}")
        db.rollback()
        raise