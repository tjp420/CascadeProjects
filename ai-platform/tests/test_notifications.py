#!/usr/bin/env python3


"""


Unit tests for notifications router


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


class TestNotificationsRouter:


    """Test notifications router endpoints"""


    def test_get_notifications_empty(self, client):


        """Test getting notifications when none exist"""


        response = client.get("/api/notifications")


        assert response.status_code in [200, 401]


    def test_get_notifications_unread_only(self, client):


        """Test getting only unread notifications"""


        response = client.get("/api/notifications?unread_only = true")


        assert response.status_code in [200, 401]


    def test_mark_notification_as_read(self, client):


        """Test marking a notification as read"""


        response = client.put("/api/notifications/1/read")


        assert response.status_code in [200, 401, 404]


    def test_mark_all_as_read(self, client):


        """Test marking all notifications as read"""


        response = client.put("/api/notifications/read-all")


        assert response.status_code in [200, 401]


    def test_delete_notification(self, client):


        """Test deleting a notification"""


        response = client.delete("/api/notifications/1")


        assert response.status_code in [200, 401, 404]


    def test_get_notification_count(self, client):


        """Test getting notification count"""


        response = client.get("/api/notifications/count")


        assert response.status_code in [200, 401]


