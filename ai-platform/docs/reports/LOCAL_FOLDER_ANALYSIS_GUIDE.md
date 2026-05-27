# Local Folder Analysis Guide

This guide explains how to add and analyze local folder locations in the AI Code Analysis dashboard.

## Overview

The system now supports analyzing local folder paths (e.g., `C:\Users\Trevor\CascadeProjects\`) in addition to remote repositories. This allows you to analyze any project on your local file system.

## Database Changes

A new `local_path` column has been added to the `projects` table to store local file system paths.

### Migration

Run the database migration to add the new column:

```bash
cd web/api
alembic upgrade head
```

Or manually if needed:

```bash
python -c "
from alembic.config import Config
from alembic import command
alembic_cfg = Config('alembic.ini')
command.upgrade(alembic_cfg, 'head')
"
```

## API Changes

### Project Model Updates

The `Project` model now includes:
- `local_path` (String, 1000 chars, nullable): Local file system path for analysis

### Pydantic Models Updated

- `ProjectCreate`: Added `local_path` field
- `ProjectUpdate`: Added `local_path` field  
- `ProjectResponse`: Added `local_path` field

### Analysis Router Updates

The analysis endpoints now support:
- `project_path` parameter in `CodeStructureRequest`
- `project_id` parameter to look up project from database
- Automatic resolution of `local_path` from project settings

## Usage

### Creating a Project with Local Path

**POST** `/api/projects`

```json
{
  "name": "My Local Project",
  "description": "Analysis of local CascadeProjects folder",
  "local_path": "C:\\Users\\Trevor\\CascadeProjects\\",
  "settings": {}
}
```

**Response:**

```json
{
  "id": 1,
  "user_id": 1,
  "name": "My Local Project",
  "description": "Analysis of local CascadeProjects folder",
  "repo_url": null,
  "repo_provider": null,
  "local_path": "C:\\Users\\Trevor\\CascadeProjects\\",
  "settings": {},
  "is_active": true,
  "created_at": "2026-05-18T05:02:00",
  "updated_at": "2026-05-18T05:02:00",
  "last_analyzed": null
}
```

### Analyzing a Local Project

**Option 1: Using project_id**

**GET** `/api/analysis/code-structure?project_id=1`

The system will:
1. Look up the project by ID
2. Retrieve the `local_path` from the project
3. Analyze the files in that directory

**Option 2: Using direct path**

**GET** `/api/analysis/code-structure?project_path=C:\\Users\\Trevor\\CascadeProjects\\`

The system will analyze the specified path directly.

### Updating a Project's Local Path

**PUT** `/api/projects/{project_id}`

```json
{
  "local_path": "C:\\Users\\Trevor\\AnotherProject\\"
}
```

## Code Analysis Module Updates

The `CodeAnalysisAPI` class now supports custom project paths:

```python
# Analyze with custom path
code_analysis_api.analyze_code_structure(project_path="C:\\Users\\Trevor\\CascadeProjects\\")

# Analyze with default path (current project)
code_analysis_api.analyze_code_structure()
```

The implementation:
1. Temporarily sets `project_root` to the custom path
2. Performs the analysis
3. Restores the original `project_root` after analysis
4. Handles errors gracefully with proper cleanup

## Security Considerations

- Path validation should be added to prevent directory traversal attacks
- Consider implementing a whitelist of allowed directories
- Ensure proper file system permissions are in place
- Validate that paths exist and are accessible before analysis

## Future Enhancements

Potential improvements:
1. Add path validation and sanitization
2. Implement directory whitelist/blacklist
3. Add support for relative paths
4. Create UI components for folder selection
5. Add batch analysis for multiple local projects
6. Implement path normalization across operating systems

## Troubleshooting

### Migration Issues

If the migration fails:
```bash
# Check current migration status
alembic current

# Force upgrade (use with caution)
alembic upgrade head --sql
```

### Path Not Found

If you get "Path not found" errors:
- Ensure the path is absolute
- Check that the path exists on the server
- Verify file system permissions
- Use forward slashes or escaped backslashes in JSON

### Analysis Not Using Custom Path

If analysis uses default path instead of custom:
- Verify `project_id` is correct
- Check that `local_path` is set in the project
- Ensure the analysis endpoint is using the updated code
- Check server logs for path resolution errors

## Example Workflow

```bash
# 1. Run database migration
cd web/api
alembic upgrade head

# 2. Start the API server
python server.py

# 3. Create a project with local path
curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "CascadeProjects Analysis",
    "local_path": "C:\\Users\\Trevor\\CascadeProjects\\"
  }'

# 4. Analyze the project
curl "http://localhost:8080/api/analysis/code-structure?project_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Files Modified

1. `web/api/models/__init__.py` - Added `local_path` column to Project model
2. `web/api/routers/projects.py` - Updated Pydantic models and create endpoint
3. `web/api/routers/analysis.py` - Added project path resolution logic
4. `web/api/code_analysis.py` - Updated `analyze_code_structure` to accept custom path
5. `web/api/alembic/versions/20260518_0502_add_local_path_to_projects.py` - Database migration
