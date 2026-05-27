"""Tests for analysis endpoints"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


def test_analysis_code_structure(client: TestClient, db: Session):


    """Test code structure analysis endpoint"""


    response = client.get("/api/analysis/code-structure")


    assert response.status_code in [200, 401]  # May require auth


def test_analysis_code_structure_with_project_path(client: TestClient, db: Session):


    """Test code structure analysis with custom project path"""


    response = client.get("/api/analysis/code-structure?project_path=/tmp/test")


    assert response.status_code in [200, 401]


def test_analysis_code_structure_with_project_id(client: TestClient, db: Session):


    """Test code structure analysis with project_id (uses local_path from database)"""


    # Create a project with local_path


    project_response = client.post(


        "/api/projects",


        json={


            "name": "Local Test Project",


            "description": "A test project with local path",


            "local_path": "/tmp/test_project"


        }


    )


    if project_response.status_code == 201:


        project_id = project_response.json()["id"]


        response = client.get(f"/api/analysis/code-structure?project_id={project_id}")


        assert response.status_code in [200, 401]


def test_analysis_file_structure(client: TestClient, db: Session):


    """Test file structure analysis endpoint"""


    response = client.get("/api/analysis/file-structure")


    assert response.status_code in [200, 401]


def test_analysis_quality(client: TestClient, db: Session):


    """Test code quality analysis endpoint"""


    response = client.get("/api/analysis/quality")


    assert response.status_code in [200, 401]


def test_analysis_technical_debt(client: TestClient, db: Session):


    """Test technical debt analysis endpoint"""


    response = client.get("/api/analysis/technical-debt")


    assert response.status_code in [200, 401]


def test_analysis_security(client: TestClient, db: Session):


    """Test security analysis endpoint"""


    response = client.get("/api/analysis/security")


    assert response.status_code in [200, 401]


def test_analysis_performance(client: TestClient, db: Session):


    """Test performance analysis endpoint"""


    response = client.get("/api/analysis/performance")


    assert response.status_code in [200, 401]


def test_analysis_recommendations(client: TestClient, db: Session):


    """Test recommendations analysis endpoint"""


    response = client.get("/api/analysis/recommendations")


    assert response.status_code in [200, 401]


def test_analysis_run_success(client: TestClient, db: Session):


    """Test running a complete analysis"""


    # Create a project first


    project_response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": "A test project",


            "repo_url": "https://example.com",


            "repo_provider": "github"


        }


    )


    project_id = project_response.json()["id"]


    # Run analysis


    response = client.post(


        f"/api/analysis/run",


        json={"project_id": project_id}


    )


    assert response.status_code in [200, 202, 401]


def test_analysis_run_with_local_path(client: TestClient, db: Session):


    """Test running analysis on a project with local_path"""


    project_response = client.post(


        "/api/projects",


        json={


            "name": "Local Path Project",


            "description": "Project with local path",


            "local_path": "/tmp/test_local"


        }


    )


    if project_response.status_code == 201:


        project_id = project_response.json()["id"]


        response = client.post(


            f"/api/analysis/run",


            json={"project_id": project_id}


        )


        assert response.status_code in [200, 202, 401]


def test_analysis_run_invalid_project(client: TestClient):


    """Test running analysis with invalid project ID"""


    response = client.post(


        "/api/analysis/run",


        json={"project_id": 99999}


    )


    assert response.status_code in [404, 422]


def test_analysis_run_missing_project_id(client: TestClient):


    """Test running analysis without project ID"""


    response = client.post(


        "/api/analysis/run",


        json={}


    )


    assert response.status_code == 422


def test_project_overview(client: TestClient, db: Session):


    """Test project overview analysis endpoint"""


    # Create a project first


    project_response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": "A test project",


            "repo_url": "https://example.com",


            "repo_provider": "github"


        }


    )


    project_id = project_response.json()["id"]


    response = client.get(f"/api/analysis/project/overview?project_id={project_id}")


    assert response.status_code in [200, 401]


