#!/usr/bin/env python3
"""
Seed Performance Data for AI Dashboard

This script seeds the performance monitoring system with initial data based on
the performance metrics shared in the conversation.
"""

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    Base, APIPerformanceDB, SystemResourcesDB, PerformanceAlertDB,
    PerformanceHistoryDB, SlowOperationDB
)
from datetime import datetime, timedelta
import random
import uuid

def seed_api_performance_data(db: Session):
    """Seed API performance data based on shared metrics"""
    print("Seeding API performance data...")
    
    # Export Service - degraded performance
    for i in range(20):
        response_time = random.gauss(8700, 1500)  # 8.7s average with variance
        status_code = 500 if random.random() < 0.024 else 200  # 2.4% error rate
        
        performance = APIPerformanceDB(
            endpoint_name="/api/reports/export",
            method="POST",
            response_time_ms=max(100, response_time),
            status_code=status_code,
            error_count=1 if status_code >= 400 else 0,
            success_count=0 if status_code >= 400 else 1,
            avg_response_time=8700,
            error_rate=2.4,
            performance_trend="degrading",
            trend_percentage=12.5
        )
        performance.created_at = datetime.utcnow() - timedelta(hours=i)
        performance.updated_at = datetime.utcnow() - timedelta(hours=i)
        db.add(performance)
    
    # Analysis Engine - slow performance
    for i in range(15):
        response_time = random.gauss(12300, 2000)  # 12.3s average with variance
        status_code = 500 if random.random() < 0.012 else 200  # 1.2% error rate
        
        performance = APIPerformanceDB(
            endpoint_name="/api/reports/analyze",
            method="POST",
            response_time_ms=max(100, response_time),
            status_code=status_code,
            error_count=1 if status_code >= 400 else 0,
            success_count=0 if status_code >= 400 else 1,
            avg_response_time=12300,
            error_rate=1.2,
            performance_trend="degrading",
            trend_percentage=8.3
        )
        performance.created_at = datetime.utcnow() - timedelta(hours=i)
        performance.updated_at = datetime.utcnow() - timedelta(hours=i)
        db.add(performance)
    
    # Other endpoints - normal performance
    endpoints = [
        ("/api/reports", "GET", 250, 0.1),
        ("/api/dashboard/metrics", "GET", 180, 0.05),
        ("/api/roadmap/", "GET", 320, 0.2),
        ("/api/refactoring/plans", "GET", 290, 0.15),
        ("/api/backup/list", "GET", 150, 0.0)
    ]
    
    for endpoint_name, method, base_time, error_rate in endpoints:
        for i in range(10):
            response_time = random.gauss(base_time, base_time * 0.3)
            status_code = 500 if random.random() < error_rate else 200
            
            performance = APIPerformanceDB(
                endpoint_name=endpoint_name,
                method=method,
                response_time_ms=max(50, response_time),
                status_code=status_code,
                error_count=1 if status_code >= 400 else 0,
                success_count=0 if status_code >= 400 else 1,
                avg_response_time=base_time,
                error_rate=error_rate * 100,
                performance_trend="stable",
                trend_percentage=0
            )
            performance.created_at = datetime.utcnow() - timedelta(hours=i)
            performance.updated_at = datetime.utcnow() - timedelta(hours=i)
            db.add(performance)
    
    db.commit()
    print("API performance data seeded")

def seed_system_resources_data(db: Session):
    """Seed system resources data based on shared metrics"""
    print("Seeding system resources data...")
    
    # Current system resources (from shared data)
    current = SystemResourcesDB(
        cpu_percent=45.0,
        cpu_count=8,
        cpu_freq_mhz=2400.0,
        memory_percent=67.0,
        memory_total_mb=16384.0,  # 16GB
        memory_available_mb=5408.0,  # ~5.3GB available
        memory_used_mb=10976.0,  # ~10.7GB used
        memory_cached_mb=2048.0,
        disk_percent=23.0,
        disk_total_gb=500.0,
        disk_used_gb=115.0,
        disk_free_gb=385.0,
        disk_read_mb_s=15.5,
        disk_write_mb_s=8.2,
        network_sent_mb_s=2.5,
        network_recv_mb_s=3.8,
        network_connections=45,
        system_health="healthy"
    )
    db.add(current)
    
    # Historical data for trend analysis
    for i in range(24):  # 24 hours of data
        cpu_percent = random.gauss(45, 10)
        memory_percent = random.gauss(67, 5)
        disk_percent = random.gauss(23, 2)
        
        resources = SystemResourcesDB(
            cpu_percent=max(0, min(100, cpu_percent)),
            cpu_count=8,
            cpu_freq_mhz=2400.0,
            memory_percent=max(0, min(100, memory_percent)),
            memory_total_mb=16384.0,
            memory_available_mb=16384.0 * (1 - memory_percent/100),
            memory_used_mb=16384.0 * (memory_percent/100),
            memory_cached_mb=2048.0,
            disk_percent=max(0, min(100, disk_percent)),
            disk_total_gb=500.0,
            disk_used_gb=500.0 * (disk_percent/100),
            disk_free_gb=500.0 * (1 - disk_percent/100),
            network_sent_mb_s=random.gauss(2.5, 0.5),
            network_recv_mb_s=random.gauss(3.8, 0.8),
            network_connections=random.randint(30, 60),
            system_health="healthy" if cpu_percent < 75 and memory_percent < 85 else "warning"
        )
        resources.created_at = datetime.utcnow() - timedelta(hours=i)
        resources.updated_at = datetime.utcnow() - timedelta(hours=i)
        db.add(resources)
    
    db.commit()
    print("System resources data seeded")

def seed_performance_alerts(db: Session):
    """Seed performance alerts based on shared alerts"""
    print("Seeding performance alerts...")
    
    # Export Service Slow Response Alert
    alert1 = PerformanceAlertDB(
        alert_name="Export Service Slow Response",
        alert_type="api_performance",
        metric_name="response_time_ms",
        condition="above",
        threshold_value=5000.0,  # 5 seconds
        severity="warning",
        is_active=True,
        cooldown_minutes=15,
        last_triggered_at=datetime.utcnow() - timedelta(minutes=30),
        trigger_count=5,
        description="Alert when export service response time exceeds 5 seconds"
    )
    db.add(alert1)
    
    # Memory Usage Above Threshold Alert
    alert2 = PerformanceAlertDB(
        alert_name="Memory Usage Above Threshold",
        alert_type="system_resources",
        metric_name="memory_percent",
        condition="above",
        threshold_value=85.0,  # 85%
        severity="info",
        is_active=True,
        cooldown_minutes=30,
        last_triggered_at=datetime.utcnow() - timedelta(hours=2),
        trigger_count=2,
        description="Alert when memory usage exceeds 85%"
    )
    db.add(alert2)
    
    # CPU Usage High Alert
    alert3 = PerformanceAlertDB(
        alert_name="CPU Usage High",
        alert_type="system_resources",
        metric_name="cpu_percent",
        condition="above",
        threshold_value=80.0,  # 80%
        severity="warning",
        is_active=False,
        cooldown_minutes=10,
        trigger_count=0,
        description="Alert when CPU usage exceeds 80%"
    )
    db.add(alert3)
    
    # API Error Rate Alert
    alert4 = PerformanceAlertDB(
        alert_name="API Error Rate High",
        alert_type="api_performance",
        metric_name="error_rate",
        condition="above",
        threshold_value=5.0,  # 5%
        severity="critical",
        is_active=True,
        cooldown_minutes=5,
        last_triggered_at=datetime.utcnow() - timedelta(minutes=45),
        trigger_count=3,
        description="Alert when API error rate exceeds 5%"
    )
    db.add(alert4)
    
    db.commit()
    print("Performance alerts seeded")

def seed_slow_operations(db: Session):
    """Seed slow operations based on shared analysis"""
    print("Seeding slow operations...")
    
    # Export Report Generation - 8500ms
    slow_op1 = SlowOperationDB(
        operation_name="Export Report Generation",
        operation_type="api",
        duration_ms=8500.0,
        threshold_ms=1000.0,
        endpoint="/api/reports/export",
        frequency=15,
        status="active",
        first_seen_at=datetime.utcnow() - timedelta(days=2),
        last_seen_at=datetime.utcnow() - timedelta(minutes=10)
    )
    db.add(slow_op1)
    
    # Backup Creation - 3200ms
    slow_op2 = SlowOperationDB(
        operation_name="Backup Creation",
        operation_type="api",
        duration_ms=3200.0,
        threshold_ms=1000.0,
        endpoint="/api/backup/create",
        frequency=8,
        status="active",
        first_seen_at=datetime.utcnow() - timedelta(days=1),
        last_seen_at=datetime.utcnow() - timedelta(hours=1)
    )
    db.add(slow_op2)
    
    # Chart Renderer - Memory leak (23.84MB)
    slow_op3 = SlowOperationDB(
        operation_name="Chart Renderer",
        operation_type="custom",
        duration_ms=2500.0,
        threshold_ms=1000.0,
        frequency=25,
        status="investigating",
        first_seen_at=datetime.utcnow() - timedelta(days=3),
        last_seen_at=datetime.utcnow() - timedelta(minutes=5),
        meta_data={"memory_leak": "23.84MB", "component": "frontend"}
    )
    db.add(slow_op3)
    
    db.commit()
    print("Slow operations seeded")

def seed_performance_history(db: Session):
    """Seed performance history for trend analysis"""
    print("Seeding performance history...")
    
    # API performance history
    for i in range(48):  # 48 hours of data
        history = PerformanceHistoryDB(
            metric_type="api",
            metric_name="avg_response_time",
            metric_value=random.gauss(500, 200),
            previous_value=random.gauss(480, 180),
            change_value=random.gauss(20, 50),
            change_percentage=random.gauss(4, 8),
            context={"endpoint": "all"},
            is_anomaly=abs(random.gauss(0, 1)) > 2,
            anomaly_score=abs(random.gauss(0, 1))
        )
        history.created_at = datetime.utcnow() - timedelta(hours=i)
        db.add(history)
    
    # System resources history
    for i in range(48):
        history = PerformanceHistoryDB(
            metric_type="system",
            metric_name="cpu_percent",
            metric_value=random.gauss(45, 10),
            previous_value=random.gauss(44, 9),
            change_value=random.gauss(1, 3),
            change_percentage=random.gauss(2, 5),
            context={"server": "main"},
            is_anomaly=abs(random.gauss(0, 1)) > 2,
            anomaly_score=abs(random.gauss(0, 1))
        )
        history.created_at = datetime.utcnow() - timedelta(hours=i)
        db.add(history)
    
    db.commit()
    print("Performance history seeded")

def main():
    """Main seeding function"""
    print("Starting performance data seeding...")
    print("=" * 50)
    
    db = next(get_db())
    
    try:
        # Clear existing performance data (if tables exist)
        print("Clearing existing performance data...")
        try:
            db.query(APIPerformanceDB).delete()
            db.query(SystemResourcesDB).delete()
            db.query(PerformanceAlertDB).delete()
            db.query(SlowOperationDB).delete()
            db.query(PerformanceHistoryDB).delete()
            db.commit()
            print("Existing data cleared")
        except Exception as e:
            print(f"Note: Some tables may not exist yet: {e}")
            db.rollback()
        
        # Seed new data
        seed_api_performance_data(db)
        seed_system_resources_data(db)
        seed_performance_alerts(db)
        seed_slow_operations(db)
        seed_performance_history(db)
        
        print("=" * 50)
        print("Performance data seeding completed successfully!")
        print("\nSummary:")
        print("- API Performance Records: ~45 records")
        print("- System Resources Records: 25 records")
        print("- Performance Alerts: 4 alerts")
        print("- Slow Operations: 3 operations")
        print("- Performance History: 96 records")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()