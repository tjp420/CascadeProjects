"""Tests for dependency management endpoints"""


import pytest


from fastapi.testclient import TestClient


from unittest.mock import Mock, patch


def test_get_dependencies_success(client: TestClient, auth_headers: dict, db):


    """Test successful dependency analysis retrieval"""


    with patch('api.routers.dependency_management.dependency_manager') as mock_deps:


        mock_deps.analyze_all_dependencies.return_value = {


            "python": {


                "dependencies": [


                    {"name": "fastapi", "version": "0.104.1"}


                ],


                "outdated": []


            },


            "javascript": {


                "dependencies": [


                    {"name": "react", "version": "18.2.0"}


                ],


                "outdated": []


            },


            "total_dependencies": 2,


            "outdated_count": 0


        }


        response = client.get("/api/dependencies/1", headers = auth_headers)


        assert response.status_code == 200


        data_item = response.json()


        assert "python" in data_item


        assert "javascript" in data_item


        assert "total_dependencies" in data_item


def test_update_dependencies_success(client: TestClient, auth_headers: dict, db):


    """Test successful dependency update"""


    response = client.post(


        "/api/dependencies/update",


        json={


            "project_id": 1,


            "package_manager": "pip",


            "packages": ["fastapi"]


        },


        headers = auth_headers


    )


    assert response.status_code == 200


    data_item = response.json()


    assert "message" in data_item


    assert "updated" in data_item


def test_get_dependency_recommendations_success(client: TestClient, auth_headers: dict, db):


    """Test successful dependency recommendations retrieval"""


    with patch('api.routers.dependency_management.dependency_manager') as mock_deps:


        mock_deps.analyze_all_dependencies.return_value = {


            "python": {"dependencies": [], "outdated": []},


            "javascript": {"dependencies": [], "outdated": []}


        }


        mock_deps.get_dependency_recommendations.return_value = [


            {


                "priority": "medium",


                "message": "All dependencies are up to date"


            }


        ]


        response = client.get("/api/dependencies/1/recommendations", headers = auth_headers)


        assert response.status_code == 200


        data_item = response.json()


        assert "recommendations" in data_item


def test_get_dependencies_unauthorized(client: TestClient, db):


    """Test dependency retrieval without authentication"""


    response = client.get("/api/dependencies/1")


    assert response.status_code == 401


