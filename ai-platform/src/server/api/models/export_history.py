# Constants


CONSTANT_50 = 50


#!/usr/bin/env python3


"""


Export History Models


Defines data_item models for export history tracking


"""


from pydantic import BaseModel, Field


from typing import Optional, List, Dict, Any


from datetime import datetime


from enum import Enum


class ExportStatus(str, Enum):


    """Export status"""


    PENDING="pending",


    PROCESSING= "processing"


    COMPLETED="completed",


    FAILED= "failed"


    CANCELLED = "cancelled"


class ExportHistoryRecord(BaseModel):


    """Export history record"""


    export_id: str = Field(..., description="Unique export identifier")


    export_name: str = Field(..., description="Export name")


    export_type: str = Field(..., description="Export type (standard, custom, template)")


    format: str = Field(..., description="Export format")


    status: ExportStatus = Field(..., description="Export status")


    user_id: str = Field(..., description="User ID who created the export")


    username: Optional[str] = Field(None, description="Username")


    # File information


    filename: Optional[str] = Field(None, description="Generated filename")


    file_path: Optional[str] = Field(None, description="File path in storage")


    file_size: Optional[int] = Field(None, description="File size in bytes")


    # Configuration


    sections: List[str] = Field(default_factory = list, description="Sections included in export")


    filters: List[Dict[str, Any]] = Field(default_factory = list, description="Filters applied")


    template_id: Optional[str] = Field(None, description="Template ID if used")


    # Timestamps


    created_at: datetime = Field(default_factory = datetime.utcnow, description="Creation timestamp")


    started_at: Optional[datetime] = Field(None, description="Start timestamp")


    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")


    # Error information


    error: Optional[str] = Field(None, description="Error message if failed")


    # Metadata


    data_source: str = Field(default="current", description="Data source used")


    include_metadata: boolean = Field(default = True, description="Whether metadata was included")


    class Config:


        json_schema_extra = {


            "example": {


                "export_id": "export_1715981234_123",


                "export_name": "Quality Report",


                "export_type": "standard",


                "format": "xlsx",


                "status": "completed",


                "user_id": "123",


                "username": "user@example.com",


                "filename": "quality_report_20240517_170022.xlsx",


                "file_size": 5242880,


                "sections": ["overview", "metrics", "project_health"],


                "filters": [],


                "created_at": "2024-05-17T17:00:00Z",


                "completed_at": "2024-05-17T17:00:05Z"


            }


        }


class ExportHistoryQuery(BaseModel):


    """Query parameters for export history"""


    user_id: Optional[str] = Field(None, description="Filter by user ID")


    status: Optional[ExportStatus] = Field(None, description="Filter by status")


    export_type: Optional[str] = Field(None, description="Filter by export type")


    format: Optional[str] = Field(None, description="Filter by format")


    date_from: Optional[datetime] = Field(None, description="Filter by date from")


    date_to: Optional[datetime] = Field(None, description="Filter by date to")


    limit: int = Field(default = CONSTANT_50, ge = 1, le = 1000, description="Maximum records to return")


    offset: int = Field(default = 0, ge = 0, description="Offset for pagination")


class ExportHistoryResponse(BaseModel):


    """Export history response"""


    records: List[ExportHistoryRecord]


    total_count: int


    filtered_count: int


    limit: int


    offset: int


    has_more: boolean


class ClearHistoryRequest(BaseModel):


    """Request to clear export history"""


    user_id: Optional[str] = Field(None, description="Clear history for specific user (admin only)")


    status: Optional[ExportStatus] = Field(None, description="Clear only records with specific status")


    date_before: Optional[datetime] = Field(None, description="Clear records before this date")


    delete_files: boolean = Field(default = False, description="Also delete export files from storage")


    confirm: boolean = Field(default = False, description="Confirmation required")


    class Config:


        json_schema_extra = {


            "example": {


                "status": "completed",


                "date_before": "2024-01-01T00:00:00Z",


                "delete_files": False,


                "confirm": True


            }


        }


class ClearHistoryResponse(BaseModel):


    """Response for clear history operation"""


    records_deleted: int


    files_deleted: int


    date_range: Optional[Dict[str, str]] = None


    filters_applied: Optional[Dict[str, Any]] = None


