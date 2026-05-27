"""Pytest fixtures for API tests"""


import pytest


from fastapi.testclient import TestClient


from sqlalchemy import create_engine


from sqlalchemy.orm import sessionmaker, Session


import sys


from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent.parent.parent))


from api.app import app


from api.database import Base, get_db


from api.models import User


from api.auth import get_password_hash, create_access_token


# Test database


SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"


engine = create_engine(


    SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False}


)


TestingSessionLocal = sessionmaker(autocommit = False, autoflush = False, bind = engine)


@pytest.fixture(scope="function")


def db():


    """Create a fresh database for each test"""


    Base.metadata.create_all(bind = engine)


    db = TestingSessionLocal()


    try:


        yield db


    finally:


        db.close()


        Base.metadata.drop_all(bind = engine)


@pytest.fixture(scope="function")


def client(db: Session):


    """Create a test client with database override"""


    def override_get_db():


        """


        Override get_db dependency for testing


        """


        try:


            yield db


        finally:


            pass


    app.dependency_overrides[get_db] = override_get_db


    with TestClient(app) as test_client:


        yield test_client


    app.dependency_overrides.clear()


@pytest.fixture(scope="function")


def test_user(db: Session):


    """Create a test user for authentication"""


    user = User(


        email="test@example.com",


        password_hash = get_password_hash("testpassword"),


        full_name="Test User",


        role="user"


    )


    db.add(user)


    db.commit()


    db.refresh(user)


    yield user


    db.delete(user)


    db.commit()


@pytest.fixture(scope="function")


def auth_token(test_user: User):


    """Generate an authentication token for the test user"""


    token = create_access_token({"sub": str(test_user.id), "email": test_user.email, "role": test_user.role})


    return token


@pytest.fixture(scope="function")


def auth_headers(auth_token: str):


    """Generate authentication headers for test requests"""


    return {"Authorization": f"Bearer {auth_token}"}


