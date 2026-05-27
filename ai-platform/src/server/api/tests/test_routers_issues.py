"""


Unit tests for issues router


"""


import pytest


from fastapi.testclient import TestClient


from routers.issues import router


import os


# Create a test app with the issues router


from fastapi import FastAPI


app = FastAPI()


app.include_router(router, prefix="/api/issues")


client = TestClient(app)


@pytest.fixture(autouse = True)


def setup_test_env():


    """Setup test environment variables"""


    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


    os.environ["ALLOWED_ORIGINS"] = "http://localhost:8000"


    yield


class TestIssuesRouter:


    """Test issues router endpoints"""


    def test_list_issues_unauthorized(self):


        """


        """


        response = client.get("/api/issues")


        assert response.status_code in [401, 403]


    def test_create_issue_unauthorized(self):


        """


        """


        issue_data = {


            "project_id": 1,


            "title": "Test Issue",


            "severity": "medium"


        }


        response = client.post("/api/issues", json = issue_data)


        assert response.status_code in [401, 403, 422]


    def test_get_issue_unauthorized(self):


        """


        """


        response = client.get("/api/issues/1")


        assert response.status_code in [401, 403, 404]


    def test_update_issue_unauthorized(self):


        """


        """


        update_data = {"title": "Updated Issue"}


        response = client.put("/api/issues/1", json = update_data)


        assert response.status_code in [401, 403, 404]


    def test_delete_issue_unauthorized(self):


        """


        """


        response = client.delete("/api/issues/1")


        assert response.status_code in [401, 403, 404]


    def test_resolve_issue_unauthorized(self):


        """


        """


        response = client.post("/api/issues/1/resolve")


        assert response.status_code in [401, 403, 404]


    def test_close_issue_unauthorized(self):


        """


        """


        response = client.post("/api/issues/1/close")


        assert response.status_code in [401, 403, 404]


    def test_reopen_issue_unauthorized(self):


        """


        """


        response = client.post("/api/issues/1/reopen")


        assert response.status_code in [401, 403, 404]


    def test_get_issue_stats_unauthorized(self):


        """


        """


        response = client.get("/api/issues/stats")


        assert response.status_code in [401, 403]


    def test_create_issue_validation_missing_title(self):


        """


        """


        issue_data = {


            "project_id": 1


            # Missing title


        }


        response = client.post("/api/issues", json = issue_data)


        assert response.status_code == 422


    def test_create_issue_validation_title_too_short(self):


        """


        """


        issue_data = {


            "project_id": 1,


            "title": "ab"  # Less than 3 characters


        }


        response = client.post("/api/issues", json = issue_data)


        assert response.status_code == 422


    def test_create_issue_validation_invalid_issue_type(self):


        """


        """


        issue_data = {


            "project_id": 1,


            "title": "Test Issue",


            "issue_type": "invalid_type"


        }


        response = client.post("/api/issues", json = issue_data)


        assert response.status_code == 422


    def test_create_issue_validation_invalid_severity(self):


        """


        """


        issue_data = {


            "project_id": 1,


            "title": "Test Issue",


            "severity": "invalid_severity"


        }


        response = client.post("/api/issues", json = issue_data)


        assert response.status_code == 422


    def test_create_issue_validation_too_many_labels(self):


        """


        """


        issue_data = {


            "project_id": 1,


            "title": "Test Issue",


            "labels": ["label1", "label2", "label3", "label4", "label5",


                     "label6", "label7", "label8", "label9", "label10", "label11"]


        }


        response = client.post("/api/issues", json = issue_data)


        assert response.status_code == 422


    def test_list_issues_with_filters(self):


        """


        """


        response = client.get("/api/issues?status = open&severity = high&limit = 50")


        assert response.status_code in [401, 403, 422]


    def test_list_issues_pagination(self):


        """


        """


        response = client.get("/api/issues?skip = 10&limit = 20")


        assert response.status_code in [401, 403]


    def test_list_issues_invalid_pagination(self):


        """


        """


        response = client.get("/api/issues?skip=-1&limit = 0")


        assert response.status_code == 422


if __name__ == "__main__":


    pytest.main([__file__, "-v"])


