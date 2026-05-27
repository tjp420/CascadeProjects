#!/usr/bin/env python3
"""
Comprehensive Test Suite for Reports API

Tests for CRUD operations, real-time functionality, report generation,
history tracking, and scheduling features.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json
import uuid

# Import the FastAPI app and database dependencies
from reports_server import app
from enhanced_database import get_enhanced_db
from enhanced_models import (
    ReportDB, ReportMetadataDB, ReportDataDB,
    ReportHistoryDB, ReportScheduleDB, ScheduleRunHistoryDB, Base
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# ============================================================================
# TEST SETUP AND FIXTURES
# ============================================================================

# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Override the database dependency
app.dependency_overrides[get_enhanced_db] = override_get_db

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client():
    """Create a test client"""
    return TestClient(app)

@pytest.fixture
def sample_report_data():
    """Sample report data for testing"""
    return {
        "name": "Test Performance Report",
        "description": "A test performance report",
        "type": "performance",
        "category": "analytics",
        "format": "json",
        "size": 1024,
        "schedule": "daily",
        "status": "ready",
        "version": "1.0.0",
        "validation_status": "valid"
    }

@pytest.fixture
def sample_report(db_session):
    """Create a sample report in the database"""
    report = ReportDB(
        id=str(uuid.uuid4()),
        name="Sample Report",
        description="A sample report for testing",
        type="performance",
        category="analytics",
        format="json",
        size=2048,
        schedule="daily",
        status="ready",
        version="1.0.0",
        validation_status="valid"
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)
    return report

# ============================================================================
# CRUD OPERATIONS TESTS
# ============================================================================

class TestReportCRUD:
    """Test suite for report CRUD operations"""
    
    def test_get_all_reports(self, client, sample_report):
        """Test retrieving all reports"""
        response = client.get("/api/reports/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    def test_get_report_by_id(self, client, sample_report):
        """Test retrieving a specific report by ID"""
        response = client.get(f"/api/reports/{sample_report.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_report.id
        assert data["name"] == sample_report.name
    
    def test_get_report_not_found(self, client):
        """Test retrieving a non-existent report"""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/reports/{fake_id}")
        assert response.status_code == 404
    
    def test_create_report(self, client, sample_report_data):
        """Test creating a new report"""
        response = client.post("/api/reports/", json=sample_report_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == sample_report_data["name"]
        assert data["type"] == sample_report_data["type"]
    
    def test_update_report(self, client, sample_report):
        """Test updating an existing report"""
        update_data = {
            "name": "Updated Report Name",
            "status": "processing"
        }
        response = client.put(f"/api/reports/{sample_report.id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Report Name"
        assert data["status"] == "processing"
    
    def test_delete_report(self, client, sample_report):
        """Test deleting a report"""
        response = client.delete(f"/api/reports/{sample_report.id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
        # Verify report is deleted
        get_response = client.get(f"/api/reports/{sample_report.id}")
        assert get_response.status_code == 404
    
    def test_get_reports_by_type(self, client, sample_report):
        """Test filtering reports by type"""
        response = client.get(f"/api/reports/type/{sample_report.type}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert data[0]["type"] == sample_report.type

# ============================================================================
# ADVANCED SEARCH AND FILTERING TESTS
# ============================================================================

class TestAdvancedSearch:
    """Test suite for advanced search and filtering"""
    
    def test_search_reports_by_term(self, client, sample_report):
        """Test searching reports by search term"""
        search_request = {
            "search_term": sample_report.name[:5],
            "skip": 0,
            "limit": 10
        }
        response = client.post("/api/reports/search", json=search_request)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_search_reports_by_type(self, client, sample_report):
        """Test filtering reports by type in search"""
        search_request = {
            "report_type": sample_report.type,
            "skip": 0,
            "limit": 10
        }
        response = client.post("/api/reports/search", json=search_request)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_search_reports_by_status(self, client, sample_report):
        """Test filtering reports by status in search"""
        search_request = {
            "status": sample_report.status,
            "skip": 0,
            "limit": 10
        }
        response = client.post("/api/reports/search", json=search_request)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_batch_delete_operation(self, client, sample_report):
        """Test batch delete operation"""
        batch_request = {
            "report_ids": [sample_report.id],
            "operation": "delete"
        }
        response = client.post("/api/reports/batch", json=batch_request)
        assert response.status_code == 200
        data = response.json()
        assert data["operation"] == "delete"
        assert data["processed"] == 1
    
    def test_batch_archive_operation(self, client, sample_report):
        """Test batch archive operation"""
        batch_request = {
            "report_ids": [sample_report.id],
            "operation": "archive"
        }
        response = client.post("/api/reports/batch", json=batch_request)
        assert response.status_code == 200
        data = response.json()
        assert data["operation"] == "archive"
    
    def test_get_report_versions(self, client, sample_report):
        """Test getting report version history"""
        response = client.get(f"/api/reports/{sample_report.id}/versions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

# ============================================================================
# REPORT GENERATION TESTS
# ============================================================================

class TestReportGeneration:
    """Test suite for report generation functionality"""
    
    def test_get_generation_types(self, client):
        """Test getting available report generation types"""
        response = client.get("/api/reports/generate/types")
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        assert isinstance(data["types"], list)
        assert len(data["types"]) > 0
    
    def test_generate_performance_report(self, client):
        """Test generating a performance report"""
        generation_request = {
            "report_type": "performance",
            "title": "Generated Performance Report",
            "description": "Auto-generated performance report"
        }
        response = client.post("/api/reports/generate", json=generation_request)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert "report_id" in data
        assert data["report_data"]["type"] == "performance"
    
    def test_generate_quality_report(self, client):
        """Test generating a quality report"""
        generation_request = {
            "report_type": "quality",
            "title": "Generated Quality Report",
            "description": "Auto-generated quality report"
        }
        response = client.post("/api/reports/generate", json=generation_request)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["report_data"]["type"] == "quality"
    
    def test_generate_security_report(self, client):
        """Test generating a security report"""
        generation_request = {
            "report_type": "security",
            "title": "Generated Security Report",
            "description": "Auto-generated security report"
        }
        response = client.post("/api/reports/generate", json=generation_request)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["report_data"]["type"] == "security"
    
    def test_generate_resources_report(self, client):
        """Test generating a resources report"""
        generation_request = {
            "report_type": "resources",
            "title": "Generated Resources Report",
            "description": "Auto-generated resources report"
        }
        response = client.post("/api/reports/generate", json=generation_request)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["report_data"]["type"] == "resources"

# ============================================================================
# REPORT HISTORY TESTS
# ============================================================================

class TestReportHistory:
    """Test suite for report history tracking"""
    
    def test_get_report_history(self, client, sample_report):
        """Test getting report history"""
        response = client.get(f"/api/reports/{sample_report.id}/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_add_history_entry(self, client, sample_report):
        """Test adding a history entry"""
        history_data = {
            "change_type": "updated",
            "change_description": "Test update",
            "changed_by": "test_user",
            "change_reason": "Testing history functionality"
        }
        response = client.post(f"/api/reports/{sample_report.id}/history", json=history_data)
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        
        # Verify history entry was created
        history_response = client.get(f"/api/reports/{sample_report.id}/history")
        history_data = history_response.json()
        assert len(history_data) > 0

# ============================================================================
# REPORT SCHEDULING TESTS
# ============================================================================

class TestReportScheduling:
    """Test suite for report scheduling functionality"""
    
    def test_create_schedule(self, client, sample_report):
        """Test creating a new schedule"""
        schedule_data = {
            "report_id": sample_report.id,
            "schedule_type": "daily",
            "notify_on_failure": True
        }
        response = client.post("/api/reports/schedules", json=schedule_data)
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == sample_report.id
        assert data["schedule_type"] == "daily"
        assert data["is_active"] == True
    
    def test_get_all_schedules(self, client):
        """Test getting all schedules"""
        response = client.get("/api/reports/schedules")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_schedule_by_id(self, client, sample_report):
        """Test getting a specific schedule"""
        # First create a schedule
        schedule_data = {
            "report_id": sample_report.id,
            "schedule_type": "weekly"
        }
        create_response = client.post("/api/reports/schedules", json=schedule_data)
        schedule_id = create_response.json()["id"]
        
        # Now get the schedule
        response = client.get(f"/api/reports/schedules/{schedule_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == schedule_id
    
    def test_update_schedule(self, client, sample_report):
        """Test updating a schedule"""
        # First create a schedule
        schedule_data = {
            "report_id": sample_report.id,
            "schedule_type": "daily"
        }
        create_response = client.post("/api/reports/schedules", json=schedule_data)
        schedule_id = create_response.json()["id"]
        
        # Now update the schedule
        update_data = {
            "is_paused": True
        }
        response = client.put(f"/api/reports/schedules/{schedule_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["is_paused"] == True
    
    def test_delete_schedule(self, client, sample_report):
        """Test deleting a schedule"""
        # First create a schedule
        schedule_data = {
            "report_id": sample_report.id,
            "schedule_type": "monthly"
        }
        create_response = client.post("/api/reports/schedules", json=schedule_data)
        schedule_id = create_response.json()["id"]
        
        # Now delete the schedule
        response = client.delete(f"/api/reports/schedules/{schedule_id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
    
    def test_get_schedule_runs(self, client, sample_report):
        """Test getting schedule run history"""
        # First create a schedule
        schedule_data = {
            "report_id": sample_report.id,
            "schedule_type": "daily"
        }
        create_response = client.post("/api/reports/schedules", json=schedule_data)
        schedule_id = create_response.json()["id"]
        
        # Get run history
        response = client.get(f"/api/reports/schedules/{schedule_id}/runs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

# ============================================================================
# REAL-TIME FUNCTIONALITY TESTS
# ============================================================================

class TestRealTimeFunctionality:
    """Test suite for real-time data refresh functionality"""
    
    def test_get_realtime_status(self, client):
        """Test getting real-time connection status"""
        response = client.get("/api/reports/status/realtime")
        assert response.status_code == 200
        data = response.json()
        assert "active_connections" in data
        assert "report_subscriptions" in data
    
    def test_refresh_report(self, client, sample_report):
        """Test manual refresh of a report"""
        response = client.post(f"/api/reports/refresh/{sample_report.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == sample_report.id
        assert "last_generated" in data
    
    def test_refresh_all_reports(self, client):
        """Test refreshing all reports"""
        response = client.post("/api/reports/refresh/all")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "count" in data

# ============================================================================
# DATA ENDPOINTS TESTS
# ============================================================================

class TestDataEndpoints:
    """Test suite for report data endpoints"""
    
    def test_get_report_data(self, client, sample_report, db_session):
        """Test getting report data"""
        # First add some data to the report
        report_data = ReportDataDB(
            report_id=sample_report.id,
            data_type="summary",
            content={"test": "data"}
        )
        db_session.add(report_data)
        db_session.commit()
        
        # Now get the data
        response = client.get(f"/api/reports/{sample_report.id}/data")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_report_data(self, client, sample_report):
        """Test creating report data"""
        data_content = {
            "data_type": "metrics",
            "content": {"metric1": 100, "metric2": 200}
        }
        response = client.post(f"/api/reports/{sample_report.id}/data", json=data_content)
        assert response.status_code == 200
        data = response.json()
        assert data["data_type"] == "metrics"

# ============================================================================
# ANALYTICS ENDPOINTS TESTS
# ============================================================================

class TestAnalyticsEndpoints:
    """Test suite for analytics endpoints"""
    
    def test_get_report_analytics(self, client):
        """Test getting report analytics"""
        response = client.get("/api/reports/analytics/overview")
        assert response.status_code == 200
        data = response.json()
        assert "total_generated" in data
        assert "total_views" in data
        assert "popular_reports" in data
    
    def test_get_validation_status(self, client):
        """Test getting validation status"""
        response = client.get("/api/reports/validation/status")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "valid" in data
        assert "invalid" in data
        assert "pending" in data

# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling:
    """Test suite for error handling"""
    
    def test_create_report_missing_fields(self, client):
        """Test creating report with missing required fields"""
        incomplete_data = {
            "name": "Incomplete Report"
        }
        response = client.post("/api/reports/", json=incomplete_data)
        # Should return error due to missing required fields
        assert response.status_code != 200
    
    def test_update_nonexistent_report(self, client):
        """Test updating a non-existent report"""
        fake_id = str(uuid.uuid4())
        update_data = {"name": "Updated Name"}
        response = client.put(f"/api/reports/{fake_id}", json=update_data)
        assert response.status_code == 404
    
    def test_delete_nonexistent_report(self, client):
        """Test deleting a non-existent report"""
        fake_id = str(uuid.uuid4())
        response = client.delete(f"/api/reports/{fake_id}")
        assert response.status_code == 404
    
    def test_invalid_batch_operation(self, client):
        """Test invalid batch operation"""
        batch_request = {
            "report_ids": [str(uuid.uuid4())],
            "operation": "invalid_operation"
        }
        response = client.post("/api/reports/batch", json=batch_request)
        assert response.status_code == 400
    
    def test_generate_invalid_report_type(self, client):
        """Test generating report with invalid type"""
        generation_request = {
            "report_type": "invalid_type",
            "title": "Invalid Report"
        }
        response = client.post("/api/reports/generate", json=generation_request)
        assert response.status_code != 200

# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])