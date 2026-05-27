#!/usr/bin/env python3
"""
Backup Configuration Models
Data models for backup system configuration and settings
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class BackupType(str, Enum):
    """Backup type enumeration"""
    FULL = "full"
    INCREMENTAL = "incremental"
    DIFFERENTIAL = "differential"
    SELECTIVE = "selective"

class CompressionLevel(str, Enum):
    """Compression level enumeration"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    MAXIMUM = "maximum"

class EncryptionType(str, Enum):
    """Encryption type enumeration"""
    NONE = "none"
    AES256 = "aes256"
    CHACHA20 = "chacha20"

class BackupPattern(BaseModel):
    """Include/exclude pattern configuration"""
    pattern: str = Field(..., description="File pattern (glob syntax)")
    enabled: bool = Field(True, description="Whether this pattern is active")
    description: Optional[str] = Field(None, description="Pattern description")

class BackupSchedule(BaseModel):
    """Backup schedule configuration"""
    enabled: bool = Field(False, description="Whether scheduling is enabled")
    frequency: str = Field("daily", description="Schedule frequency (daily, weekly, monthly)")
    time: str = Field("02:00", description="Time of day for scheduled backups (HH:MM)")
    day_of_week: Optional[int] = Field(None, description="Day of week for weekly backups (0-6)")
    day_of_month: Optional[int] = Field(None, description="Day of month for monthly backups (1-31)")
    max_backups: int = Field(10, description="Maximum number of backups to retain")
    cleanup_old: bool = Field(True, description="Whether to automatically clean old backups")

class CloudStorageConfig(BaseModel):
    """Cloud storage configuration"""
    enabled: bool = Field(False, description="Whether cloud storage is enabled")
    provider: str = Field("s3", description="Cloud provider (s3, gdrive, github)")
    bucket_name: Optional[str] = Field(None, description="Storage bucket/name")
    region: Optional[str] = Field(None, description="Storage region")
    access_key: Optional[str] = Field(None, description="Access key (for S3)")
    secret_key: Optional[str] = Field(None, description="Secret key (for S3)")
    endpoint_url: Optional[str] = Field(None, description="Custom endpoint URL")
    sync_on_create: bool = Field(True, description="Sync to cloud immediately after creation")
    sync_on_schedule: bool = Field(True, description="Sync to cloud on scheduled backups")

class BackupConfig(BaseModel):
    """Main backup configuration"""
    # Basic settings
    backup_name: Optional[str] = Field(None, description="Custom backup name")
    backup_type: BackupType = Field(BackupType.FULL, description="Type of backup")
    compression: CompressionLevel = Field(CompressionLevel.MEDIUM, description="Compression level")
    encryption: EncryptionType = Field(EncryptionType.NONE, description="Encryption type")
    encryption_key: Optional[str] = Field(None, description="Encryption key (if enabled)")
    
    # File selection
    include_patterns: List[BackupPattern] = Field(
        default_factory=lambda: [
            BackupPattern(pattern="src/**", description="Source code files"),
            BackupPattern(pattern="web/**", description="Web application files"),
            BackupPattern(pattern="tests/**", description="Test files"),
            BackupPattern(pattern="tools/**", description="Tools and utilities"),
            BackupPattern(pattern="docs/**", description="Documentation"),
            BackupPattern(pattern="*.md", description="Markdown files"),
            BackupPattern(pattern="*.json", description="JSON configuration files"),
            BackupPattern(pattern="*.py", description="Python files"),
            BackupPattern(pattern="*.js", description="JavaScript files"),
            BackupPattern(pattern=".env.example", description="Environment template")
        ],
        description="Files and directories to include"
    )
    
    exclude_patterns: List[BackupPattern] = Field(
        default_factory=lambda: [
            BackupPattern(pattern="node_modules/**", description="Node.js dependencies"),
            BackupPattern(pattern="__pycache__/**", description="Python cache files"),
            BackupPattern(pattern="*.pyc", description="Python compiled files"),
            BackupPattern(pattern=".git/**", description="Git repository files"),
            BackupPattern(pattern="backups/**", description="Existing backup files"),
            BackupPattern(pattern="dist/**", description="Distribution files"),
            BackupPattern(pattern="build/**", description="Build artifacts"),
            BackupPattern(pattern=".pytest_cache/**", description="Pytest cache"),
            BackupPattern(pattern="*.log", description="Log files")
        ],
        description="Files and directories to exclude"
    )
    
    # Advanced options
    follow_symlinks: bool = Field(False, description="Follow symbolic links")
    preserve_permissions: bool = Field(True, description="Preserve file permissions")
    preserve_timestamps: bool = Field(True, description="Preserve file timestamps")
    verify_integrity: bool = Field(True, description="Verify backup integrity after creation")
    
    # Metadata options
    include_metadata: bool = Field(True, description="Include backup metadata")
    include_git_info: bool = Field(True, description="Include git repository information")
    include_dependencies: bool = Field(False, description="Include dependency information")
    include_system_info: bool = Field(False, description="Include system information")
    
    # Scheduling
    schedule: BackupSchedule = Field(default_factory=BackupSchedule, description="Backup schedule")
    
    # Cloud storage
    cloud_storage: CloudStorageConfig = Field(default_factory=CloudStorageConfig, description="Cloud storage settings")
    
    # Notifications
    notify_on_success: bool = Field(False, description="Send notification on successful backup")
    notify_on_failure: bool = Field(True, description="Send notification on backup failure")
    notification_email: Optional[str] = Field(None, description="Email address for notifications")

class BackupMetadata(BaseModel):
    """Backup metadata model"""
    name: str = Field(..., description="Backup name")
    timestamp: datetime = Field(..., description="Backup creation timestamp")
    backup_type: BackupType = Field(..., description="Type of backup")
    size: int = Field(..., description="Backup size in bytes")
    checksum: str = Field(..., description="SHA256 checksum")
    files_count: int = Field(..., description="Number of files in backup")
    compression: bool = Field(..., description="Whether compression was used")
    encryption: EncryptionType = Field(..., description="Encryption type used")
    
    # Additional metadata
    project_root: str = Field(..., description="Project root directory")
    backup_config: Dict[str, Any] = Field(..., description="Backup configuration used")
    git_info: Optional[Dict[str, Any]] = Field(None, description="Git repository information")
    dependencies: Optional[List[Dict[str, Any]]] = Field(None, description="Dependency information")
    system_info: Optional[Dict[str, Any]] = Field(None, description="System information")
    
    # Status information
    status: str = Field("completed", description="Backup status")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    cloud_synced: bool = Field(False, description="Whether synced to cloud storage")
    cloud_locations: List[str] = Field(default_factory=list, description="Cloud storage locations")

class BackupJob(BaseModel):
    """Backup job model for tracking ongoing operations"""
    job_id: str = Field(..., description="Unique job identifier")
    backup_name: str = Field(..., description="Backup name")
    backup_type: BackupType = Field(..., description="Type of backup")
    status: str = Field("pending", description="Job status (pending, running, completed, failed)")
    progress: float = Field(0.0, description="Progress percentage (0-100)")
    started_at: Optional[datetime] = Field(None, description="Job start time")
    completed_at: Optional[datetime] = Field(None, description="Job completion time")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    files_processed: int = Field(0, description="Number of files processed")
    total_files: int = Field(0, description="Total number of files to process")
    bytes_processed: int = Field(0, description="Bytes processed")
    total_bytes: int = Field(0, description="Total bytes to process")

class BackupRestoreRequest(BaseModel):
    """Backup restore request model"""
    backup_name: str = Field(..., description="Backup name to restore")
    target_directory: Optional[str] = Field(None, description="Target directory for restore")
    overwrite_existing: bool = Field(False, description="Overwrite existing files")
    restore_permissions: bool = Field(True, description="Restore file permissions")
    restore_timestamps: bool = Field(True, description="Restore file timestamps")
    verify_integrity: bool = Field(True, description="Verify restore integrity")
    dry_run: bool = Field(False, description="Perform dry run without actual restore")

class BackupRestoreResult(BaseModel):
    """Backup restore result model"""
    success: bool = Field(..., description="Whether restore was successful")
    backup_name: str = Field(..., description="Backup name that was restored")
    target_directory: str = Field(..., description="Target directory for restore")
    files_restored: int = Field(..., description="Number of files restored")
    bytes_restored: int = Field(..., description="Number of bytes restored")
    errors: List[str] = Field(default_factory=list, description="List of errors during restore")
    warnings: List[str] = Field(default_factory=list, description="List of warnings during restore")
    integrity_verified: bool = Field(True, description="Whether backup integrity was verified")
    restore_time: datetime = Field(..., description="Restore completion timestamp")
