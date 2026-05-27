#!/usr/bin/env python3
"""
Database Seeding Script

Populates the database with realistic sample data matching mock data structures
This serves as the foundation for real data integration
"""

import sys
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import enhanced_db_config
from enhanced_models import (
    Base, ReportDB, ReportMetadataDB, ReportDataDB,
    MockDatasetDB, MockAnalysisResultDB, MockGeneratorDB,
    MilestoneDB, TimelineSettingsDB, TeamMemberDB,
    SystemMetricDB, DataValidationDB, DataVersionDB
)
import json
import uuid

def seed_reports(db: Session):
    """Seed reports data matching reports.js structure"""
    print("Seeding reports data...")
    
    reports_data = [
        {
            "id": "report_001",
            "name": "Project Performance Report",
            "description": "Comprehensive analysis of project performance metrics",
            "type": "performance",
            "category": "analytics",
            "format": "pdf",
            "size": 2457600,
            "schedule": "weekly",
            "status": "ready",
            "version": "1.0.0",
            "validation_status": "valid",
            "template_source": "createPerformanceReportTemplate",
            "data_version": "1.0.0"
        },
        {
            "id": "report_002",
            "name": "Code Quality Analysis",
            "description": "Detailed code quality metrics and recommendations",
            "type": "quality",
            "category": "development",
            "format": "excel",
            "size": 1024000,
            "schedule": "monthly",
            "status": "ready",
            "version": "1.0.0",
            "validation_status": "valid",
            "template_source": "createCodeQualityReportTemplate",
            "data_version": "1.0.0"
        },
        {
            "id": "report_003",
            "name": "Security Audit Report",
            "description": "Security vulnerabilities and compliance analysis",
            "type": "security",
            "category": "compliance",
            "format": "pdf",
            "size": 3145728,
            "schedule": "monthly",
            "status": "processing",
            "version": "1.0.0",
            "validation_status": "pending",
            "template_source": "createSecurityAuditReportTemplate",
            "data_version": "1.0.0"
        },
        {
            "id": "report_004",
            "name": "Resource Utilization",
            "description": "System resource usage and capacity planning",
            "type": "resources",
            "category": "operations",
            "format": "json",
            "size": 512000,
            "schedule": "daily",
            "status": "ready",
            "version": "1.0.0",
            "validation_status": "valid",
            "template_source": "createResourceUtilizationReportTemplate",
            "data_version": "1.0.0"
        }
    ]
    
    for report_data in reports_data:
        existing = db.query(ReportDB).filter(ReportDB.id == report_data["id"]).first()
        if not existing:
            report = ReportDB(**report_data)
            report.last_generated = datetime.utcnow()
            db.add(report)
            
            # Add metadata
            metadata = ReportMetadataDB(
                report_id=report.id,
                size=report_data["size"],
                schedule=report_data["schedule"],
                last_generated=datetime.utcnow(),
                version=report_data["version"],
                validation_status=report_data["validation_status"],
                template_source=report_data["template_source"]
            )
            db.add(metadata)
            
            # Add sample data
            data = ReportDataDB(
                report_id=report.id,
                data_type="summary",
                content={
                    "total_metrics": 45,
                    "passed": 38,
                    "failed": 7,
                    "score": 84.4
                }
            )
            db.add(data)
    
    db.commit()
    print(f"Seeded {len(reports_data)} reports")

def seed_mock_datasets(db: Session):
    """Seed mock datasets matching mock-data.js structure"""
    print("Seeding mock datasets...")
    
    datasets_data = [
        {
            "id": "dataset_001",
            "name": "E-commerce Sales Data",
            "type": "Sales",
            "size": "2.5GB",
            "records": 150000,
            "columns": 12,
            "description": "Realistic e-commerce sales data with customer information, products, and transactions.",
            "schema": ["order_id", "customer_id", "product_id", "quantity", "price", "timestamp", 
                     "category", "region", "payment_method", "status", "shipping_method", "discount_applied"],
            "tags": ["sales", "ecommerce", "transactions"],
            "version": "1.2.0",
            "validation_status": "valid",
            "uses_template": False,
            "template_used": None
        },
        {
            "id": "dataset_002",
            "name": "User Activity Logs",
            "type": "Analytics",
            "size": "1.8GB",
            "records": 250000,
            "columns": 8,
            "description": "User behavior and activity tracking data with session information and interaction patterns.",
            "schema": ["user_id", "session_id", "action", "timestamp", "page_url", "device_type", "referrer", "duration"],
            "tags": ["analytics", "user_behavior", "sessions"],
            "version": "1.1.0",
            "validation_status": "valid",
            "uses_template": False,
            "template_used": None
        },
        {
            "id": "dataset_003",
            "name": "Financial Transactions",
            "type": "Financial",
            "size": "4.2GB",
            "records": 500000,
            "columns": 15,
            "description": "Financial transaction data including payments, refunds, and transaction processing details.",
            "schema": ["transaction_id", "amount", "currency", "timestamp", "status", "payment_method", 
                     "customer_id", "merchant_id", "category", "risk_score", "fraud_flag", "processing_time"],
            "tags": ["financial", "transactions", "payments"],
            "version": "1.0.0",
            "validation_status": "valid",
            "uses_template": False,
            "template_used": None
        },
        {
            "id": "dataset_004",
            "name": "Project Management Data",
            "type": "Project Management",
            "size": "1.5GB",
            "records": 300000,
            "columns": 10,
            "description": "Project management data including tasks, sprints, and team assignments.",
            "schema": ["project_id", "task_id", "assignee", "status", "priority", "due_date", "story_points", "sprint_id"],
            "tags": ["project_management", "tasks", "agile"],
            "version": "1.0.0",
            "validation_status": "valid",
            "uses_template": True,
            "template_used": "createProjectTemplate"
        },
        {
            "id": "dataset_005",
            "name": "Team Performance Metrics",
            "type": "Team Analytics",
            "size": "0.8GB",
            "records": 150000,
            "columns": 8,
            "description": "Team performance metrics including productivity, quality, and collaboration scores.",
            "schema": ["team_member_id", "productivity_score", "quality_score", "collaboration_score", 
                     "tasks_completed", "code_reviews", "meeting_attendance"],
            "tags": ["team", "performance", "analytics"],
            "version": "1.0.0",
            "validation_status": "valid",
            "uses_template": True,
            "template_used": "createUserTemplate"
        }
    ]
    
    for dataset_data in datasets_data:
        existing = db.query(MockDatasetDB).filter(MockDatasetDB.id == dataset_data["id"]).first()
        if not existing:
            dataset = MockDatasetDB(**dataset_data)
            dataset.last_generated = datetime.utcnow()
            db.add(dataset)
    
    db.commit()
    print(f"Seeded {len(datasets_data)} mock datasets")

def seed_team_members(db: Session):
    """Seed team members data"""
    print("Seeding team members...")
    
    team_members = [
        {
            "id": "member_001",
            "name": "Alex Johnson",
            "role": "Project Manager",
            "email": "alex.johnson@company.com",
            "status": "active",
            "department": "Engineering",
            "performance_productivity": 85,
            "performance_quality": 90,
            "performance_collaboration": 88,
            "version": "1.0.0",
            "validation_status": "valid"
        },
        {
            "id": "member_002",
            "name": "Sarah Chen",
            "role": "Lead Developer",
            "email": "sarah.chen@company.com",
            "status": "active",
            "department": "Engineering",
            "performance_productivity": 92,
            "performance_quality": 95,
            "performance_collaboration": 85,
            "version": "1.0.0",
            "validation_status": "valid"
        },
        {
            "id": "member_003",
            "name": "Michael Brown",
            "role": "Backend Developer",
            "email": "michael.brown@company.com",
            "status": "active",
            "department": "Engineering",
            "performance_productivity": 78,
            "performance_quality": 85,
            "performance_collaboration": 90,
            "version": "1.0.0",
            "validation_status": "valid"
        }
    ]
    
    for member_data in team_members:
        existing = db.query(TeamMemberDB).filter(TeamMemberDB.id == member_data["id"]).first()
        if not existing:
            member = TeamMemberDB(**member_data)
            member.join_date = datetime.utcnow() - timedelta(days=180)
            member.last_active = datetime.utcnow()
            db.add(member)
    
    db.commit()
    print(f"Seeded {len(team_members)} team members")

def seed_system_metrics(db: Session):
    """Seed system metrics for monitoring"""
    print("Seeding system metrics...")
    
    metric_types = ['cpu', 'memory', 'disk', 'network']
    
    for i in range(20):  # Create 20 sample metrics
        metric_type = metric_types[i % len(metric_types)]
        metric = SystemMetricDB(
            metric_type=metric_type,
            metric_name=f"{metric_type}_usage_{i}",
            value=50 + (i * 2) % 40,  # Values between 50-90
            unit="%" if metric_type in ['cpu', 'memory'] else "GB",
            timestamp=datetime.utcnow() - timedelta(minutes=i),
            source="system",
            status="active"
        )
        db.add(metric)
    
    db.commit()
    print("Seeded system metrics")

def seed_roadmap_data(db: Session):
    """Seed roadmap milestones and settings"""
    print("Seeding roadmap data...")
    
    # Sample milestones
    milestones = [
        {
            "id": "milestone_001",
            "name": "Q2 2024 Product Launch",
            "description": "Major product release for Q2 2024",
            "date": datetime.utcnow() + timedelta(days=30),
            "priority": "high",
            "status": "in-progress",
            "team": "Engineering",
            "progress": 65,
            "dependencies": [],
            "tags": ["product", "launch", "q2"],
            "version": "1.0.0",
            "validation_status": "valid"
        },
        {
            "id": "milestone_002",
            "name": "Security Audit Completion",
            "description": "Complete security audit and vulnerability assessment",
            "date": datetime.utcnow() + timedelta(days=15),
            "priority": "high",
            "status": "in-progress",
            "team": "Security",
            "progress": 80,
            "dependencies": [],
            "tags": ["security", "audit", "compliance"],
            "version": "1.0.0",
            "validation_status": "valid"
        }
    ]
    
    for milestone_data in milestones:
        existing = db.query(MilestoneDB).filter(MilestoneDB.id == milestone_data["id"]).first()
        if not existing:
            milestone = MilestoneDB(**milestone_data)
            db.add(milestone)
    
    # Timeline settings
    settings = TimelineSettingsDB(
        view="months",
        show_milestones=True,
        show_dependencies=False,
        show_progress=True,
        show_teams=True,
        theme="default",
        auto_save=True,
        notifications=True,
        version="1.0.0"
    )
    
    existing_settings = db.query(TimelineSettingsDB).first()
    if not existing_settings:
        db.add(settings)
    
    db.commit()
    print(f"Seeded {len(milestones)} milestones and timeline settings")

def seed_data_validations(db: Session):
    """Seed data validation records"""
    print("Seeding data validation records...")
    
    # Add validation records for reports
    report_ids = ["report_001", "report_002", "report_003", "report_004"]
    
    for report_id in report_ids:
        validation = DataValidationDB(
            data_source="reports",
            data_id=report_id,
            validation_type="schema",
            status="valid" if report_id != "report_003" else "pending",
            errors=[],
            warnings=[],
            score=95.0 if report_id != "report_003" else 0.0,
            validator_version="1.0.0"
        )
        db.add(validation)
    
    db.commit()
    print(f"Seeded {len(report_ids)} validation records")

def seed_data_versions(db: Session):
    """Seed initial version control records"""
    print("Seeding data version control records...")
    
    # Add version records for datasets
    dataset_ids = ["dataset_001", "dataset_002", "dataset_003", "dataset_004", "dataset_005"]
    
    for dataset_id in dataset_ids:
        version = DataVersionDB(
            data_source="mock_datasets",
            data_id=dataset_id,
            version="1.0.0",
            changes=["Initial version creation"],
            changed_by="system",
            change_reason="Database initialization",
            snapshot={}
        )
        db.add(version)
    
    db.commit()
    print(f"Seeded {len(dataset_ids)} version control records")

def main():
    """Main seeding function"""
    print("Starting database seeding...")
    
    try:
        # Initialize database tables
        print("Creating database tables...")
        enhanced_db_config.create_tables()
        
        # Get database session
        with enhanced_db_config.get_session() as db:
            # Seed all data
            seed_reports(db)
            seed_mock_datasets(db)
            seed_team_members(db)
            seed_system_metrics(db)
            seed_roadmap_data(db)
            seed_data_validations(db)
            seed_data_versions(db)
            
            print("\nDatabase seeding completed successfully!")
            print("Summary:")
            print(f"   - Reports: 4")
            print(f"   - Mock Datasets: 5")
            print(f"   - Team Members: 3")
            print(f"   - System Metrics: 20")
            print(f"   - Roadmap Milestones: 2")
            print(f"   - Validation Records: 4")
            print(f"   - Version Records: 5")
            
    except Exception as e:
        print(f"Database seeding failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()