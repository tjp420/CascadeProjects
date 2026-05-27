"""Tests for GitHub integration endpoints"""


import pytest


from fastapi.testclient import TestClient


from unittest.mock import Mock, patch


def test_sync_to_github_success(client: TestClient, auth_headers: dict, db):


    """Test successful GitHub sync"""


    with patch('api.routers.github_integration_router.github_client') as mock_github:


        mock_github.sync_analysis_to_issues.return_value = [


            {"number": 123, "title": "Security Issue"},


            {"number": 124, "title": "Refactor Needed"}


        ]


        response = client.post(


            "/api/github/sync",


            json={


                "repo_owner": "testowner",


                "repo_name": "testrepo",


                "analysis_results": {"security": {"issues": []}}


            },


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "created_issues" in data_item


        assert "total" in data_item


        assert data_item["total"] == 2


def test_get_github_issues_success(client: TestClient, auth_headers: dict, db):


    """Test successful GitHub issues retrieval"""


    with patch('api.routers.github_integration_router.github_client') as mock_github:


        mock_github.list_issues.return_value = [


            {"number": 123, "title": "Test Issue", "state": "open"}


        ]


        response = client.get(


            "/api/github/issues?repo_owner = testowner&repo_name = testrepo&state = open",


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "issues" in data_item


        assert "total" in data_item


def test_trigger_github_workflow_success(client: TestClient, auth_headers: dict, db):


    """Test successful GitHub workflow trigger"""


    with patch('api.routers.github_integration_router.github_client') as mock_github:


        mock_github.trigger_workflow.return_value = True


        response = client.post(


            "/api/github/workflows/trigger",


            json={


                "repo_owner": "testowner",


                "repo_name": "testrepo",


                "workflow_id": "ci.yml",


                "inputs": {"branch": "main"}


            },


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "message" in data_item


        assert "workflow_id" in data_item


def test_github_sync_unauthorized(client: TestClient, db):


    """Test GitHub sync without authentication"""


    response = client.post(


        "/api/github/sync",


        json={


            "repo_owner": "testowner",


            "repo_name": "testrepo",


            "analysis_results": {}


        }


    )


    assert response.status_code == 401


