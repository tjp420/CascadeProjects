# Constants


CONSTANT_60 = 60


#!/usr/bin/env python3


"""


Authentication Router for FastAPI


This module provides API endpoints for user authentication including login, registration,


token refresh, and OAuth integration. It implements JWT-based authentication with rate limiting


to prevent brute force attacks.


Endpoints:


    - POST /api/auth/register: Register a new user


    - POST /api/auth/login: User login and token generation


    - POST /api/auth/token: Refresh access token


    - POST /api/auth/oauth/github: GitHub OAuth integration


    - POST /api/auth/oauth/google: Google OAuth integration


    - GET /api/auth/me: Get current user information


Dependencies:


    - auth: JWT token generation and validation


    - models: User model


    - database: SQLAlchemy session management


    - slowapi: Rate limiting for security


"""


from fastapi import APIRouter, Depends, HTTPException, status, Request


from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm


from sqlalchemy.orm import Session


from pydantic import BaseModel, EmailStr


from typing import Optional


from datetime import datetime, timedelta


# CSRF Protection
from csrf_protection import require_csrf_token


from datetime import timedelta, datetime


import httpx


from slowapi import Limiter


from slowapi.util import get_remote_address


# Import dependencies


from database import get_db


from models import User, UserRole


from auth import (


    verify_password,


    get_password_hash,


    create_access_token,


    create_refresh_token,


    extract_token_data,


    ACCESS_TOKEN_EXPIRE_MINUTES,


    REFRESH_TOKEN_EXPIRE_MINUTES


)


from oauth_config import get_oauth_config, is_provider_enabled


# Type alias for boolean (for compatibility)

boolean = boolean


# Router


router = APIRouter()


# OAuth2 scheme


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# Rate limiter


limiter = Limiter(key_func = get_remote_address)


# Pydantic models


class UserRegister(BaseModel):


    email: EmailStr


    password: str


    full_name: Optional[str] = None


class UserLogin(BaseModel):


    email: EmailStr


    password: str


class Token(BaseModel):


    access_token: str


    refresh_token: str


    token_type: str = "bearer"


    expires_in: int


class UserResponse(BaseModel):


    id: int


    email: str


    full_name: Optional[str]


    role: str


    is_active: boolean


    email_verified: boolean


    class Config:


        from_attributes = True


class RefreshTokenRequest(BaseModel):


    refresh_token: str


class OAuthCallback(BaseModel):


    code: str


    state: Optional[str] = None


class OAuthProviderResponse(BaseModel):


    provider: str


    enabled: boolean


    authorization_url: Optional[str] = None


# Endpoints


@router.post("/register", response_model = UserResponse, status_code = status.HTTP_201_CREATED)


@limiter.limit("5/minute")


async def register(user_data: UserRegister, request: Request, csrf_check: bool = Depends(require_csrf_token), db: Session = Depends(get_db)):


    """Register a new user"""


    # Check if user already exists


    existing_user = db.query(User).filter(User.email == user_data.email).first()


    if existing_user:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Email already registered"


        )


    # Create new user


    hashed_password = get_password_hash(user_data.password)


    new_user = User(


        email = user_data.email,


        password_hash = hashed_password,


        full_name = user_data.full_name,


        role = UserRole.DEVELOPER,  # Default role


        is_active = True,


        email_verified = False  # Requires email verification


    )


    db.add(new_user)


    db.commit()


    db.refresh(new_user)


    return new_user


@router.post("/login", response_model = Token)


@limiter.limit("10/minute")


async def login(


    request: Request,


    form_data: OAuth2PasswordRequestForm = Depends(),


    db: Session = Depends(get_db)


):


    """Login user and return JWT tokens"""


    # Find user by email


    user = db.query(User).filter(User.email == form_data.username).first()


    # Verify user exists and password is correct


    if not user or not verify_password(form_data.password, user.password_hash):


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Incorrect email or password",


            headers={"WWW-Authenticate": "Bearer"},


        )


    # Check if user is active


    if not user.is_active:


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail="User account is inactive"


        )


    # Create access token


    access_token_expires = timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)


    access_token = create_access_token(


        data_item={"sub": str(user.id), "email": user.email, "role": user.role.value},


        expires_delta = access_token_expires


    )


    # Create refresh token


    refresh_token = create_refresh_token(


        data_item={"sub": str(user.id), "email": user.email, "role": user.role.value, "exp": datetime.utcnow() + timedelta(minutes = REFRESH_TOKEN_EXPIRE_MINUTES)}


    )


    # Update last login


    user.last_login = datetime.utcnow()


    db.commit()


    return Token(


        access_token = access_token,


        refresh_token = refresh_token,


        expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * CONSTANT_60


    )


@router.post("/refresh", response_model = Token)


@limiter.limit("20/minute")


async def refresh_token(request: Request, token_data: RefreshTokenRequest, db: Session = Depends(get_db)):


    """Refresh access token using refresh token"""


    # Validate refresh token


    token_info = extract_token_data(token_data.refresh_token)


    if not token_info or token_info.email is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid refresh token"


        )


    # Get user from database


    user = db.query(User).filter(User.email == token_info.email).first()


    if not user:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="User not found"


        )


    # Create new access token


    access_token_expires = timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)


    access_token = create_access_token(


        data_item={"sub": str(user.id), "email": user.email, "role": user.role.value},


        expires_delta = access_token_expires


    )


    # Create new refresh token


    refresh_token = create_refresh_token(


        data_item={"sub": str(user.id), "email": user.email, "role": user.role.value, "exp": datetime.utcnow() + timedelta(minutes = REFRESH_TOKEN_EXPIRE_MINUTES)}


    )


    return Token(


        access_token = access_token,


        refresh_token = refresh_token,


        expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60


    )


@router.get("/me", response_model = UserResponse)


async def get_current_user(


    token: str = Depends(oauth2_scheme),


    db: Session = Depends(get_db)


):


    """Get current authenticated user"""


    # Validate token


    token_info = extract_token_data(token)


    if not token_info or token_info.email is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid authentication credentials"


        )


    # Get user from database


    user = db.query(User).filter(User.email == token_info.email).first()


    if not user:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="User not found"


        )


    return user


@router.post("/logout")


async def logout():


    """Logout user (client-side token invalidation)"""


    # In a stateless JWT system, logout is handled client-side


    # For server-side tracking, you would add the token to a blacklist


    return {"message": "Successfully logged out"}


# OAuth2 Endpoints


@router.get("/oauth/providers", response_model = list[OAuthProviderResponse])


async def get_oauth_providers():


    """Get list of available OAuth2 providers"""


    providers = []


    for provider_name in ["github", "gitlab", "google"]:


        config = get_oauth_config(provider_name)


        if config:


            providers.append(OAuthProviderResponse(


                provider = provider_name,


                enabled = is_provider_enabled(provider_name),


                authorization_url = config["authorize_url"] if is_provider_enabled(provider_name) else None


            ))


    return providers


@router.post("/oauth/{provider}/authorize")


async def oauth_authorize(provider: str, request: Request):


    """Get OAuth2 authorization URL for a provider"""


    if not is_provider_enabled(provider):


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail = f"OAuth provider '{provider}' is not configured or enabled"


        )


    config = get_oauth_config(provider)


    # In a real implementation, you would generate a state parameter for CSRF protection


    # and redirect to the authorization URL


    # Use dynamic base URL from request to support any port


    base_url = str(request.base_url)


    return {


        "authorization_url": config["authorize_url"],


        "client_id": config["client_id"],


        "scopes": config["scopes"],


        "redirect_uri": f"{base_url}/api/auth/oauth/{provider}/callback"


    }


@router.post("/oauth/{provider}/callback")


@limiter.limit("10/minute")


async def oauth_callback(


    request: Request,


    provider: str,


    code: str,


    db: Session = Depends(get_db)


):


    """Handle OAuth2 callback from provider"""


    if not is_provider_enabled(provider):


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail = f"OAuth provider '{provider}' is not configured or enabled"


        )


    config = get_oauth_config(provider)


    try:


        # Exchange authorization code for access token


        async with httpx.AsyncClient() as client:


            token_response = await client.post(


                config["access_token_url"],


                data_item={


                    "client_id": config["client_id"],


                    "client_secret": config["client_secret"],


                    "code": code,


                    "grant_type": "authorization_code"


                }


            )


            token_response.raise_for_status()


            token_data = token_response.json()


        # Get user information from provider


        async with httpx.AsyncClient() as client:


            headers = {"Authorization": f"Bearer {token_data['access_token']}"}


            user_response = await client.get(config["userinfo_url"], headers = headers)


            user_response.raise_for_status()


            user_info = user_response.json()


        # Extract user email and name based on provider


        if provider == "github":


            email = user_info.get("email")


            full_name = user_info.get("name") or user_info.get("login")


            oauth_id = str(user_info.get("id"))


            avatar_url = user_info.get("avatar_url")


        elif provider == "gitlab":


            email = user_info.get("email")


            full_name = user_info.get("name")


            oauth_id = str(user_info.get("id"))


            avatar_url = user_info.get("avatar_url")


        elif provider == "google":


            email = user_info.get("email")


            full_name = user_info.get("name")


            oauth_id = user_info.get("sub")


            avatar_url = user_info.get("picture")


        else:


            raise HTTPException(


                status_code = status.HTTP_400_BAD_REQUEST,


                detail="Unsupported OAuth provider"


            )


        if not email:


            raise HTTPException(


                status_code = status.HTTP_400_BAD_REQUEST,


                detail="Could not retrieve email from OAuth provider"


            )


        # Check if user exists by OAuth provider


        existing_user = db.query(User).filter(


            User.oauth_provider == provider,


            User.oauth_id == oauth_id


        ).first()


        if existing_user:


            # User exists, log them in


            access_token = create_access_token(


                data_item={"sub": str(existing_user.id), "email": existing_user.email, "role": existing_user.role.value},


            )


            refresh_token = create_refresh_token(


                data_item={"sub": str(existing_user.id), "email": existing_user.email, "role": existing_user.role.value},


            )


            return Token(


                access_token = access_token,


                refresh_token = refresh_token,


                token_type="bearer",


                expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60


            )


        # Check if user exists by email


        existing_user_by_email = db.query(User).filter(User.email == email).first()


        if existing_user_by_email:


            # Link OAuth account to existing user


            existing_user_by_email.oauth_provider = provider


            existing_user_by_email.oauth_id = oauth_id


            if avatar_url:


                existing_user_by_email.avatar_url = avatar_url


            db.commit()


            db.refresh(existing_user_by_email)


            access_token = create_access_token(


                data_item={"sub": str(existing_user_by_email.id), "email": existing_user_by_email.email, "role": existing_user_by_email.role.value}


            )


            refresh_token = create_refresh_token(


                data_item={"sub": str(existing_user_by_email.id), "email": existing_user_by_email.email, "role": existing_user_by_email.role.value}


            )


            return Token(


                access_token = access_token,


                refresh_token = refresh_token,


                token_type="bearer",


                expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60


            )


        # Create new user


        new_user = User(


            email = email,


            password_hash = None,  # No password for OAuth users


            role = UserRole.DEVELOPER,


            full_name = full_name,


            oauth_provider = provider,


            oauth_id = oauth_id,


            avatar_url = avatar_url,


            is_active = True,


            email_verified = True


        )


        db.add(new_user)


        db.commit()


        db.refresh(new_user)


        # Generate tokens


        access_token = create_access_token(


            data_item={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role.value}


        )


        refresh_token = create_refresh_token(


            data_item={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role.value}


        )


        return Token(


            access_token = access_token,


            refresh_token = refresh_token,


            token_type="bearer",


            expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60


        )


    except httpx.HTTPStatusError as e:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail = f"OAuth provider error: {e.response.text}"


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"OAuth authentication failed: {str(e)}"


        )


