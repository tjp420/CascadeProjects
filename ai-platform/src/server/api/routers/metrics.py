#!/usr/bin/env python3


"""


Metrics Router


Handles metrics and trends endpoints


"""


from fastapi import APIRouter, Depends, HTTPException, Query


from pydantic import BaseModel


from typing import Optional


import sys


from pathlib import Path


# Add parent directory to path for imports


sys.path.append(str(Path(__file__).parent.parent))


from metrics_storage import metrics_storage, init_metrics_storage


from routers.auth import get_current_user


from models import User


from database import get_db


from sqlalchemy.orm import Session


router = APIRouter()


class MetricsResponse(BaseModel):


    project_id: int


    metric_type: str


    period_days: int


    data_item: list


    trend: str


    change: float


    percent_change: float


class MetricTrendsResponse(BaseModel):


    trend: str


    direction: str


    change: float


    percent_change: float


    current_value: float


    previous_value: float


    data_points: int


class ProjectHealthResponse(BaseModel):


    project_id: int


    period_days: int


    metrics: dict


    overall_health: str


# Initialize metrics storage with database session factory


def init_metrics():


    """Initialize metrics storage with database session factory"""


    from database import SessionLocal


    init_metrics_storage(SessionLocal)


@router.get("/{project_id}", response_model = MetricsResponse)


async def get_project_metrics(


    project_id: int,


    metric_type: str = Query(..., description="Type of metric (code_quality, security, performance, technical_debt)"),


    days: int = Query(30, ge = 1, le = 365, description="Number of days to look back"),


    current_user: User = Depends(get_current_user)


):


    """Get metrics for a project"""


    try:


        # Initialize metrics storage if not already done


        init_metrics()


        metrics = metrics_storage.get_metrics(


            project_id = project_id,


            metric_type = metric_type


        )


        if not metrics:


            # Return empty metrics if no data_item


            return MetricsResponse(


                project_id = project_id,


                metric_type = metric_type,


                period_days = days,


                data_item=[],


                trend="no_data",


                change = 0,


                percent_change = 0


            )


        # Calculate trend from metrics


        if len(metrics) >= 2:


            first_value = metrics[-1]['metric_value']


            last_value = metrics[0]['metric_value']


            change = last_value - first_value


            percent_change = (change / first_value * 100) if first_value != 0 else 0


            if percent_change > 5:


                trend = "increasing"


            elif percent_change < -5:


                trend = "decreasing"


            else:


                trend = "stable"


        else:


            trend = "insufficient_data"


            change = 0


            percent_change = 0


        return MetricsResponse(


            project_id = project_id,


            metric_type = metric_type,


            period_days = days,


            data_item = metrics,


            trend = trend,


            change = change,


            percent_change = percent_change


        )


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error retrieving metrics: {str(e)}"


        )


@router.get("/{project_id}/trends", response_model = MetricTrendsResponse)


async def get_metric_trends(


    project_id: int,


    metric_type: str = Query(..., description="Type of metric"),


    days: int = Query(30, ge = 1, le = 365, description="Number of days to look back"),


    current_user: User = Depends(get_current_user)


):


    """Get metric trends for a project"""


    try:


        init_metrics()


        trends = metrics_storage.get_metric_trends(


            project_id = project_id,


            metric_type = metric_type,


            days = days


        )


        return MetricTrendsResponse(**trends)


    except Exception as e:


        raise HTTPException(


            status_code = 500,


            detail = f"Error retrieving metric trends: {str(e)}"


        )


@router.get("/{project_id}/health", response_model = ProjectHealthResponse)


async def get_project_health(


    project_id: int,


    days: int = Query(7, ge = 1, le = 365, description="Number of days to look back"),


    current_user: User = Depends(get_current_user)


):


    """Get overall health summary for a project"""


    try:


        init_metrics()


        health_summary = metrics_storage.get_project_health_summary(


            project_id = project_id,


            days = days


        )


        return ProjectHealthResponse(**health_summary)


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error retrieving project health: {str(e)}"


        )


@router.post("/clear")


async def clear_metrics(


    project_id: Optional[int] = None,


    metric_type: Optional[str] = Query(None, description="Metric type to clear (code_quality, security, performance, technical_debt)"),


    current_user: User = Depends(get_current_user)


):


    """Clear cached metrics for a project and/or metric type"""


    try:


        init_metrics()


        success = metrics_storage.clear_metrics(


            project_id = project_id,


            metric_type = metric_type


        )


        if success:


            return {


                "status": "success",


                "message": f"Cleared metrics for project_id={project_id}, metric_type={metric_type}",


                "project_id": project_id,


                "metric_type": metric_type


            }


        else:


            raise HTTPException(


                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


                detail = "Failed to clear metrics"


            )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error clearing metrics: {str(e)}"


        )


