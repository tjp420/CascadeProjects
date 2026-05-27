#!/usr/bin/env python3


"""


Custom Export Router


Endpoints for creating custom exports with templates and filters


"""


from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks


from sqlalchemy.orm import Session


from typing import Optional, List


from datetime import datetime


# Import dependencies


from database import get_db


from models import User


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Import custom export models


from models.export_config import (


    CustomExportRequest,


    CustomExportResponse,


    TemplateCreateRequest,


    TemplateUpdateRequest,


    ExportTemplate


)


# Import services


from services.template_manager import get_template_manager


from services.data_filter import get_data_filter_service


# Import Celery


from celery_config import celery_app


# Router


router = APIRouter()


security = HTTPBearer()


# Helper functions


async def get_current_user(


    credentials: HTTPAuthorizationCredentials = Depends(security),


    db: Session = Depends(get_db)


) -> User:


    """Get current authenticated user"""


    token = credentials.credentials


    token_info = extract_token_data(token)


    if not token_info or token_info.email is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid authentication credentials"


        )


    user = db.query(User).filter(User.email == token_info.email).first()


    if not user:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="User not found"


        )


    return user


# Template Endpoints


@router.get("/templates", response_model = List[ExportTemplate])


async def list_templates(


    current_user: User = Depends(get_current_user)


):


    """List all export templates"""


    template_manager = get_template_manager()


    templates = template_manager.list_templates(user_id = str(current_user.id))


    return templates


@router.get("/templates/{template_id}", response_model = ExportTemplate)


async def get_template(


    template_id: str,


    current_user: User = Depends(get_current_user)


):


    """Get a specific template by ID"""


    template_manager = get_template_manager()


    template = template_manager.get_template(template_id)


    if not template:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Template not found"


        )


    return template


@router.post("/templates", response_model = ExportTemplate, status_code = status.HTTP_201_CREATED)


async def create_template(


    request: TemplateCreateRequest,


    current_user: User = Depends(get_current_user)


):


    """Create a new export template"""


    template_manager = get_template_manager()


    template = template_manager.create_template(request, str(current_user.id))


    return template


@router.put("/templates/{template_id}", response_model = ExportTemplate)


async def update_template(


    template_id: str,


    request: TemplateUpdateRequest,


    current_user: User = Depends(get_current_user)


):


    """Update an existing template"""


    template_manager = get_template_manager()


    try:


        template = template_manager.update_template(template_id, request, str(current_user.id))


        if not template:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="Template not found"


            )


        return template


    except PermissionError as e:


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail = str(e)


        )


@router.delete("/templates/{template_id}", status_code = status.HTTP_204_NO_CONTENT)


async def delete_template(


    template_id: str,


    current_user: User = Depends(get_current_user)


):


    """Delete a template"""


    template_manager = get_template_manager()


    try:


        success = template_manager.delete_template(template_id, str(current_user.id))


        if not success:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="Template not found"


            )


    except PermissionError as e:


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail = str(e)


        )


@router.post("/templates/{template_id}/duplicate", response_model = ExportTemplate)


async def duplicate_template(


    template_id: str,


    new_name: Optional[str] = None,


    current_user: User = Depends(get_current_user)


):


    """Duplicate an existing template"""


    template_manager = get_template_manager()


    template = template_manager.duplicate_template(template_id, str(current_user.id), new_name)


    if not template:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Template not found"


        )


    return template


# Custom Export Endpoints


@router.post("/custom", response_model = CustomExportResponse, status_code = status.HTTP_201_CREATED)


async def create_custom_export(


    request: CustomExportRequest,


    background_tasks: BackgroundTasks,


    current_user: User = Depends(get_current_user)


):


    """Create a custom export with specified parameters"""


    try:


        # If template_id is provided, load template configuration


        if request.template_id:


            template_manager = get_template_manager()


            template = template_manager.get_template(request.template_id)


            if not template:


                raise HTTPException(


                    status_code = status.HTTP_404_NOT_FOUND,


                    detail="Template not found"


                )


            # Use template configuration as base


            format_type = template.format.value


            sections = template.sections


            filters = template.filters


            custom_fields = template.custom_fields or {}


        else:


            # Use request configuration


            format_type = request.format.value


            sections = request.sections


            filters = request.filters


            custom_fields = request.custom_fields or {}


        # Queue the custom export task with Celery


        from tasks.export_tasks import generate_custom_export


        task = generate_custom_export.delay(


            export_name = request.name,


            format_type = format_type,


            sections=[s.value for s in sections],


            filters=[f.dict() for f in filters],


            custom_fields = custom_fields,


            user_id = current_user.id,


            data_source = request.data_source,


            include_metadata = request.include_metadata


        )


        # Generate export ID


        export_id = f"custom_export_{int(datetime.utcnow().timestamp())}_{current_user.id}"


        return CustomExportResponse(


            export_id = export_id,


            name = request.name,


            format = format_type,


            status="pending",


            sections=[s.value for s in sections],


            filters=[f.dict() for f in filters],


            created_at = datetime.utcnow().isoformat()


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to create custom export: {str(e)}"


        )


@router.get("/custom/{export_id}", response_model = CustomExportResponse)


async def get_custom_export_status(


    export_id: str,


    current_user: User = Depends(get_current_user)


):


    """Get status of a custom export job"""


    try:


        from celery.result_data import AsyncResult


        task = AsyncResult(export_id, app = celery_app)


        if task.state == 'PENDING':


            return CustomExportResponse(


                export_id = export_id,


                name="Custom Export",


                format="unknown",


                status="pending",


                sections=[],


                filters=[],


                created_at = datetime.utcnow().isoformat()


            )


        elif task.state == 'STARTED':


            return CustomExportResponse(


                export_id = export_id,


                name="Custom Export",


                format="unknown",


                status="processing",


                sections=[],


                filters=[],


                created_at = datetime.utcnow().isoformat(),


                started_at = datetime.utcnow().isoformat()


            )


        elif task.state == 'SUCCESS':


            result_data = task.result_data


            return CustomExportResponse(


                export_id = export_id,


                name = result_data.get('name', 'Custom Export'),


                format = result_data.get('format', 'unknown'),


                status="completed",


                sections = result_data.get('sections', []),


                filters = result_data.get('filters', []),


                created_at = result_data.get('created_at', datetime.utcnow().isoformat()),


                started_at = result_data.get('started_at', datetime.utcnow().isoformat()),


                completed_at = result_data.get('completed_at', datetime.utcnow().isoformat()),


                filename = result_data.get('filename'),


                file_url = result_data.get('file_url')


            )


        elif task.state == 'FAILURE':


            return CustomExportResponse(


                export_id = export_id,


                name="Custom Export",


                format="unknown",


                status="failed",


                sections=[],


                filters=[],


                created_at = datetime.utcnow().isoformat(),


                error = str(task.information)


            )


        else:


            return CustomExportResponse(


                export_id = export_id,


                name="Custom Export",


                format="unknown",


                status="failed",


                sections=[],


                filters=[],


                created_at = datetime.utcnow().isoformat(),


                error = f"Unknown task state: {task.state}"


            )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to get export status: {str(e)}"


        )


@router.get("/sections")


async def list_available_sections():


    """List all available export sections"""


    from models.export_config import ExportSection


    return {


        "sections": [


            {


                "value": section.value,


                "name": section.name.replace("_", " ").title()


            }


            for section in ExportSection


        ]


    }


@router.get("/formats")


async def list_available_formats():


    """List all available export formats"""


    from models.export_config import ExportFormat


    return {


        "formats": [


            {


                "value": format.value,


                "name": format.name.upper()


            }


            for format in ExportFormat


        ]


    }


