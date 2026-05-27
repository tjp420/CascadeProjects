#!/usr/bin/env python3
"""
Dashboard Metrics Scheduling Integration

This script sets up automated reporting for dashboard metrics using the scheduling system.
It creates scheduled reports, periodic snapshots, and metric aggregation reports.
"""

from datetime import datetime, timedelta
import sys
import os

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db
from enhanced_models import (
    ReportScheduleDB, ReportDB, ReportMetadataDB, ReportDataDB,
    DashboardMetricDB, DashboardSnapshotDB
)
import logging
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_dashboard_scheduling(db: Session):
    """
    Set up automated reporting for dashboard metrics
    """
    
    logger.info("Setting up dashboard metrics scheduling...")
    
    # 1. Create daily dashboard summary report schedule
    daily_report_schedule = ReportScheduleDB(
        id=str(uuid.uuid4()),
        report_id=str(uuid.uuid4()),  # Placeholder, will be updated after report creation
        schedule_type="daily",
        schedule_config={"time": "08:00", "timezone": "UTC"},
        next_run=datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0) + timedelta(days=1),
        is_active=True,
        is_paused=False,
        notify_on_success=True,
        notify_on_failure=True,
        notification_recipients=["admin@example.com"]
    )
    
    # First create the report that will be scheduled
    daily_report = ReportDB(
        id=daily_report_schedule.report_id,
        name="Daily Dashboard Summary",
        description="Automated daily summary of dashboard metrics",
        type="performance",
        category="analytics",
        format="json",
        size=0,
        schedule="daily",
        status="ready",
        version="1.0.0",
        validation_status="valid",
        template_source="dashboard_daily"
    )
    db.add(daily_report)
    db.add(daily_report_schedule)
    
    # 2. Create weekly metrics analysis report schedule
    weekly_report_id = str(uuid.uuid4())
    weekly_report_schedule = ReportScheduleDB(
        id=str(uuid.uuid4()),
        report_id=weekly_report_id,
        schedule_type="weekly",
        schedule_config={"day": "monday", "time": "09:00", "timezone": "UTC"},
        next_run=_get_next_weekday_run("monday", "09:00"),
        is_active=True,
        is_paused=False,
        notify_on_success=True,
        notify_on_failure=True,
        notification_recipients=["admin@example.com", "team@example.com"]
    )
    
    weekly_report = ReportDB(
        id=weekly_report_id,
        name="Weekly Metrics Analysis",
        description="Comprehensive weekly analysis of dashboard metrics trends",
        type="quality",
        category="analytics",
        format="json",
        size=0,
        schedule="weekly",
        status="ready",
        version="1.0.0",
        validation_status="valid",
        template_source="dashboard_weekly"
    )
    db.add(weekly_report)
    db.add(weekly_report_schedule)
    
    # 3. Create monthly dashboard health report schedule
    monthly_report_id = str(uuid.uuid4())
    monthly_report_schedule = ReportScheduleDB(
        id=str(uuid.uuid4()),
        report_id=monthly_report_id,
        schedule_type="monthly",
        schedule_config={"day": 1, "time": "10:00", "timezone": "UTC"},
        next_run=_get_next_monthly_run(1, "10:00"),
        is_active=True,
        is_paused=False,
        notify_on_success=True,
        notify_on_failure=True,
        notification_recipients=["admin@example.com", "management@example.com"]
    )
    
    monthly_report = ReportDB(
        id=monthly_report_id,
        name="Monthly Dashboard Health Report",
        description="Monthly comprehensive health check of dashboard metrics and system status",
        type="performance",
        category="analytics",
        format="json",
        size=0,
        schedule="monthly",
        status="ready",
        version="1.0.0",
        validation_status="valid",
        template_source="dashboard_monthly"
    )
    db.add(monthly_report)
    db.add(monthly_report_schedule)
    
    # 4. Create hourly snapshot schedule
    hourly_snapshot_schedule = ReportScheduleDB(
        id=str(uuid.uuid4()),
        report_id=str(uuid.uuid4()),
        schedule_type="custom",
        schedule_config={"cron": "0 * * * *"},  # Every hour
        next_run=datetime.utcnow().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1),
        is_active=True,
        is_paused=False,
        notify_on_success=False,
        notify_on_failure=True
    )
    
    hourly_report = ReportDB(
        id=hourly_snapshot_schedule.report_id,
        name="Hourly Dashboard Snapshot",
        description="Automated hourly snapshot of dashboard metrics",
        type="performance",
        category="operations",
        format="json",
        size=0,
        schedule="hourly",
        status="ready",
        version="1.0.0",
        validation_status="valid",
        template_source="dashboard_hourly"
    )
    db.add(hourly_report)
    db.add(hourly_snapshot_schedule)
    
    # 5. Create security metrics alert schedule (every 6 hours)
    security_alert_schedule = ReportScheduleDB(
        id=str(uuid.uuid4()),
        report_id=str(uuid.uuid4()),
        schedule_type="custom",
        schedule_config={"cron": "0 */6 * * *"},  # Every 6 hours
        next_run=_get_next_custom_run("0 */6 * * *"),
        is_active=True,
        is_paused=False,
        notify_on_success=False,
        notify_on_failure=True,
        notification_recipients=["security@example.com"]
    )
    
    security_report = ReportDB(
        id=security_alert_schedule.report_id,
        name="Security Metrics Alert",
        description="Security metrics monitoring and alerting",
        type="security",
        category="compliance",
        format="json",
        size=0,
        schedule="every_6_hours",
        status="ready",
        version="1.0.0",
        validation_status="valid",
        template_source="dashboard_security"
    )
    db.add(security_report)
    db.add(security_alert_schedule)
    
    db.commit()
    
    logger.info("Dashboard scheduling setup completed successfully")
    logger.info(f"Created 5 automated report schedules:")
    logger.info(f"  1. Daily Dashboard Summary (8:00 AM UTC)")
    logger.info(f"  2. Weekly Metrics Analysis (Monday 9:00 AM UTC)")
    logger.info(f"  3. Monthly Dashboard Health (1st 10:00 AM UTC)")
    logger.info(f"  4. Hourly Dashboard Snapshot (Every hour)")
    logger.info(f"  5. Security Metrics Alert (Every 6 hours)")
    
    return {
        "daily_report_id": daily_report.id,
        "weekly_report_id": weekly_report.id,
        "monthly_report_id": monthly_report.id,
        "hourly_snapshot_id": hourly_report.id,
        "security_alert_id": security_report.id
    }

def _get_next_weekday_run(day: str, time_str: str) -> datetime:
    """Calculate next run time for a weekly schedule"""
    from datetime import datetime, timedelta
    
    days_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }
    
    target_day = days_map.get(day.lower(), 0)
    now = datetime.utcnow()
    hour, minute = map(int, time_str.split(":"))
    
    # Create target datetime for this week
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    target = target + timedelta(days=(target_day - now.weekday()))
    
    # If target is in the past, move to next week
    if target <= now:
        target = target + timedelta(days=7)
    
    return target

def _get_next_monthly_run(day: int, time_str: str) -> datetime:
    """Calculate next run time for a monthly schedule"""
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    hour, minute = map(int, time_str.split(":"))
    
    # Create target datetime for this month
    target = now.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
    
    # If target is in the past, move to next month
    if target <= now:
        if now.month == 12:
            target = target.replace(year=now.year + 1, month=1, day=day)
        else:
            target = target.replace(month=now.month + 1, day=day)
    
    return target

def _get_next_custom_run(cron_expression: str) -> datetime:
    """Calculate next run time for a custom cron schedule"""
    # Simplified cron parsing for common patterns
    # For production, use a proper cron parser library
    
    now = datetime.utcnow()
    
    if "*/6" in cron_expression:  # Every 6 hours
        next_hour = ((now.hour // 6) + 1) * 6
        if next_hour >= 24:
            next_hour = 0
            target = now.replace(day=now.day + 1, hour=next_hour, minute=0, second=0, microsecond=0)
        else:
            target = now.replace(hour=next_hour, minute=0, second=0, microsecond=0)
        
        if target <= now:
            target = target + timedelta(hours=6)
        
        return target
    
    # Default to 1 hour from now for unknown patterns
    return now + timedelta(hours=1)

def generate_dashboard_report(report_id: str, db: Session):
    """
    Generate a dashboard report based on current metrics
    """
    logger.info(f"Generating dashboard report for {report_id}")
    
    # Get all current metrics
    metrics = db.query(DashboardMetricDB).all()
    
    # Aggregate metrics by category
    metrics_by_category = {}
    for metric in metrics:
        if metric.category not in metrics_by_category:
            metrics_by_category[metric.category] = []
        metrics_by_category[metric.category].append({
            "name": metric.metric_name,
            "value": metric.metric_value,
            "unit": metric.unit,
            "trend": metric.trend_direction,
            "change_percentage": metric.change_percentage
        })
    
    # Calculate overall health score
    health_score = calculate_health_score(metrics)
    
    # Generate report data
    report_data = {
        "generated_at": datetime.utcnow().isoformat(),
        "health_score": health_score,
        "total_metrics": len(metrics),
        "metrics_by_category": metrics_by_category,
        "summary": {
            "quality": get_category_summary(metrics, "quality"),
            "security": get_category_summary(metrics, "security"),
            "performance": get_category_summary(metrics, "performance"),
            "backup": get_category_summary(metrics, "backup")
        },
        "recommendations": generate_recommendations(metrics)
    }
    
    # Update report with generated data
    report = db.query(ReportDB).filter(ReportDB.id == report_id).first()
    if report:
        report.last_generated = datetime.utcnow()
        report.updated_at = datetime.utcnow()
        
        # Create or update report data
        data_record = ReportDataDB(
            report_id=report_id,
            data_type="dashboard_metrics",
            content=report_data
        )
        db.add(data_record)
        
        db.commit()
        logger.info(f"Dashboard report generated successfully for {report_id}")
        return report_data
    
    return None

def calculate_health_score(metrics: list) -> dict:
    """Calculate overall health score from metrics"""
    if not metrics:
        return {"score": 0, "status": "unknown"}
    
    total_score = 0
    weighted_count = 0
    
    for metric in metrics:
        # Normalize metric value to 0-100 scale
        if metric.metric_type == "percentage":
            normalized = metric.metric_value
        elif metric.metric_type == "count":
            # Lower is better for counts like security issues
            if "security" in metric.metric_name.lower():
                normalized = max(0, 100 - (metric.metric_value * 2))
            else:
                normalized = min(100, metric.metric_value)
        elif metric.metric_type == "time":
            # Lower is better for time metrics
            normalized = max(0, 100 - (metric.metric_value * 10))
        else:
            normalized = 50  # Default middle value
        
        total_score += normalized
        weighted_count += 1
    
    if weighted_count == 0:
        return {"score": 0, "status": "unknown"}
    
    avg_score = total_score / weighted_count
    
    # Determine status
    if avg_score >= 80:
        status = "excellent"
    elif avg_score >= 60:
        status = "good"
    elif avg_score >= 40:
        status = "fair"
    else:
        status = "poor"
    
    return {
        "score": round(avg_score, 1),
        "status": status
    }

def get_category_summary(metrics: list, category: str) -> dict:
    """Get summary for a specific category"""
    category_metrics = [m for m in metrics if m.category == category]
    
    if not category_metrics:
        return {"count": 0, "average_value": 0, "trend": "stable"}
    
    avg_value = sum(m.metric_value for m in category_metrics) / len(category_metrics)
    
    # Determine overall trend
    up_trends = sum(1 for m in category_metrics if m.trend_direction == "up")
    down_trends = sum(1 for m in category_metrics if m.trend_direction == "down")
    
    if up_trends > down_trends:
        trend = "improving"
    elif down_trends > up_trends:
        trend = "declining"
    else:
        trend = "stable"
    
    return {
        "count": len(category_metrics),
        "average_value": round(avg_value, 2),
        "trend": trend
    }

def generate_recommendations(metrics: list) -> list:
    """Generate recommendations based on metrics"""
    recommendations = []
    
    for metric in metrics:
        # Check for critical thresholds
        if metric.threshold_critical and metric.metric_value >= metric.threshold_critical:
            if metric.metric_type == "count" and "security" in metric.metric_name.lower():
                recommendations.append({
                    "priority": "critical",
                    "metric": metric.metric_name,
                    "message": f"Critical: {metric.metric_name} exceeds threshold of {metric.threshold_critical}",
                    "action": "Immediate investigation required"
                })
            else:
                recommendations.append({
                    "priority": "high",
                    "metric": metric.metric_name,
                    "message": f"{metric.metric_name} exceeds critical threshold",
                    "action": "Review and address immediately"
                })
        
        # Check for warning thresholds
        elif metric.threshold_warning and metric.metric_value >= metric.threshold_warning:
            recommendations.append({
                "priority": "medium",
                "metric": metric.metric_name,
                "message": f"{metric.metric_name} exceeds warning threshold",
                "action": "Monitor and plan remediation"
            })
        
        # Check for negative trends
        if metric.trend_direction == "down" and metric.change_percentage and metric.change_percentage < -10:
            if "quality" in metric.metric_name.lower() or metric.metric_type == "percentage":
                recommendations.append({
                    "priority": "medium",
                    "metric": metric.metric_name,
                    "message": f"{metric.metric_name} is declining by {abs(metric.change_percentage):.1f}%",
                    "action": "Investigate cause of decline"
                })
    
    return recommendations

def main():
    """Main function to set up dashboard scheduling"""
    try:
        # Get database session
        db_gen = get_enhanced_db()
        db = next(db_gen)
        
        try:
            # Setup scheduling
            result = setup_dashboard_scheduling(db)
            
            print("\n✅ Dashboard scheduling setup completed successfully!")
            print(f"\nCreated report IDs:")
            for name, report_id in result.items():
                print(f"  {name}: {report_id}")
            
            # Generate initial reports
            print("\n📊 Generating initial dashboard reports...")
            for report_id in result.values():
                report_data = generate_dashboard_report(report_id, db)
                if report_data:
                    print(f"  ✓ Generated report for {report_id}")
            
            print("\n🎉 Dashboard metrics automation is now active!")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error setting up dashboard scheduling: {e}")
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()