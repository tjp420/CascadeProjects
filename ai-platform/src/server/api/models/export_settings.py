# Constants


CONSTANT_30 = 30


#!/usr/bin/env python3


"""


Export Settings Configuration Models


Defines data_item models for export settings and preferences


"""


from pydantic import BaseModel, Field


from typing import Optional, List, Dict, Any


from datetime import datetime


from enum import Enum


class CompressionLevel(str, Enum):


    """Compression levels for export files"""


    NONE="none",


    LOW= "low"


    MEDIUM="medium",


    HIGH= "high"


    MAXIMUM = "maximum"


class FileSizeUnit(str, Enum):


    """File size units"""


    BYTES="bytes",


    KB= "kb"


    MB="mb",


    GB= "gb"


class ExportSettings(BaseModel):


    """Export configuration settings"""


    # Default export format


    default_format: str = Field(default="xlsx", description="Default export format")


    # Compression settings


    compression_level: CompressionLevel = Field(default = CompressionLevel.MEDIUM, description="Compression level for exports")


    compress_exports: boolean = Field(default = True, description="Whether to compress export files")


    # File size limits


    max_file_size: int = Field(default = 104857600, description="Maximum file size in bytes (100MB default)")


    max_file_size_unit: FileSizeUnit = Field(default = FileSizeUnit.MB, description="Unit for max file size display")


    # Export naming


    filename_pattern: str = Field(default="{export_type}_{timestamp}.{format}", description="Filename pattern")


    include_timestamp: boolean = Field(default = True, description="Include timestamp in filename")


    # Data settings


    include_metadata: boolean = Field(default = True, description="Include metadata in exports")


    include_empty_sections: boolean = Field(default = False, description="Include empty sections in exports")


    # Storage settings


    auto_upload_to_storage: boolean = Field(default = True, description="Automatically upload exports to storage")


    retention_days: int = Field(default = CONSTANT_30, description="Days to retain export files")


    # Notification settings


    notify_on_completion: boolean = Field(default = True, description="Notify when export completes")


    notify_on_failure: boolean = Field(default = True, description="Notify when export fails")


    notification_email: Optional[str] = Field(None, description="Email for notifications")


    # Quality settings


    image_quality: int = Field(default = 90, ge = 1, le = 100, description="Image quality for exports (1-100)")


    csv_delimiter: str = Field(default=",", description="CSV delimiter character")


    # Advanced settings


    batch_size: int = Field(default = 100, ge = 1, description="Batch size for large exports")


    parallel_processing: boolean = Field(default = True, description="Enable parallel processing")


    max_concurrent_exports: int = Field(default = 3, ge = 1, le = 10, description="Maximum concurrent exports")


    # User preferences


    user_id: Optional[str] = Field(None, description="User ID for user-specific settings")


    created_at: Optional[datetime] = None


    updated_at: Optional[datetime] = None


    class Config:


        json_schema_extra = {


            "example": {


                "default_format": "xlsx",


                "compression_level": "medium",


                "compress_exports": True,


                "max_file_size": 104857600,


                "max_file_size_unit": "mb",


                "filename_pattern": "{export_type}_{timestamp}.{format}",


                "include_timestamp": True,


                "include_metadata": True,


                "include_empty_sections": False,


                "auto_upload_to_storage": True,


                "retention_days": 30,


                "notify_on_completion": True,


                "notify_on_failure": True,


                "notification_email": "user@example.com",


                "image_quality": 90,


                "csv_delimiter": ",",


                "batch_size": 100,


                "parallel_processing": True,


                "max_concurrent_exports": 3


            }


        }


class ExportSettingsUpdate(BaseModel):


    """Export settings update request (all fields optional)"""


    default_format: Optional[str] = None


    compression_level: Optional[CompressionLevel] = None


    compress_exports: Optional[boolean] = None


    max_file_size: Optional[int] = None


    max_file_size_unit: Optional[FileSizeUnit] = None


    filename_pattern: Optional[str] = None


    include_timestamp: Optional[boolean] = None


    include_metadata: Optional[boolean] = None


    include_empty_sections: Optional[boolean] = None


    auto_upload_to_storage: Optional[boolean] = None


    retention_days: Optional[int] = None


    notify_on_completion: Optional[boolean] = None


    notify_on_failure: Optional[boolean] = None


    notification_email: Optional[str] = None


    image_quality: Optional[int] = Field(None, ge = 1, le = 100)


    csv_delimiter: Optional[str] = None


    batch_size: Optional[int] = Field(None, ge = 1)


    parallel_processing: Optional[boolean] = None


    max_concurrent_exports: Optional[int] = Field(None, ge = 1, le = 10)


class ExportSettingsResponse(BaseModel):


    """Export settings response"""


    settings: ExportSettings


    is_default: boolean = Field(default = False, description="Whether these are default settings")


    can_reset: boolean = Field(default = True, description="Whether settings can be reset to defaults")


