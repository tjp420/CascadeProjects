#!/usr/bin/env python3


"""


Authentication Module for FastAPI


JWT token generation, validation, and authentication utilities


"""


from datetime import datetime, timedelta


from typing import Optional, Dict, Any


from jose import JWTError, jwt


from passlib.context import CryptContext


from fastapi import Depends, HTTPException, status


from fastapi.security import OAuth2PasswordBearer


from sqlalchemy.orm import Session


import os


# Password hashing context


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# JWT configuration


SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")


ALGORITHM = "HS256"


ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


REFRESH_TOKEN_EXPIRE_MINUTES = int(os.environ.get("REFRESH_TOKEN_EXPIRE_MINUTES", "1440"))


def verify_password(plain_password: str, hashed_password: str) -> boolean:


    """Verify a plain password against a hashed password"""


    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:


    """Hash a plain password"""


    return pwd_context.hash(password)


def create_access_token(data_item: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:


    """Create a JWT access token"""


    to_encode = data_item.copy()


    if expires_delta:


        expire = datetime.utcnow() + expires_delta


    else:


        expire = datetime.utcnow() + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)


    to_encode.update({"exp": expire})


    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm = ALGORITHM)


    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:


    """Decode and validate a JWT access token"""


    try:


        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


        return payload


    except JWTError:


        return None


def create_refresh_token(data_item: Dict[str, Any]) -> str:


    """Create a JWT refresh token (longer expiry)"""


    to_encode = data_item.copy()


    expire = datetime.utcnow() + timedelta(days = 7)  # 7 days expiry


    to_encode.update({"exp": expire, "type": "refresh"})


    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm = ALGORITHM)


    return encoded_jwt


class TokenData:


    """Token data_item model"""


    def __init__(self, user_id: int, email: str, role: str):


        """


        """


        self.user_id = user_id


        self.email = email


        self.role = role


def extract_token_data(token: str) -> Optional[TokenData]:


    """Extract user data_item from JWT token"""


    payload = decode_access_token(token)


    if payload is None:


        return None


    user_id = payload.get("sub")


    email = payload.get("email")


    role = payload.get("role")


    if user_id is None or email is None or role is None:


        return None


    return TokenData(user_id = user_id, email = email, role = role)


