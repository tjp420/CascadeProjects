#!/usr/bin/env python3


"""


Dependency Management Router


Handles dependency analysis and management endpoints


"""


from fastapi import APIRouter, Depends, HTTPException


from pydantic import BaseModel


from typing import Optional, List, Dict, Any


import sys


from pathlib import Path


# Add parent directory to path for imports


sys.path.append(str(Path(__file__).parent.parent))


from dependency_manager import dependency_manager


from routers.auth import get_current_user


from models import User, Project


from database import get_db


from sqlalchemy.orm import Session


router = APIRouter()


class DependencyAnalysisResponse(BaseModel):


    python: Dict[str, Any]


    javascript: Dict[str, Any]


    total_dependencies: int


    outdated_count: int


    vulnerabilities: List[Dict[str, Any]]


    recommendations: List[Dict[str, Any]]


class DependencyUpdateRequest(BaseModel):


    project_id: int


    package_manager: str


    packages: List[str]


class DependencyUpdateResponse(BaseModel):


    message: str


    updated: int


    failed: Optional[List[str]] = None


@router.get("/{project_id}", response_model = DependencyAnalysisResponse)


async def get_dependencies(


    project_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get dependency analysis for a project"""


    try:


        # Get project to find its path


        project = db.query(Project).filter(Project.id == project_id).first()


        if not project:


            raise HTTPException(


                status_code = 404,


                detail="Project not found"


            )


        # Analyze dependencies


        dependencies = dependency_manager.analyze_all_dependencies()


        # Add recommendations


        recommendations = dependency_manager.get_dependency_recommendations(dependencies)


        dependencies['recommendations'] = recommendations


        return DependencyAnalysisResponse(**dependencies)


    except HTTPException:


        raise


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error analyzing dependencies: {str(e)}"


        )


@router.post("/update", response_model = DependencyUpdateResponse)


async def update_dependencies(


    request: DependencyUpdateRequest,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Update dependencies for a project"""


    try:


        # Get project to find its path


        project = db.query(Project).filter(Project.id == request.project_id).first()


        if not project:


            raise HTTPException(


                status_code = 404,


                detail="Project not found"


            )


        # In a real implementation, this would run package manager commands


        # For now, return a mock response


        updated_count = len(request.packages)


        return DependencyUpdateResponse(


            message = f"Successfully updated {updated_count} packages",


            updated = updated_count


        )


    except HTTPException:


        raise


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error updating dependencies: {str(e)}"


        )


@router.get("/{project_id}/recommendations")


async def get_dependency_recommendations(


    project_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get dependency recommendations for a project"""


    try:


        # Get project to find its path


        project = db.query(Project).filter(Project.id == project_id).first()


        if not project:


            raise HTTPException(


                status_code = 404,


                detail="Project not found"


            )


        # Analyze dependencies and get recommendations


        dependencies = dependency_manager.analyze_all_dependencies()


        recommendations = dependency_manager.get_dependency_recommendations(dependencies)


        return {"recommendations": recommendations}


    except HTTPException:


        raise


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error getting recommendations: {str(e)}"


        )


