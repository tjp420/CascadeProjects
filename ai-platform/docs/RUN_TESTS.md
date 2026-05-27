# Reports API Test Suite

This document describes how to run the comprehensive test suite for the Reports API.

## Test Coverage

The test suite covers the following functionality:

### 1. CRUD Operations Tests
- Get all reports
- Get specific report by ID
- Create new report
- Update existing report
- Delete report
- Filter reports by type

### 2. Advanced Search and Filtering Tests
- Search reports by term
- Filter by report type
- Filter by status
- Batch operations (delete, archive, publish)
- Version history retrieval

### 3. Report Generation Tests
- Get available generation types
- Generate performance reports
- Generate quality reports
- Generate security reports
- Generate resources reports

### 4. Report History Tests
- Get report change history
- Add history entries
- Version tracking

### 5. Report Scheduling Tests
- Create schedules
- Get all schedules
- Get specific schedule
- Update schedules
- Delete schedules
- Get schedule run history

### 6. Real-time Functionality Tests
- Get real-time connection status
- Manual report refresh
- Refresh all reports

### 7. Data Endpoints Tests
- Get report data
- Create report data

### 8. Analytics Endpoints Tests
- Get report analytics
- Get validation status

### 9. Error Handling Tests
- Missing required fields
- Non-existent resources
- Invalid operations
- Invalid report types

## Prerequisites

Install the required test dependencies:

```bash
pip install pytest pytest-asyncio httpx
```

## Running Tests

### Run All Tests

```bash
python test_reports_api.py
```

Or using pytest directly:

```bash
pytest test_reports_api.py -v
```

### Run Specific Test Class

```bash
pytest test_reports_api.py::TestReportCRUD -v
```

### Run Specific Test Method

```bash
pytest test_reports_api.py::TestReportCRUD::test_create_report -v
```

### Run with Coverage

```bash
pytest test_reports_api.py --cov=reports_api --cov-report=html
```

## Test Configuration

The tests use an in-memory SQLite database for fast, isolated testing. The database is created fresh for each test function and cleaned up afterward.

## Test Fixtures

The test suite uses the following fixtures:

- `db_session`: Creates a fresh database session for each test
- `client`: Creates a test client for making API requests
- `sample_report_data`: Provides sample report data for testing
- `sample_report`: Creates a sample report in the database

## Expected Results

All tests should pass with the following expected behaviors:

- CRUD operations should successfully create, read, update, and delete reports
- Search and filtering should return appropriate results
- Report generation should create reports with proper data
- History tracking should maintain change logs
- Scheduling should create and manage schedules
- Real-time endpoints should return connection status
- Error handling should return appropriate HTTP status codes

## Continuous Integration

To integrate with CI/CD pipelines:

```bash
# Run tests in CI environment
pytest test_reports_api.py -v --tb=short --junitxml=results.xml
```

## Troubleshooting

### Import Errors

If you encounter import errors, ensure you're running the tests from the `api/` directory:

```bash
cd C:/Users/Trevor/CascadeProjects/web/api
python test_reports_api.py
```

### Database Errors

The tests use an in-memory database, so no external database setup is required. If you encounter database errors, ensure SQLite is properly installed.

### Dependency Issues

Install all required dependencies:

```bash
pip install fastapi uvicorn sqlalchemy pydantic pytest pytest-asyncio httpx
```

## Test Maintenance

When adding new features to the Reports API, add corresponding tests to maintain comprehensive coverage. Follow the existing test patterns and structure.

## Performance

The test suite is designed to run quickly:
- Average test execution time: ~2-3 seconds
- Uses in-memory database for fast setup/teardown
- Parallel test execution support available via pytest-xdist