#!/usr/bin/env python3


"""


Export Settings Router


Endpoints for managing export configuration settings


"""


from fastapi import APIRouter, Depends, HTTPException, status


from sqlalchemy.orm import Session


from typing import Optional


# Import dependencies


from database import get_db


from models import User


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Import settings models


from models.export_settings import ExportSettings, ExportSettingsUpdate, ExportSettingsResponse


# Import settings service


from services.settings_manager import get_settings_manager


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


# Settings Endpoints


@router.get("/settings", response_model = ExportSettingsResponse)


async def get_export_settings(


    current_user: User = Depends(get_current_user)


):


    """Get export settings for current user"""


    settings_manager = get_settings_manager()


    settings = settings_manager.get_settings(str(current_user.id))


    return ExportSettingsResponse(


        settings = settings,


        is_default = settings.user_id == "default",


        can_reset = settings.user_id != "default"


    )


@router.put("/settings", response_model = ExportSettingsResponse)


async def update_export_settings(


    update: ExportSettingsUpdate,


    current_user: User = Depends(get_current_user)


):


    """Update export settings for current user"""


    settings_manager = get_settings_manager()


    try:


        settings = settings_manager.update_settings(str(current_user.id), update)


        return ExportSettingsResponse(


            settings = settings,


            is_default = False,


            can_reset = True


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to update settings: {str(e)}"


        )


@router.post("/settings/reset", response_model = ExportSettingsResponse)


async def reset_export_settings(


    current_user: User = Depends(get_current_user)


):


    """Reset export settings to defaults"""


    settings_manager = get_settings_manager()


    try:


        settings = settings_manager.reset_settings(str(current_user.id))


        return ExportSettingsResponse(


            settings = settings,


            is_default = True,


            can_reset = True


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to reset settings: {str(e)}"


        )


@router.delete("/settings", status_code = status.HTTP_204_NO_CONTENT)


async def delete_export_settings(


    current_user: User = Depends(get_current_user)


):


    """Delete user-specific settings (reverts to defaults)"""


    settings_manager = get_settings_manager()


    try:


        settings_manager.delete_settings(str(current_user.id))


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to delete settings: {str(e)}"


        )


@router.post("/settings/validate")


async def validate_export_settings(


    settings: ExportSettings,


    current_user: User = Depends(get_current_user)


):


    """Validate export settings"""


    settings_manager = get_settings_manager()


    validation_result = settings_manager.validate_settings(settings)


    return validation_result


@router.get("/settings/summary")


async def get_export_settings_summary(


    current_user: User = Depends(get_current_user)


):


    """Get summary of current export settings"""


    settings_manager = get_settings_manager()


    summary = settings_manager.get_settings_summary(str(current_user.id))


    return summary


@router.get("/settings/default", response_model = ExportSettings)


async def get_default_export_settings(


    current_user: User = Depends(get_current_user)


):


    """Get default export settings"""


    settings_manager = get_settings_manager()


    settings = settings_manager.get_default_settings()


    return settings


