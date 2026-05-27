#!/usr/bin/env python3


"""


Projects Router for FastAPI


This module provides API endpoints for project management including CRUD operations.


It handles project creation, retrieval, updating, and deletion with support for


local folder analysis via the local_path field.


Endpoints:


    - GET /api/projects: List all projects for the authenticated user


    - GET /api/projects/{project_id}: Get project details by ID


    - POST /api/projects: Create a new project


    - PUT /api/projects/{project_id}: Update an existing project


    - DELETE /api/projects/{project_id}: Delete a project


    - GET /api/projects/{project_id}/analyses: Get analyses for a project


Dependencies:


    - database: SQLAlchemy session management


    - models: Project, User, AnalysisResult models


    - auth: JWT token extraction and validation


"""


from fastapi import APIRouter, Depends, HTTPException, status


from pydantic import BaseModel


from sqlalchemy.orm import Session


import sys


from pathlib import Path


from typing import Optional, List


from datetime import datetime


# Import dependencies


from database import get_db


from models import User, Project, AnalysisResult


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Router


router = APIRouter()


# Security


security = HTTPBearer()


# Pydantic models


class ProjectCreate(BaseModel):


    name: str


    description: Optional[str] = None


    repo_url: Optional[str] = None


    repo_provider: Optional[str] = None


    local_path: Optional[str] = None


    settings: Optional[dict] = {}


class ProjectUpdate(BaseModel):


    name: Optional[str] = None


    description: Optional[str] = None


    repo_url: Optional[str] = None


    repo_provider: Optional[str] = None


    local_path: Optional[str] = None


    settings: Optional[dict] = None


    is_active: Optional[boolean] = None


class ProjectResponse(BaseModel):


    id: int


    user_id: int


    name: str


    description: Optional[str]


    repo_url: Optional[str]


    repo_provider: Optional[str]


    local_path: Optional[str]


    settings: Optional[dict]


    is_active: boolean


    created_at: datetime


    updated_at: datetime


    last_analyzed: Optional[datetime]


    class Config:


        from_attributes = True


# Helper function to get current user


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


@router.post("", response_model = ProjectResponse, status_code = status.HTTP_201_CREATED)


async def create_project(


    project_data: ProjectCreate,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Create a new project"""


    new_project = Project(


        user_id = current_user.id,


        name = project_data.name,


        description = project_data.description,


        repo_url = project_data.repo_url,


        repo_provider = project_data.repo_provider,


        local_path = project_data.local_path,


        settings = project_data.settings,


        is_active = True


    )


    db.add(new_project)


    db.commit()


    db.refresh(new_project)


    return new_project


@router.get("", response_model = List[ProjectResponse])


async def list_projects(


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db),


    skip: int = 0,


    limit: int = 100


):


    """List all projects for current user"""


    projects = db.query(Project).filter(


        Project.user_id == current_user.id


    ).offset(skip).limit(limit).all()


    return projects


@router.get("/{project_id}", response_model = ProjectResponse)


async def get_project(


    project_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get a specific project by ID"""


    project = db.query(Project).filter(


        Project.id == project_id,


        Project.user_id == current_user.id


    ).first()


    if not project:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Project not found"


        )


    return project


@router.put("/{project_id}", response_model = ProjectResponse)


async def update_project(


    project_id: int,


    project_data: ProjectUpdate,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Update a project"""


    project = db.query(Project).filter(


        Project.id == project_id,


        Project.user_id == current_user.id


    ).first()


    if not project:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Project not found"


        )


    # Update fields if provided


    if project_data.name is not None:


        project.name = project_data.name


    if project_data.description is not None:


        project.description = project_data.description


    if project_data.repo_url is not None:


        project.repo_url = project_data.repo_url


    if project_data.repo_provider is not None:


        project.repo_provider = project_data.repo_provider


    if project_data.settings is not None:


        project.settings = project_data.settings


    if project_data.is_active is not None:


        project.is_active = project_data.is_active


    project.updated_at = datetime.utcnow()


    db.commit()


    db.refresh(project)


    return project


@router.delete("/{project_id}", status_code = status.HTTP_204_NO_CONTENT)


async def delete_project(


    project_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Delete a project"""


    project = db.query(Project).filter(


        Project.id == project_id,


        Project.user_id == current_user.id


    ).first()


    if not project:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Project not found"


        )


    db.delete(project)


    db.commit()


    return None


@router.get("/{project_id}/analysis-history")


async def get_project_analysis_history(


    project_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get analysis history for a project"""


    # Verify project belongs to user


    project = db.query(Project).filter(


        Project.id == project_id,


        Project.user_id == current_user.id


    ).first()


    if not project:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Project not found"


        )


    # Get analysis results


    analyses = db.query(AnalysisResult).filter(


        AnalysisResult.project_id == project_id


    ).order_by(AnalysisResult.created_at.desc()).all()


    return analyses


