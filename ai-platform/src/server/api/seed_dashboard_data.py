#!/usr/bin/env python3
"""
Dashboard Metrics Seed Data Script

This script initializes the dashboard with the provided metrics data and
sets up the complete dashboard system with sample data.
"""

import sys
import os
from datetime import datetime, timedelta

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db
from enhanced_models import (
    DashboardMetricDB, MetricHistoryDB, BackupSystemStatusDB,
    MetricAlertDB, DashboardSnapshotDB
)
import logging
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_dashboard_metrics(db: Session):
    """Seed dashboard with the provided metrics data"""
    
    logger.info("Seeding dashboard metrics...")
    
    # Define the metrics based on the dashboard overview
    metrics_data = [
        {
            "metric_name": "code_quality",
            "metric_value": 87.0,
            "metric_type": "percentage",
            "category": "quality",
            "description": "Overall code quality score based on static analysis",
            "unit": "%",
            "threshold_warning": 80.0,
            "threshold_critical": 70.0,
            "previous_value": 82.0,
            "change_value": 5.0,
            "change_percentage": 6.1,
            "trend_direction": "up",
            "metadata": {
                "change_description": "+5% from last week",
                "last_analysis": datetime.utcnow().isoformat(),
                "factors_analyzed": ["complexity", "duplication", "maintainability"]
            }
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
            "previous_value": 15.0,
            "change_value": -3.0,
            "change_percentage": -20.0,
            "trend_direction": "down",
            "metadata": {
                "change_description": "-3 resolved",
                "last_scan": datetime.utcnow().isoformat(),
                "severity_breakdown": {"critical": 2, "high": 4, "medium": 4, "low": 2}
            }
        },
        {
            "metric_name": "files_analyzed",
            "metric_value": 156.0,
            "metric_type": "count",
            "category": "quality",
            "description": "Total number of files analyzed",
            "unit": "files",
            "threshold_warning": 100.0,
            "threshold_critical": 50.0,
            "previous_value": 144.0,
            "change_value": 12.0,
            "change_percentage": 8.3,
            "trend_direction": "up",
            "metadata": {
                "change_description": "+12 new files",
                "last_analysis": datetime.utcnow().isoformat(),
                "file_types": {".py": 80, ".js": 45, ".html": 20, ".css": 11}
            }
        },
        {
            "metric_name": "avg_load_time",
            "metric_value": 4.2,
            "metric_type": "time",
            "category": "performance",
            "description": "Average system load time in seconds",
            "unit": "seconds",
            "threshold_warning": 5.0,
            "threshold_critical": 8.0,
            "previous_value": 5.0,
            "change_value": -0.8,
            "change_percentage": -16.0,
            "trend_direction": "down",
            "metadata": {
                "change_description": "-0.8s improved",
                "last_measurement": datetime.utcnow().isoformat(),
                "p50": 3.8,
                "p95": 7.2,
                "p99": 9.1
            }
        },
        {
            "metric_name": "backup_api_connected",
            "metric_value": 1.0,
            "metric_type": "status",
            "category": "backup",
            "description": "Backup API connection status (1 = connected, 0 = disconnected)",
            "unit": "status",
            "threshold_warning": 0.5,
            "threshold_critical": 0.0,
            "previous_value": 1.0,
            "change_value": 0.0,
            "change_percentage": 0.0,
            "trend_direction": "stable",
            "metadata": {
                "status": "connected",
                "last_check": datetime.utcnow().isoformat(),
                "response_time_ms": 45
            }
        },
        {
            "metric_name": "realtime_updates_active",
            "metric_value": 1.0,
            "metric_type": "status",
            "category": "backup",
            "description": "Real-time updates status (1 = active, 0 = inactive)",
            "unit": "status",
            "threshold_warning": 0.5,
            "threshold_critical": 0.0,
            "previous_value": 1.0,
            "change_value": 0.0,
            "change_percentage": 0.0,
            "trend_direction": "stable",
            "metadata": {
                "status": "active",
                "last_check": datetime.utcnow().isoformat(),
                "active_connections": 3
            }
        },
        {
            "metric_name": "total_backups",
            "metric_value": 2.0,
            "metric_type": "count",
            "category": "backup",
            "description": "Total number of backups completed",
            "unit": "backups",
            "threshold_warning": 1.0,
            "threshold_critical": 0.0,
            "previous_value": 1.0,
            "change_value": 1.0,
            "change_percentage": 100.0,
            "trend_direction": "up",
            "metadata": {
                "change_description": "+1 new backup",
                "last_backup": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                "backup_schedule": "daily"
            }
        }
    ]
    
    created_metrics = []
    for metric_data in metrics_data:
        # Check if metric already exists
        existing = db.query(DashboardMetricDB).filter(
            DashboardMetricDB.metric_name == metric_data["metric_name"]
        ).first()
        
        if existing:
            logger.info(f"Metric {metric_data['metric_name']} already exists, updating...")
            for key, value in metric_data.items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            created_metrics.append(existing.metric_name)
        else:
            new_metric = DashboardMetricDB(**metric_data)
            db.add(new_metric)
            created_metrics.append(new_metric.metric_name)
    
    db.commit()
    logger.info(f"Created/updated {len(created_metrics)} dashboard metrics")
    
    return created_metrics

def seed_backup_status(db: Session):
    """Seed backup system status"""
    
    logger.info("Seeding backup system status...")
    
    existing = db.query(BackupSystemStatusDB).first()
    
    backup_data = {
        "backup_api_connected": True,
        "realtime_updates_active": True,
        "total_backups": 2,
        "last_backup_time": datetime.utcnow() - timedelta(hours=2),
        "last_backup_status": "success",
        "last_backup_size": 1024 * 1024 * 256,  # 256 MB
        "last_backup_duration": 45,  # 45 seconds
        "next_backup_time": datetime.utcnow() + timedelta(hours=22),
        "backup_schedule": "daily",
        "system_health": "healthy",
        "last_health_check": datetime.utcnow(),
        "backup_location": "/backups/automated",
        "retention_policy": "30 days"
    }
    
    if existing:
        logger.info("Backup status already exists, updating...")
        for key, value in backup_data.items():
            setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
    else:
        existing = BackupSystemStatusDB(**backup_data)
        db.add(existing)
    
    db.commit()
    logger.info("Backup system status seeded successfully")
    
    return existing

def seed_metric_alerts(db: Session):
    """Seed metric alerts for monitoring"""
    
    logger.info("Seeding metric alerts...")
    
    alerts_data = [
        {
            "metric_name": "code_quality",
            "alert_type": "threshold",
            "condition": "below",
            "threshold_value": 75.0,
            "severity": "critical",
            "description": "Alert when code quality falls below 75%",
            "notify_on_trigger": True,
            "notification_channels": ["email", "slack"],
            "notification_recipients": ["dev-team@example.com"],
            "cooldown_period_minutes": 60
        },
        {
            "metric_name": "security_issues",
            "alert_type": "threshold",
            "condition": "above",
            "threshold_value": 20.0,
            "severity": "critical",
            "description": "Alert when security issues exceed 20",
            "notify_on_trigger": True,
            "notification_channels": ["email", "slack", "pagerduty"],
            "notification_recipients": ["security@example.com"],
            "cooldown_period_minutes": 30
        },
        {
            "metric_name": "avg_load_time",
            "alert_type": "threshold",
            "condition": "above",
            "threshold_value": 6.0,
            "severity": "warning",
            "description": "Alert when average load time exceeds 6 seconds",
            "notify_on_trigger": True,
            "notification_channels": ["email"],
            "notification_recipients": ["ops@example.com"],
            "cooldown_period_minutes": 15
        },
        {
            "metric_name": "backup_api_connected",
            "alert_type": "threshold",
            "condition": "below",
            "threshold_value": 1.0,
            "severity": "critical",
            "description": "Alert when backup API becomes disconnected",
            "notify_on_trigger": True,
            "notification_channels": ["email", "slack", "pagerduty"],
            "notification_recipients": ["ops@example.com", "admin@example.com"],
            "cooldown_period_minutes": 5
        }
    ]
    
    created_alerts = []
    for alert_data in alerts_data:
        # Check if alert already exists
        existing = db.query(MetricAlertDB).filter(
            MetricAlertDB.metric_name == alert_data["metric_name"],
            MetricAlertDB.alert_type == alert_data["alert_type"],
            MetricAlertDB.condition == alert_data["condition"]
        ).first()
        
        if not existing:
            new_alert = MetricAlertDB(**alert_data)
            db.add(new_alert)
            created_alerts.append(new_alert.metric_name)
        else:
            logger.info(f"Alert for {alert_data['metric_name']} already exists")
    
    db.commit()
    logger.info(f"Created {len(created_alerts)} metric alerts")
    
    return created_alerts

def seed_historical_data(db: Session):
    """Seed historical metric data for trend analysis"""
    
    logger.info("Seeding historical metric data...")
    
    metrics = db.query(DashboardMetricDB).all()
    
    # Generate 24 hours of historical data (hourly)
    for hours_ago in range(24, 0, -1):
        timestamp = datetime.utcnow() - timedelta(hours=hours_ago)
        
        for metric in metrics:
            # Generate some realistic variation
            import random
            variation = random.uniform(-0.95, 1.05)  # ±5% variation
            
            historical_value = metric.previous_value * variation if metric.previous_value else metric.metric_value * variation
            
            history_entry = MetricHistoryDB(
                metric_name=metric.metric_name,
                metric_value=round(historical_value, 2),
                metric_type=metric.metric_type,
                recorded_at=timestamp,
                context={"source": "automated_collection"},
                previous_value=None,
                change_value=None,
                change_percentage=None
            )
            db.add(history_entry)
    
    db.commit()
    logger.info("Historical metric data seeded successfully (24 hours)")

def create_initial_snapshot(db: Session):
    """Create initial dashboard snapshot"""
    
    logger.info("Creating initial dashboard snapshot...")
    
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
        created_by="seed_script",
        snapshot_type="initial"
    )
    db.add(snapshot)
    db.commit()
    
    logger.info("Initial dashboard snapshot created successfully")
    
    return snapshot

def main():
    """Main function to seed dashboard data"""
    try:
        # Get database session
        db_gen = get_enhanced_db()
        db = next(db_gen)
        
        try:
            print("🚀 Starting dashboard data seeding...")
            
            # Seed dashboard metrics
            metrics = seed_dashboard_metrics(db)
            print(f"✅ Seeded {len(metrics)} dashboard metrics")
            
            # Seed backup status
            backup_status = seed_backup_status(db)
            print("✅ Seeded backup system status")
            
            # Seed metric alerts
            alerts = seed_metric_alerts(db)
            print(f"✅ Seeded {len(alerts)} metric alerts")
            
            # Seed historical data
            seed_historical_data(db)
            print("✅ Seeded 24 hours of historical data")
            
            # Create initial snapshot
            snapshot = create_initial_snapshot(db)
            print("✅ Created initial dashboard snapshot")
            
            print("\n🎉 Dashboard data seeding completed successfully!")
            print("\n📊 Dashboard Summary:")
            print(f"  • Metrics: {len(metrics)}")
            print(f"  • Alerts: {len(alerts)}")
            print(f"  • Historical Data Points: 24 hours")
            print(f"  • Backup System: {'Connected' if backup_status.backup_api_connected else 'Disconnected'}")
            print(f"  • System Health: {backup_status.system_health}")
            
            print("\n🔗 Next Steps:")
            print("  1. Start the dashboard API server: python dashboard_api.py")
            print("  2. Initialize dashboard via API: POST /api/dashboard/initialize")
            print("  3. Set up automated scheduling: python setup_dashboard_scheduling.py")
            print("  4. Access dashboard metrics: GET /api/dashboard/metrics")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error seeding dashboard data: {e}")
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()