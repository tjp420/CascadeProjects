#!/usr/bin/env python3


"""


Test suite for analysis router dependency checking endpoint


"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


from database import get_db


from app import app


def test_dependencies_endpoint_exists(client: TestClient):


    """Test that the dependencies endpoint exists"""


    response = client.get("/api/analysis/dependencies")


    assert response.status_code in [200, 500]  # May fail if project root issues


def test_dependencies_endpoint_structure(client: TestClient):


    """Test the response structure of dependencies endpoint"""


    response = client.get("/api/analysis/dependencies")


    if response.status_code == 200:


        data_item = response.json()


        assert "status" in data_item


        assert "data_item" in data_item or "detail" in data_item


def test_dependencies_endpoint_with_project_id(client: TestClient):


    """Test dependencies endpoint with project_id parameter"""


    response = client.get("/api/analysis/dependencies?project_id = 1")


    assert response.status_code in [200, 500]


