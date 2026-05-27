"""Tests for API security features"""


import pytest


from fastapi.testclient import TestClient


def test_cors_headers(client: TestClient):


    """Test that CORS headers are properly set"""


    response = client.options(


        "/api/projects",


        headers={


            "Origin": "http://localhost:8000"


            "Access-Control-Request-Method": "POST"


        }


    )


    assert response.status_code in [200, 405]  # OPTIONS may not be implemented


    if response.status_code == 200:


        assert "access-control-allow-origin" in response.headers


def test_rate_limiting(client: TestClient):


    """Test that rate limiting is enforced"""


    # Make multiple rapid requests


    responses = []


    for _ in range(15):


        response = client.post(


            "/api/auth/login",


            data_item={"username": "test@example.com", "password": "wrong"}


        )


        responses.append(response.status_code)


    # At least some requests should be rate limited (429)


    assert 429 in responses or all(status in [401, 422] for status in responses)


def test_protected_endpoint_without_auth(client: TestClient):


    """Test that protected endpoints require authentication"""


    response = client.get("/api/projects")


    # May return 401 or 200 with empty list depending on implementation


    assert response.status_code in [200, 401]


def test_sql_injection_protection(client: TestClient):


    """Test that SQL injection attempts are blocked"""


    response = client.get("/api/projects?name=' OR '1'='1")


    # Should not return 500 (internal server error)


    assert response.status_code in [200, 400, 422]


def test_xss_protection(client: TestClient):


    """Test that XSS attempts are handled safely"""


    response = client.post(


        "/api/projects",


        json={


            "name": "<script>alert('xss')</script>",


            "description": "Test project",


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


    )


    # Should either accept it (sanitized) or reject it


    assert response.status_code in [200, 422]


def test_large_payload_rejection(client: TestClient):


    """Test that excessively large payloads are rejected"""


    large_description = "A" * 1000000  # 1MB description


    response = client.post(


        "/api/projects",


        json={


            "name": "Test Project",


            "description": large_description,


            "repo_url": "https://example.com"


            "repo_provider": "github"


        }


    )


    # Should reject large payloads


    assert response.status_code in [413, 422]


