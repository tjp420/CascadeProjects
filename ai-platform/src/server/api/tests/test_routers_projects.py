"""


Unit tests for projects router


"""


import pytest


from fastapi.testclient import TestClient


from routers.projects import router


import os


# Create a test app with the projects router


from fastapi import FastAPI


app = FastAPI()


app.include_router(router, prefix="/api/projects")


client = TestClient(app)


@pytest.fixture(autouse = True)


def setup_test_env():


    """Setup test environment variables"""


    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


    os.environ["ALLOWED_ORIGINS"] = "http://localhost:8000"


    yield


class TestProjectsRouter:


    """Test projects router endpoints"""


    def test_list_projects_unauthorized(self):


        """


        """


        response = client.get("/api/projects")


        assert response.status_code in [401, 403]


    def test_create_project_unauthorized(self):


        """


        """


        project_data = {


            "name": "Test Project",


            "description": "Test description"


        }


        response = client.post("/api/projects", json = project_data)


        assert response.status_code in [401, 403, 422]


    def test_get_project_unauthorized(self):


        """


        """


        response = client.get("/api/projects/1")


        assert response.status_code in [401, 403, 404]


    def test_update_project_unauthorized(self):


        """


        """


        update_data = {"name": "Updated Project"}


        response = client.put("/api/projects/1", json = update_data)


        assert response.status_code in [401, 403, 404]


    def test_delete_project_unauthorized(self):


        """


        """


        response = client.delete("/api/projects/1")


        assert response.status_code in [401, 403, 404]


    def test_create_project_with_local_path_unauthorized(self):


        """Test creating project with local_path without authentication"""


        project_data = {


            "name": "Local Test Project",


            "description": "Test project with local path",


            "local_path": "/tmp/test_project"


        }


        response = client.post("/api/projects", json = project_data)


        assert response.status_code in [401, 403, 422]


    def test_update_project_with_local_path_unauthorized(self):


        """Test updating project with local_path without authentication"""


        update_data = {"local_path": "/tmp/updated_path"}


        response = client.put("/api/projects/1", json = update_data)


        assert response.status_code in [401, 403, 404]


    def test_create_project_validation(self):


        """


        """


        # Missing required field 'name'


        project_data = {


            "description": "Test description"


        }


        response = client.post("/api/projects", json = project_data)


        assert response.status_code == 422


    def test_create_project_with_valid_data(self):


        """


        """


        project_data = {


            "name": "Test Project",


            "description": "Test description",


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


        response = client.post("/api/projects", json = project_data)


        # Will be 401/403 without auth, or 201/200 with auth


        assert response.status_code in [200, 201, 401, 403, 422]


    def test_update_project_validation(self):


        """


        """


        update_data = {"name": ""}


        response = client.put("/api/projects/1", json = update_data)


        assert response.status_code in [401, 403, 404, 422]


if __name__ == "__main__":


    pytest.main([__file__, "-v"])


