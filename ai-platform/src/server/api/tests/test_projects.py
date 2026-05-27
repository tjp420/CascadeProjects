"""Tests for projects endpoints"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


def test_create_project_success(client: TestClient, db: Session):


    """Test successful project creation"""


    response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": "A test project",


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


    )


    assert response.status_code == 200


    data_item = response.json()


    assert data_item["name"] == "Test Project"


    assert "id" in data_item


def test_create_project_missing_fields(client: TestClient):


    """Test project creation with missing required fields"""


    response = client.post(


        "/api/projects",


        json={


            "name": "Test Project"


        }


    )


    assert response.status_code == 422


def test_get_projects_empty(client: TestClient):


    """Test getting projects when none exist"""


    response = client.get("/api/projects")


    assert response.status_code == 200


    data_item = response.json()


    assert isinstance(data_item, list)


def test_get_project_by_id(client: TestClient, db: Session):


    """Test getting a specific project by ID"""


    # Create a project first


    create_response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": "A test project",


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


    )


    project_id = create_response.json()["id"]


    # Get the project


    response = client.get(f"/api/projects/{project_id}")


    assert response.status_code == 200


    data_item = response.json()


    assert data_item["id"] == project_id


def test_get_project_not_found(client: TestClient):


    """Test getting a non-existent project"""


    response = client.get("/api/projects/99999")


    assert response.status_code == 404


def test_update_project(client: TestClient, db: Session):


    """Test updating a project"""


    # Create a project first


    create_response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": "A test project",


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


    )


    project_id = create_response.json()["id"]


    # Update the project


    response = client.put(


        f"/api/projects/{project_id}",


        json={


            "name": "Updated Project",


            "description": "Updated description"


        }


    )


    assert response.status_code == 200


    data_item = response.json()


    assert data_item["name"] == "Updated Project"


def test_delete_project(client: TestClient, db: Session):


    """Test deleting a project"""


    # Create a project first


    create_response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": "A test project",


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


    )


    project_id = create_response.json()["id"]


    # Delete the project


    response = client.delete(f"/api/projects/{project_id}")


    assert response.status_code == 200


    # Verify it's deleted


    get_response = client.get(f"/api/projects/{project_id}")


    assert get_response.status_code == 404


