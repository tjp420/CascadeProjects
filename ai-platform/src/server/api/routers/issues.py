# Constants


CONSTANT_5000 = 5000


#!/usr/bin/env python3


"""


Issues Router for FastAPI


This module provides API endpoints for managing code issues and vulnerabilities


identified during analysis. It handles issue creation, retrieval, status updates,


and assignment with support for filtering and sorting.


Endpoints:


    - GET /api/issues: List all issues with filtering and pagination


    - GET /api/issues/{issue_id}: Get issue details by ID


    - POST /api/issues: Create a new issue


    - PUT /api/issues/{issue_id}: Update an existing issue


    - DELETE /api/issues/{issue_id}: Delete an issue


    - GET /api/issues/project/{project_id}: Get issues for a specific project


    - PUT /api/issues/{issue_id}/assign: Assign issue to a user


Dependencies:


    - database: SQLAlchemy session management


    - models: User, Project, Issue, IssueStatus models


    - auth: JWT token extraction and validation


"""


from fastapi import APIRouter, Depends, HTTPException, status, Query


from sqlalchemy.orm import Session


from pydantic import BaseModel, Field, validator


from typing import Optional, List, Dict, Any


from datetime import datetime


from enum import Enum


# Import dependencies


from database import get_db


from models import User, Project, Issue, IssueStatus


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Router


router = APIRouter()


# Security


security = HTTPBearer()


# Enums for validation


class IssueTypeEnum(str, Enum):


    FEATURE="feature",


    IMPROVEMENT= "improvement"


    DOCUMENTATION = "documentation"


class SeverityEnum(str, Enum):


    LOW="low",


    MEDIUM= "medium"


    HIGH="high",


    CRITICAL= "critical"


class StatusEnum(str, Enum):


    OPEN="open",


    IN_PROGRESS= "in-progress"


    RESOLVED="resolved",


    CLOSED= "closed"


# Pydantic models


class IssueCreate(BaseModel):


    project_id: int = Field(..., gt = 0, description="Project ID")


    title: str = Field(..., min_length = 3, max_length = 200, description="Issue title")


    description: Optional[str] = Field(None, max_length = CONSTANT_5000, description="Issue description")


    severity: SeverityEnum = Field(SeverityEnum.MEDIUM, description="Issue severity")


    file_path: Optional[str] = Field(None, max_length = 500, description="File path where issue was found")


    line_number: Optional[int] = Field(None, ge = 1, description="Line number where issue was found")


    labels: List[str] = Field(default_factory = list, description="Issue labels")


    @validator('labels')


    def validate_labels(cls, v):


        """


        """


        if len(v) > 10:


            raise ValueError('Maximum 10 labels allowed')


        return [label.lower().strip() for label in v if label.strip()]


    class Config:


        json_schema_extra = {


            "example": {


                "project_id": 1,


                "description": "Users cannot login with valid credentials",


                "severity": "high",


                "file_path": "src/auth.py",


                "line_number": 45,


                "labels": ["auth", "urgent"]


            }


        }


class IssueUpdate(BaseModel):


    title: Optional[str] = Field(None, min_length = 3, max_length = 200)


    description: Optional[str] = Field(None, max_length = 5000)


    issue_type: Optional[IssueTypeEnum] = None


    severity: Optional[SeverityEnum] = None


    status: Optional[StatusEnum] = None


    assignee_id: Optional[int] = Field(None, gt = 0)


    file_path: Optional[str] = Field(None, max_length = 500)


    line_number: Optional[int] = Field(None, ge = 1)


    labels: Optional[List[str]] = None


    @validator('labels')


    def validate_labels(cls, v):


        """


        """


        if v is not None and len(v) > 10:


            raise ValueError('Maximum 10 labels allowed')


        if v:


            return [label.lower().strip() for label in v if label.strip()]


        return v


    class Config:


        json_schema_extra = {


            "example": {


                "title": "Updated title",


                "severity": "critical",


                "status": "in-progress"


            }


        }


class IssueResponse(BaseModel):


    id: int


    project_id: int


    assignee_id: Optional[int]


    title: str


    description: Optional[str]


    issue_type: str


    severity: str


    status: str


    file_path: Optional[str]


    line_number: Optional[int]


    labels: Optional[List[str]]


    created_at: datetime


    updated_at: datetime


    resolved_at: Optional[datetime]


    class Config:


        from_attributes = True


        json_schema_extra = {


            "example": {


                "id": 1,


                "project_id": 1,


                "assignee_id": 2,


                "description": "Users cannot login",


                "severity": "high",


                "status": "open",


                "file_path": "src/auth.py",


                "line_number": 45,


                "labels": ["auth", "urgent"],


                "created_at": "2024-01-01T00:00:00Z",


                "updated_at": "2024-01-01T00:00:00Z",


                "resolved_at": None


            }


        }


# Helper functions


def _map_status_to_enum(status_str: str) -> IssueStatus:


    """Map status string to IssueStatus enum"""


    status_map = {


        'open': IssueStatus.OPEN,


        'in-progress': IssueStatus.IN_PROGRESS,


        'resolved': IssueStatus.RESOLVED,


        'closed': IssueStatus.CLOSED


    }


    return status_map.get(status_str.lower(), IssueStatus.OPEN)


def _get_user_project_issue(db: Session, issue_id: int, user_id: int) -> Optional[Issue]:


    """Get issue by ID ensuring it belongs to user's project"""


    return db.query(Issue).join(Project).filter(


        Issue.id == issue_id,


        Project.user_id == user_id


    ).first()


def _verify_project_ownership(db: Session, project_id: int, user_id: int) -> Optional[Project]:


    """Verify project exists and belongs to user"""


    return db.query(Project).filter(


        Project.id == project_id,


        Project.user_id == user_id


    ).first()


async def get_current_user(


    credentials: HTTPAuthorizationCredentials = Depends(security),


    db: Session = Depends(get_db)


) -> User:


    """Get current authenticated user"""


    token = credentials.credentials


    token_info = extract_token_data(token)


    if not token_info or token_info.email is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid authentication credentials"


        )


    user = db.query(User).filter(User.email == token_info.email).first()


    if not user:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="User not found"


        )


    return user


# Endpoints


@router.post("", response_model = IssueResponse, status_code = status.HTTP_201_CREATED)


async def create_issue(


    issue_data: IssueCreate,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Create a new issue"""


    project = _verify_project_ownership(db, issue_data.project_id, current_user.id)


    if not project:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Project not found or access denied"


        )


    new_issue = Issue(


        project_id = issue_data.project_id,


        title = issue_data.title,


        description = issue_data.description,


        issue_type = issue_data.issue_type.value,


        severity = issue_data.severity.value,


        status = IssueStatus.OPEN,


        file_path = issue_data.file_path,


        line_number = issue_data.line_number,


        labels = issue_data.labels


    )


    db.add(new_issue)


    db.commit()


    db.refresh(new_issue)


    return new_issue


@router.get("", response_model = List[IssueResponse])


async def list_issues(


    project_id: Optional[int] = Query(None, description="Filter by project ID"),


    status: Optional[StatusEnum] = Query(None, description="Filter by status"),


    severity: Optional[SeverityEnum] = Query(None, description="Filter by severity"),


    issue_type: Optional[IssueTypeEnum] = Query(None, description="Filter by issue type"),


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db),


    skip: int = Query(0, ge = 0, description="Skip results"),


    limit: int = Query(100, ge = 1, le = 1000, description="Limit results")


):


    """List all issues for current user with filtering and pagination"""


    query = db.query(Issue).join(Project).filter(Project.user_id == current_user.id)


    if project_id:


        query = query.filter(Issue.project_id == project_id)


    if status:


        query = query.filter(Issue.status == _map_status_to_enum(status.value))


    if severity:


        query = query.filter(Issue.severity == severity.value)


    if issue_type:


        query = query.filter(Issue.issue_type == issue_type.value)


    issues = query.order_by(Issue.created_at.desc()).offset(skip).limit(limit).all()


    return issues


@router.get("/{issue_id}", response_model = IssueResponse)


async def get_issue(


    issue_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get a specific issue by ID"""


    issue = _get_user_project_issue(db, issue_id, current_user.id)


    if not issue:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Issue not found or access denied"


        )


    return issue


@router.put("/{issue_id}", response_model = IssueResponse)


async def update_issue(


    issue_id: int,


    issue_data: IssueUpdate,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Update an issue"""


    issue = _get_user_project_issue(db, issue_id, current_user.id)


    if not issue:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Issue not found or access denied"


        )


    # Update fields if provided


    if issue_data.title is not None:


        issue.title = issue_data.title


    if issue_data.description is not None:


        issue.description = issue_data.description


    if issue_data.issue_type is not None:


        issue.issue_type = issue_data.issue_type.value


    if issue_data.severity is not None:


        issue.severity = issue_data.severity.value


    if issue_data.status is not None:


        issue.status = _map_status_to_enum(issue_data.status.value)


        if issue.status == IssueStatus.RESOLVED:


            issue.resolved_at = datetime.utcnow()


    if issue_data.assignee_id is not None:


        issue.assignee_id = issue_data.assignee_id


    if issue_data.file_path is not None:


        issue.file_path = issue_data.file_path


    if issue_data.line_number is not None:


        issue.line_number = issue_data.line_number


    if issue_data.labels is not None:


        issue.labels = issue_data.labels


    issue.updated_at = datetime.utcnow()


    db.commit()


    db.refresh(issue)


    return issue


@router.delete("/{issue_id}", status_code = status.HTTP_204_NO_CONTENT)


async def delete_issue(


    issue_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Delete an issue"""


    issue = _get_user_project_issue(db, issue_id, current_user.id)


    if not issue:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Issue not found or access denied"


        )


    db.delete(issue)


    db.commit()


    return None


@router.post("/{issue_id}/resolve")


async def resolve_issue(


    issue_id: int,


    resolution_type: str = Query("fixed", description="Type of resolution"),


    resolution_notes: Optional[str] = Query(None, description="Resolution notes"),


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Mark an issue as resolved"""


    issue = _get_user_project_issue(db, issue_id, current_user.id)


    if not issue:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Issue not found or access denied"


        )


    if issue.status == IssueStatus.RESOLVED or issue.status == IssueStatus.CLOSED:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Issue is already resolved or closed"


        )


    issue.status = IssueStatus.RESOLVED


    issue.resolved_at = datetime.utcnow()


    issue.updated_at = datetime.utcnow()


    db.commit()


    db.refresh(issue)


    return {


        "message": "Issue marked as resolved",


        "issue_id": issue.id,


        "resolution_type": resolution_type,


        "resolved_at": issue.resolved_at


    }


@router.post("/{issue_id}/close")


async def close_issue(


    issue_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Close a resolved issue"""


    issue = _get_user_project_issue(db, issue_id, current_user.id)


    if not issue:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Issue not found or access denied"


        )


    if issue.status == IssueStatus.CLOSED:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Issue is already closed"


        )


    if issue.status != IssueStatus.RESOLVED:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Only resolved issues can be closed"


        )


    issue.status = IssueStatus.CLOSED


    issue.updated_at = datetime.utcnow()


    db.commit()


    db.refresh(issue)


    return {


        "message": "Issue closed",


        "issue_id": issue.id,


        "closed_at": issue.updated_at


    }


@router.post("/{issue_id}/reopen")


async def reopen_issue(


    issue_id: int,


    reason: Optional[str] = Query(None, description="Reason for reopening"),


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Reopen a closed issue"""


    issue = _get_user_project_issue(db, issue_id, current_user.id)


    if not issue:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Issue not found or access denied"


        )


    if issue.status == IssueStatus.OPEN or issue.status == IssueStatus.IN_PROGRESS:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Issue is already open or in progress"


        )


    issue.status = IssueStatus.OPEN


    issue.resolved_at = None


    issue.updated_at = datetime.utcnow()


    db.commit()


    db.refresh(issue)


    return {


        "message": "Issue reopened",


        "issue_id": issue.id,


        "reason": reason,


        "reopened_at": issue.updated_at


    }


@router.get("/stats", response_model = Dict[str, Any])


async def get_issue_stats(


    project_id: Optional[int] = Query(None, description="Filter by project ID"),


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get issue statistics"""


    query = db.query(Issue).join(Project).filter(Project.user_id == current_user.id)


    if project_id:


        query = query.filter(Issue.project_id == project_id)


    total = query.count()


    open_count = query.filter(Issue.status == IssueStatus.OPEN).count()


    in_progress_count = query.filter(Issue.status == IssueStatus.IN_PROGRESS).count()


    resolved_count = query.filter(Issue.status == IssueStatus.RESOLVED).count()


    closed_count = query.filter(Issue.status == IssueStatus.CLOSED).count()


    critical_count = query.filter(Issue.severity == 'critical').count()


    high_count = query.filter(Issue.severity == 'high').count()


    return {


        "total": total,


        "by_status": {


            "open": open_count,


            "in_progress": in_progress_count,


            "resolved": resolved_count,


            "closed": closed_count


        },


        "by_severity": {


            "critical": critical_count,


            "high": high_count


        }


    }


