#!/usr/bin/env python3


"""


GitHub Integration Router


Handles GitHub API integration endpoints


"""


from fastapi import APIRouter, Depends, HTTPException


from pydantic import BaseModel


from typing import Optional, List, Dict, Any


import sys


from pathlib import Path


# Add parent directory to path for imports


sys.path.append(str(Path(__file__).parent.parent))


from github_integration import github_client


from routers.auth import get_current_user


from models import User


from database import get_db


from sqlalchemy.orm import Session


router = APIRouter()


class GitHubSyncRequest(BaseModel):


    repo_owner: str


    repo_name: str


    analysis_results: Dict[str, Any]


class GitHubSyncResponse(BaseModel):


    created_issues: List[Dict[str, Any]]


    total: int


class GitHubWorkflowTriggerRequest(BaseModel):


    repo_owner: str


    repo_name: str


    workflow_id: str


    inputs: Optional[Dict[str, Any]] = None


class GitHubWorkflowTriggerResponse(BaseModel):


    message: str


    workflow_id: str


@router.post("/sync", response_model = GitHubSyncResponse)


async def sync_to_github(


    request: GitHubSyncRequest,


    current_user: User = Depends(get_current_user)


):


    """Sync analysis results to GitHub Issues"""


    try:


        created_issues = github_client.sync_analysis_to_issues(


            repo_owner = request.repo_owner,


            repo_name = request.repo_name,


            analysis_results = request.analysis_results


        )


        return GitHubSyncResponse(


            created_issues = created_issues,


            total = len(created_issues)


        )


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error syncing to GitHub: {str(e)}"


        )


@router.get("/issues")


async def get_github_issues(


    repo_owner: str,


    repo_name: str,


    state: str = "open",


    labels: Optional[str] = None,


    current_user: User = Depends(get_current_user)


):


    """Get GitHub Issues for a repository"""


    try:


        labels_list = labels.split(',') if labels else None


        issues = github_client.list_issues(


            repo_owner = repo_owner,


            repo_name = repo_name,


            state = state,


            labels = labels_list


        )


        return {"issues": issues, "total": len(issues)}


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error retrieving GitHub issues: {str(e)}"


        )


@router.post("/workflows/trigger", response_model = GitHubWorkflowTriggerResponse)


async def trigger_github_workflow(


    request: GitHubWorkflowTriggerRequest,


    current_user: User = Depends(get_current_user)


):


    """Trigger a GitHub Actions workflow"""


    try:


        result_data = github_client.trigger_workflow(


            repo_owner = request.repo_owner,


            repo_name = request.repo_name,


            workflow_id = request.workflow_id,


            inputs = request.inputs or {}


        )


        if not result_data:


            raise HTTPException(


                status_code = 500,


                detail="Failed to trigger workflow"


            )


        return GitHubWorkflowTriggerResponse(


            message="Workflow triggered successfully",


            workflow_id = request.workflow_id


        )


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error triggering workflow: {str(e)}"


        )


@router.get("/workflows/runs")


async def get_workflow_runs(


    repo_owner: str,


    repo_name: str,


    workflow_id: Optional[str] = None,


    current_user: User = Depends(get_current_user)


):


    """Get GitHub Actions workflow runs"""


    try:


        runs = github_client.get_workflow_runs(


            repo_owner = repo_owner,


            repo_name = repo_name,


            workflow_id = workflow_id


        )


        return {"runs": runs, "total": len(runs)}


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error retrieving workflow runs: {str(e)}"


        )


