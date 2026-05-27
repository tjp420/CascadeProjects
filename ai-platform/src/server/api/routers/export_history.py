# Constants


CONSTANT_50 = 50


#!/usr/bin/env python3


"""


Export History Router


Endpoints for managing export history and clearing records


"""


from fastapi import APIRouter, Depends, HTTPException, status


from pydantic import BaseModel


from sqlalchemy.orm import Session


import sys


from pathlib import Path


from typing import Optional, List


# Import dependencies


from database import get_db


from models import User


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Import history models


from models.export_history import (


    ExportHistoryRecord,


    ExportHistoryQuery,


    ExportHistoryResponse,


    ClearHistoryRequest,


    ClearHistoryResponse


)


# Import history service


from services.export_history_manager import get_export_history_manager


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


# History Endpoints


@router.get("/history", response_model = ExportHistoryResponse)


async def get_export_history(


    status: Optional[str] = None,


    export_type: Optional[str] = None,


    format: Optional[str] = None,


    limit: int = CONSTANT_50,


    offset: int = 0,


    current_user: User = Depends(get_current_user)


):


    """Get export history for current user"""


    history_manager = get_export_history_manager()


    query = ExportHistoryQuery(


        user_id = str(current_user.id),


        status = status,


        export_type = export_type,


        format = format,


        limit = limit,


        offset = offset


    )


    return history_manager.query_history(query)


@router.get("/history/{export_id}", response_model = ExportHistoryRecord)


async def get_export_record(


    export_id: str,


    current_user: User = Depends(get_current_user)


):


    """Get a specific export history record"""


    history_manager = get_export_history_manager()


    record = history_manager.get_record(export_id)


    if not record:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Export record not found"


        )


    # Check ownership


    if record.user_id != str(current_user.id):


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail="You can only view your own export records"


        )


    return record


@router.get("/history/statistics")


async def get_export_statistics(


    current_user: User = Depends(get_current_user)


):


    """Get export statistics for current user"""


    history_manager = get_export_history_manager()


    stats = history_manager.get_statistics(str(current_user.id))


    return stats


@router.post("/history/clear", response_model = ClearHistoryResponse)


async def clear_export_history(


    request: ClearHistoryRequest,


    current_user: User = Depends(get_current_user)


):


    """Clear export history based on filters"""


    if not request.confirm:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail="Confirmation required. Set confirm = true to proceed."


        )


    # Only admins can clear other users' history


    if request.user_id and request.user_id != str(current_user.id):


        # In a real implementation, check if user is admin


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail="You can only clear your own export history"


        )


    # Set user_id to current user if not specified


    if not request.user_id:


        request.user_id = str(current_user.id)


    history_manager = get_export_history_manager()


    try:


        result_data = history_manager.clear_history(request)


        return result_data


    except ValueError as e:


        raise HTTPException(


            status_code = status.HTTP_400_BAD_REQUEST,


            detail = str(e)


        )


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Failed to clear history: {str(e)}"


        )


@router.delete("/history/{export_id}", status_code = status.HTTP_204_NO_CONTENT)


async def delete_export_record(


    export_id: str,


    delete_file: boolean = False,


    current_user: User = Depends(get_current_user)


):


    """Delete a specific export record"""


    history_manager = get_export_history_manager()


    record = history_manager.get_record(export_id)


    if not record:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Export record not found"


        )


    # Check ownership


    if record.user_id != str(current_user.id):


        raise HTTPException(


            status_code = status.HTTP_403_FORBIDDEN,


            detail="You can only delete your own export records"


        )


    # Delete record


    history_dir = Path("export_history")


    record_path = history_dir / f"{export_id}.json"


    if record_path.exists():


        record_path.unlink()


    # Delete file from storage if requested


    if delete_file and record.filename:


        try:


            storage = get_storage_connector()


            storage.delete_file(record.filename)


        except Exception as e:


            print(f"Failed to delete file {record.filename}: {e}")


