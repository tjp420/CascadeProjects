"""Tests for metrics endpoints"""


import pytest


from fastapi.testclient import TestClient


from unittest.mock import Mock, patch


def test_get_project_metrics_success(client: TestClient, auth_headers: dict, db):


    """Test successful project metrics retrieval"""


    with patch('api.routers.metrics.metrics_storage') as mock_metrics:


        mock_metrics.get_metrics.return_value = [


            {"metric_value": 75, "timestamp": "2024-01-01"},


            {"metric_value": 80, "timestamp": "2024-01-02"}


        ]


        response = client.get(


            "/api/metrics/1?metric_type = code_quality&days = 30",


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "project_id" in data_item


        assert "metric_type" in data_item


        assert "data_item" in data_item


def test_get_metric_trends_success(client: TestClient, auth_headers: dict, db):


    """Test successful metric trends retrieval"""


    with patch('api.routers.metrics.metrics_storage') as mock_metrics:


        mock_metrics.get_metric_trends.return_value = {


            "trend": "increasing",


            "direction": "up",


            "change": 10,


            "percent_change": 13.3


        }


        response = client.get(


            "/api/metrics/1/trends?metric_type = code_quality&days = 30",


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "trend" in data_item


        assert "direction" in data_item


def test_get_project_health_success(client: TestClient, auth_headers: dict, db):


    """Test successful project health retrieval"""


    with patch('api.routers.metrics.metrics_storage') as mock_metrics:


        mock_metrics.get_project_health_summary.return_value = {


            "project_id": 1,


            "overall_health": "good",


            "metrics": {


                "code_quality": {"trend": "stable"},


                "security": {"trend": "up"}


            }


        }


        response = client.get(


            "/api/metrics/1/health?days = 7",


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "project_id" in data_item


        assert "overall_health" in data_item


def test_get_metrics_unauthorized(client: TestClient, db):


    """Test metrics retrieval without authentication"""


    response = client.get("/api/metrics/1?metric_type = code_quality")


    assert response.status_code == 401


