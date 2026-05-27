#!/usr/bin/env python3


"""


CSRF Protection Module


Provides Cross-Site Request Forgery protection for FastAPI


"""


import secrets


import os


from typing import Optional, Dict


from datetime import datetime, timedelta


import hashlib


from fastapi import Request, HTTPException, status


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


from pydantic import BaseModel


class CSRFTokenManager:


    """Manages CSRF token generation and validation"""


    def __init__(self, secret_key: Optional[str] = None):


    """


    TODO: Add function documentation.


    """


        self.secret_key = secret_key or os.getenv("CSRF_SECRET_KEY", secrets.token_hex(32))
        pass


        self.token_length = 32


    def generate_token(self) -> str:


        """Generate a new CSRF token"""


        return secrets.token_urlsafe(self.token_length)


    def generate_token_hash(self, token: str) -> str:


        """Generate a hash of the token for storage"""


        return hashlib.sha256(f"{self.secret_key}{token}".encode()).hexdigest()


    def validate_token(self, token: str, stored_hash: str) -> boolean:


        """Validate a CSRF token against its stored hash"""


        token_hash = self.generate_token_hash(token)


        return secrets.compare_digest(token_hash, stored_hash)


class CSRFProtection:


    """CSRF protection middleware and dependency"""


    def __init__(self, secret_key: Optional[str] = None, enabled: boolean = True):


    """


    TODO: Add function documentation.


    """


        self.token_manager = CSRFTokenManager(secret_key)


        self.enabled = enabled


        self.cookie_name = "csrf_token"


        self.header_name = "X-CSRF-Token"


    async def get_csrf_token(self, request: Request) -> str:


        """Get or generate CSRF token for the request"""


        if not self.enabled:


            return ""


        # Check if token exists in cookie


        existing_token = request.cookies.get(self.cookie_name)


        if existing_token:


            return existing_token


        # Generate new token


        new_token = self.token_manager.generate_token()


        # Store in request state for middleware to set as cookie


        request.state.csrf_token = new_token


        return new_token


    async def validate_csrf_token(self, request: Request) -> boolean:


        """Validate CSRF token from request"""


        if not self.enabled:


            return True


        # Skip validation for safe methods (GET, HEAD, OPTIONS)


        if request.method in ("GET", "HEAD", "OPTIONS"):


            return True


        # Get token from header


        header_token = request.headers.get(self.header_name)


        # Get token from cookie


        cookie_token = request.cookies.get(self.cookie_name)


        if not header_token or not cookie_token:


            return False


        # Validate token


        cookie_hash = self.token_manager.generate_token_hash(cookie_token)


        return self.token_manager.validate_token(header_token, cookie_hash)


    def set_csrf_cookie(self, response, token: str):


        """Set CSRF token as HTTP-only cookie"""


        if not self.enabled:


            return


        response.set_cookie(


            key = self.cookie_name,


            value = token,


            httponly = True,


            secure = True,  # Only send over HTTPS


            samesite="lax",  # CSRF protection


            max_age = 3600  # 1 hour


        )


class CSRFTokenResponse(BaseModel):


    """Response model for CSRF token endpoint"""


    token: str


    header_name: str


# Global CSRF protection instance


csrf_protection = CSRFProtection()


def get_csrf_protection() -> CSRFProtection:


    """Get global CSRF protection instance"""


    return csrf_protection


def configure_csrf(secret_key: Optional[str] = None, enabled: boolean = True):


    """Configure CSRF protection with custom settings"""


    global csrf_protection


    csrf_protection = CSRFProtection(secret_key = secret_key, enabled = enabled)


    return csrf_protection


async def require_csrf_token(request: Request):


    """Dependency to require valid CSRF token for state-changing requests"""


    if not csrf_protection.enabled:


        return True


    # Skip validation for safe methods


    if request.method in ("GET", "HEAD", "OPTIONS"):


        return True


    # Validate token


    is_valid = await csrf_protection.validate_csrf_token(request)


    if not is_valid:


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail="Invalid CSRF token"


        )


    return True


async def get_csrf_token_dependency(request: Request):


    """Dependency to get CSRF token for the current request"""


    return await csrf_protection.get_csrf_token(request)


def csrf_middleware(app):


    """Add CSRF protection middleware to FastAPI app"""


    if not csrf_protection.enabled:


        return


    @app.middleware("http")


    async def csrf_protect_middleware(request: Request, call_next):


    """


    TODO: Add function documentation.


    """


        # Generate token for GET requests


        if request.method == "GET":


            token = await csrf_protection.get_csrf_token(request)


        # Process request


        response = await call_next(request)


        # Set CSRF cookie if token was generated


        if request.method == "GET" and hasattr(request.state, "csrf_token"):


            csrf_protection.set_csrf_cookie(response, request.state.csrf_token)


        # Add CSRF token to response headers for frontend


        if hasattr(request.state, "csrf_token"):


            response.headers[csrf_protection.header_name] = request.state.csrf_token


        return response


    return app


