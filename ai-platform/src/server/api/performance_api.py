#!/usr/bin/env python3
"""
Performance Analysis API for AI Coding Intelligence Dashboard

RESTful API endpoints for performance monitoring, system resources tracking,
API performance analysis, and performance alert management.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    APIPerformanceDB, SystemResourcesDB, PerformanceAlertDB,
    PerformanceHistoryDB, SlowOperationDB
)
import logging
import psutil
import uuid
import statistics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/performance", tags=["performance"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class APIPerformanceResponse(BaseModel):
    """API performance response model"""
    id: str
    endpoint_name: str
    method: str
    response_time_ms: float
    status_code: int
    error_count: int
    success_count: int
    avg_response_time: Optional[float] = None
    p95_response_time: Optional[float] = None
    p99_response_time: Optional[float] = None
    error_rate: Optional[float] = None
    performance_trend: Optional[str] = None
    trend_percentage: Optional[float] = None
    created_at: datetime
    updated_at: datetime

class APIPerformanceCreate(BaseModel):
    """Create API performance record"""
    endpoint_name: str = Field(..., description="API endpoint name")
    method: str = Field(..., description="HTTP method")
    response_time_ms: float = Field(..., description="Response time in milliseconds")
    status_code: int = Field(..., description="HTTP status code")

class SystemResourcesResponse(BaseModel):
    """System resources response model"""
    id: str
    cpu_percent: float
    cpu_count: Optional[int] = None
    cpu_freq_mhz: Optional[float] = None
    memory_percent: float
    memory_total_mb: float
    memory_available_mb: float
    memory_used_mb: float
    memory_cached_mb: Optional[float] = None
    disk_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_free_gb: float
    disk_read_mb_s: Optional[float] = None
    disk_write_mb_s: Optional[float] = None
    network_sent_mb_s: Optional[float] = None
    network_recv_mb_s: Optional[float] = None
    network_connections: Optional[int] = None
    system_health: str
    created_at: datetime

class PerformanceAlertResponse(BaseModel):
    """Performance alert response model"""
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

class PerformanceAlertCreate(BaseModel):
    """Create performance alert"""
    alert_name: str = Field(..., description="Alert name")
    alert_type: str = Field(..., description="Alert type: api_performance, system_resources, custom")
    metric_name: str = Field(..., description="Metric to monitor")
    condition: str = Field(..., description="Condition: above, below, equals, changes_by")
    threshold_value: float = Field(..., description="Threshold value")
    severity: str = Field(default="warning", description="Severity: info, warning, critical")
    cooldown_minutes: int = Field(default=15, description="Cooldown period in minutes")

class SlowOperationResponse(BaseModel):
    """Slow operation response model"""
    id: str
    operation_name: str
    operation_type: str
    duration_ms: float
    threshold_ms: float
    endpoint: Optional[str] = None
    frequency: int
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    created_at: datetime

class PerformanceAnalyticsResponse(BaseModel):
    """Performance analytics response"""
    total_endpoints: int
    avg_response_time: float
    p95_response_time: float
    p99_response_time: float
    total_errors: int
    error_rate: float
    slow_operations_count: int
    system_health: str
    alerts_count: int
    active_alerts_count: int

# ============================================================================
# API PERFORMANCE ENDPOINTS
# ============================================================================

@router.post("/api/track", response_model=APIPerformanceResponse)
async def track_api_performance(
    performance_data: APIPerformanceCreate,
    db: Session = Depends(get_db)
):
    """
    Track API endpoint performance
    """
    try:
        # Create performance record
        performance = APIPerformanceDB(
            endpoint_name=performance_data.endpoint_name,
            method=performance_data.method,
            response_time_ms=performance_data.response_time_ms,
            status_code=performance_data.status_code,
            error_count=1 if performance_data.status_code >= 400 else 0,
            success_count=0 if performance_data.status_code >= 400 else 1
        )
        
        # Calculate historical metrics
        historical_data = db.query(APIPerformanceDB).filter(
            APIPerformanceDB.endpoint_name == performance_data.endpoint_name,
            APIPerformanceDB.method == performance_data.method
        ).order_by(APIPerformanceDB.created_at.desc()).limit(100).all()
        
        if historical_data:
            response_times = [p.response_time_ms for p in historical_data]
            performance.avg_response_time = statistics.mean(response_times)
            performance.p95_response_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) >= 20 else max(response_times)
            performance.p99_response_time = statistics.quantiles(response_times, n=100)[98] if len(response_times) >= 100 else max(response_times)
            
            # Calculate error rate
            total_requests = len(historical_data) + 1
            total_errors = sum(p.error_count for p in historical_data) + performance.error_count
            performance.error_rate = (total_errors / total_requests) * 100
            
            # Calculate trend
            if len(response_times) >= 10:
                recent_avg = statistics.mean(response_times[:10])
                older_avg = statistics.mean(response_times[10:])
                if recent_avg > older_avg * 1.1:
                    performance.performance_trend = "degrading"
                    performance.trend_percentage = ((recent_avg - older_avg) / older_avg) * 100
                elif recent_avg < older_avg * 0.9:
                    performance.performance_trend = "improving"
                    performance.trend_percentage = ((older_avg - recent_avg) / older_avg) * 100
                else:
                    performance.performance_trend = "stable"
                    performance.trend_percentage = 0
        
        db.add(performance)
        db.commit()
        db.refresh(performance)
        
        # Check for slow operations
        if performance_data.response_time_ms > 1000:  # 1 second threshold
            await _track_slow_operation(
                db,
                operation_name=f"{performance_data.method} {performance_data.endpoint_name}",
                operation_type="api",
                duration_ms=performance_data.response_time_ms,
                endpoint=performance_data.endpoint_name
            )
        
        return performance
    except Exception as e:
        logger.error(f"Error tracking API performance: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to track performance")

@router.get("/api/performance", response_model=List[APIPerformanceResponse])
async def get_api_performance(
    endpoint_name: Optional[str] = None,
    method: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get API performance data with optional filtering
    """
    try:
        query = db.query(APIPerformanceDB)
        
        if endpoint_name:
            query = query.filter(APIPerformanceDB.endpoint_name == endpoint_name)
        if method:
            query = query.filter(APIPerformanceDB.method == method)
        
        performances = query.order_by(APIPerformanceDB.created_at.desc()).limit(limit).all()
        return performances
    except Exception as e:
        logger.error(f"Error getting API performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance data")

@router.get("/api/slow", response_model=List[APIPerformanceResponse])
async def get_slow_api_calls(
    threshold_ms: float = 1000,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get slow API calls above threshold
    """
    try:
        slow_calls = db.query(APIPerformanceDB).filter(
            APIPerformanceDB.response_time_ms > threshold_ms
        ).order_by(APIPerformanceDB.response_time_ms.desc()).limit(limit).all()
        return slow_calls
    except Exception as e:
        logger.error(f"Error getting slow API calls: {e}")
        raise HTTPException(status_code=500, detail="Failed to get slow API calls")

# ============================================================================
# SYSTEM RESOURCES ENDPOINTS
# ============================================================================

@router.get("/system/current", response_model=SystemResourcesResponse)
async def get_current_system_resources(db: Session = Depends(get_db)):
    """
    Get current system resources using psutil
    """
    try:
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # Memory metrics
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_total_mb = memory.total / (1024 * 1024)
        memory_available_mb = memory.available / (1024 * 1024)
        memory_used_mb = memory.used / (1024 * 1024)
        memory_cached_mb = memory.cached / (1024 * 1024) if hasattr(memory, 'cached') else None
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        disk_total_gb = disk.total / (1024 * 1024 * 1024)
        disk_used_gb = disk.used / (1024 * 1024 * 1024)
        disk_free_gb = disk.free / (1024 * 1024 * 1024)
        
        # Network metrics
        network = psutil.net_io_counters()
        network_sent_mb = network.bytes_sent / (1024 * 1024)
        network_recv_mb = network.bytes_recv / (1024 * 1024)
        network_connections = len(psutil.net_connections())
        
        # Calculate network speed (approximate)
        network_sent_mb_s = 0  # Would need historical data for actual speed
        network_recv_mb_s = 0
        
        # System health determination
        if cpu_percent > 90 or memory_percent > 95 or disk_percent > 95:
            system_health = "critical"
        elif cpu_percent > 75 or memory_percent > 85 or disk_percent > 85:
            system_health = "warning"
        else:
            system_health = "healthy"
        
        # Create system resources record
        resources = SystemResourcesDB(
            cpu_percent=cpu_percent,
            cpu_count=cpu_count,
            cpu_freq_mhz=cpu_freq.current if cpu_freq else None,
            memory_percent=memory_percent,
            memory_total_mb=memory_total_mb,
            memory_available_mb=memory_available_mb,
            memory_used_mb=memory_used_mb,
            memory_cached_mb=memory_cached_mb,
            disk_percent=disk_percent,
            disk_total_gb=disk_total_gb,
            disk_used_gb=disk_used_gb,
            disk_free_gb=disk_free_gb,
            network_sent_mb_s=network_sent_mb_s,
            network_recv_mb_s=network_recv_mb_s,
            network_connections=network_connections,
            system_health=system_health
        )
        
        db.add(resources)
        db.commit()
        db.refresh(resources)
        
        return resources
    except Exception as e:
        logger.error(f"Error getting system resources: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system resources")

@router.get("/system/history", response_model=List[SystemResourcesResponse])
async def get_system_resources_history(
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """
    Get system resources history for specified time period
    """
    try:
        since = datetime.utcnow() - timedelta(hours=hours)
        history = db.query(SystemResourcesDB).filter(
            SystemResourcesDB.created_at >= since
        ).order_by(SystemResourcesDB.created_at.desc()).all()
        return history
    except Exception as e:
        logger.error(f"Error getting system resources history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system resources history")

# ============================================================================
# PERFORMANCE ALERTS ENDPOINTS
# ============================================================================

@router.post("/alerts", response_model=PerformanceAlertResponse)
async def create_performance_alert(
    alert_data: PerformanceAlertCreate,
    db: Session = Depends(get_db)
):
    """
    Create a performance alert
    """
    try:
        alert = PerformanceAlertDB(
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
        logger.error(f"Error creating performance alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create alert")

@router.get("/alerts", response_model=List[PerformanceAlertResponse])
async def get_performance_alerts(
    alert_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Get performance alerts with optional filtering
    """
    try:
        query = db.query(PerformanceAlertDB)
        
        if alert_type:
            query = query.filter(PerformanceAlertDB.alert_type == alert_type)
        if is_active is not None:
            query = query.filter(PerformanceAlertDB.is_active == is_active)
        
        alerts = query.order_by(PerformanceAlertDB.created_at.desc()).all()
        return alerts
    except Exception as e:
        logger.error(f"Error getting performance alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to get alerts")

@router.put("/alerts/{alert_id}/activate")
async def activate_performance_alert(
    alert_id: str,
    db: Session = Depends(get_db)
):
    """
    Activate a performance alert
    """
    try:
        alert = db.query(PerformanceAlertDB).filter(
            PerformanceAlertDB.id == alert_id
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.is_active = True
        alert.updated_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Alert activated successfully"}
    except Exception as e:
        logger.error(f"Error activating alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to activate alert")

@router.put("/alerts/{alert_id}/deactivate")
async def deactivate_performance_alert(
    alert_id: str,
    db: Session = Depends(get_db)
):
    """
    Deactivate a performance alert
    """
    try:
        alert = db.query(PerformanceAlertDB).filter(
            PerformanceAlertDB.id == alert_id
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.is_active = False
        alert.updated_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Alert deactivated successfully"}
    except Exception as e:
        logger.error(f"Error deactivating alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to deactivate alert")

# ============================================================================
# SLOW OPERATIONS ENDPOINTS
# ============================================================================

async def _track_slow_operation(
    db: Session,
    operation_name: str,
    operation_type: str,
    duration_ms: float,
    endpoint: Optional[str] = None,
    query: Optional[str] = None,
    file_path: Optional[str] = None
):
    """
    Track a slow operation (internal helper function)
    """
    try:
        # Check if operation already exists
        existing = db.query(SlowOperationDB).filter(
            SlowOperationDB.operation_name == operation_name,
            SlowOperationDB.operation_type == operation_type
        ).first()
        
        if existing:
            existing.frequency += 1
            existing.last_seen_at = datetime.utcnow()
            existing.duration_ms = min(existing.duration_ms, duration_ms)  # Keep the worst case
            existing.updated_at = datetime.utcnow()
        else:
            slow_op = SlowOperationDB(
                operation_name=operation_name,
                operation_type=operation_type,
                duration_ms=duration_ms,
                endpoint=endpoint,
                query=query,
                file_path=file_path
            )
            db.add(slow_op)
        
        db.commit()
    except Exception as e:
        logger.error(f"Error tracking slow operation: {e}")
        db.rollback()

@router.get("/slow-operations", response_model=List[SlowOperationResponse])
async def get_slow_operations(
    operation_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get slow operations with optional filtering
    """
    try:
        query = db.query(SlowOperationDB)
        
        if operation_type:
            query = query.filter(SlowOperationDB.operation_type == operation_type)
        if status:
            query = query.filter(SlowOperationDB.status == status)
        
        slow_ops = query.order_by(SlowOperationDB.duration_ms.desc()).limit(limit).all()
        return slow_ops
    except Exception as e:
        logger.error(f"Error getting slow operations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get slow operations")

@router.put("/slow-operations/{operation_id}/resolve")
async def resolve_slow_operation(
    operation_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark a slow operation as resolved
    """
    try:
        slow_op = db.query(SlowOperationDB).filter(
            SlowOperationDB.id == operation_id
        ).first()
        
        if not slow_op:
            raise HTTPException(status_code=404, detail="Slow operation not found")
        
        slow_op.status = "resolved"
        slow_op.updated_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Slow operation marked as resolved"}
    except Exception as e:
        logger.error(f"Error resolving slow operation: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to resolve slow operation")

# ============================================================================
# PERFORMANCE ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/analytics", response_model=PerformanceAnalyticsResponse)
async def get_performance_analytics(db: Session = Depends(get_db)):
    """
    Get comprehensive performance analytics
    """
    try:
        # API performance metrics
        api_performances = db.query(APIPerformanceDB).all()
        
        total_endpoints = len(set(p.endpoint_name for p in api_performances))
        response_times = [p.response_time_ms for p in api_performances]
        total_errors = sum(p.error_count for p in api_performances)
        total_requests = sum(p.success_count + p.error_count for p in api_performances)
        
        avg_response_time = statistics.mean(response_times) if response_times else 0
        p95_response_time = statistics.quantiles(response_times, n=20)[18] if len(response_times) >= 20 else (max(response_times) if response_times else 0)
        p99_response_time = statistics.quantiles(response_times, n=100)[98] if len(response_times) >= 100 else (max(response_times) if response_times else 0)
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        
        # Slow operations
        slow_operations_count = db.query(SlowOperationDB).filter(
            SlowOperationDB.status == "active"
        ).count()
        
        # System health (most recent)
        latest_resources = db.query(SystemResourcesDB).order_by(
            SystemResourcesDB.created_at.desc()
        ).first()
        system_health = latest_resources.system_health if latest_resources else "unknown"
        
        # Alerts
        alerts_count = db.query(PerformanceAlertDB).count()
        active_alerts_count = db.query(PerformanceAlertDB).filter(
            PerformanceAlertDB.is_active == True
        ).count()
        
        return PerformanceAnalyticsResponse(
            total_endpoints=total_endpoints,
            avg_response_time=avg_response_time,
            p95_response_time=p95_response_time,
            p99_response_time=p99_response_time,
            total_errors=total_errors,
            error_rate=error_rate,
            slow_operations_count=slow_operations_count,
            system_health=system_health,
            alerts_count=alerts_count,
            active_alerts_count=active_alerts_count
        )
    except Exception as e:
        logger.error(f"Error getting performance analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")