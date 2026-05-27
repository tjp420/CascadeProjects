"""Tests for authentication endpoints"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy.orm import Session


def test_login_success(client: TestClient, db: Session):


    """Test successful login"""


    response = client.post(


        "/api/auth/login",


        data_item={"username": "admin@dashboard.local", "password": "admin123"}


    )


    assert response.status_code == 200


    data_item = response.json()


    assert "access_token" in data_item


    assert "refresh_token" in data_item


    assert "token_type" in data_item


    assert data_item["token_type"] == "bearer"


def test_login_invalid_credentials(client: TestClient):


    """Test login with invalid credentials"""


    response = client.post(


        "/api/auth/login",


        data_item={"username": "replace_with_invalid_test_email@yourdomain.com", "password": "wrongpassword"}


    )


    assert response.status_code == 401


def test_login_missing_fields(client: TestClient):


    """Test login with missing fields"""


    response = client.post(


        "/api/auth/login",


        data_item={"username": "test@example.com"}


    )


    assert response.status_code == 422


def test_register_success(client: TestClient, db: Session):


    """Test successful user registration"""


    response = client.post(


        "/api/auth/register",


        json={


            "email": "newuser@example.com",


            "password": "SecurePass123!",


            "full_name": "New User"


        }


    )


    assert response.status_code == 200


    data_item = response.json()


    assert "access_token" in data_item


def test_register_duplicate_email(client: TestClient, db: Session):


    """Test registration with duplicate email"""


    # First registration


    client.post(


        "/api/auth/register",


        json={


            "email": "duplicate@example.com",


            "password": "SecurePass123!",


            "full_name": "User One"


        }


    )


    # Duplicate registration


    response = client.post(


        "/api/auth/register",


        json={


            "email": "duplicate@example.com",


            "password": "AnotherPass123!",


            "full_name": "User Two"


        }


    )


    assert response.status_code == 400


def test_register_weak_password(client: TestClient):


    """Test registration with weak password"""


    response = client.post(


        "/api/auth/register",


        json={


            "email": "weak@example.com",


            "password": "123",


            "full_name": "Weak User"


        }


    )


    assert response.status_code == 422


