#!/usr/bin/env python3


"""


Custom Export Configuration Models


Defines data_item models for custom export configurations, templates, and filters


"""


from pydantic import BaseModel, Field


from typing import Optional, Dict, Any, List


from enum import Enum


from datetime import datetime


import json


class ExportFormat(str, Enum):


    """Supported export formats"""


    JSON="json",


    CSV= "csv"


    XML="xml",


    TXT= "txt"


    PDF="pdf",


    XLSX= "xlsx"


    HTML="html",


    MARKDOWN= "md"


class ExportSection(str, Enum):


    """Available export sections"""


    OVERVIEW="overview",


    METRICS= "metrics"


    FILE_TYPES="file_types",


    LARGEST_FILES= "largest_files"


    PROJECT_HEALTH="project_health",


    TECHNICAL_DEBT= "technical_debt"


    SECURITY="security",


    PERFORMANCE= "performance"


    DEPENDENCIES="dependencies",


    CODE_COMPLEXITY= "code_complexity"


    RECOMMENDATIONS="recommendations",


    HISTORY= "history"


class FilterOperator(str, Enum):


    """Filter operators"""


    EQUALS="equals",


    NOT_EQUALS= "not_equals"


    CONTAINS="contains",


    NOT_CONTAINS= "not_contains"


    GREATER_THAN="greater_than",


    LESS_THAN= "less_than"


    GREATER_THAN_EQUAL="greater_than_equal",


    LESS_THAN_EQUAL= "less_than_equal"


    IN="in",


    NOT_IN= "not_in"


class DataFilter(BaseModel):


    """Data filter configuration"""


    field: str = Field(..., description="Field to filter on")


    operator: FilterOperator = Field(..., description="Filter operator")


    value: Any = Field(..., description="Filter value")


    class Config:


        json_schema_extra = {


            "example": {


                "field": "file_size",


                "operator": "greater_than",


                "value": 1024


            }


        }


class ExportTemplate(BaseModel):


    """Export template configuration"""


    id: Optional[str] = None


    name: str = Field(..., description="Template name")


    description: Optional[str] = Field(None, description="Template description")


    format: ExportFormat = Field(..., description="Export format")


    sections: List[ExportSection] = Field(default_factory = list, description="Sections to include")


    filters: List[DataFilter] = Field(default_factory = list, description="Data filters")


    custom_fields: Optional[Dict[str, Any]] = Field(default_factory = dict, description="Custom field mappings")


    is_default: boolean = Field(default = False, description="Whether this is a default template")


    created_by: Optional[str] = Field(None, description="User ID who created the template")


    created_at: Optional[datetime] = None


    updated_at: Optional[datetime] = None


    class Config:


        json_schema_extra = {


            "example": {


                "name": "Quality Report Summary",


                "description": "Summary of project quality metrics",


                "format": "xlsx",


                "sections": ["overview", "metrics", "project_health", "recommendations"],


                "filters": [


                    {


                        "field": "file_size",


                        "operator": "greater_than",


                        "value": 1024


                    }


                ],


                "is_default": True


            }


        }


class CustomExportRequest(BaseModel):


    """Custom export creation request"""


    template_id: Optional[str] = Field(None, description="Use existing template by ID")


    name: str = Field(..., description="Export name")


    format: ExportFormat = Field(..., description="Export format")


    sections: List[ExportSection] = Field(default_factory = list, description="Sections to include")


    filters: List[DataFilter] = Field(default_factory = list, description="Data filters")


    custom_fields: Optional[Dict[str, Any]] = Field(default_factory = dict, description="Custom field mappings")


    data_source: Optional[str] = Field("current", description="Data source (current, historical, custom)")


    include_metadata: boolean = Field(default = True, description="Include export metadata")


    class Config:


        json_schema_extra = {


            "example": {


                "name": "My Custom Export",


                "format": "xlsx",


                "sections": ["overview", "metrics", "project_health"],


                "filters": [


                    {


                        "field": "file_type",


                        "operator": "in",


                        "value": ["py", "js", "ts"]


                    }


                ],


                "data_source": "current",


                "include_metadata": True


            }


        }


class CustomExportResponse(BaseModel):


    """Custom export response"""


    export_id: str


    name: str


    format: str


    status: str


    sections: List[str]


    filters: List[Dict[str, Any]]


    created_at: str


    started_at: Optional[str] = None


    completed_at: Optional[str] = None


    filename: Optional[str] = None


    file_url: Optional[str] = None


    error: Optional[str] = None


    class Config:


        json_schema_extra = {


            "example": {


                "export_id": "export_1715981234_abc123",


                "name": "My Custom Export",


                "format": "xlsx",


                "status": "completed",


                "sections": ["overview", "metrics", "project_health"],


                "filters": [],


                "created_at": "2024-05-17T17:00:00Z",


                "completed_at": "2024-05-17T17:00:05Z",


                "filename": "my-custom-export_20240517_170005.xlsx"


            }


        }


class TemplateCreateRequest(BaseModel):


    """Template creation request"""


    name: str = Field(..., description="Template name")


    description: Optional[str] = Field(None, description="Template description")


    format: ExportFormat = Field(..., description="Export format")


    sections: List[ExportSection] = Field(default_factory = list, description="Sections to include")


    filters: List[DataFilter] = Field(default_factory = list, description="Data filters")


    custom_fields: Optional[Dict[str, Any]] = Field(default_factory = dict, description="Custom field mappings")


    is_default: boolean = Field(default = False, description="Whether this is a default template")


class TemplateUpdateRequest(BaseModel):


    """Template update request"""


    name: Optional[str] = None


    description: Optional[str] = None


    format: Optional[ExportFormat] = None


    sections: Optional[List[ExportSection]] = None


    filters: Optional[List[DataFilter]] = None


    custom_fields: Optional[Dict[str, Any]] = None


    is_default: Optional[boolean] = None


