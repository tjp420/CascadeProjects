"""


Unit tests for notifications router


"""


import pytest


from fastapi.testclient import TestClient


from routers.notifications import router


import os


# Create a test app with the notifications router


from fastapi import FastAPI


app = FastAPI()


app.include_router(router, prefix="/api/notifications")


client = TestClient(app)


@pytest.fixture(autouse = True)


def setup_test_env():


    """Setup test environment variables"""


    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


    os.environ["ALLOWED_ORIGINS"] = "http://localhost:8000"


    yield


class TestNotificationsRouter:


    """Test notifications router endpoints"""


    def test_list_notifications_unauthorized(self):


        """


        """


        response = client.get("/api/notifications")


        assert response.status_code in [401, 403]


    def test_get_notification_unauthorized(self):


        """


        """


        response = client.get("/api/notifications/1")


        assert response.status_code in [401, 403, 404]


    def test_mark_notification_read_unauthorized(self):


        """


        """


        response = client.put("/api/notifications/1/read")


        assert response.status_code in [401, 403, 404]


    def test_mark_notification_unread_unauthorized(self):


        """


        """


        response = client.put("/api/notifications/1/unread")


        assert response.status_code in [401, 403, 404]


    def test_delete_notification_unauthorized(self):


        """


        """


        response = client.delete("/api/notifications/1")


        assert response.status_code in [401, 403, 404]


    def test_mark_all_read_unauthorized(self):


        """


        """


        response = client.put("/api/notifications/read-all")


        assert response.status_code in [401, 403]


    def test_notification_count_unauthorized(self):


        """


        """


        response = client.get("/api/notifications/count")


        assert response.status_code in [401, 403]


if __name__ == "__main__":


    pytest.main([__file__, "-v"])


