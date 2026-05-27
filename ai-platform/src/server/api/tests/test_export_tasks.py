#!/usr/bin/env python3


"""


Test suite for export tasks functionality


"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


from database import get_db


from app import app


def test_export_history_endpoint(client: TestClient):


    """Test export history endpoint exists"""


    response = client.get("/api/export/history")


    # May require authentication


    assert response.status_code in [200, 401, 403]


def test_export_settings_endpoint(client: TestClient):


    """Test export settings endpoint exists"""


    response = client.get("/api/export/settings")


    # May require authentication


    assert response.status_code in [200, 401, 403]


def test_export_list_endpoint(client: TestClient):


    """Test export list endpoint exists"""


    response = client.get("/api/export")


    # May require authentication


    assert response.status_code in [200, 401, 403]


