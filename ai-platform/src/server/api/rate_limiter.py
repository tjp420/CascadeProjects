#!/usr/bin/env python3


"""


Per-Endpoint Rate Limiting Module


Provides configurable rate limiting for specific endpoints


"""


from typing import Optional, Dict, Any


from fastapi import Request, HTTPException, status, Depends


from slowapi import Limiter


from slowapi.util import get_remote_address


from slowapi.errors import RateLimitExceeded


import time


from collections import defaultdict


from functools import wraps


from datetime import datetime, timedelta


class RateLimitConfig:


    """Configuration for rate limiting"""


    # Default limits per endpoint


    DEFAULT_LIMITS = {


        # Auth endpoints - stricter limits


        "POST:/api/auth/login": "5/minute",


        "POST:/api/auth/register": "3/minute",


        "POST:/api/auth/refresh": "10/minute",


        # Analysis endpoints - moderate limits


        "POST:/api/analysis/run": "10/minute",


        "GET:/api/analysis/*": "30/minute",


        # Export endpoints - lower limits (resource intensive)


        "POST:/api/export/pdf": "5/minute",


        "POST:/api/export/excel": "5/minute",


        # Project endpoints - moderate limits


        "POST:/api/projects": "20/minute",


        "PUT:/api/projects/*": "20/minute",


        "DELETE:/api/projects/*": "10/minute",


        # Metrics endpoints - higher limits (read-only)


        "GET:/api/metrics/*": "60/minute",


        # GitHub integration - moderate limits


        "POST:/api/github/*": "10/minute",


        "GET:/api/github/*": "30/minute",


        # Dependency management - moderate limits


        "POST:/api/dependencies/*": "10/minute",


        "GET:/api/dependencies/*": "30/minute",


        # Default for all other endpoints


        "default": "60/minute"


    }


class PerEndpointRateLimiter:


    """Per-endpoint rate limiter with configurable limits"""


    def __init__(self, key_func = None):


    """


    TODO: Add function documentation.


    """


        self.key_func = key_func or get_remote_address


        self.requests = defaultdict(list)


        self.limits = RateLimitConfig.DEFAULT_LIMITS.copy()


        self.enabled = True


    def get_limit(self, method: str, path: str) -> tuple:


        """Get rate limit for a specific endpoint"""


        key = f"{method}:{path}"


        # Try exact match first


        if key in self.limits:


            limit_str = self.limits[key]


        else:


            # Try wildcard match


            wildcard_key = f"{method}:*"


            if wildcard_key in self.limits:


                limit_str = self.limits[wildcard_key]


            else:


                # Use default


                limit_str = self.limits.get("default", "60/minute")


        # Parse limit string (e.g., "60/minute" -> 60 requests per 60 seconds)


        parts = limit_str.split("/")


        max_requests = int(parts[0])


        period_str = parts[1].lower()


        if period_str == "second":


            period = 1


        elif period_str == "minute":


            period = 60


        elif period_str == "hour":


            period = 3600


        elif period_str == "day":


            period = 86400


        else:


            period = 60  # Default to minute


        return max_requests, period


    def is_allowed(self, key: str, method: str, path: str) -> boolean:


        """Check if request is allowed based on rate limit"""


        if not self.enabled:


            return True


        max_requests, period = self.get_limit(method, path)


        now = time.time()


        # Get request history for this key


        request_history = self.requests[key]


        # Remove old requests outside the time window


        request_history[:] = [req_time for req_time in request_history if req_time > now - period]


        # Check if under limit


        if len(request_history) >= max_requests:


            return False


        # Add current request


        request_history.append(now)


        return True


    def get_remaining(self, key: str, method: str, path: str) -> int:


        """Get remaining requests for the current window"""


        if not self.enabled:


            return 999999


        max_requests, period = self.get_limit(method, path)


        now = time.time()


        request_history = self.requests[key]


        request_history[:] = [req_time for req_time in request_history if req_time > now - period]


        return max(0, max_requests - len(request_history))


    def get_reset_time(self, key: str, method: str, path: str) -> Optional[float]:


        """Get reset time for the current window"""


        if not self.enabled:


            return None


        period = self.get_limit(method, path)[1]


        request_history = self.requests[key]


        if not request_history:


            return None


        return request_history[0] + period


# Global rate limiter instance


rate_limiter = PerEndpointRateLimiter()


def get_rate_limiter() -> PerEndpointRateLimiter:


    """Get global rate limiter instance"""


    return rate_limiter


def configure_rate_limiter(enabled: boolean = True, custom_limits: Optional[Dict[str, str]] = None):


    """Configure rate limiter with custom settings"""


    global rate_limiter


    rate_limiter = PerEndpointRateLimiter()


    rate_limiter.enabled = enabled


    if custom_limits:


        rate_limiter.limits.update(custom_limits)


    return rate_limiter


def rate_limit(max_requests: int = 60, period: str = "minute"):


    """Decorator for rate limiting specific endpoints"""


    def decorator(func):


    """


    TODO: Add function documentation.


    """


        @wraps(func)


        async def wrapper(*args, **kwargs):


    """


    TODO: Add function documentation.


    """


            request = None


            # Find request in args/kwargs


            for arg in args:


                if isinstance(arg, Request):


                    request = arg


                    break


            if request is None:


                return await func(*args, **kwargs)


            key = rate_limiter.key_func(request)


            method = request.method


            path = request.url.path


            if not rate_limiter.is_allowed(key, method, path):


                remaining = rate_limiter.get_remaining(key, method, path)


                reset_time = rate_limiter.get_reset_time(key, method, path)


                raise HTTPException(


                    status_code = status.HTTP_429_TOO_MANY_REQUESTS,


                    detail="Rate limit exceeded",


                    headers={


                        "X-RateLimit-Limit": str(max_requests),


                        "X-RateLimit-Remaining": str(remaining),


                        "X-RateLimit-Reset": str(int(reset_time)) if reset_time else "0",


                        "Retry-After": str(int(reset_time - time.time())) if reset_time else "60"


                    }


                )


            return await func(*args, **kwargs)


        return wrapper


    return decorator


async def check_rate_limit(request: Request):


    """Dependency to check rate limit for current request"""


    if not rate_limiter.enabled:


        return True


    key = rate_limiter.key_func(request)


    method = request.method


    path = request.url.path


    if not rate_limiter.is_allowed(key, method, path):


        max_requests, _ = rate_limiter.get_limit(method, path)


        remaining = rate_limiter.get_remaining(key, method, path)


        reset_time = rate_limiter.get_reset_time(key, method, path)


        raise HTTPException(


            status_code = status.HTTP_429_TOO_MANY_REQUESTS,


            detail="Rate limit exceeded",


            headers={


                "X-RateLimit-Limit": str(max_requests),


                "X-RateLimit-Remaining": str(remaining),


                "X-RateLimit-Reset": str(int(reset_time)) if reset_time else "0",


                "Retry-After": str(int(reset_time - time.time())) if reset_time else "60"


            }


        )


    return True


def add_rate_limit_headers(response: Request, request: Request):


    """Add rate limit headers to response"""


    if not rate_limiter.enabled:


        return


    key = rate_limiter.key_func(request)


    method = request.method


    path = request.url.path


    max_requests, _ = rate_limiter.get_limit(method, path)


    remaining = rate_limiter.get_remaining(key, method, path)


    reset_time = rate_limiter.get_reset_time(key, method, path)


    response.headers["X-RateLimit-Limit"] = str(max_requests)


    response.headers["X-RateLimit-Remaining"] = str(remaining)


    if reset_time:


        response.headers["X-RateLimit-Reset"] = str(int(reset_time))


