#!/usr/bin/env python3
"""
Refactoring Planning API for AI Coding Intelligence Dashboard

RESTful API endpoints for complexity-based refactoring planning,
automatic prioritization, and sprint integration.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    RefactoringPlanDB, RefactoringTaskDB, ComplexityAnalysisDB,
    RefactoringSprintIntegrationDB
)
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/refactoring", tags=["refactoring"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class RefactoringPlanResponse(BaseModel):
    id: str
    file_id: str
    file_path: str
    file_name: str
    current_complexity: int
    target_complexity: int
    complexity_reduction: Optional[int]
    lines_of_code: Optional[int]
    functions_count: Optional[int]
    action_type: str
    priority: str
    status: str
    estimated_hours: Optional[int]
    actual_hours: Optional[int]
    sprint_id: Optional[str]
    task_id: Optional[str]
    description: Optional[str]
    strategy: Optional[str]
    breakdown: Optional[Dict[str, Any]]
    risk_level: Optional[str]
    dependencies: Optional[List[str]]
    impact_analysis: Optional[Dict[str, Any]]
    progress_percentage: int
    assignee: Optional[str]
    team: Optional[str]
    actual_complexity_after: Optional[int]
    improvement_percentage: Optional[float]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

class RefactoringPlanCreate(BaseModel):
    file_path: str = Field(..., description="Full file path")
    file_name: str = Field(..., description="File name")
    current_complexity: int = Field(..., description="Current complexity score")
    lines_of_code: Optional[int] = None
    functions_count: Optional[int] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    team: Optional[str] = None

class RefactoringPlanUpdate(BaseModel):
    status: Optional[str] = None
    progress_percentage: Optional[int] = None
    actual_hours: Optional[int] = None
    assignee: Optional[str] = None
    actual_complexity_after: Optional[int] = None

class RefactoringTaskResponse(BaseModel):
    id: str
    plan_id: str
    title: str
    description: Optional[str]
    task_type: Optional[str]
    complexity_before: Optional[int]
    complexity_after: Optional[int]
    complexity_reduction: Optional[int]
    status: str
    progress_percentage: int
    estimated_hours: Optional[int]
    actual_hours: Optional[int]
    depends_on_tasks: Optional[List[str]]
    blocks_tasks: Optional[List[str]]
    file_section: Optional[str]
    line_range_start: Optional[int]
    line_range_end: Optional[int]
    tests_required: bool
    tests_passed: bool
    assignee: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

class RefactoringTaskCreate(BaseModel):
    plan_id: str = Field(..., description="Refactoring plan ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = None
    task_type: Optional[str] = None
    estimated_hours: Optional[int] = None
    file_section: Optional[str] = None
    line_range_start: Optional[int] = None
    line_range_end: Optional[int] = None
    assignee: Optional[str] = None

class ComplexityAnalysisResponse(BaseModel):
    id: str
    file_id: str
    file_path: str
    analyzed_at: datetime
    complexity_score: int
    cyclomatic_complexity: Optional[int]
    maintainability_index: Optional[int]
    lines_of_code: Optional[int]
    functions_count: Optional[int]
    classes_count: Optional[int]
    code_smells: Optional[int]
    code_duplication: Optional[int]
    security_issues: Optional[int]
    previous_complexity: Optional[int]
    complexity_change: Optional[int]
    improvement_percentage: Optional[float]

class RefactoringAnalyticsResponse(BaseModel):
    total_plans: int
    by_status: Dict[str, int]
    by_priority: Dict[str, int]
    by_action_type: Dict[str, int]
    average_complexity_reduction: float
    total_estimated_hours: int
    total_actual_hours: int
    completion_rate: float

# ============================================================================
# AUTOMATIC PLAN GENERATION
# ============================================================================

@router.post("/generate-plan")
async def generate_refactoring_plan(
    file_data: RefactoringPlanCreate,
    db: Session = Depends(get_db)
):
    """
    Automatically generate a refactoring plan based on complexity analysis
    """
    try:
        # Determine action type and priority based on complexity
        action_type, priority = _determine_action_type_and_priority(
            file_data.current_complexity,
            file_data.lines_of_code or 0
        )
        
        # Calculate target complexity
        target_complexity = _calculate_target_complexity(
            file_data.current_complexity,
            action_type
        )
        
        # Generate breakdown strategy
        breakdown = _generate_breakdown_strategy(
            file_data.current_complexity,
            target_complexity,
            file_data.lines_of_code or 0,
            file_data.functions_count or 0
        )
        
        # Estimate effort
        estimated_hours = _estimate_refactoring_effort(
            file_data.current_complexity,
            file_data.lines_of_code or 0,
            action_type
        )
        
        # Create the refactoring plan
        new_plan = RefactoringPlanDB(
            id=str(uuid.uuid4()),
            file_id=str(uuid.uuid4()),
            file_path=file_data.file_path,
            file_name=file_data.file_name,
            current_complexity=file_data.current_complexity,
            target_complexity=target_complexity,
            complexity_reduction=file_data.current_complexity - target_complexity,
            lines_of_code=file_data.lines_of_code,
            functions_count=file_data.functions_count,
            action_type=action_type,
            priority=priority,
            status="planned",
            estimated_hours=estimated_hours,
            description=file_data.description,
            breakdown=breakdown,
            assignee=file_data.assignee,
            team=file_data.team
        )
        
        db.add(new_plan)
        db.commit()
        db.refresh(new_plan)
        
        # Create initial tasks based on breakdown
        tasks = _create_initial_tasks(new_plan, breakdown, db)
        
        return {
            "plan": new_plan,
            "tasks_created": len(tasks),
            "recommendations": _generate_recommendations(new_plan)
        }
        
    except Exception as e:
        logger.error(f"Error generating refactoring plan: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate refactoring plan")

@router.post("/generate-plans-batch")
async def generate_refactoring_plans_batch(
    files_data: List[RefactoringPlanCreate],
    db: Session = Depends(get_db)
):
    """
    Generate refactoring plans for multiple files with coordination
    """
    try:
        plans = []
        
        # Sort by complexity (highest first)
        sorted_files = sorted(files_data, key=lambda x: x.current_complexity, reverse=True)
        
        for file_data in sorted_files:
            # Generate individual plan
            action_type, priority = _determine_action_type_and_priority(
                file_data.current_complexity,
                file_data.lines_of_code or 0
            )
            
            target_complexity = _calculate_target_complexity(
                file_data.current_complexity,
                action_type
            )
            
            breakdown = _generate_breakdown_strategy(
                file_data.current_complexity,
                target_complexity,
                file_data.lines_of_code or 0,
                file_data.functions_count or 0
            )
            
            estimated_hours = _estimate_refactoring_effort(
                file_data.current_complexity,
                file_data.lines_of_code or 0,
                action_type
            )
            
            new_plan = RefactoringPlanDB(
                id=str(uuid.uuid4()),
                file_id=str(uuid.uuid4()),
                file_path=file_data.file_path,
                file_name=file_data.file_name,
                current_complexity=file_data.current_complexity,
                target_complexity=target_complexity,
                complexity_reduction=file_data.current_complexity - target_complexity,
                lines_of_code=file_data.lines_of_code,
                functions_count=file_data.functions_count,
                action_type=action_type,
                priority=priority,
                status="planned",
                estimated_hours=estimated_hours,
                description=file_data.description,
                breakdown=breakdown,
                assignee=file_data.assignee,
                team=file_data.team
            )
            
            db.add(new_plan)
            db.commit()
            db.refresh(new_plan)
            
            # Create tasks
            tasks = _create_initial_tasks(new_plan, breakdown, db)
            
            plans.append({
                "plan": new_plan,
                "tasks_created": len(tasks)
            })
        
        # Analyze dependencies between files
        dependencies = _analyze_file_dependencies([p["plan"] for p in plans])
        
        # Update plans with dependency information
        for plan_data in plans:
            plan = plan_data["plan"]
            if plan.file_path in dependencies:
                plan.dependencies = dependencies[plan.file_path]
                plan.impact_analysis = _analyze_impact(plan, dependencies)
                db.commit()
        
        return {
            "total_plans": len(plans),
            "plans": plans,
            "dependencies": dependencies,
            "coordination_recommendations": _generate_coordination_recommendations(plans)
        }
        
    except Exception as e:
        logger.error(f"Error generating batch refactoring plans: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate batch refactoring plans")

# ============================================================================
# REFACTORING PLAN CRUD
# ============================================================================

@router.get("/plans", response_model=List[RefactoringPlanResponse])
async def get_refactoring_plans(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    action_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all refactoring plans with filtering
    """
    try:
        query = db.query(RefactoringPlanDB)
        
        if status:
            query = query.filter(RefactoringPlanDB.status == status)
        if priority:
            query = query.filter(RefactoringPlanDB.priority == priority)
        if action_type:
            query = query.filter(RefactoringPlanDB.action_type == action_type)
        
        plans = query.order_by(RefactoringPlanDB.current_complexity.desc()).offset(skip).limit(limit).all()
        return plans
    except Exception as e:
        logger.error(f"Error fetching refactoring plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch refactoring plans")

@router.get("/plans/{plan_id}", response_model=RefactoringPlanResponse)
async def get_refactoring_plan(plan_id: str, db: Session = Depends(get_db)):
    """
    Get specific refactoring plan by ID
    """
    try:
        plan = db.query(RefactoringPlanDB).filter(RefactoringPlanDB.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Refactoring plan not found")
        return plan
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching refactoring plan {plan_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch refactoring plan")

@router.put("/plans/{plan_id}", response_model=RefactoringPlanResponse)
async def update_refactoring_plan(
    plan_id: str,
    plan_update: RefactoringPlanUpdate,
    db: Session = Depends(get_db)
):
    """
    Update refactoring plan progress
    """
    try:
        plan = db.query(RefactoringPlanDB).filter(RefactoringPlanDB.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Refactoring plan not found")
        
        # Update fields
        update_data = plan_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        # Auto-calculate improvement if completed
        if plan_update.status == "completed" and plan_update.actual_complexity_after:
            plan.improvement_percentage = (
                (plan.current_complexity - plan_update.actual_complexity_after) / plan.current_complexity * 100
            )
            plan.completed_at = datetime.utcnow()
        
        plan.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(plan)
        
        return plan
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating refactoring plan {plan_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update refactoring plan")

@router.delete("/plans/{plan_id}")
async def delete_refactoring_plan(plan_id: str, db: Session = Depends(get_db)):
    """
    Delete a refactoring plan
    """
    try:
        plan = db.query(RefactoringPlanDB).filter(RefactoringPlanDB.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Refactoring plan not found")
        
        # Delete associated tasks
        db.query(RefactoringTaskDB).filter(RefactoringTaskDB.plan_id == plan_id).delete()
        db.query(RefactoringSprintIntegrationDB).filter(
            RefactoringSprintIntegrationDB.refactoring_plan_id == plan_id
        ).delete()
        
        db.delete(plan)
        db.commit()
        
        return {"message": "Refactoring plan deleted successfully", "id": plan_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting refactoring plan {plan_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete refactoring plan")

# ============================================================================
# TASK MANAGEMENT
# ============================================================================

@router.get("/plans/{plan_id}/tasks", response_model=List[RefactoringTaskResponse])
async def get_refactoring_tasks(
    plan_id: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all tasks for a refactoring plan
    """
    try:
        query = db.query(RefactoringTaskDB).filter(RefactoringTaskDB.plan_id == plan_id)
        
        if status:
            query = query.filter(RefactoringTaskDB.status == status)
        
        tasks = query.order_by(RefactoringTaskDB.created_at).offset(skip).limit(limit).all()
        return tasks
    except Exception as e:
        logger.error(f"Error fetching tasks for plan {plan_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch refactoring tasks")

@router.post("/tasks", response_model=RefactoringTaskResponse)
async def create_refactoring_task(task_data: RefactoringTaskCreate, db: Session = Depends(get_db)):
    """
    Create a new refactoring task
    """
    try:
        new_task = RefactoringTaskDB(**task_data.dict())
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        return new_task
    except Exception as e:
        logger.error(f"Error creating refactoring task: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create refactoring task")

@router.put("/tasks/{task_id}", response_model=RefactoringTaskResponse)
async def update_refactoring_task(
    task_id: str,
    status: str,
    progress_percentage: int,
    actual_hours: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Update refactoring task progress
    """
    try:
        task = db.query(RefactoringTaskDB).filter(RefactoringTaskDB.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Refactoring task not found")
        
        task.status = status
        task.progress_percentage = progress_percentage
        if actual_hours:
            task.actual_hours = actual_hours
        
        if status == "completed":
            task.completed_at = datetime.utcnow()
        
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        
        # Update parent plan progress
        _update_plan_progress(task.plan_id, db)
        
        return task
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating refactoring task {task_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update refactoring task")

# ============================================================================
# SPRINT INTEGRATION
# ============================================================================

@router.post("/plans/{plan_id}/integrate-sprint")
async def integrate_with_sprint(
    plan_id: str,
    sprint_id: str,
    db: Session = Depends(get_db)
):
    """
    Integrate refactoring plan with sprint system
    """
    try:
        plan = db.query(RefactoringPlanDB).filter(RefactoringPlanDB.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Refactoring plan not found")
        
        # Create sprint integration record
        integration = RefactoringSprintIntegrationDB(
            id=str(uuid.uuid4()),
            refactoring_plan_id=plan_id,
            sprint_id=sprint_id,
            task_id=str(uuid.uuid4()),  # Would be actual task ID from sprint system
            integration_type="automatic",
            integration_status="pending",
            task_title=f"Refactoring: {plan.file_name}",
            task_description=plan.description,
            estimated_hours=plan.estimated_hours,
            priority=plan.priority
        )
        
        db.add(integration)
        
        # Update plan with sprint reference
        plan.sprint_id = sprint_id
        plan.task_id = integration.task_id
        
        db.commit()
        
        return {
            "message": "Plan integrated with sprint successfully",
            "integration_id": integration.id,
            "task_id": integration.task_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error integrating plan {plan_id} with sprint: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to integrate with sprint")

# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics", response_model=RefactoringAnalyticsResponse)
async def get_refactoring_analytics(db: Session = Depends(get_db)):
    """
    Get comprehensive refactoring analytics
    """
    try:
        plans = db.query(RefactoringPlanDB).all()
        
        # Calculate analytics
        by_status = {}
        by_priority = {}
        by_action_type = {}
        
        total_estimated = 0
        total_actual = 0
        total_reduction = 0
        completed_count = 0
        
        for plan in plans:
            # Status breakdown
            if plan.status not in by_status:
                by_status[plan.status] = 0
            by_status[plan.status] += 1
            
            # Priority breakdown
            if plan.priority not in by_priority:
                by_priority[plan.priority] = 0
            by_priority[plan.priority] += 1
            
            # Action type breakdown
            if plan.action_type not in by_action_type:
                by_action_type[plan.action_type] = 0
            by_action_type[plan.action_type] += 1
            
            # Hours tracking
            if plan.estimated_hours:
                total_estimated += plan.estimated_hours
            if plan.actual_hours:
                total_actual += plan.actual_hours
            
            # Complexity reduction
            if plan.complexity_reduction:
                total_reduction += plan.complexity_reduction
            
            # Completion tracking
            if plan.status == "completed":
                completed_count += 1
        
        avg_reduction = total_reduction / len(plans) if plans else 0
        completion_rate = (completed_count / len(plans) * 100) if plans else 0
        
        return RefactoringAnalyticsResponse(
            total_plans=len(plans),
            by_status=by_status,
            by_priority=by_priority,
            by_action_type=by_action_type,
            average_complexity_reduction=avg_reduction,
            total_estimated_hours=total_estimated,
            total_actual_hours=total_actual,
            completion_rate=completion_rate
        )
    except Exception as e:
        logger.error(f"Error fetching refactoring analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch refactoring analytics")

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def _determine_action_type_and_priority(complexity: int, lines_of_code: int) -> tuple:
    """Determine action type and priority based on complexity"""
    if complexity >= 10:
        return "refactor", "critical"
    elif complexity >= 8:
        return "optimize", "high"
    elif complexity >= 5:
        return "review", "medium"
    else:
        return "review", "low"

def _calculate_target_complexity(current_complexity: int, action_type: str) -> int:
    """Calculate target complexity based on action type"""
    if action_type == "refactor":
        return max(3, current_complexity // 2)  # Reduce by at least 50%
    elif action_type == "optimize":
        return max(5, current_complexity - 3)  # Reduce by 3
    else:  # review
        return current_complexity  # No reduction target for review

def _generate_breakdown_strategy(complexity: int, target: int, lines_of_code: int, functions: int) -> dict:
    """Generate step-by-step breakdown strategy"""
    steps = []
    
    if complexity >= 10:  # Large refactoring
        steps.append({
            "phase": "analysis",
            "description": "Deep complexity analysis and dependency mapping",
            "estimated_hours": lines_of_code // 1000
        })
        steps.append({
            "phase": "extraction",
            "description": "Extract independent modules and functions",
            "estimated_hours": lines_of_code // 500
        })
        steps.append({
            "phase": "simplification",
            "description": "Simplify complex functions and reduce nesting",
            "estimated_hours": functions * 2
        })
        steps.append({
            "phase": "testing",
            "description": "Comprehensive testing and validation",
            "estimated_hours": lines_of_code // 200
        })
    elif complexity >= 8:  # Medium optimization
        steps.append({
            "phase": "analysis",
            "description": "Identify optimization opportunities",
            "estimated_hours": 4
        })
        steps.append({
            "phase": "optimization",
            "description": "Optimize identified bottlenecks",
            "estimated_hours": functions * 1.5
        })
        steps.append({
            "phase": "validation",
            "description": "Validate improvements and measure impact",
            "estimated_hours": 4
        })
    else:  # Simple review
        steps.append({
            "phase": "review",
            "description": "Code quality review and recommendations",
            "estimated_hours": 2
        })
        steps.append({
            "phase": "documentation",
            "description": "Document findings and improvement suggestions",
            "estimated_hours": 1
        })
    
    return {"steps": steps, "total_phases": len(steps)}

def _estimate_refactoring_effort(complexity: int, lines_of_code: int, action_type: str) -> int:
    """Estimate refactoring effort in hours"""
    base_hours = complexity * 2  # Base complexity multiplier
    
    # Lines of code factor
    if lines_of_code > 5000:
        base_hours += lines_of_code // 500
    elif lines_of_code > 1000:
        base_hours += lines_of_code // 1000
    
    # Action type multiplier
    multipliers = {
        "refactor": 1.5,
        "optimize": 1.2,
        "review": 0.5
    }
    
    return int(base_hours * multipliers.get(action_type, 1.0))

def _create_initial_tasks(plan: RefactoringPlanDB, breakdown: dict, db: Session) -> list:
    """Create initial tasks based on breakdown strategy"""
    tasks = []
    
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
        tasks.append(task)
    
    db.commit()
    return tasks

def _update_plan_progress(plan_id: str, db: Session):
    """Update plan progress based on tasks"""
    plan = db.query(RefactoringPlanDB).filter(RefactoringPlanDB.id == plan_id).first()
    if not plan:
        return
    
    tasks = db.query(RefactoringTaskDB).filter(RefactoringTaskDB.plan_id == plan_id).all()
    
    if tasks:
        completed = len([t for t in tasks if t.status == "completed"])
        plan.progress_percentage = int((completed / len(tasks)) * 100)
        
        # Check if all tasks completed
        if completed == len(tasks):
            plan.status = "completed"
            plan.completed_at = datetime.utcnow()
    
    plan.updated_at = datetime.utcnow()
    db.commit()

def _analyze_file_dependencies(plans: list) -> dict:
    """Analyze dependencies between files"""
    dependencies = {}
    
    # Simple dependency analysis based on file paths
    for plan in plans:
        file_deps = []
        
        # Check for common dependency patterns
        for other_plan in plans:
            if other_plan.id != plan.id:
                # Example: if this is a component file, it might depend on main files
                if "component" in plan.file_name.lower() and "main" in other_plan.file_name.lower():
                    file_deps.append(other_plan.file_path)
                elif "util" in plan.file_name.lower() and other_plan.file_name not in file_deps:
                    file_deps.append(other_plan.file_path)
        
        if file_deps:
            dependencies[plan.file_path] = file_deps
    
    return dependencies

def _analyze_impact(plan: RefactoringPlanDB, dependencies: dict) -> dict:
    """Analyze impact of refactoring on other files"""
    impact = {
        "affected_files": len(dependencies.get(plan.file_path, [])),
        "risk_level": "medium" if len(dependencies.get(plan.file_path, [])) > 2 else "low",
        "recommendation": "Coordinate with dependent file refactoring"
    }
    return impact

def _generate_coordination_recommendations(plans: list) -> list:
    """Generate recommendations for coordinating multiple refactoring efforts"""
    recommendations = []
    
    # Sort by complexity (highest first)
    sorted_plans = sorted(plans, key=lambda x: x[0].current_complexity, reverse=True)
    
    if len(sorted_plans) > 1:
        recommendations.append({
            "priority": "high",
            "message": f"Start with highest complexity file: {sorted_plans[0][0].file_name}",
            "reason": "Address most critical issues first"
        })
        
        recommendations.append({
            "priority": "medium",
            "message": f"Coordinate {sorted_plans[0][0].action_type} and {sorted_plans[1][0].action_type} efforts",
            "reason": "Optimize resource allocation across related work"
        })
    
    return recommendations

def _generate_recommendations(plan: RefactoringPlanDB) -> list:
    """Generate recommendations for a refactoring plan"""
    recommendations = []
    
    if plan.current_complexity >= 10:
        recommendations.append({
            "priority": "critical",
            "message": f"High complexity ({plan.current_complexity}) requires immediate attention",
            "action": "Consider breaking into multiple phases"
        })
    
    if plan.lines_of_code and plan.lines_of_code > 5000:
        recommendations.append({
            "priority": "high",
            "message": f"Large file ({plan.lines_of_code} lines) - consider modularization",
            "action": "Extract independent modules first"
        })
    
    if plan.estimated_hours and plan.estimated_hours > 40:
        recommendations.append({
            "priority": "medium",
            "message": f"Large effort estimate ({plan.estimated_hours} hours)",
            "action": "Consider sprint allocation across multiple iterations"
        })
    
    return recommendations