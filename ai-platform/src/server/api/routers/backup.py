#!/usr/bin/env python3
"""
Backup Router for FastAPI
Provides REST API endpoints for backup and recovery operations
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from typing import List, Dict, Optional
import os
import json
from datetime import datetime
from pathlib import Path

from backup_system import BackupSystem
from models.backup_config import BackupConfig

router = APIRouter(prefix="/api/backup", tags=["backup"])

# Global backup system instance
backup_system = BackupSystem()

@router.post("/create")
async def create_backup(
    background_tasks: BackgroundTasks,
    backup_name: Optional[str] = None,
    include_patterns: Optional[List[str]] = None,
    exclude_patterns: Optional[List[str]] = None,
    compression: bool = True
):
    """Create a new backup"""
    try:
        result = backup_system.create_backup(
            backup_name=backup_name,
            include_patterns=include_patterns,
            exclude_patterns=exclude_patterns
        )
        
        if result["success"]:
            # Add background task for backup processing notification
            background_tasks.add_task(log_backup_creation, result["backup_name"])
            return result
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_backups():
    """List all available backups"""
    try:
        backups = backup_system.list_backups()
        return {
            "success": True,
            "backups": backups,
            "count": len(backups)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore/{backup_name}")
async def restore_backup(
    backup_name: str,
    target_dir: Optional[str] = None,
    background_tasks: BackgroundTasks = None
):
    """Restore a backup"""
    try:
        result = backup_system.restore_backup(backup_name, target_dir)
        
        if result["success"]:
            if background_tasks:
                background_tasks.add_task(log_backup_restoration, backup_name)
            return result
        else:
            raise HTTPException(status_code=404, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete/{backup_name}")
async def delete_backup(backup_name: str):
    """Delete a backup"""
    try:
        result = backup_system.delete_backup(backup_name)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=404, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{backup_name}")
async def download_backup(backup_name: str):
    """Download a backup file"""
    try:
        backup_path = backup_system.backup_dir / f'{backup_name}.tar.gz'
        
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="Backup not found")
        
        return FileResponse(
            path=str(backup_path),
            filename=f'{backup_name}.tar.gz',
            media_type='application/gzip'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{backup_name}")
async def get_backup_status(backup_name: str):
    """Get backup status and metadata"""
    try:
        metadata_path = backup_system.backup_dir / f'{backup_name}.metadata.json'
        
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail="Backup metadata not found")
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Add additional status information
        backup_path = backup_system.backup_dir / f'{backup_name}.tar.gz'
        metadata["exists"] = backup_path.exists()
        metadata["size_mb"] = round(backup_path.stat().st_size / (1024*1024), 2) if backup_path.exists() else 0
        
        return {
            "success": True,
            "metadata": metadata
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/schedule")
async def schedule_backup(
    background_tasks: BackgroundTasks,
    schedule_config: Dict
):
    """Schedule a backup (basic implementation)"""
    try:
        # For now, just create the backup immediately
        # In future, integrate with a proper scheduler like Celery
        backup_name = schedule_config.get("name", f"scheduled_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        
        result = backup_system.create_backup(
            backup_name=backup_name,
            include_patterns=schedule_config.get("include_patterns"),
            exclude_patterns=schedule_config.get("exclude_patterns")
        )
        
        if result["success"]:
            background_tasks.add_task(log_scheduled_backup, backup_name, schedule_config)
            return result
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
async def get_backup_config():
    """Get current backup configuration"""
    try:
        config = {
            "max_backups": backup_system.max_backups,
            "compression": backup_system.compression,
            "backup_dir": str(backup_system.backup_dir),
            "default_include_patterns": [
                'src/**',
                'web/**',
                'tests/**',
                'tools/**',
                'docs/**',
                '*.md',
                '*.json',
                '*.py',
                '*.js',
                '.env.example'
            ],
            "default_exclude_patterns": [
                'node_modules/**',
                '__pycache__/**',
                '*.pyc',
                '.git/**',
                'backups/**',
                'dist/**',
                'build/**',
                '.pytest_cache/**',
                '*.log'
            ]
        }
        return {
            "success": True,
            "config": config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config")
async def update_backup_config(config: Dict):
    """Update backup configuration"""
    try:
        if "max_backups" in config:
            backup_system.max_backups = config["max_backups"]
        if "compression" in config:
            backup_system.compression = config["compression"]
        
        return {
            "success": True,
            "message": "Configuration updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_backup_stats():
    """Get backup statistics"""
    try:
        backups = backup_system.list_backups()
        backup_dir = backup_system.backup_dir
        
        # Calculate total size
        total_size = 0
        for backup in backups:
            backup_path = backup_dir / f'{backup["name"]}.tar.gz'
            if backup_path.exists():
                total_size += backup_path.stat().st_size
        
        # Get recent activity
        recent_backups = [b for b in backups if 
                         (datetime.now() - datetime.fromisoformat(b["timestamp"])).days <= 7]
        
        stats = {
            "total_backups": len(backups),
            "total_size_mb": round(total_size / (1024*1024), 2),
            "recent_backups": len(recent_backups),
            "oldest_backup": backups[-1]["timestamp"] if backups else None,
            "newest_backup": backups[0]["timestamp"] if backups else None,
            "backup_directory_exists": backup_dir.exists(),
            "backup_directory_path": str(backup_dir)
        }
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Background task functions
async def log_backup_creation(backup_name: str):
    """Log backup creation for monitoring"""
    print(f"Backup created successfully: {backup_name}")

async def log_backup_restoration(backup_name: str):
    """Log backup restoration for monitoring"""
    print(f"Backup restored successfully: {backup_name}")

async def log_scheduled_backup(backup_name: str, config: Dict):
    """Log scheduled backup for monitoring"""
    print(f"Scheduled backup created: {backup_name} with config: {config}")
