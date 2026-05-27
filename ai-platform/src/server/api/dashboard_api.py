#!/usr/bin/env python3
"""
Dashboard Metrics API for AI Coding Intelligence Dashboard

RESTful API endpoints for dashboard metrics with real-time updates,
historical tracking, and automated reporting capabilities.
"""

from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    DashboardMetricDB, MetricHistoryDB, BackupSystemStatusDB,
    MetricAlertDB, DashboardSnapshotDB, RoadmapDB, MilestoneDB,
    RefactoringPlanDB, ComplexityAnalysisDB
)
import logging
import json
import uuid

logger = logging.getLogger(__name__)

# ============================================================================
# REAL-TIME CONNECTION MANAGER
# ============================================================================

class DashboardConnectionManager:
    """Manages WebSocket connections for dashboard real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.metric_subscribers: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Dashboard client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        # Remove from metric subscriptions
        for metric_name, subscribers in self.metric_subscribers.items():
            if websocket in subscribers:
                subscribers.remove(websocket)
        logger.info(f"Dashboard client disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast_update(self, message: dict):
        """Broadcast update to all connected dashboard clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                # Connection might be closed
                pass
    
    async def send_metric_update(self, metric_name: str, message: dict):
        """Send update to clients subscribed to specific metric"""
        if metric_name in self.metric_subscribers:
            for connection in self.metric_subscribers[metric_name]:
                try:
                    await connection.send_json(message)
                except:
                    pass
    
    def subscribe_to_metric(self, metric_name: str, websocket: WebSocket):
        """Subscribe a client to updates for a specific metric"""
        if metric_name not in self.metric_subscribers:
            self.metric_subscribers[metric_name] = []
        self.metric_subscribers[metric_name].append(websocket)

dashboard_manager = DashboardConnectionManager()

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class DashboardMetricResponse(BaseModel):
    id: str
    metric_name: str
    metric_value: float
    metric_type: str
    category: str
    previous_value: Optional[float]
    change_value: Optional[float]
    change_percentage: Optional[float]
    trend_direction: Optional[str]
    description: Optional[str]
    unit: Optional[str]
    threshold_warning: Optional[float]
    threshold_critical: Optional[float]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

class DashboardMetricCreate(BaseModel):
    metric_name: str = Field(..., description="Unique metric name")
    metric_value: float = Field(..., description="Current metric value")
    metric_type: str = Field(..., description="Type: percentage, count, time, status")
    category: str = Field(..., description="Category: quality, security, performance, backup")
    description: Optional[str] = None
    unit: Optional[str] = None
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class DashboardMetricUpdate(BaseModel):
    metric_value: Optional[float] = None
    description: Optional[str] = None
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class MetricHistoryResponse(BaseModel):
    id: str
    metric_name: str
    metric_value: float
    metric_type: str
    recorded_at: datetime
    context: Optional[Dict[str, Any]]
    previous_value: Optional[float]
    change_value: Optional[float]
    change_percentage: Optional[float]

class BackupStatusResponse(BaseModel):
    id: str
    backup_api_connected: bool
    realtime_updates_active: bool
    total_backups: int
    last_backup_time: Optional[datetime]
    last_backup_status: Optional[str]
    last_backup_size: Optional[int]
    last_backup_duration: Optional[int]
    next_backup_time: Optional[datetime]
    backup_schedule: Optional[str]
    system_health: str
    last_health_check: datetime
    backup_location: Optional[str]
    retention_policy: Optional[str]
    created_at: datetime
    updated_at: datetime

class BackupStatusUpdate(BaseModel):
    backup_api_connected: Optional[bool] = None
    realtime_updates_active: Optional[bool] = None
    total_backups: Optional[int] = None
    last_backup_time: Optional[datetime] = None
    last_backup_status: Optional[str] = None
    last_backup_size: Optional[int] = None
    last_backup_duration: Optional[int] = None
    next_backup_time: Optional[datetime] = None
    backup_schedule: Optional[str] = None
    system_health: Optional[str] = None
    backup_location: Optional[str] = None
    retention_policy: Optional[str] = None

class MetricAlertCreate(BaseModel):
    metric_name: str = Field(..., description="Metric to monitor")
    alert_type: str = Field(..., description="Type: threshold, trend, anomaly")
    condition: str = Field(..., description="Condition: above, below, equals, changes_by")
    threshold_value: Optional[float] = None
    severity: str = Field(default="warning", description="Severity: info, warning, critical")
    description: Optional[str] = None
    notify_on_trigger: bool = True
    notification_channels: Optional[List[str]] = None
    notification_recipients: Optional[List[str]] = None
    cooldown_period_minutes: int = 60

class MetricAlertResponse(BaseModel):
    id: str
    metric_name: str
    alert_type: str
    condition: str
    threshold_value: Optional[float]
    is_active: bool
    last_triggered: Optional[datetime]
    trigger_count: int
    notify_on_trigger: bool
    notification_channels: Optional[List[str]]
    notification_recipients: Optional[List[str]]
    severity: Optional[str]
    description: Optional[str]
    cooldown_period_minutes: int
    created_at: datetime
    updated_at: datetime

class DashboardSnapshotResponse(BaseModel):
    id: str
    snapshot_time: datetime
    metrics_data: Optional[Dict[str, Any]]
    backup_status: Optional[Dict[str, Any]]
    system_health: Optional[str]
    context: Optional[Dict[str, Any]]
    created_by: Optional[str]
    snapshot_type: Optional[str]
    created_at: datetime

# ============================================================================
# COMPLEXITY ANALYSIS MODELS
# ============================================================================

class ComplexityMetricResponse(BaseModel):
    id: str
    file_id: str
    file_path: str
    file_name: str
    complexity_score: int
    cyclomatic_complexity: Optional[int]
    maintainability_index: Optional[int]
    lines_of_code: Optional[int]
    functions_count: Optional[int]
    analyzed_at: datetime
    previous_complexity: Optional[int]
    complexity_change: Optional[int]
    improvement_percentage: Optional[float]

class ComplexitySummaryResponse(BaseModel):
    total_files_analyzed: int
    average_complexity: float
    total_complexity: int
    high_complexity_files: int
    medium_complexity_files: int
    low_complexity_files: int
    complexity_distribution: Dict[str, int]
    trend_direction: str
    improvement_rate: float

class RefactoringPlanSummaryResponse(BaseModel):
    total_plans: int
    critical_priority: int
    high_priority: int
    medium_priority: int
    low_priority: int
    total_estimated_hours: int
    in_progress: int
    completed: int
    average_complexity_reduction: float

# ============================================================================
# DASHBOARD METRICS ENDPOINTS
# ============================================================================

@router.get("/metrics", response_model=List[DashboardMetricResponse])
async def get_all_metrics(
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all dashboard metrics, optionally filtered by category
    """
    try:
        query = db.query(DashboardMetricDB)
        if category:
            query = query.filter(DashboardMetricDB.category == category)
        
        metrics = query.order_by(DashboardMetricDB.metric_name).offset(skip).limit(limit).all()
        return metrics
    except Exception as e:
        logger.error(f"Error fetching dashboard metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch metrics")

@router.get("/metrics/{metric_name}", response_model=DashboardMetricResponse)
async def get_metric(metric_name: str, db: Session = Depends(get_db)):
    """
    Get a specific metric by name
    """
    try:
        metric = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == metric_name
        ).first()
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        return metric
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching metric {metric_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch metric")

@router.post("/metrics", response_model=DashboardMetricResponse)
async def create_metric(
    metric_data: DashboardMetricCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new dashboard metric
    """
    try:
        # Check if metric already exists
        existing = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == metric_data.metric_name
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Metric already exists")
        
        new_metric = DashboardMetricDB(**metric_data.dict())
        db.add(new_metric)
        db.commit()
        db.refresh(new_metric)
        
        # Notify subscribers
        await dashboard_manager.broadcast_update({
            "type": "metric_created",
            "metric_name": new_metric.metric_name,
            "metric_value": new_metric.metric_value,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return new_metric
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating metric: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create metric")

@router.put("/metrics/{metric_name}", response_model=DashboardMetricResponse)
async def update_metric(
    metric_name: str,
    metric_update: DashboardMetricUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing metric with automatic trend calculation
    """
    try:
        metric = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == metric_name
        ).first()
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        
        # Store previous value for trend calculation
        previous_value = metric.metric_value
        
        # Update fields
        update_data = metric_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(metric, key, value)
        
        # Calculate trend if value changed
        if "metric_value" in update_data:
            metric.previous_value = previous_value
            metric.change_value = metric.metric_value - previous_value
            if previous_value != 0:
                metric.change_percentage = (metric.change_value / previous_value) * 100
            else:
                metric.change_percentage = 0
            
            # Determine trend direction
            if metric.change_value > 0:
                metric.trend_direction = "up"
            elif metric.change_value < 0:
                metric.trend_direction = "down"
            else:
                metric.trend_direction = "stable"
        
        metric.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(metric)
        
        # Create history entry
        history_entry = MetricHistoryDB(
            metric_name=metric_name,
            metric_value=metric.metric_value,
            metric_type=metric.metric_type,
            previous_value=previous_value,
            change_value=metric.change_value,
            change_percentage=metric.change_percentage
        )
        db.add(history_entry)
        db.commit()
        
        # Check alerts
        await _check_metric_alerts(metric_name, metric.metric_value, db)
        
        # Notify subscribers
        await dashboard_manager.send_metric_update(metric_name, {
            "type": "metric_updated",
            "metric_name": metric_name,
            "metric_value": metric.metric_value,
            "previous_value": previous_value,
            "change_value": metric.change_value,
            "change_percentage": metric.change_percentage,
            "trend_direction": metric.trend_direction,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return metric
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating metric {metric_name}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update metric")

@router.delete("/metrics/{metric_name}")
async def delete_metric(metric_name: str, db: Session = Depends(get_db)):
    """
    Delete a metric
    """
    try:
        metric = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == metric_name
        ).first()
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        
        db.delete(metric)
        db.commit()
        
        # Notify subscribers
        await dashboard_manager.broadcast_update({
            "type": "metric_deleted",
            "metric_name": metric_name,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {"message": "Metric deleted successfully", "metric_name": metric_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting metric {metric_name}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete metric")

# ============================================================================
# METRIC HISTORY ENDPOINTS
# ============================================================================

@router.get("/metrics/{metric_name}/history", response_model=List[MetricHistoryResponse])
async def get_metric_history(
    metric_name: str,
    hours: int = 24,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get historical data for a specific metric
    """
    try:
        # Verify metric exists
        metric = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == metric_name
        ).first()
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        
        # Calculate time range
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        
        history = db.query(MetricHistoryDB).filter(
            MetricHistoryDB.metric_name == metric_name,
            MetricHistoryDB.recorded_at >= time_threshold
        ).order_by(MetricHistoryDB.recorded_at.desc()).offset(skip).limit(limit).all()
        
        return history
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching history for {metric_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch metric history")

# ============================================================================
# BACKUP STATUS ENDPOINTS
# ============================================================================

@router.get("/backup/status", response_model=BackupStatusResponse)
async def get_backup_status(db: Session = Depends(get_db)):
    """
    Get current backup system status
    """
    try:
        status = db.query(BackupSystemStatusDB).first()
        if not status:
            # Create default status if none exists
            status = BackupSystemStatusDB(
                backup_api_connected=True,
                realtime_updates_active=True,
                total_backups=2,
                last_backup_time=datetime.utcnow() - timedelta(hours=2),
                last_backup_status="success",
                system_health="healthy"
            )
            db.add(status)
            db.commit()
            db.refresh(status)
        
        return status
    except Exception as e:
        logger.error(f"Error fetching backup status: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch backup status")

@router.put("/backup/status", response_model=BackupStatusResponse)
async def update_backup_status(
    status_update: BackupStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Update backup system status
    """
    try:
        status = db.query(BackupSystemStatusDB).first()
        if not status:
            status = BackupSystemStatusDB()
            db.add(status)
        
        # Update fields
        update_data = status_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(status, key, value)
        
        status.last_health_check = datetime.utcnow()
        status.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(status)
        
        # Notify subscribers
        await dashboard_manager.broadcast_update({
            "type": "backup_status_updated",
            "status": {
                "backup_api_connected": status.backup_api_connected,
                "realtime_updates_active": status.realtime_updates_active,
                "system_health": status.system_health,
                "total_backups": status.total_backups
            },
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return status
    except Exception as e:
        logger.error(f"Error updating backup status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update backup status")

@router.get("/backup/health")
async def check_backup_health():
    """
    Check backup API health by testing actual connectivity
    """
    import httpx
    import asyncio
    
    try:
        # Test backup API connectivity
        backup_api_url = "http://localhost:8002/api/backup"
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Test config endpoint
            try:
                config_response = await client.get(f"{backup_api_url}/config")
                config_ok = config_response.status_code == 200
            except:
                config_ok = False
            
            # Test list endpoint
            try:
                list_response = await client.get(f"{backup_api_url}/list")
                list_ok = list_response.status_code == 200
            except:
                list_ok = False
            
            # Test stats endpoint
            try:
                stats_response = await client.get(f"{backup_api_url}/stats")
                stats_ok = stats_response.status_code == 200
            except:
                stats_ok = False
        
        # Overall health determination
        all_ok = config_ok and list_ok and stats_ok
        
        health_status = {
            "backup_api_healthy": all_ok,
            "backup_api_url": backup_api_url,
            "endpoints": {
                "config": "operational" if config_ok else "failed",
                "list": "operational" if list_ok else "failed",
                "stats": "operational" if stats_ok else "failed"
            },
            "overall_health": "healthy" if all_ok else "unhealthy",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Update database status
        db = next(get_db())
        try:
            status = db.query(BackupSystemStatusDB).first()
            if not status:
                status = BackupSystemStatusDB()
                db.add(status)
            
            status.backup_api_connected = all_ok
            status.last_health_check = datetime.utcnow()
            status.system_health = "healthy" if all_ok else "critical"
            status.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(status)
        except Exception as e:
            logger.error(f"Error updating backup health in database: {e}")
            db.rollback()
        finally:
            db.close()
        
        return health_status
        
    except Exception as e:
        logger.error(f"Error checking backup health: {e}")
        return {
            "backup_api_healthy": False,
            "backup_api_url": "http://localhost:8002/api/backup",
            "error": str(e),
            "overall_health": "unhealthy",
            "timestamp": datetime.utcnow().isoformat()
        }

# ============================================================================
# PERFORMANCE MONITORING ENDPOINTS
# ============================================================================

@router.get("/performance/summary")
async def get_performance_summary(db: Session = Depends(get_db)):
    """
    Get performance summary for dashboard
    """
    try:
        from performance_api import get_performance_analytics
        return await get_performance_analytics(db)
    except Exception as e:
        logger.error(f"Error getting performance summary: {e}")
        return {
            "total_endpoints": 0,
            "avg_response_time": 0,
            "p95_response_time": 0,
            "p99_response_time": 0,
            "total_errors": 0,
            "error_rate": 0,
            "slow_operations_count": 0,
            "system_health": "unknown",
            "alerts_count": 0,
            "active_alerts_count": 0
        }

@router.get("/performance/system")
async def get_system_performance(db: Session = Depends(get_db)):
    """
    Get current system performance for dashboard
    """
    try:
        from performance_api import get_current_system_resources
        return await get_current_system_resources(db)
    except Exception as e:
        logger.error(f"Error getting system performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system performance")

@router.get("/performance/slow")
async def get_slow_operations_dashboard(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get slow operations for dashboard
    """
    try:
        from performance_api import get_slow_operations
        return await get_slow_operations(None, "active", limit, db)
    except Exception as e:
        logger.error(f"Error getting slow operations: {e}")
        return []

@router.get("/uploads/summary")
async def get_upload_summary(db: Session = Depends(get_db)):
    """
    Get upload summary for dashboard
    """
    try:
        from upload_monitoring_api import get_upload_analytics
        return await get_upload_analytics(db)
    except Exception as e:
        logger.error(f"Error getting upload summary: {e}")
        return {
            "total_uploads": 0,
            "successful_uploads": 0,
            "failed_uploads": 0,
            "pending_uploads": 0,
            "success_rate": 0,
            "total_size_mb": 0,
            "avg_size_mb": 0,
            "avg_processing_time_seconds": 0,
            "uploads_per_day": 0,
            "failed_uploads_count": 0,
            "slow_uploads_count": 0,
            "active_alerts_count": 0
        }

@router.get("/uploads/statistics")
async def get_upload_statistics_dashboard(db: Session = Depends(get_db)):
    """
    Get current upload statistics for dashboard
    """
    try:
        from upload_monitoring_api import get_current_statistics
        return await get_current_statistics(db)
    except Exception as e:
        logger.error(f"Error getting upload statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get upload statistics")

@router.get("/uploads/recent")
async def get_recent_uploads_dashboard(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get recent uploads for dashboard
    """
    try:
        from upload_monitoring_api import get_uploads
        return await get_uploads(None, None, None, limit, db)
    except Exception as e:
        logger.error(f"Error getting recent uploads: {e}")
        return []

# ============================================================================
# METRIC ALERTS ENDPOINTS
# ============================================================================

@router.post("/alerts", response_model=MetricAlertResponse)
async def create_alert(
    alert_data: MetricAlertCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new metric alert
    """
    try:
        # Verify metric exists
        metric = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == alert_data.metric_name
        ).first()
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        
        new_alert = MetricAlertDB(**alert_data.dict())
        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)
        
        return new_alert
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create alert")

@router.get("/alerts", response_model=List[MetricAlertResponse])
async def get_alerts(
    metric_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all metric alerts, optionally filtered
    """
    try:
        query = db.query(MetricAlertDB)
        
        if metric_name:
            query = query.filter(MetricAlertDB.metric_name == metric_name)
        if is_active is not None:
            query = query.filter(MetricAlertDB.is_active == is_active)
        
        alerts = query.order_by(MetricAlertDB.created_at.desc()).offset(skip).limit(limit).all()
        return alerts
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch alerts")

@router.put("/alerts/{alert_id}", response_model=MetricAlertResponse)
async def update_alert(
    alert_id: str,
    is_active: bool,
    db: Session = Depends(get_db)
):
    """
    Activate or deactivate an alert
    """
    try:
        alert = db.query(MetricAlertDB).filter(MetricAlertDB.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.is_active = is_active
        alert.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)
        
        return alert
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating alert {alert_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update alert")

@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, db: Session = Depends(get_db)):
    """
    Delete an alert
    """
    try:
        alert = db.query(MetricAlertDB).filter(MetricAlertDB.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        db.delete(alert)
        db.commit()
        
        return {"message": "Alert deleted successfully", "alert_id": alert_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting alert {alert_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete alert")

# ============================================================================
# DASHBOARD SNAPSHOT ENDPOINTS
# ============================================================================

@router.post("/snapshots", response_model=DashboardSnapshotResponse)
async def create_snapshot(
    snapshot_type: str = "manual",
    db: Session = Depends(get_db)
):
    """
    Create a complete dashboard snapshot
    """
    try:
        # Gather all current metrics
        metrics = db.query(DashboardMetricDB).all()
        metrics_data = {
            metric.metric_name: {
                "value": metric.metric_value,
                "type": metric.metric_type,
                "category": metric.category,
                "unit": metric.unit,
                "trend_direction": metric.trend_direction,
                "change_percentage": metric.change_percentage
            }
            for metric in metrics
        }
        
        # Get backup status
        backup_status = db.query(BackupSystemStatusDB).first()
        backup_data = None
        if backup_status:
            backup_data = {
                "backup_api_connected": backup_status.backup_api_connected,
                "realtime_updates_active": backup_status.realtime_updates_active,
                "total_backups": backup_status.total_backups,
                "system_health": backup_status.system_health
            }
        
        # Determine overall system health
        system_health = "healthy"
        if backup_status and backup_status.system_health == "critical":
            system_health = "critical"
        elif backup_status and backup_status.system_health == "warning":
            system_health = "warning"
        
        # Create snapshot
        snapshot = DashboardSnapshotDB(
            snapshot_time=datetime.utcnow(),
            metrics_data=metrics_data,
            backup_status=backup_data,
            system_health=system_health,
            created_by="system",
            snapshot_type=snapshot_type
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        
        return snapshot
    except Exception as e:
        logger.error(f"Error creating snapshot: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create snapshot")

@router.get("/snapshots", response_model=List[DashboardSnapshotResponse])
async def get_snapshots(
    hours: int = 24,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get dashboard snapshots within time range
    """
    try:
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        
        snapshots = db.query(DashboardSnapshotDB).filter(
            DashboardSnapshotDB.snapshot_time >= time_threshold
        ).order_by(DashboardSnapshotDB.snapshot_time.desc()).offset(skip).limit(limit).all()
        
        return snapshots
    except Exception as e:
        logger.error(f"Error fetching snapshots: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch snapshots")

# ============================================================================
# REAL-TIME WEBSOCKET ENDPOINT
# ============================================================================

@router.websocket("/ws")
async def dashboard_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time dashboard updates
    """
    await dashboard_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle subscription requests
            if message.get("action") == "subscribe":
                metric_name = message.get("metric_name")
                if metric_name:
                    dashboard_manager.subscribe_to_metric(metric_name, websocket)
                    await websocket.send_json({
                        "type": "subscribed",
                        "metric_name": metric_name,
                        "timestamp": datetime.utcnow().isoformat()
                    })
            
            # Handle ping/pong for connection health
            elif message.get("action") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Handle unsubscribe requests
            elif message.get("action") == "unsubscribe":
                metric_name = message.get("metric_name")
                if metric_name and metric_name in dashboard_manager.metric_subscribers:
                    if websocket in dashboard_manager.metric_subscribers[metric_name]:
                        dashboard_manager.metric_subscribers[metric_name].remove(websocket)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "metric_name": metric_name,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
    except WebSocketDisconnect:
        dashboard_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        dashboard_manager.disconnect(websocket)

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

async def _check_metric_alerts(metric_name: str, current_value: float, db: Session):
    """
    Check if any alerts should be triggered for a metric
    """
    try:
        alerts = db.query(MetricAlertDB).filter(
            MetricAlertDB.metric_name == metric_name,
            MetricAlertDB.is_active == True
        ).all()
        
        for alert in alerts:
            should_trigger = False
            
            # Check cooldown period
            if alert.last_triggered:
                cooldown_elapsed = (datetime.utcnow() - alert.last_triggered).total_seconds() / 60
                if cooldown_elapsed < alert.cooldown_period_minutes:
                    continue
            
            # Evaluate alert condition
            if alert.condition == "above" and alert.threshold_value:
                if current_value > alert.threshold_value:
                    should_trigger = True
            elif alert.condition == "below" and alert.threshold_value:
                if current_value < alert.threshold_value:
                    should_trigger = True
            elif alert.condition == "equals" and alert.threshold_value:
                if current_value == alert.threshold_value:
                    should_trigger = True
            
            if should_trigger:
                # Update alert
                alert.last_triggered = datetime.utcnow()
                alert.trigger_count += 1
                db.commit()
                
                # Send notification
                await dashboard_manager.broadcast_update({
                    "type": "alert_triggered",
                    "alert_id": alert.id,
                    "metric_name": metric_name,
                    "severity": alert.severity,
                    "current_value": current_value,
                    "threshold_value": alert.threshold_value,
                    "condition": alert.condition,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                logger.info(f"Alert triggered: {alert.id} for metric {metric_name}")
    
    except Exception as e:
        logger.error(f"Error checking metric alerts: {e}")

async def _check_complexity_alerts(db: Session):
    """
    Check for complexity-related alerts
    """
    try:
        # Get high complexity files
        high_complexity = db.query(ComplexityAnalysisDB).filter(
            ComplexityAnalysisDB.complexity_score >= 8
        ).all()
        
        if len(high_complexity) >= 3:
            await dashboard_manager.broadcast_update({
                "type": "complexity_alert",
                "severity": "warning",
                "message": f"{len(high_complexity)} files with high complexity detected",
                "count": len(high_complexity),
                "recommendation": "Consider refactoring high complexity files",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Get critical complexity files
        critical_complexity = db.query(ComplexityAnalysisDB).filter(
            ComplexityAnalysisDB.complexity_score >= 10
        ).all()
        
        if critical_complexity:
            for analysis in critical_complexity:
                await dashboard_manager.broadcast_update({
                    "type": "critical_complexity",
                    "severity": "critical",
                    "file_name": analysis.file_name,
                    "complexity_score": analysis.complexity_score,
                    "message": f"Critical complexity detected in {analysis.file_name}",
                    "recommendation": "Immediate refactoring required",
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    except Exception as e:
        logger.error(f"Error checking complexity alerts: {e}")

# ============================================================================
# INITIAL DATA SETUP
# ============================================================================

@router.post("/initialize")
async def initialize_dashboard_data(db: Session = Depends(get_db)):
    """
    Initialize dashboard with sample data based on the provided dashboard overview
    """
    try:
        # Check if already initialized
        existing_metrics = db.query(DashboardMetricDB).count()
        if existing_metrics > 0:
            return {"message": "Dashboard already initialized", "metrics_count": existing_metrics}
        
        # Create metrics based on the dashboard data provided
        metrics_data = [
            {
                "metric_name": "code_quality",
                "metric_value": 87.0,
                "metric_type": "percentage",
                "category": "quality",
                "description": "Overall code quality score",
                "unit": "%",
                "threshold_warning": 80.0,
                "threshold_critical": 70.0,
                "metadata": {"change_description": "+5% from last week"}
            },
            {
                "metric_name": "security_issues",
                "metric_value": 12.0,
                "metric_type": "count",
                "category": "security",
                "description": "Number of unresolved security issues",
                "unit": "issues",
                "threshold_warning": 15.0,
                "threshold_critical": 25.0,
                "metadata": {"change_description": "-3 resolved"}
            },
            {
                "metric_name": "files_analyzed",
                "metric_value": 156.0,
                "metric_type": "count",
                "category": "quality",
                "description": "Total number of files analyzed",
                "unit": "files",
                "metadata": {"change_description": "+12 new files"}
            },
            {
                "metric_name": "avg_load_time",
                "metric_value": 4.2,
                "metric_type": "time",
                "category": "performance",
                "description": "Average system load time",
                "unit": "seconds",
                "threshold_warning": 5.0,
                "threshold_critical": 8.0,
                "metadata": {"change_description": "-0.8s improved"}
            },
            {
                "metric_name": "complexity_score",
                "metric_value": 7.8,
                "metric_type": "count",
                "category": "quality",
                "description": "Average code complexity score",
                "unit": "score",
                "threshold_warning": 8.0,
                "threshold_critical": 10.0,
                "previous_value": 8.2,
                "change_value": -0.4,
                "change_percentage": -4.9,
                "trend_direction": "down",
                "metadata": {"change_description": "-0.4 improvement from last analysis"}
            }
        ]
        
        created_metrics = []
        for metric_data in metrics_data:
            # Parse change description to set trend data
            metadata = metric_data.pop("metadata", {})
            change_desc = metadata.get("change_description", "")
            
            # Calculate trend from description
            if "+5%" in change_desc:
                metric_data["previous_value"] = 82.0
                metric_data["change_value"] = 5.0
                metric_data["change_percentage"] = 6.1
                metric_data["trend_direction"] = "up"
            elif "-3" in change_desc:
                metric_data["previous_value"] = 15.0
                metric_data["change_value"] = -3.0
                metric_data["change_percentage"] = -20.0
                metric_data["trend_direction"] = "down"
            elif "+12" in change_desc:
                metric_data["previous_value"] = 144.0
                metric_data["change_value"] = 12.0
                metric_data["change_percentage"] = 8.3
                metric_data["trend_direction"] = "up"
            elif "-0.8s" in change_desc:
                metric_data["previous_value"] = 5.0
                metric_data["change_value"] = -0.8
                metric_data["change_percentage"] = -16.0
                metric_data["trend_direction"] = "down"
            
            new_metric = DashboardMetricDB(**metric_data)
            db.add(new_metric)
            created_metrics.append(new_metric.metric_name)
        
        # Initialize backup status
        backup_status = BackupSystemStatusDB(
            backup_api_connected=True,
            realtime_updates_active=True,
            total_backups=2,
            last_backup_time=datetime.utcnow() - timedelta(hours=2),
            last_backup_status="success",
            system_health="healthy"
        )
        db.add(backup_status)
        
        db.commit()
        
        # Create initial snapshot
        await create_snapshot("initialization", db)
        
        return {
            "message": "Dashboard initialized successfully",
            "metrics_created": created_metrics,
            "backup_status_initialized": True
        }
    
    except Exception as e:
        logger.error(f"Error initializing dashboard: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to initialize dashboard")

# ============================================================================
# ROADMAP INTEGRATION ENDPOINTS
# ============================================================================

@router.get("/roadmap/summary")
async def get_roadmap_summary(db: Session = Depends(get_db)):
    """
    Get roadmap summary for dashboard integration
    """
    try:
        # Get current active roadmap
        active_roadmap = db.query(RoadmapDB).filter(RoadmapDB.status == "active").first()
        
        if not active_roadmap:
            return {
                "active_roadmap": None,
                "message": "No active roadmap found"
            }
        
        # Get milestone summary
        milestones = db.query(MilestoneDB).filter(MilestoneDB.roadmap_id == active_roadmap.id).all()
        
        # Get risk summary
        risks = db.query(RoadmapRiskDB).filter(RoadmapRiskDB.roadmap_id == active_roadmap.id).all()
        
        # Calculate summary metrics
        milestone_summary = {
            "total": len(milestones),
            "completed": len([m for m in milestones if m.status == "completed"]),
            "in_progress": len([m for m in milestones if m.status == "in_progress"]),
            "blocked": len([m for m in milestones if m.status == "blocked"])
        }
        
        risk_summary = {
            "total": len(risks),
            "high": len([r for r in risks if r.priority == "high"]),
            "medium": len([r for r in risks if r.priority == "medium"]),
            "low": len([r for r in risks if r.priority == "low"]),
            "open": len([r for r in risks if r.status == "open"])
        }
        
        # Get upcoming deadlines
        upcoming_deadlines = [
            {
                "milestone": m.name,
                "target_date": m.target_date.isoformat(),
                "days_until": (m.target_date - datetime.utcnow()).days
            }
            for m in milestones
            if m.target_date > datetime.utcnow() and m.status != "completed"
        ]
        upcoming_deadlines.sort(key=lambda x: x["days_until"])
        
        return {
            "active_roadmap": {
                "quarter": active_roadmap.quarter,
                "year": active_roadmap.year,
                "progress": active_roadmap.progress_percentage,
                "on_track": active_roadmap.on_track,
                "remaining_days": active_roadmap.remaining_days
            },
            "milestones": milestone_summary,
            "risks": risk_summary,
            "upcoming_deadlines": upcoming_deadlines[:5]  # Next 5 deadlines
        }
        
    except Exception as e:
        logger.error(f"Error fetching roadmap summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roadmap summary")

@router.get("/roadmap/alerts")
async def get_roadmap_alerts_dashboard(db: Session = Depends(get_db)):
    """
    Get roadmap alerts for dashboard integration
    """
    try:
        from roadmap_alert_system import get_roadmap_alert_summary
        
        alert_summary = get_roadmap_alert_summary(db)
        
        return alert_summary
        
    except Exception as e:
        logger.error(f"Error fetching roadmap alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roadmap alerts")

# ============================================================================
# COMPLEXITY ANALYSIS ENDPOINTS
# ============================================================================

@router.get("/complexity/summary", response_model=ComplexitySummaryResponse)
async def get_complexity_summary(db: Session = Depends(get_db)):
    """
    Get complexity analysis summary for dashboard
    """
    try:
        # Get complexity analysis data
        analyses = db.query(ComplexityAnalysisDB).all()
        
        if not analyses:
            return {
                "total_files_analyzed": 0,
                "average_complexity": 0,
                "total_complexity": 0,
                "high_complexity_files": 0,
                "medium_complexity_files": 0,
                "low_complexity_files": 0,
                "complexity_distribution": {},
                "trend_direction": "stable",
                "improvement_rate": 0.0
            }
        
        # Calculate summary metrics
        total_complexity = sum(a.complexity_score for a in analyses)
        average_complexity = total_complexity / len(analyses) if analyses else 0
        
        high_complexity = len([a for a in analyses if a.complexity_score >= 8])
        medium_complexity = len([a for a in analyses if 5 <= a.complexity_score < 8])
        low_complexity = len([a for a in analyses if a.complexity_score < 5])
        
        # Calculate trend
        recent_analyses = sorted(analyses, key=lambda x: x.analyzed_at, reverse=True)[:10]
        older_analyses = sorted(analyses, key=lambda x: x.analyzed_at)[:10]
        
        recent_avg = sum(a.complexity_score for a in recent_analyses) / len(recent_analyses) if recent_analyses else 0
        older_avg = sum(a.complexity_score for a in older_analyses) / len(older_analyses) if older_analyses else 0
        
        if recent_avg < older_avg:
            trend_direction = "improving"
            improvement_rate = ((older_avg - recent_avg) / older_avg * 100) if older_avg > 0 else 0
        elif recent_avg > older_avg:
            trend_direction = "degrading"
            improvement_rate = -((recent_avg - older_avg) / older_avg * 100) if older_avg > 0 else 0
        else:
            trend_direction = "stable"
            improvement_rate = 0.0
        
        return ComplexitySummaryResponse(
            total_files_analyzed=len(analyses),
            average_complexity=round(average_complexity, 1),
            total_complexity=total_complexity,
            high_complexity_files=high_complexity,
            medium_complexity_files=medium_complexity,
            low_complexity_files=low_complexity,
            complexity_distribution={
                "high": high_complexity,
                "medium": medium_complexity,
                "low": low_complexity
            },
            trend_direction=trend_direction,
            improvement_rate=round(improvement_rate, 1)
        )
        
    except Exception as e:
        logger.error(f"Error fetching complexity summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch complexity summary")

@router.get("/complexity/files", response_model=List[ComplexityMetricResponse])
async def get_complexity_files(
    min_complexity: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get complexity analysis for all files, optionally filtered
    """
    try:
        query = db.query(ComplexityAnalysisDB)
        
        if min_complexity:
            query = query.filter(ComplexityAnalysisDB.complexity_score >= min_complexity)
        
        analyses = query.order_by(ComplexityAnalysisDB.complexity_score.desc()).offset(skip).limit(limit).all()
        return analyses
    except Exception as e:
        logger.error(f"Error fetching complexity files: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch complexity files")

@router.get("/complexity/high-priority", response_model=List[ComplexityMetricResponse])
async def get_high_priority_complexity(db: Session = Depends(get_db)):
    """
    Get high complexity files (complexity >= 8) requiring attention
    """
    try:
        analyses = db.query(ComplexityAnalysisDB).filter(
            ComplexityAnalysisDB.complexity_score >= 8
        ).order_by(ComplexityAnalysisDB.complexity_score.desc()).limit(10).all()
        
        return analyses
    except Exception as e:
        logger.error(f"Error fetching high priority complexity: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch high priority complexity")

@router.get("/refactoring/summary", response_model=RefactoringPlanSummaryResponse)
async def get_refactoring_summary_dashboard(db: Session = Depends(get_db)):
    """
    Get refactoring plan summary for dashboard integration
    """
    try:
        plans = db.query(RefactoringPlanDB).all()
        
        if not plans:
            return {
                "total_plans": 0,
                "critical_priority": 0,
                "high_priority": 0,
                "medium_priority": 0,
                "low_priority": 0,
                "total_estimated_hours": 0,
                "in_progress": 0,
                "completed": 0,
                "average_complexity_reduction": 0.0
            }
        
        critical = len([p for p in plans if p.priority == "critical"])
        high = len([p for p in plans if p.priority == "high"])
        medium = len([p for p in plans if p.priority == "medium"])
        low = len([p for p in plans if p.priority == "low"])
        
        in_progress = len([p for p in plans if p.status == "in_progress"])
        completed = len([p for p in plans if p.status == "completed"])
        
        total_estimated = sum(p.estimated_hours for p in plans if p.estimated_hours)
        avg_reduction = sum(p.complexity_reduction for p in plans if p.complexity_reduction) / len(plans) if plans else 0
        
        return RefactoringPlanSummaryResponse(
            total_plans=len(plans),
            critical_priority=critical,
            high_priority=high,
            medium_priority=medium,
            low_priority=low,
            total_estimated_hours=total_estimated,
            in_progress=in_progress,
            completed=completed,
            average_complexity_reduction=round(avg_reduction, 1)
        )
        
    except Exception as e:
        logger.error(f"Error fetching refactoring summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch refactoring summary")