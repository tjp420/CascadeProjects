#!/usr/bin/env python3
"""
Seed Upload Monitoring Data for AI Dashboard

This script seeds the upload monitoring system with initial data based on
the upload metrics shared in the conversation.
"""

from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    UploadTrackingDB, UploadStatisticsDB, UploadAlertDB,
    UploadHistoryDB, UploadPatternDB
)
from datetime import datetime, timedelta
import random
import uuid

def seed_upload_tracking_data(db: Session):
    """Seed individual upload tracking records"""
    print("Seeding upload tracking data...")
    
    file_types = ["csv", "json", "xlsx", "xml", "txt"]
    upload_categories = ["data_import", "backup", "export", "user_upload"]
    statuses = ["completed", "completed", "completed", "completed", "failed"]  # 94.5% success rate
    
    # Calculate target metrics
    target_total_uploads = 156
    target_success_rate = 94.5
    target_successful_uploads = int(target_total_uploads * (target_success_rate / 100))
    target_failed_uploads = target_total_uploads - target_successful_uploads
    target_total_size_mb = 97600  # 97.6GB
    target_avg_processing_time = 28  # seconds
    
    # Generate successful uploads
    for i in range(target_successful_uploads):
        file_size_mb = random.gauss(target_total_size_mb / target_total_uploads, target_total_size_mb / target_total_uploads * 0.5)
        file_size_mb = max(0.1, file_size_mb)  # Ensure positive size
        
        processing_time = random.gauss(target_avg_processing_time, target_avg_processing_time * 0.3)
        processing_time = max(1, processing_time)  # Ensure positive time
        
        upload = UploadTrackingDB(
            upload_id=str(uuid.uuid4()),
            file_name=f"upload_{i}_{random.choice(file_types)}",
            file_type=random.choice(file_types),
            file_size_mb=file_size_mb,
            upload_status="completed",
            upload_progress=100,
            processing_time_seconds=processing_time,
            processing_start_time=datetime.utcnow() - timedelta(hours=random.randint(1, 168)),
            processing_end_time=datetime.utcnow() - timedelta(hours=random.randint(0, 167)),
            records_processed=random.randint(100, 10000),
            records_failed=0,
            upload_category=random.choice(upload_categories),
            priority=random.choice(["low", "normal", "normal", "normal", "high"]),
            user_id=f"user_{random.randint(1, 10)}"
        )
        upload.created_at = upload.processing_start_time
        upload.updated_at = upload.processing_end_time
        db.add(upload)
    
    # Generate failed uploads
    for i in range(target_failed_uploads):
        file_size_mb = random.gauss(target_total_size_mb / target_total_uploads, target_total_size_mb / target_total_uploads * 0.5)
        file_size_mb = max(0.1, file_size_mb)
        
        upload = UploadTrackingDB(
            upload_id=str(uuid.uuid4()),
            file_name=f"upload_failed_{i}_{random.choice(file_types)}",
            file_type=random.choice(file_types),
            file_size_mb=file_size_mb,
            upload_status="failed",
            upload_progress=random.randint(10, 90),
            processing_time_seconds=random.uniform(5, 60),
            records_processed=random.randint(10, 1000),
            records_failed=random.randint(1, 100),
            error_message=random.choice([
                "File format error",
                "Validation failed",
                "Network timeout",
                "Server error",
                "Insufficient storage"
            ]),
            upload_category=random.choice(upload_categories),
            priority=random.choice(["low", "normal", "high"]),
            user_id=f"user_{random.randint(1, 10)}"
        )
        upload.created_at = datetime.utcnow() - timedelta(hours=random.randint(1, 168))
        upload.updated_at = datetime.utcnow() - timedelta(hours=random.randint(0, 167))
        db.add(upload)
    
    # Generate some pending uploads
    for i in range(5):
        file_size_mb = random.gauss(target_total_size_mb / target_total_uploads, target_total_size_mb / target_total_uploads * 0.5)
        file_size_mb = max(0.1, file_size_mb)
        
        upload = UploadTrackingDB(
            upload_id=str(uuid.uuid4()),
            file_name=f"upload_pending_{i}_{random.choice(file_types)}",
            file_type=random.choice(file_types),
            file_size_mb=file_size_mb,
            upload_status=random.choice(["pending", "uploading", "processing"]),
            upload_progress=random.randint(0, 75),
            upload_category=random.choice(upload_categories),
            priority=random.choice(["normal", "high", "urgent"]),
            user_id=f"user_{random.randint(1, 10)}"
        )
        upload.created_at = datetime.utcnow() - timedelta(minutes=random.randint(1, 60))
        upload.updated_at = datetime.utcnow() - timedelta(minutes=random.randint(0, 59))
        db.add(upload)
    
    db.commit()
    print("Upload tracking data seeded")

def seed_upload_statistics_data(db: Session):
    """Seed aggregated upload statistics"""
    print("Seeding upload statistics data...")
    
    # Generate daily statistics for the last 30 days
    for day in range(30):
        period_start = datetime.utcnow() - timedelta(days=day+1)
        period_end = period_start + timedelta(days=1)
        
        # Generate realistic daily metrics
        daily_uploads = random.randint(3, 10)
        daily_success_rate = random.uniform(90, 98)
        daily_successful = int(daily_uploads * (daily_success_rate / 100))
        daily_failed = daily_uploads - daily_successful
        
        daily_size_mb = random.uniform(500, 3000)
        daily_avg_size_mb = daily_size_mb / daily_uploads if daily_uploads > 0 else 0
        daily_avg_processing = random.uniform(20, 35)
        
        # Trend calculation
        if day > 0:
            trend = random.choice(["increasing", "decreasing", "stable"])
            trend_percentage = random.uniform(-10, 15)
        else:
            trend = "stable"
            trend_percentage = 0
        
        stats = UploadStatisticsDB(
            period_type="daily",
            period_start=period_start,
            period_end=period_end,
            total_uploads=daily_uploads,
            successful_uploads=daily_successful,
            failed_uploads=daily_failed,
            pending_uploads=0,
            total_size_mb=daily_size_mb,
            avg_size_mb=daily_avg_size_mb,
            avg_processing_time_seconds=daily_avg_processing,
            success_rate=daily_success_rate,
            failure_rate=100 - daily_success_rate,
            uploads_trend=trend,
            trend_percentage=trend_percentage,
            file_type_counts={
                "csv": random.randint(1, daily_uploads),
                "json": random.randint(0, daily_uploads // 2),
                "xlsx": random.randint(0, daily_uploads // 3),
                "xml": random.randint(0, daily_uploads // 4),
                "txt": random.randint(0, daily_uploads // 5)
            }
        )
        stats.created_at = period_start
        stats.updated_at = period_end
        db.add(stats)
    
    db.commit()
    print("Upload statistics data seeded")

def seed_upload_alerts_data(db: Session):
    """Seed upload alerts"""
    print("Seeding upload alerts data...")
    
    # High failure rate alert
    alert1 = UploadAlertDB(
        alert_name="High Upload Failure Rate",
        alert_type="failure_rate",
        metric_name="failure_rate",
        condition="above",
        threshold_value=10.0,  # 10%
        severity="critical",
        is_active=True,
        cooldown_minutes=15,
        last_triggered_at=datetime.utcnow() - timedelta(hours=4),
        trigger_count=3,
        description="Alert when upload failure rate exceeds 10%"
    )
    db.add(alert1)
    
    # Slow upload alert
    alert2 = UploadAlertDB(
        alert_name="Slow Upload Processing",
        alert_type="processing_time",
        metric_name="processing_time_seconds",
        condition="above",
        threshold_value=60.0,  # 60 seconds
        severity="warning",
        is_active=True,
        cooldown_minutes=30,
        last_triggered_at=datetime.utcnow() - timedelta(hours=6),
        trigger_count=5,
        description="Alert when upload processing time exceeds 60 seconds"
    )
    db.add(alert2)
    
    # Large file upload alert
    alert3 = UploadAlertDB(
        alert_name="Large File Upload",
        alert_type="file_size",
        metric_name="file_size_mb",
        condition="above",
        threshold_value=1000.0,  # 1GB
        severity="warning",
        is_active=False,
        cooldown_minutes=60,
        trigger_count=0,
        description="Alert when file size exceeds 1GB"
    )
    db.add(alert3)
    
    # Upload queue backlog alert
    alert4 = UploadAlertDB(
        alert_name="Upload Queue Backlog",
        alert_type="custom",
        metric_name="pending_uploads",
        condition="above",
        threshold_value=10.0,  # 10 pending uploads
        severity="info",
        is_active=True,
        cooldown_minutes=10,
        last_triggered_at=datetime.utcnow() - timedelta(hours=2),
        trigger_count=2,
        description="Alert when pending uploads exceed 10"
    )
    db.add(alert4)
    
    db.commit()
    print("Upload alerts data seeded")

def seed_upload_history_data(db: Session):
    """Seed upload history for trend analysis"""
    print("Seeding upload history data...")
    
    # Get some uploads to create history for
    uploads = db.query(UploadTrackingDB).limit(20).all()
    
    for upload in uploads:
        # Create 3-5 history snapshots per upload
        for i in range(random.randint(3, 5)):
            time_diff = (upload.updated_at - upload.created_at).total_seconds()
            if time_diff > 0:
                snapshot_time = upload.created_at + timedelta(
                    seconds=random.randint(0, int(time_diff))
                )
            else:
                snapshot_time = upload.created_at + timedelta(seconds=random.randint(0, 3600))
            
            history = UploadHistoryDB(
                upload_id=upload.upload_id,
                snapshot_time=snapshot_time,
                upload_status=random.choice(["pending", "uploading", "processing", "completed"]),
                upload_progress=random.randint(0, 100),
                processing_time_seconds=random.uniform(0, upload.processing_time_seconds or 30),
                file_size_mb=upload.file_size_mb,
                is_anomaly=random.random() < 0.05,  # 5% anomaly rate
                anomaly_score=random.uniform(0, 3) if random.random() < 0.05 else 0
            )
            history.created_at = snapshot_time
            db.add(history)
    
    db.commit()
    print("Upload history data seeded")

def seed_upload_patterns_data(db: Session):
    """Seed upload pattern analysis"""
    print("Seeding upload patterns data...")
    
    # Monday morning pattern
    pattern1 = UploadPatternDB(
        pattern_name="Monday Morning Upload Spike",
        pattern_type="time_based",
        detection_criteria={"hour": 9, "day_of_week": 1},
        confidence_score=0.85,
        frequency=45,
        avg_upload_size_mb=625.0,
        avg_processing_time_seconds=25.0,
        success_rate=95.0,
        is_active=True,
        first_detected_at=datetime.utcnow() - timedelta(days=60),
        last_detected_at=datetime.utcnow() - timedelta(days=1),
        recommendations=["Consider scaling resources on Monday mornings", "Add upload queue management"]
    )
    db.add(pattern1)
    
    # Large file pattern
    pattern2 = UploadPatternDB(
        pattern_name="End of Month Large File Uploads",
        pattern_type="time_based",
        detection_criteria={"day_of_month": [28, 29, 30, 31]},
        confidence_score=0.72,
        frequency=12,
        avg_upload_size_mb=2500.0,
        avg_processing_time_seconds=45.0,
        success_rate=92.0,
        is_active=True,
        first_detected_at=datetime.utcnow() - timedelta(days=90),
        last_detected_at=datetime.utcnow() - timedelta(days=30),
        recommendations=["Optimize large file processing", "Consider chunked upload for large files"]
    )
    db.add(pattern2)
    
    # CSV file pattern
    pattern3 = UploadPatternDB(
        pattern_name="CSV Data Import Pattern",
        pattern_type="file_type_based",
        detection_criteria={"file_type": "csv"},
        confidence_score=0.91,
        frequency=85,
        avg_upload_size_mb=450.0,
        avg_processing_time_seconds=22.0,
        success_rate=96.0,
        is_active=True,
        first_detected_at=datetime.utcnow() - timedelta(days=120),
        last_detected_at=datetime.utcnow() - timedelta(hours=6),
        recommendations=["Optimize CSV parsing", "Implement streaming CSV processing"]
    )
    db.add(pattern3)
    
    db.commit()
    print("Upload patterns data seeded")

def main():
    """Main seeding function"""
    print("Starting upload monitoring data seeding...")
    print("=" * 50)
    
    db = next(get_db())
    
    try:
        # Clear existing upload data
        print("Clearing existing upload data...")
        try:
            db.query(UploadTrackingDB).delete()
            db.query(UploadStatisticsDB).delete()
            db.query(UploadAlertDB).delete()
            db.query(UploadHistoryDB).delete()
            db.query(UploadPatternDB).delete()
            db.commit()
            print("Existing data cleared")
        except Exception as e:
            print(f"Note: Some tables may not exist yet: {e}")
            db.rollback()
        
        # Seed new data
        seed_upload_tracking_data(db)
        seed_upload_statistics_data(db)
        seed_upload_alerts_data(db)
        seed_upload_history_data(db)
        seed_upload_patterns_data(db)
        
        print("=" * 50)
        print("Upload monitoring data seeding completed successfully!")
        print("\nSummary:")
        print("- Upload Tracking Records: 161 records (156 completed + 5 pending)")
        print("- Upload Statistics Records: 30 daily records")
        print("- Upload Alerts: 4 alerts")
        print("- Upload History Records: ~80 records")
        print("- Upload Patterns: 3 patterns")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()