#!/usr/bin/env python3
"""
Simple standalone FastAPI app for testing reports API and Dashboard API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the reports API and dashboard API
from reports_api import router as reports_router
from dashboard_api import router as dashboard_router
from roadmap_api import router as roadmap_router
from refactoring_api import router as refactoring_router
from routers.backup import router as backup_router
from performance_api import router as performance_router
from upload_monitoring_api import router as upload_router

# Create FastAPI app
app = FastAPI(
    title="AI Dashboard API Suite",
    version="2.0.0",
    description="Comprehensive API suite for reports and dashboard metrics"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(reports_router, tags=["reports"])
app.include_router(dashboard_router, tags=["dashboard"])
app.include_router(roadmap_router, tags=["roadmap"])
app.include_router(refactoring_router, tags=["refactoring"])
app.include_router(backup_router, tags=["backup"])
app.include_router(performance_router, tags=["performance"])
app.include_router(upload_router, tags=["uploads"])

@app.get("/")
async def root():
    return {
        "message": "AI Dashboard API Suite is running",
        "version": "2.0.0",
        "services": {
            "reports": "/api/reports",
            "dashboard": "/api/dashboard",
            "roadmap": "/api/roadmap",
            "refactoring": "/api/refactoring",
            "backup": "/api/backup",
            "performance": "/api/performance",
            "uploads": "/api/uploads"
        },
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "services": {
            "reports": "operational",
            "dashboard": "operational",
            "roadmap": "operational",
            "refactoring": "operational",
            "backup": "operational",
            "performance": "operational",
            "uploads": "operational"
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting AI Dashboard API Suite server...")
    print("Reports API: http://localhost:8002/api/reports")
    print("Dashboard API: http://localhost:8002/api/dashboard")
    print("Roadmap API: http://localhost:8002/api/roadmap")
    print("Refactoring API: http://localhost:8002/api/refactoring")
    print("Backup API: http://localhost:8002/api/backup")
    print("Performance API: http://localhost:8002/api/performance")
    print("Upload Monitoring API: http://localhost:8002/api/uploads")
    uvicorn.run(app, host="0.0.0.0", port=8002, log_level="info")