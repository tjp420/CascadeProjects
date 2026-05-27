#!/usr/bin/env python3
"""
Roadmap Data Seeding Script

This script seeds the database with the Q1-Q4 2024 roadmap data
that was provided in the roadmap overview.
"""

import sys
import os
from datetime import datetime, timedelta

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db
from enhanced_models import RoadmapDB, MilestoneDB, RoadmapRiskDB
import logging
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_q1_2024_roadmap(db: Session):
    """Seed Q1 2024 roadmap (COMPLETED)"""
    logger.info("Seeding Q1 2024 roadmap...")
    
    # Create Q1 2024 roadmap
    q1_roadmap = RoadmapDB(
        id=str(uuid.uuid4()),
        quarter="Q1",
        year=2024,
        start_date=datetime(2024, 1, 1),
        end_date=datetime(2024, 3, 31),
        status="completed",
        progress_percentage=100,
        total_milestones=3,
        completed_milestones=3,
        total_risks=0,
        remaining_days=0,
        on_track=True,
        summary="Q1 2024 completed successfully with all foundational components delivered"
    )
    db.add(q1_roadmap)
    db.commit()
    db.refresh(q1_roadmap)
    
    # Create Q1 milestones
    q1_milestones = [
        {
            "name": "Dashboard Foundation",
            "description": "Core dashboard infrastructure and basic components",
            "priority": "high",
            "status": "completed",
            "target_date": datetime(2024, 1, 14),
            "completed_date": datetime(2024, 1, 14),
            "estimated_hours": 120,
            "actual_hours": 115,
            "progress_percentage": 100,
            "team": "Frontend Team"
        },
        {
            "name": "Backup System Integration",
            "description": "Initial backup functionality and API integration",
            "priority": "high",
            "status": "completed",
            "target_date": datetime(2024, 2, 19),
            "completed_date": datetime(2024, 2, 19),
            "estimated_hours": 80,
            "actual_hours": 85,
            "progress_percentage": 100,
            "team": "Backend Team"
        },
        {
            "name": "Performance Monitoring",
            "description": "Basic performance metrics and monitoring",
            "priority": "medium",
            "status": "completed",
            "target_date": datetime(2024, 3, 9),
            "completed_date": datetime(2024, 3, 9),
            "estimated_hours": 60,
            "actual_hours": 55,
            "progress_percentage": 100,
            "team": "DevOps Team"
        }
    ]
    
    for milestone_data in q1_milestones:
        milestone = MilestoneDB(
            id=str(uuid.uuid4()),
            roadmap_id=q1_roadmap.id,
            **milestone_data
        )
        db.add(milestone)
    
    db.commit()
    logger.info(f"Q1 2024 roadmap created with {len(q1_milestones)} milestones")
    
    return q1_roadmap

def seed_q2_2024_roadmap(db: Session):
    """Seed Q2 2024 roadmap (ACTIVE)"""
    logger.info("Seeding Q2 2024 roadmap...")
    
    # Create Q2 2024 roadmap
    q2_roadmap = RoadmapDB(
        id=str(uuid.uuid4()),
        quarter="Q2",
        year=2024,
        start_date=datetime(2024, 4, 1),
        end_date=datetime(2024, 6, 30),
        status="active",
        progress_percentage=75,
        total_milestones=6,
        completed_milestones=4,
        total_risks=2,
        high_priority_risks=0,
        medium_priority_risks=2,
        low_priority_risks=0,
        remaining_days=41,
        on_track=True,
        summary="Q2 2024 progressing well with 75% completion, 2 medium risks identified"
    )
    db.add(q2_roadmap)
    db.commit()
    db.refresh(q2_roadmap)
    
    # Create Q2 milestones
    q2_milestones = [
        {
            "name": "Advanced Analytics",
            "description": "Complexity analysis and code quality metrics",
            "priority": "high",
            "status": "completed",
            "target_date": datetime(2024, 4, 14),
            "completed_date": datetime(2024, 4, 14),
            "estimated_hours": 100,
            "actual_hours": 95,
            "progress_percentage": 100,
            "team": "Backend Team"
        },
        {
            "name": "Enhanced Backup Features",
            "description": "Advanced backup scheduling and automation",
            "priority": "high",
            "status": "completed",
            "target_date": datetime(2024, 5, 9),
            "completed_date": datetime(2024, 5, 9),
            "estimated_hours": 80,
            "actual_hours": 78,
            "progress_percentage": 100,
            "team": "Backend Team"
        },
        {
            "name": "Debug Tools Suite",
            "description": "Comprehensive debugging and diagnostic tools",
            "priority": "medium",
            "status": "completed",
            "target_date": datetime(2024, 5, 19),
            "completed_date": datetime(2024, 5, 19),
            "estimated_hours": 60,
            "actual_hours": 58,
            "progress_percentage": 100,
            "team": "Tools Team"
        },
        {
            "name": "Mock Data System Enhancement",
            "description": "Export consolidation, lifecycle documentation, version control, and templates",
            "priority": "high",
            "status": "completed",
            "target_date": datetime(2024, 5, 19),
            "completed_date": datetime(2024, 5, 19),
            "estimated_hours": 120,
            "actual_hours": 115,
            "progress_percentage": 100,
            "team": "Data Team"
        },
        {
            "name": "Reporting System",
            "description": "Advanced reporting and analytics dashboard",
            "priority": "high",
            "status": "in_progress",
            "target_date": datetime(2024, 6, 14),
            "estimated_hours": 100,
            "actual_hours": 75,
            "progress_percentage": 75,
            "team": "Analytics Team"
        },
        {
            "name": "Mobile Optimization",
            "description": "Responsive design and mobile app integration",
            "priority": "medium",
            "status": "planned",
            "target_date": datetime(2024, 6, 29),
            "estimated_hours": 80,
            "actual_hours": 0,
            "progress_percentage": 0,
            "team": "Frontend Team"
        }
    ]
    
    for milestone_data in q2_milestones:
        milestone = MilestoneDB(
            id=str(uuid.uuid4()),
            roadmap_id=q2_roadmap.id,
            **milestone_data
        )
        db.add(milestone)
    
    # Create Q2 risks
    q2_risks = [
        {
            "title": "Reporting System Timeline Risk",
            "description": "Reporting system complexity may cause delay beyond June 14 target",
            "category": "timeline",
            "priority": "medium",
            "probability": "medium",
            "impact": "medium",
            "status": "open",
            "mitigation_strategy": "Add additional resources and prioritize core features",
            "mitigation_progress": 50,
            "owner": "Project Manager",
            "target_resolution_date": datetime(2024, 6, 1),
            "estimated_delay_days": 7
        },
        {
            "title": "Mobile Integration Dependency",
            "description": "Mobile optimization depends on reporting system completion",
            "category": "dependency",
            "priority": "medium",
            "probability": "low",
            "impact": "medium",
            "status": "open",
            "mitigation_strategy": "Parallel development of independent mobile components",
            "mitigation_progress": 30,
            "owner": "Tech Lead",
            "target_resolution_date": datetime(2024, 6, 15),
            "estimated_delay_days": 5
        }
    ]
    
    for risk_data in q2_risks:
        risk = RoadmapRiskDB(
            id=str(uuid.uuid4()),
            roadmap_id=q2_roadmap.id,
            **risk_data
        )
        db.add(risk)
    
    db.commit()
    logger.info(f"Q2 2024 roadmap created with {len(q2_milestones)} milestones and {len(q2_risks)} risks")
    
    return q2_roadmap

def seed_q3_2024_roadmap(db: Session):
    """Seed Q3 2024 roadmap (PLANNED)"""
    logger.info("Seeding Q3 2024 roadmap...")
    
    # Create Q3 2024 roadmap
    q3_roadmap = RoadmapDB(
        id=str(uuid.uuid4()),
        quarter="Q3",
        year=2024,
        start_date=datetime(2024, 7, 1),
        end_date=datetime(2024, 9, 30),
        status="planned",
        progress_percentage=0,
        total_milestones=5,
        completed_milestones=0,
        total_risks=0,
        remaining_days=72,  # Days from now until July 1
        on_track=True,
        summary="Q3 2024 planning phase with focus on security, AI features, and enterprise capabilities"
    )
    db.add(q3_roadmap)
    db.commit()
    db.refresh(q3_roadmap)
    
    # Create Q3 milestones
    q3_milestones = [
        {
            "name": "Mock Data Security Enhancement",
            "description": "Implement clearly identifiable test data and security isolation",
            "priority": "high",
            "status": "planned",
            "target_date": datetime(2024, 7, 14),
            "estimated_hours": 80,
            "progress_percentage": 0,
            "team": "Security Team"
        },
        {
            "name": "Mock Data Performance Optimization",
            "description": "Implement lazy loading and caching for mock data",
            "priority": "medium",
            "status": "planned",
            "target_date": datetime(2024, 8, 14),
            "estimated_hours": 60,
            "progress_percentage": 0,
            "team": "Performance Team"
        },
        {
            "name": "AI-Powered Insights",
            "description": "Machine learning integration for predictive analytics",
            "priority": "high",
            "status": "planned",
            "target_date": datetime(2024, 7, 30),
            "estimated_hours": 120,
            "progress_percentage": 0,
            "team": "AI/ML Team"
        },
        {
            "name": "Enterprise Features",
            "description": "Multi-tenant support and enterprise security",
            "priority": "high",
            "status": "planned",
            "target_date": datetime(2024, 8, 30),
            "estimated_hours": 150,
            "progress_percentage": 0,
            "team": "Enterprise Team"
        },
        {
            "name": "API Gateway",
            "description": "Centralized API management and documentation",
            "priority": "medium",
            "status": "planned",
            "target_date": datetime(2024, 9, 14),
            "estimated_hours": 70,
            "progress_percentage": 0,
            "team": "API Team"
        }
    ]
    
    for milestone_data in q3_milestones:
        milestone = MilestoneDB(
            id=str(uuid.uuid4()),
            roadmap_id=q3_roadmap.id,
            **milestone_data
        )
        db.add(milestone)
    
    db.commit()
    logger.info(f"Q3 2024 roadmap created with {len(q3_milestones)} milestones")
    
    return q3_roadmap

def seed_q4_2024_roadmap(db: Session):
    """Seed Q4 2024 roadmap (PLANNED)"""
    logger.info("Seeding Q4 2024 roadmap...")
    
    # Create Q4 2024 roadmap
    q4_roadmap = RoadmapDB(
        id=str(uuid.uuid4()),
        quarter="Q4",
        year=2024,
        start_date=datetime(2024, 10, 1),
        end_date=datetime(2024, 12, 31),
        status="planned",
        progress_percentage=0,
        total_milestones=5,
        completed_milestones=0,
        total_risks=0,
        remaining_days=164,  # Days from now until October 1
        on_track=True,
        summary="Q4 2024 planning phase with focus on cloud integration, security hardening, and performance optimization"
    )
    db.add(q4_roadmap)
    db.commit()
    db.refresh(q4_roadmap)
    
    # Create Q4 milestones
    q4_milestones = [
        {
            "name": "Cloud Integration",
            "description": "AWS/Azure integration and cloud deployment",
            "priority": "high",
            "status": "planned",
            "target_date": datetime(2024, 10, 30),
            "estimated_hours": 100,
            "progress_percentage": 0,
            "team": "Cloud Team"
        },
        {
            "name": "Mock Data Hardcoded Value Reduction",
            "description": "Replace hardcoded values with generated test data",
            "priority": "medium",
            "status": "planned",
            "target_date": datetime(2024, 10, 14),
            "estimated_hours": 60,
            "progress_percentage": 0,
            "team": "Data Team"
        },
        {
            "name": "Mock Data Comprehensive Documentation",
            "description": "Add detailed documentation for all mock data structures",
            "priority": "medium",
            "status": "planned",
            "target_date": datetime(2024, 11, 14),
            "estimated_hours": 50,
            "progress_percentage": 0,
            "team": "Documentation Team"
        },
        {
            "name": "Advanced Security",
            "description": "Zero-trust security model and compliance",
            "priority": "high",
            "status": "planned",
            "target_date": datetime(2024, 11, 29),
            "estimated_hours": 120,
            "progress_percentage": 0,
            "team": "Security Team"
        },
        {
            "name": "Performance Optimization",
            "description": "System-wide performance optimization and scaling",
            "priority": "medium",
            "status": "planned",
            "target_date": datetime(2024, 12, 14),
            "estimated_hours": 80,
            "progress_percentage": 0,
            "team": "Performance Team"
        }
    ]
    
    for milestone_data in q4_milestones:
        milestone = MilestoneDB(
            id=str(uuid.uuid4()),
            roadmap_id=q4_roadmap.id,
            **milestone_data
        )
        db.add(milestone)
    
    db.commit()
    logger.info(f"Q4 2024 roadmap created with {len(q4_milestones)} milestones")
    
    return q4_roadmap

def main():
    """Main function to seed all roadmap data"""
    try:
        # Get database session
        db_gen = get_enhanced_db()
        db = next(db_gen)
        
        try:
            print("🚀 Starting roadmap data seeding...")
            
            # Check if data already exists
            existing_roadmaps = db.query(RoadmapDB).count()
            if existing_roadmaps > 0:
                print(f"⚠️  Roadmap data already exists ({existing_roadmaps} roadmaps)")
                print("Deleting existing data...")
                db.query(RoadmapRiskDB).delete()
                db.query(MilestoneDB).delete()
                db.query(RoadmapDB).delete()
                db.commit()
            
            # Seed all quarters
            q1 = seed_q1_2024_roadmap(db)
            print("✅ Q1 2024 roadmap seeded (COMPLETED)")
            
            q2 = seed_q2_2024_roadmap(db)
            print("✅ Q2 2024 roadmap seeded (ACTIVE)")
            
            q3 = seed_q3_2024_roadmap(db)
            print("✅ Q3 2024 roadmap seeded (PLANNED)")
            
            q4 = seed_q4_2024_roadmap(db)
            print("✅ Q4 2024 roadmap seeded (PLANNED)")
            
            print("\n🎉 Roadmap data seeding completed successfully!")
            print("\n📊 Roadmap Summary:")
            print(f"  • Q1 2024: {q1.total_milestones} milestones, {q1.progress_percentage}% complete")
            print(f"  • Q2 2024: {q2.total_milestones} milestones, {q2.progress_percentage}% complete (ACTIVE)")
            print(f"  • Q3 2024: {q3.total_milestones} milestones, {q3.progress_percentage}% complete (PLANNED)")
            print(f"  • Q4 2024: {q4.total_milestones} milestones, {q4.progress_percentage}% complete (PLANNED)")
            print(f"  • Total: 19 milestones across 4 quarters")
            print(f"  • Active Risks: {q2.total_risks}")
            
            print("\n🔗 Next Steps:")
            print("  1. View roadmaps: GET /api/roadmap/")
            print("  2. Check Q2 progress: GET /api/roadmap/{q2.id}")
            print("  3. Monitor alerts: GET /api/dashboard/roadmap/alerts")
            print("  4. Generate reports: POST /api/reports/generate with type='roadmap'")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error seeding roadmap data: {e}")
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()