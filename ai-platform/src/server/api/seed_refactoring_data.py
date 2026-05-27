#!/usr/bin/env python3
"""
Refactoring Planning Data Seeding Script

This script seeds the database with the complexity analysis data
that was provided in the performance analysis overview.
"""

import sys
import os
from datetime import datetime, timedelta

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db
from enhanced_models import RefactoringPlanDB, RefactoringTaskDB, ComplexityAnalysisDB
import logging
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_complexity_analysis_data(db: Session):
    """Seed refactoring plans based on the complexity analysis data provided"""
    logger.info("Seeding refactoring plans based on complexity analysis...")
    
    # Data from the complexity analysis provided earlier
    complexity_data = [
        {
            "file_path": "/dashboard-scripts.js",
            "file_name": "dashboard-scripts.js",
            "current_complexity": 15,
            "lines_of_code": 8397,
            "functions_count": 45,
            "cyclomatic_complexity": 392,
            "maintainability_index": 0,
            "issues": 12,
            "description": "Highest complexity file requiring immediate refactoring attention"
        },
        {
            "file_path": "/dashboard_components/backup-manager.js",
            "file_name": "backup-manager.js",
            "current_complexity": 8,
            "lines_of_code": 543,
            "functions_count": 18,
            "cyclomatic_complexity": 61,
            "maintainability_index": 0,
            "issues": 5,
            "description": "Medium-high complexity file needing optimization"
        },
        {
            "file_path": "/api/app.py",
            "file_name": "api/app.py",
            "current_complexity": 6,
            "lines_of_code": 715,
            "functions_count": 12,
            "cyclomatic_complexity": 25,
            "maintainability_index": 5,
            "issues": 3,
            "description": "Medium complexity file requiring review"
        },
        {
            "file_path": "/api/backup_system.py",
            "file_name": "backup_system.py",
            "current_complexity": 4,
            "lines_of_code": 802,
            "functions_count": 8,
            "cyclomatic_complexity": 18,
            "maintainability_index": 45,
            "issues": 2,
            "description": "Low-medium complexity file"
        },
        {
            "file_path": "/dashboard-init.js",
            "file_name": "dashboard-init.js",
            "current_complexity": 3,
            "lines_of_code": 418,
            "functions_count": 15,
            "cyclomatic_complexity": 31,
            "maintainability_index": 6,
            "issues": 1,
            "description": "Low complexity file"
        }
    ]
    
    created_plans = []
    
    for file_data in complexity_data:
        # Create complexity analysis history entry
        analysis_entry = ComplexityAnalysisDB(
            id=str(uuid.uuid4()),
            file_id=str(uuid.uuid4()),
            file_path=file_data["file_path"],
            analyzed_at=datetime.utcnow(),
            complexity_score=file_data["current_complexity"],
            cyclomatic_complexity=file_data["cyclomatic_complexity"],
            maintainability_index=file_data["maintainability_index"],
            lines_of_code=file_data["lines_of_code"],
            functions_count=file_data["functions_count"],
            code_smells=file_data.get("issues", 0),
            code_duplication=0,
            security_issues=0,
            analyzer_version="1.0.0",
            analysis_duration=30
        )
        db.add(analysis_entry)
        
        # Use the API to generate the refactoring plan
        from refactoring_api import _determine_action_type_and_priority, _calculate_target_complexity, _generate_breakdown_strategy, _estimate_refactoring_effort
        
        action_type, priority = _determine_action_type_and_priority(
            file_data["current_complexity"],
            file_data["lines_of_code"]
        )
        
        target_complexity = _calculate_target_complexity(
            file_data["current_complexity"],
            action_type
        )
        
        breakdown = _generate_breakdown_strategy(
            file_data["current_complexity"],
            target_complexity,
            file_data["lines_of_code"],
            file_data["functions_count"]
        )
        
        estimated_hours = _estimate_refactoring_effort(
            file_data["current_complexity"],
            file_data["lines_of_code"],
            action_type
        )
        
        # Create refactoring plan
        refactoring_plan = RefactoringPlanDB(
            id=str(uuid.uuid4()),
            file_id=analysis_entry.id,
            file_path=file_data["file_path"],
            file_name=file_data["file_name"],
            current_complexity=file_data["current_complexity"],
            target_complexity=target_complexity,
            complexity_reduction=file_data["current_complexity"] - target_complexity,
            lines_of_code=file_data["lines_of_code"],
            functions_count=file_data["functions_count"],
            action_type=action_type,
            priority=priority,
            status="planned",
            estimated_hours=estimated_hours,
            description=file_data["description"],
            breakdown=breakdown,
            risk_level="high" if file_data["current_complexity"] >= 10 else "medium",
            assignee="Frontend Team" if "dashboard" in file_data["file_name"] else "Backend Team",
            team="Development"
        )
        
        db.add(refactoring_plan)
        db.commit()
        db.refresh(refactoring_plan)
        
        # Create initial tasks based on breakdown
        tasks_created = _create_initial_tasks_for_plan(refactoring_plan, breakdown, db)
        
        created_plans.append({
            "file": file_data["file_name"],
            "complexity": file_data["current_complexity"],
            "action_type": action_type,
            "priority": priority,
            "tasks_created": tasks_created
        })
    
    return created_plans

def _create_initial_tasks_for_plan(plan: RefactoringPlanDB, breakdown: dict, db: Session) -> int:
    """Create initial tasks for a refactoring plan"""
    tasks_created = 0
    
    for i, step in enumerate(breakdown.get("steps", [])):
        task = RefactoringTaskDB(
            id=str(uuid.uuid4()),
            plan_id=plan.id,
            title=f"{step['phase'].capitalize()} - {plan.file_name}",
            description=step['description'],
            task_type=step['phase'],
            estimated_hours=step.get('estimated_hours', 0),
            complexity_before=plan.current_complexity,
            complexity_after=plan.target_complexity,
            complexity_reduction=plan.complexity_reduction,
            status="pending",
            assignee=plan.assignee
        )
        db.add(task)
        tasks_created += 1
    
    db.commit()
    return tasks_created

def main():
    """Main function to seed refactoring planning data"""
    try:
        # Get database session
        db_gen = get_enhanced_db()
        db = next(db_gen)
        
        try:
            print("🚀 Starting refactoring planning data seeding...")
            
            # Check if data already exists
            existing_plans = db.query(RefactoringPlanDB).count()
            if existing_plans > 0:
                print(f"⚠️  Refactoring plans already exist ({existing_plans} plans)")
                print("Deleting existing data...")
                db.query(RefactoringTaskDB).delete()
                db.query(RefactoringPlanDB).delete()
                db.commit()
            
            # Seed complexity analysis data
            plans = seed_complexity_analysis_data(db)
            
            print("\n🎉 Refactoring planning data seeded successfully!")
            print("\n📊 Refactoring Plans Created:")
            
            for plan_info in plans:
                action_icon = "🔧" if plan_info["action_type"] == "refactor" else "⚡" if plan_info["action_type"] == "optimize" else "📋"
                priority_icon = "🔴" if plan_info["priority"] == "critical" else "🟠" if plan_info["priority"] == "high" else "🟡"
                
                print(f"{action_icon} {priority_icon} {plan_info['file']}")
                print(f"   Complexity: {plan_info['complexity']} → Action: {plan_info['action_type']}")
                print(f"   Priority: {plan_info['priority']} | Tasks: {plan_info['tasks_created']}")
            
            print(f"\n📈 Summary:")
            print(f"  • Total Plans: {len(plans)}")
            print(f"  • High Priority: {len([p for p in plans if p['priority'] in ['critical', 'high']])}")
            print(f"  • Medium Priority: {len([p for p in plans if p['priority'] == 'medium'])}")
            print(f"  • Total Tasks Generated: {sum(p['tasks_created'] for p in plans)}")
            
            print("\n🔗 Next Steps:")
            print("  1. View refactoring plans: GET /api/refactoring/plans")
            print("  2. Check highest priority: GET /api/refactoring/plans?priority=critical")
            print("  3. Generate new plan: POST /api/refactoring/generate-plan")
            print("  4. Integrate with sprint: POST /api/refactoring/plans/{id}/integrate-sprint")
            print("  5. View analytics: GET /api/refactoring/analytics")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error seeding refactoring planning data: {e}")
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()