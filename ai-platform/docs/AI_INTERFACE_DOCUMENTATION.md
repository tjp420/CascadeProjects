
# Universal AI Interface Documentation

## Purpose
This interface allows any AI to discover, understand, and interact with local services.

## Available Services

### simple_server
- **URL**: http://localhost:8081
- **Description**: Basic HTTP server for testing and AI communication
- **Status**: healthy
- **Capabilities**: http_get, http_post, json_response, timestamp
- **Endpoints**:
  - `GET /`: Main endpoint - returns server info and timestamp
  - `GET /status`: Health check endpoint

### ai_guardrails
- **URL**: http://localhost:8080
- **Description**: AI Guardrails Dashboard - Project intelligence monitoring
- **Status**: healthy
- **Capabilities**: project_monitoring, metrics, real_time_data, project_analysis
- **Endpoints**:
  - `GET /`: Main dashboard HTML interface
  - `GET /api/data`: Complete project metrics and statistics

## Usage Examples

### List all services:
```python
interface = AIInterface()
services = interface.list_all_services()
print(services)
```

### Call a specific endpoint:
```python
result = interface.call_endpoint("service_name", "/endpoint", "POST", {"key": "value"})
print(result)
```

### Check service health:
```python
health = interface.check_service_health("service_name")
print(health)
```

## Interface Capabilities
project_monitoring, real_time_data, timestamp, json_response, project_analysis, http_get, http_post, metrics

## Metadata
{
  "version": "1.0.0",
  "created": "2026-04-08T11:03:07.935946",
  "purpose": "Universal AI Interface for Local Services",
  "author": "AI-Assisted Development"
}
