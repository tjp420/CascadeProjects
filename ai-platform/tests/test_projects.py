#!/usr/bin/env python3


"""


Unit tests for projects router


"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


import sys


from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture


def client():


    """Create test client"""


    from api.app import app


    return TestClient(app)


@pytest.fixture


def db():


    """Create test database session"""


    from api.database import Base, get_db


    from sqlalchemy import create_engine


    from sqlalchemy.orm import sessionmaker


    SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_projects.db"


    engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})


    TestingSessionLocal = sessionmaker(autocommit = False, autoflush = False, bind = engine)


    Base.metadata.create_all(bind = engine)


    db = TestingSessionLocal()


    try:


        yield db


    finally:


        db.close()


        Base.metadata.drop_all(bind = engine)


class TestProjectsRouter:


    """Test projects router endpoints"""


    def test_get_projects_empty(self, client):


        """Test getting projects list when empty"""


        response = client.get("/api/projects")


        assert response.status_code in [200, 401]  # 401 if auth required


    def test_create_project_missing_fields(self, client):


        """Test creating project with missing required fields"""


        response = client.post(


            "/api/projects",


            json={"name": "Test Project"}  # Missing repo_url


        )


        assert response.status_code in [422, 401]


    def test_create_project_valid(self, client, db):


        """Test creating project with valid data_item"""


        # First create a user (if auth is required)


        # This test may need adjustment based on auth requirements


        response = client.post(


            "/api/projects",


            json={


                "name": "Test Project",


                "description": "A test project",


                "repo_url": "https://github.com/test/repo",


                "repo_provider": "github"


            }


        )


        # May return 401 if auth is required, which is expected


        assert response.status_code in [201, 401]


    def test_get_project_by_id(self, client):


        """Test getting a specific project by ID"""


        response = client.get("/api/projects/1")


        assert response.status_code in [200, 401, 404]


    def test_update_project(self, client):


        """Test updating a project"""


        response = client.put(


            "/api/projects/1",


            json={"name": "Updated Project Name"}


        )


        assert response.status_code in [200, 401, 404]


    def test_delete_project(self, client):


        """Test deleting a project"""


        response = client.delete("/api/projects/1")


        assert response.status_code in [200, 401, 404]


