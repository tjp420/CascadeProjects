#!/usr/bin/env python3
"""
Roadmap Tracking API for AI Coding Intelligence Dashboard

RESTful API endpoints for roadmap management, milestone tracking,
risk assessment, and progress monitoring.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db as get_db
from enhanced_models import (
    RoadmapDB, MilestoneDB, RoadmapRiskDB, RoadmapDependencyDB, RoadmapProgressDB
)
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class RoadmapResponse(BaseModel):
    id: str
    quarter: str
    year: int
    start_date: datetime
    end_date: datetime
    status: str
    progress_percentage: int
    total_milestones: int
    completed_milestones: int
    total_risks: int
    high_priority_risks: int
    medium_priority_risks: int
    low_priority_risks: int
    remaining_days: Optional[int]
    on_track: bool
    metadata: Optional[Dict[str, Any]]
    summary: Optional[str]
    created_at: datetime
    updated_at: datetime

class RoadmapCreate(BaseModel):
    quarter: str = Field(..., description="Quarter: Q1, Q2, Q3, Q4")
    year: int = Field(..., description="Year")
    start_date: datetime = Field(..., description="Quarter start date")
    end_date: datetime = Field(..., description="Quarter end date")
    status: str = "planned"
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class RoadmapUpdate(BaseModel):
    status: Optional[str] = None
    progress_percentage: Optional[int] = None
    on_track: Optional[bool] = None
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class MilestoneResponse(BaseModel):
    id: str
    roadmap_id: str
    name: str
    description: Optional[str]
    priority: str
    status: str
    target_date: datetime
    completed_date: Optional[datetime]
    estimated_hours: Optional[int]
    actual_hours: Optional[int]
    progress_percentage: int
    assignee: Optional[str]
    team: Optional[str]
    dependencies: Optional[List[str]]
    blocked_by: Optional[List[str]]
    risk_level: Optional[str]
    risk_factors: Optional[List[str]]
    metadata: Optional[Dict[str, Any]]
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

class MilestoneCreate(BaseModel):
    roadmap_id: str = Field(..., description="Roadmap ID")
    name: str = Field(..., description="Milestone name")
    description: Optional[str] = None
    priority: str = Field(..., description="Priority: high, medium, low")
    target_date: datetime = Field(..., description="Target completion date")
    estimated_hours: Optional[int] = None
    assignee: Optional[str] = None
    team: Optional[str] = None
    dependencies: Optional[List[str]] = None
    risk_level: Optional[str] = None
    risk_factors: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class MilestoneUpdate(BaseModel):
    status: Optional[str] = None
    progress_percentage: Optional[int] = None
    completed_date: Optional[datetime] = None
    actual_hours: Optional[int] = None
    assignee: Optional[str] = None
    risk_level: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class RiskResponse(BaseModel):
    id: str
    roadmap_id: str
    milestone_id: Optional[str]
    title: str
    description: Optional[str]
    category: Optional[str]
    priority: str
    probability: Optional[str]
    impact: Optional[str]
    risk_score: Optional[int]
    status: str
    mitigation_strategy: Optional[str]
    mitigation_progress: int
    owner: Optional[str]
    identified_date: datetime
    target_resolution_date: Optional[datetime]
    actual_resolution_date: Optional[datetime]
    milestones_affected: Optional[List[str]]
    estimated_delay_days: Optional[int]
    actual_delay_days: Optional[int]
    created_at: datetime
    updated_at: datetime

class RiskCreate(BaseModel):
    roadmap_id: str = Field(..., description="Roadmap ID")
    milestone_id: Optional[str] = None
    title: str = Field(..., description="Risk title")
    description: Optional[str] = None
    category: Optional[str] = None
    priority: str = Field(..., description="Priority: high, medium, low")
    probability: str = Field(..., description="Probability: high, medium, low")
    impact: str = Field(..., description="Impact: high, medium, low")
    mitigation_strategy: Optional[str] = None
    owner: Optional[str] = None
    target_resolution_date: Optional[datetime] = None
    milestones_affected: Optional[List[str]] = None
    estimated_delay_days: Optional[int] = None

class RiskUpdate(BaseModel):
    status: Optional[str] = None
    mitigation_progress: Optional[int] = None
    mitigation_strategy: Optional[str] = None
    actual_resolution_date: Optional[datetime] = None
    actual_delay_days: Optional[int] = None

class RoadmapAnalyticsResponse(BaseModel):
    roadmap_id: str
    quarter: str
    year: int
    overall_progress: float
    on_track_status: str
    milestone_completion_rate: float
    risk_summary: Dict[str, int]
    timeline_variance: Dict[str, Any]
    resource_utilization: Dict[str, Any]
    recommendations: List[str]

# ============================================================================
# ROADMAP ENDPOINTS
# ============================================================================

@router.get("/", response_model=List[RoadmapResponse])
async def get_all_roadmaps(
    year: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all roadmaps, optionally filtered by year and status
    """
    try:
        query = db.query(RoadmapDB)
        
        if year:
            query = query.filter(RoadmapDB.year == year)
        if status:
            query = query.filter(RoadmapDB.status == status)
        
        roadmaps = query.order_by(RoadmapDB.year.desc(), RoadmapDB.start_date).offset(skip).limit(limit).all()
        return roadmaps
    except Exception as e:
        logger.error(f"Error fetching roadmaps: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roadmaps")

@router.get("/{roadmap_id}", response_model=RoadmapResponse)
async def get_roadmap(roadmap_id: str, db: Session = Depends(get_db)):
    """
    Get specific roadmap by ID
    """
    try:
        roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Update remaining days dynamically
        if roadmap.status == "active":
            roadmap.remaining_days = (roadmap.end_date - datetime.utcnow()).days
        
        return roadmap
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching roadmap {roadmap_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roadmap")

@router.post("/", response_model=RoadmapResponse)
async def create_roadmap(roadmap_data: RoadmapCreate, db: Session = Depends(get_db)):
    """
    Create a new roadmap
    """
    try:
        new_roadmap = RoadmapDB(**roadmap_data.dict())
        db.add(new_roadmap)
        db.commit()
        db.refresh(new_roadmap)
        
        # Create initial progress entry
        progress_entry = RoadmapProgressDB(
            roadmap_id=new_roadmap.id,
            progress_percentage=0,
            completed_milestones=0,
            total_milestones=0
        )
        db.add(progress_entry)
        db.commit()
        
        return new_roadmap
    except Exception as e:
        logger.error(f"Error creating roadmap: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create roadmap")

@router.put("/{roadmap_id}", response_model=RoadmapResponse)
async def update_roadmap(
    roadmap_id: str,
    roadmap_update: RoadmapUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing roadmap
    """
    try:
        roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Update fields
        update_data = roadmap_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(roadmap, key, value)
        
        # Recalculate progress if milestones changed
        if roadmap_update.progress_percentage is not None:
            roadmap.on_track = roadmap_update.progress_percentage >= _get_expected_progress(roadmap)
        
        roadmap.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(roadmap)
        
        # Create progress history entry
        _create_progress_entry(roadmap_id, db)
        
        return roadmap
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating roadmap {roadmap_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update roadmap")

@router.delete("/{roadmap_id}")
async def delete_roadmap(roadmap_id: str, db: Session = Depends(get_db)):
    """
    Delete a roadmap
    """
    try:
        roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Delete associated milestones, risks, dependencies
        db.query(MilestoneDB).filter(MilestoneDB.roadmap_id == roadmap_id).delete()
        db.query(RoadmapRiskDB).filter(RoadmapRiskDB.roadmap_id == roadmap_id).delete()
        db.query(RoadmapDependencyDB).filter(RoadmapDependencyDB.roadmap_id == roadmap_id).delete()
        db.query(RoadmapProgressDB).filter(RoadmapProgressDB.roadmap_id == roadmap_id).delete()
        
        db.delete(roadmap)
        db.commit()
        
        return {"message": "Roadmap deleted successfully", "id": roadmap_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting roadmap {roadmap_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete roadmap")

# ============================================================================
# MILESTONE ENDPOINTS
# ============================================================================

@router.get("/{roadmap_id}/milestones", response_model=List[MilestoneResponse])
async def get_milestones(
    roadmap_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all milestones for a roadmap
    """
    try:
        query = db.query(MilestoneDB).filter(MilestoneDB.roadmap_id == roadmap_id)
        
        if status:
            query = query.filter(MilestoneDB.status == status)
        if priority:
            query = query.filter(MilestoneDB.priority == priority)
        
        milestones = query.order_by(MilestoneDB.target_date).offset(skip).limit(limit).all()
        return milestones
    except Exception as e:
        logger.error(f"Error fetching milestones for roadmap {roadmap_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch milestones")

@router.post("/milestones", response_model=MilestoneResponse)
async def create_milestone(milestone_data: MilestoneCreate, db: Session = Depends(get_db)):
    """
    Create a new milestone
    """
    try:
        # Verify roadmap exists
        roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == milestone_data.roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        new_milestone = MilestoneDB(**milestone_data.dict())
        db.add(new_milestone)
        db.commit()
        db.refresh(new_milestone)
        
        # Update roadmap milestone count
        roadmap.total_milestones = db.query(MilestoneDB).filter(
            MilestoneDB.roadmap_id == milestone_data.roadmap_id
        ).count()
        db.commit()
        
        return new_milestone
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating milestone: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create milestone")

@router.put("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: str,
    milestone_update: MilestoneUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing milestone
    """
    try:
        milestone = db.query(MilestoneDB).filter(MilestoneDB.id == milestone_id).first()
        if not milestone:
            raise HTTPException(status_code=404, detail="Milestone not found")
        
        # Store previous status for progress calculation
        previous_status = milestone.status
        
        # Update fields
        update_data = milestone_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(milestone, key, value)
        
        # Auto-set completed date if status changed to completed
        if milestone_update.status == "completed" and previous_status != "completed":
            milestone.completed_date = datetime.utcnow()
            milestone.progress_percentage = 100
        
        milestone.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(milestone)
        
        # Update roadmap progress
        _update_roadmap_progress(milestone.roadmap_id, db)
        
        return milestone
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating milestone {milestone_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update milestone")

@router.delete("/milestones/{milestone_id}")
async def delete_milestone(milestone_id: str, db: Session = Depends(get_db)):
    """
    Delete a milestone
    """
    try:
        milestone = db.query(MilestoneDB).filter(MilestoneDB.id == milestone_id).first()
        if not milestone:
            raise HTTPException(status_code=404, detail="Milestone not found")
        
        roadmap_id = milestone.roadmap_id
        
        # Delete associated dependencies
        db.query(RoadmapDependencyDB).filter(
            (RoadmapDependencyDB.predecessor_id == milestone_id) |
            (RoadmapDependencyDB.successor_id == milestone_id)
        ).delete()
        
        db.delete(milestone)
        db.commit()
        
        # Update roadmap milestone count
        roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
        if roadmap:
            roadmap.total_milestones = db.query(MilestoneDB).filter(
                MilestoneDB.roadmap_id == roadmap_id
            ).count()
            db.commit()
        
        return {"message": "Milestone deleted successfully", "id": milestone_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting milestone {milestone_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete milestone")

# ============================================================================
# RISK ENDPOINTS
# ============================================================================

@router.get("/{roadmap_id}/risks", response_model=List[RiskResponse])
async def get_risks(
    roadmap_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all risks for a roadmap
    """
    try:
        query = db.query(RoadmapRiskDB).filter(RoadmapRiskDB.roadmap_id == roadmap_id)
        
        if status:
            query = query.filter(RoadmapRiskDB.status == status)
        if priority:
            query = query.filter(RoadmapRiskDB.priority == priority)
        
        risks = query.order_by(RoadmapRiskDB.priority.desc(), RoadmapRiskDB.identified_date.desc()).offset(skip).limit(limit).all()
        return risks
    except Exception as e:
        logger.error(f"Error fetching risks for roadmap {roadmap_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch risks")

@router.post("/risks", response_model=RiskResponse)
async def create_risk(risk_data: RiskCreate, db: Session = Depends(get_db)):
    """
    Create a new risk
    """
    try:
        # Calculate risk score
        risk_score = _calculate_risk_score(risk_data.probability, risk_data.impact)
        
        new_risk = RoadmapRiskDB(
            **risk_data.dict(),
            risk_score=risk_score
        )
        db.add(new_risk)
        db.commit()
        db.refresh(new_risk)
        
        # Update roadmap risk counts
        _update_roadmap_risks(risk_data.roadmap_id, db)
        
        return new_risk
    except Exception as e:
        logger.error(f"Error creating risk: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create risk")

@router.put("/risks/{risk_id}", response_model=RiskResponse)
async def update_risk(
    risk_id: str,
    risk_update: RiskUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing risk
    """
    try:
        risk = db.query(RoadmapRiskDB).filter(RoadmapRiskDB.id == risk_id).first()
        if not risk:
            raise HTTPException(status_code=404, detail="Risk not found")
        
        # Update fields
        update_data = risk_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(risk, key, value)
        
        risk.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(risk)
        
        # Update roadmap risk counts if status changed
        if risk_update.status:
            _update_roadmap_risks(risk.roadmap_id, db)
        
        return risk
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating risk {risk_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update risk")

@router.delete("/risks/{risk_id}")
async def delete_risk(risk_id: str, db: Session = Depends(get_db)):
    """
    Delete a risk
    """
    try:
        risk = db.query(RoadmapRiskDB).filter(RoadmapRiskDB.id == risk_id).first()
        if not risk:
            raise HTTPException(status_code=404, detail="Risk not found")
        
        roadmap_id = risk.roadmap_id
        db.delete(risk)
        db.commit()
        
        # Update roadmap risk counts
        _update_roadmap_risks(roadmap_id, db)
        
        return {"message": "Risk deleted successfully", "id": risk_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting risk {risk_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete risk")

# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/{roadmap_id}/analytics", response_model=RoadmapAnalyticsResponse)
async def get_roadmap_analytics(roadmap_id: str, db: Session = Depends(get_db)):
    """
    Get comprehensive analytics for a roadmap
    """
    try:
        roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Get milestones
        milestones = db.query(MilestoneDB).filter(MilestoneDB.roadmap_id == roadmap_id).all()
        
        # Get risks
        risks = db.query(RoadmapRiskDB).filter(RoadmapRiskDB.roadmap_id == roadmap_id).all()
        
        # Calculate analytics
        milestone_completion_rate = (
            len([m for m in milestones if m.status == "completed"]) / len(milestones) * 100
        ) if milestones else 0
        
        risk_summary = {
            "total": len(risks),
            "high": len([r for r in risks if r.priority == "high"]),
            "medium": len([r for r in risks if r.priority == "medium"]),
            "low": len([r for r in risks if r.priority == "low"]),
            "open": len([r for r in risks if r.status == "open"]),
            "mitigating": len([r for r in risks if r.status == "mitigating"]),
            "resolved": len([r for r in risks if r.status == "resolved"])
        }
        
        timeline_variance = _calculate_timeline_variance(milestones)
        
        # Generate recommendations
        recommendations = _generate_recommendations(roadmap, milestones, risks)
        
        return RoadmapAnalyticsResponse(
            roadmap_id=roadmap_id,
            quarter=roadmap.quarter,
            year=roadmap.year,
            overall_progress=roadmap.progress_percentage,
            on_track_status="on_track" if roadmap.on_track else "behind",
            milestone_completion_rate=milestone_completion_rate,
            risk_summary=risk_summary,
            timeline_variance=timeline_variance,
            resource_utilization={"estimated": sum(m.estimated_hours or 0 for m in milestones)},
            recommendations=recommendations
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analytics for roadmap {roadmap_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roadmap analytics")

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def _get_expected_progress(roadmap: RoadmapDB) -> float:
    """Calculate expected progress based on timeline"""
    if roadmap.status != "active":
        return 0
    
    total_days = (roadmap.end_date - roadmap.start_date).days
    elapsed_days = (datetime.utcnow() - roadmap.start_date).days
    
    if total_days <= 0:
        return 0
    
    return min(100, (elapsed_days / total_days) * 100)

def _create_progress_entry(roadmap_id: str, db: Session):
    """Create a progress history entry"""
    roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
    if not roadmap:
        return
    
    # Get previous progress
    previous_progress = db.query(RoadmapProgressDB).filter(
        RoadmapProgressDB.roadmap_id == roadmap_id
    ).order_by(RoadmapProgressDB.recorded_at.desc()).first()
    
    previous_value = previous_progress.progress_percentage if previous_progress else 0
    
    progress_entry = RoadmapProgressDB(
        roadmap_id=roadmap_id,
        progress_percentage=roadmap.progress_percentage,
        completed_milestones=roadmap.completed_milestones,
        total_milestones=roadmap.total_milestones,
        previous_progress=previous_value,
        progress_change=roadmap.progress_percentage - previous_value
    )
    db.add(progress_entry)
    db.commit()

def _update_roadmap_progress(roadmap_id: str, db: Session):
    """Update roadmap progress based on milestones"""
    roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
    if not roadmap:
        return
    
    milestones = db.query(MilestoneDB).filter(MilestoneDB.roadmap_id == roadmap_id).all()
    
    roadmap.total_milestones = len(milestones)
    roadmap.completed_milestones = len([m for m in milestones if m.status == "completed"])
    
    if roadmap.total_milestones > 0:
        roadmap.progress_percentage = int((roadmap.completed_milestones / roadmap.total_milestones) * 100)
    
    roadmap.on_track = roadmap.progress_percentage >= _get_expected_progress(roadmap)
    roadmap.updated_at = datetime.utcnow()
    db.commit()

def _update_roadmap_risks(roadmap_id: str, db: Session):
    """Update roadmap risk counts"""
    roadmap = db.query(RoadmapDB).filter(RoadmapDB.id == roadmap_id).first()
    if not roadmap:
        return
    
    risks = db.query(RoadmapRiskDB).filter(RoadmapRiskDB.roadmap_id == roadmap_id).all()
    
    roadmap.total_risks = len(risks)
    roadmap.high_priority_risks = len([r for r in risks if r.priority == "high"])
    roadmap.medium_priority_risks = len([r for r in risks if r.priority == "medium"])
    roadmap.low_priority_risks = len([r for r in risks if r.priority == "low"])
    
    roadmap.updated_at = datetime.utcnow()
    db.commit()

def _calculate_risk_score(probability: str, impact: str) -> int:
    """Calculate risk score from probability and impact"""
    probability_map = {"high": 3, "medium": 2, "low": 1}
    impact_map = {"high": 3, "medium": 2, "low": 1}
    
    prob_score = probability_map.get(probability.lower(), 2)
    impact_score = impact_map.get(impact.lower(), 2)
    
    return prob_score * impact_score  # Score 1-9

def _calculate_timeline_variance(milestones: list) -> dict:
    """Calculate timeline variance for milestones"""
    if not milestones:
        return {"variance_days": 0, "on_time_count": 0, "delayed_count": 0}
    
    on_time = []
    delayed = []
    
    for milestone in milestones:
        if milestone.status == "completed" and milestone.completed_date:
            variance = (milestone.completed_date - milestone.target_date).days
            if variance <= 0:
                on_time.append(variance)
            else:
                delayed.append(variance)
    
    avg_delay = sum(delayed) / len(delayed) if delayed else 0
    
    return {
        "variance_days": avg_delay,
        "on_time_count": len(on_time),
        "delayed_count": len(delayed),
        "total_completed": len(on_time) + len(delayed)
    }

def _generate_recommendations(roadmap: RoadmapDB, milestones: list, risks: list) -> list:
    """Generate actionable recommendations based on roadmap status"""
    recommendations = []
    
    # Progress recommendations
    if not roadmap.on_track:
        recommendations.append({
            "priority": "high",
            "category": "schedule",
            "message": "Roadmap is behind schedule. Consider reallocating resources or adjusting timelines."
        })
    
    # Risk recommendations
    high_risks = [r for r in risks if r.priority == "high" and r.status == "open"]
    if high_risks:
        recommendations.append({
            "priority": "critical",
            "category": "risk",
            "message": f"{len(high_risks)} high-priority risks require immediate attention."
        })
    
    # Milestone recommendations
    blocked_milestones = [m for m in milestones if m.status == "blocked"]
    if blocked_milestones:
        recommendations.append({
            "priority": "high",
            "category": "milestone",
            "message": f"{len(blocked_milestones)} milestones are currently blocked. Review dependencies."
        })
    
    # Timeline recommendations
    upcoming_deadlines = [m for m in milestones if m.target_date <= datetime.utcnow() + timedelta(days=7) and m.status != "completed"]
    if upcoming_deadlines:
        recommendations.append({
            "priority": "medium",
            "category": "timeline",
            "message": f"{len(upcoming_deadlines)} milestones have deadlines within 7 days."
        })
    
    return recommendations