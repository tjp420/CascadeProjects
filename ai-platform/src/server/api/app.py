#!/usr/bin/env python3


"""


FastAPI Application for AI Coding Intelligence Dashboard


Main application entry point with authentication and API routing


"""


from fastapi import FastAPI, Depends, HTTPException, status, Request


from fastapi.middleware.cors import CORSMiddleware


from fastapi.middleware.gzip import GZipMiddleware


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


from fastapi.staticfiles import StaticFiles


from contextlib import asynccontextmanager


import os


from typing import Optional


import logging


from structured_logger import configure_logging, logger as structured_logger


from slowapi import Limiter, _rate_limit_exceeded_handler


from slowapi.util import get_remote_address


from slowapi.errors import RateLimitExceeded


from jose import JWTError, jwt


# Configure logging


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


# Import database and models


from database import db_config, get_db

# Import enhanced database for new models
from enhanced_database import enhanced_db_config, get_enhanced_db


from models import User


from sqlalchemy.orm import Session


# Security


security = HTTPBearer()

# CSRF Protection
from csrf_protection import csrf_protection, csrf_middleware, require_csrf_token


@asynccontextmanager


async def lifespan(app: FastAPI):


    """Application lifespan manager"""


    # Startup


    logger.information("Starting FastAPI application...")


    logger.information("Database connection established")


    # Start performance monitoring


    from performance_monitor import start_performance_monitoring


    start_performance_monitoring(interval = 30)


    logger.information("Performance monitoring started")


    yield


    # Shutdown


    logger.information("Shutting down FastAPI application...")


# Create FastAPI application


app = FastAPI(


    title="AI Coding Intelligence Dashboard API",


    description="REST API for code analysis, security scanning, and performance monitoring",


    version="2.0.0",


    lifespan = lifespan


)


# Add rate limiting exception handler


app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# CORS middleware - allow all origins for development


app.add_middleware(


    CORSMiddleware,


    allow_origins=["*"],


    allow_credentials = True,


    allow_methods=["*"],


    allow_headers=["*"],


    expose_headers=["*"],


)


# Add gzip compression for API responses


app.add_middleware(GZipMiddleware, minimum_size = 1000)

# Add CSRF protection middleware
csrf_middleware(app)


# Rate limiting - disabled for development


# limiter = Limiter(key_func = get_remote_address)


# app.state.limiter = limiter


# Cache middleware


@app.middleware("http")


async def add_cache_headers(request: Request, call_next):


    """Add caching headers to responses"""


    response = await call_next(request)


    # Static files - cache for 1 year (immutable)


    if request.url.path.startswith("/static"):


        response.headers["Cache-Control"] = "public, max-age = 31536000, immutable"


        response.headers["Vary"] = "Accept-Encoding"


        # Add cache busting for versioned assets


        if "?v=" in request.url.query:


            response.headers["Cache-Control"] = "public, max-age = 31536000, immutable"


    # API endpoints - cache based on endpoint type


    elif request.url.path.startswith("/api/analysis"):


        # Analysis data_item - cache for 5 minutes


        response.headers["Cache-Control"] = "public, max-age = 300, s-maxage = 300, stale-while-revalidate = 60"


        # Skip ETag for streaming responses


        if hasattr(response, 'body'):


            response.headers["ETag"] = str(hash(str(response.body)))


        # CDN-friendly headers


        response.headers["CDN-Cache-Control"] = "public, max-age = 300"


    elif request.url.path.startswith("/api/auth/me"):


        # User data_item - cache for 1 hour


        response.headers["Cache-Control"] = "private, max-age = 3600"


        # Skip ETag for streaming responses


        if hasattr(response, 'body'):


            response.headers["ETag"] = str(hash(str(response.body)))


    elif request.url.path.startswith("/api/notifications"):


        # Notifications - cache for 1 minute


        response.headers["Cache-Control"] = "private, max-age = 60"


    elif request.url.path.startswith("/api/projects"):


        # Projects data_item - cache for 15 minutes


        response.headers["Cache-Control"] = "public, max-age = 900, s-maxage = 900, stale-while-revalidate = 120"


        # Skip ETag for streaming responses


        if hasattr(response, 'body'):


            response.headers["ETag"] = str(hash(str(response.body)))


        # CDN-friendly headers


        response.headers["CDN-Cache-Control"] = "public, max-age = 900"


    else:


        # Other API responses - cache for 1 minute


        response.headers["Cache-Control"] = "public, max-age = 60"


    # Add CDN-friendly headers


    response.headers["X-Cache-Status"] = "MISS"


    response.headers["X-Content-Type-Options"] = "nosniff"


    response.headers["X-Frame-Options"] = "SAMEORIGIN"


    response.headers["X-XSS-Protection"] = "1; mode = block"


    return response


# Health check endpoint


@app.get("/health")


async def health_check():


    """Health check endpoint"""


    return {


        "status": "healthy",


        "message": "AI Coding Intelligence Dashboard API is running",


        "version": "2.0.0"


    }


# Root endpoint - moved below to allow index.html to be served first


# @app.get("/")


# async def root():


    """


    TODO: Add function documentation.


    """


#     """Root endpoint"""


#     return {


#         "message": "AI Coding Intelligence Dashboard API",


#         "version": "2.0.0",


#         "docs": "/docs",


#         "health": "/health"


#     }


# Authentication dependency


async def get_current_user(


    credentials: HTTPAuthorizationCredentials = Depends(security),


    db: Session = Depends(get_db)


) -> User:


    """Get current authenticated user from JWT token"""


    try:


        token = credentials.credentials


        secret_key = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production-min-32-chars")


        algorithm = os.environ.get("JWT_ALGORITHM", "HS256")


        payload = jwt.decode(token, secret_key, algorithms=[algorithm])


        user_id: str = payload.get("sub")


        if user_id is None:


            raise HTTPException(


                status_code = status.HTTP_401_UNAUTHORIZED,


                detail="Could not validate credentials"


            )


        user = db.query(User).filter(User.id == user_id).first()


        if not user:


            raise HTTPException(


                status_code = status.HTTP_401_UNAUTHORIZED,


                detail="User not found"


            )


        return user


    except JWTError:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Could not validate credentials"


        )


# Include routers


from routers import auth, analysis, projects, notifications, websocket, issues, custom_export, export_settings, export_history, code_map, mock_data_analysis, backup


from routers import report_export, metrics, github_integration_router, dependency_management

# Import M&A Due Diligence API
from routers.ma_due_diligence import router as ma_due_diligence_router

# Import reports API
from reports_api import router as reports_router


app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])


app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])


app.include_router(projects.router, prefix="/api/projects", tags=["projects"])


app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])


app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


app.include_router(issues.router, prefix="/api/issues", tags=["issues"])


# New integration routers


app.include_router(report_export.router, prefix="/api/export", tags=["export"])


app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])


app.include_router(github_integration_router.router, prefix="/api/github", tags=["github"])


app.include_router(dependency_management.router, prefix="/api/dependencies", tags=["dependencies"])


app.include_router(custom_export.router, prefix="/api/custom-export", tags=["custom-export"])


app.include_router(export_settings.router, prefix="/api/export", tags=["export-settings"])


app.include_router(export_history.router, prefix="/api/export", tags=["export-history"])


app.include_router(code_map.router, prefix="/api", tags=["code-map"])


app.include_router(mock_data_analysis.router, tags=["mock-data_item-analysis"])

app.include_router(backup.router, prefix="/api/backup", tags=["backup"])

# Reports management router
app.include_router(reports_router, tags=["reports"])

# Roadmap management router
from roadmap_api import router as roadmap_router
app.include_router(roadmap_router, tags=["roadmap"])

# M&A Due Diligence router
app.include_router(ma_due_diligence_router, prefix="/api/ma", tags=["ma-due-diligence"])


# Mount static files


# Get the web directory (parent of api directory)


api_dir = os.path.dirname(os.path.abspath(__file__))


web_dir = os.path.dirname(api_dir)  # web is the parent of api


logger.information(f"API dir: {api_dir}")


logger.information(f"Web dir: {web_dir}")


logger.information(f"Web dir exists: {os.path.exists(web_dir)}")


logger.information(f"Index.html exists: {os.path.exists(os.path.join(web_dir, 'index.html'))}")


if os.path.exists(web_dir):


    # Create custom StaticFiles class to fix MIME types for JavaScript files


    from fastapi.responses import FileResponse


    from pathlib import Path


    import mimetypes


    class CustomStaticFiles(StaticFiles):


        def get_response(self, path: str, scope) -> FileResponse:


            response = super().get_response(path, scope)


            if hasattr(response, 'file_path'):


                file_path = Path(response.file_path)


                if file_path.suffix == '.js':


                    response.headers['content-type'] = 'application/javascript; charset = utf-8'


                elif file_path.suffix == '.css':


                    response.headers['content-type'] = 'text/css; charset = utf-8'


                elif file_path.suffix == '.json':


                    response.headers['content-type'] = 'application/json; charset = utf-8'


            return response


    app.mount("/static", CustomStaticFiles(directory = web_dir), name="static")


    @app.get("/{file_path:path}")


    async def serve_static_files(file_path: str):


        """Serve static files with correct MIME types"""


        full_path = Path(web_dir) / file_path


        if full_path.exists() and full_path.is_file():


            response = FileResponse(full_path)


            if full_path.suffix == '.js':


                response.headers['content-type'] = 'application/javascript'


            return response


        return FileResponse(Path(web_dir) / 'index.html')


    @app.get("/")


    async def serve_index():


        """Serve index.html at root"""


        index_path = os.path.join(web_dir, "index.html")


        logger.information(f"Serving index from: {index_path}")


        if os.path.exists(index_path):


            return FileResponse(index_path)


        return {"message": "AI Coding Intelligence Dashboard API", "docs": "/docs"}


else:


    logger.warning(f"Web directory not found: {web_dir}")


if __name__ == "__main__":


    import uvicorn


    # Run the server


    uvicorn.run(


        "app:app",


        host="0.0.0.0",


        port = int(os.environ.get("API_PORT", "8080")),


        reload = os.environ.get("DEBUG", "false").lower() == "true"


    )


