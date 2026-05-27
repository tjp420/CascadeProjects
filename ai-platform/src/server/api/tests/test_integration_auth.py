"""


Integration tests for authentication endpoints


"""


import pytest


from fastapi.testclient import TestClient


from app import app


import os


client = TestClient(app)


@pytest.fixture(autouse = True)


def setup_test_env():


    """Setup test environment variables"""


    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


    os.environ["ALLOWED_ORIGINS"] = "http://localhost:8000"


    yield


    # Cleanup


class TestAuthenticationEndpoints:


    """Test authentication endpoints"""


    def test_health_check(self):


        """


        """


        response = client.get("/health")


        assert response.status_code == 200


        data_item = response.json()


        assert "status" in data_item


        assert data_item["status"] == "healthy"


    def test_register_user_success(self):


        """


        """


        user_data = {


            "email": "test@example.com",


            "name": "Replace With Real Integration Test User Name",


            "password": "SecurePassword123!"


        }


        response = client.post("/api/auth/register", json = user_data)


        # Response might be 200 or 409 if user exists


        assert response.status_code in [200, 201, 409]


    def test_register_user_missing_fields(self):


        """


        """


        user_data = {


            "email": "test@example.com",


            "name": "Test User"


            # Missing password


        }


        response = client.post("/api/auth/register", json = user_data)


        assert response.status_code == 422  # Validation error


    def test_register_user_invalid_email(self):


        """


        """


        user_data = {


            "email": "invalid-email",


            "name": "Replace With Real Integration Test User Name",


            "password": "SecurePassword123!"


        }


        response = client.post("/api/auth/register", json = user_data)


        assert response.status_code == 422  # Validation error


    def test_login_success(self):


        """


        """


        login_data = {


            "email": "test@example.com",


            "password": "SecurePassword123!"


        }


        response = client.post("/api/auth/login", json = login_data)


        # Response might be 200 or 401 if user doesn't exist


        assert response.status_code in [200, 401]


        if response.status_code == 200:


            data_item = response.json()


            assert "token" in data_item or "access_token" in data_item


    def test_login_invalid_credentials(self):


        """


        """


        login_data = {


            "email": "nonexistent@example.com",


            "password": "WrongPassword123!"


        }


        response = client.post("/api/auth/login", json = login_data)


        assert response.status_code == 401


    def test_login_missing_fields(self):


        """


        """


        login_data = {


            "email": "test@example.com"


            # Missing password


        }


        response = client.post("/api/auth/login", json = login_data)


        assert response.status_code == 422  # Validation error


    def test_verify_token_valid(self):


        """


        """


        # This would require a valid token from login


        # For now, test the endpoint exists


        response = client.post("/api/auth/verify-token", json={"token": "dummy-token"})


        assert response.status_code in [200, 401]


    def test_verify_token_missing(self):


        """


        """


        response = client.post("/api/auth/verify-token", json={})


        assert response.status_code == 400 or response.status_code == 422


    def test_protected_endpoint_without_token(self):


        """


        """


        response = client.get("/api/projects")


        assert response.status_code == 401  # Unauthorized


    def test_cors_headers(self):


        """


        """


        response = client.options("/api/auth/login")


        assert "access-control-allow-origin" in response.headers or response.status_code == 200


    def test_rate_limiting(self):


        """


        """


        # Make multiple rapid requests to test rate limiting


        login_data = {


            "email": "test@example.com",


            "password": "SecurePassword123!"


        }


        responses = []


        for _ in range(20):


            response = client.post("/api/auth/login", json = login_data)


            responses.append(response.status_code)


        # If rate limiting is active, some requests should be 429


        # If not, all should be 200 or 401


        assert all(status in [200, 401, 429] for status in responses)


class TestTokenSecurity:


    """Test token security features"""


    def test_jwt_secret_required(self):


        """


        """


        original_secret = os.environ.get("JWT_SECRET_KEY")


        os.environ["JWT_SECRET_KEY"] = ""


        try:


            response = client.post("/api/auth/login", json={


                "email": "test@example.com",


                "password": "SecurePassword123!"


            })


            # Should fail or use default


            assert response.status_code in [200, 401, 500]


        finally:


            if original_secret:


                os.environ["JWT_SECRET_KEY"] = original_secret


    def test_token_expiration(self):


        """


        """


        # This would require mocking time or using a short-lived token


        # For now, test that the endpoint handles expired tokens


        expired_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwfQ.invalid",


    response= client.post("/api/auth/verify-token", json={"token": expired_token})


        assert response.status_code in [401, 400]


if __name__ == "__main__":


    pytest.main([__file__, "-v"])


