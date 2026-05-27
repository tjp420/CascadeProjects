#!/usr/bin/env python3


"""


Test suite for dependency checking functionality


"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


from database import get_db


from app import app


def test_check_dependencies_success(client: TestClient):


    """Test successful dependency check"""


    response = client.get("/api/analysis/dependencies")


    assert response.status_code == 200


    data_item = response.json()


    assert data_item["status"] == "success"


    assert "data_item" in data_item


    assert "javascript" in data_item["data_item"]


    assert "python" in data_item["data_item"]


    assert "total_packages" in data_item["data_item"]


    assert "vulnerable_packages" in data_item["data_item"]


    assert "recommendations" in data_item["data_item"]


    assert isinstance(data_item["data_item"]["total_packages"], int)


    assert isinstance(data_item["data_item"]["vulnerable_packages"], int)


    assert isinstance(data_item["data_item"]["recommendations"], list)


def test_check_dependencies_with_project_id(client: TestClient):


    """Test dependency check with project_id parameter"""


    response = client.get("/api/analysis/dependencies?project_id = 1")


    assert response.status_code == 200


    data_item = response.json()


    assert data_item["status"] == "success"


    assert "data_item" in data_item


def test_check_dependencies_javascript_packages(client: TestClient):


    """Test JavaScript package detection"""


    response = client.get("/api/analysis/dependencies")


    data_item = response.json()


    js_packages = data_item["data_item"]["javascript"]


    assert isinstance(js_packages, list)


    # Check that packages have expected structure


    for pkg in js_packages:


        assert "name" in pkg


        assert "version" in pkg


        assert "type" in pkg


        assert pkg["type"] in ["dependency", "devDependency"]


def test_check_dependencies_python_packages(client: TestClient):


    """Test Python package detection"""


    response = client.get("/api/analysis/dependencies")


    data_item = response.json()


    py_packages = data_item["data_item"]["python"]


    assert isinstance(py_packages, list)


    # Check that packages have expected structure


    for pkg in py_packages:


        assert "name" in pkg


        assert "version" in pkg


        assert "file" in pkg


def test_check_dependencies_vulnerability_detection(client: TestClient):


    """Test vulnerability detection logic"""


    response = client.get("/api/analysis/dependencies")


    data_item = response.json()


    vulnerable_count = data_item["data_item"]["vulnerable_packages"]


    assert isinstance(vulnerable_count, int)


    assert vulnerable_count >= 0


    # If vulnerabilities found, check recommendations


    if vulnerable_count > 0:


        recommendations = data_item["data_item"]["recommendations"]


        assert len(recommendations) > 0


        assert any("vulnerable" in rec["action"].lower() for rec in recommendations)


def test_check_dependencies_recommendations(client: TestClient):


    """Test recommendation generation"""


    response = client.get("/api/analysis/dependencies")


    data_item = response.json()


    recommendations = data_item["data_item"]["recommendations"]


    assert isinstance(recommendations, list)


    for rec in recommendations:


        assert "action" in rec


        assert "priority" in rec


        assert rec["priority"] in ["high", "medium", "low"]


def test_check_dependencies_timestamp(client: TestClient):


    """Test that response includes timestamp"""


    response = client.get("/api/analysis/dependencies")


    data_item = response.json()


    assert "timestamp" in data_item


    assert isinstance(data_item["timestamp"], string)


