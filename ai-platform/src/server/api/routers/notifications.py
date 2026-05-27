# Constants


CONSTANT_50 = 50


#!/usr/bin/env python3


"""


Notifications Router for FastAPI


This module provides API endpoints for managing user notifications and alerts.


It handles notification creation, retrieval, marking as read, and deletion with


support for different notification types (information, warning, error, success).


Endpoints:


    - GET /api/notifications: List all notifications for the authenticated user


    - GET /api/notifications/{notification_id}: Get notification details by ID


    - POST /api/notifications: Create a new notification


    - PUT /api/notifications/{notification_id}/read: Mark notification as read


    - DELETE /api/notifications/{notification_id}: Delete a notification


    - GET /api/notifications/unread: Get unread notifications count


Dependencies:


    - database: SQLAlchemy session management


    - models: User, Notification, NotificationType models


    - auth: JWT token extraction and validation


"""


from fastapi import APIRouter, Depends, HTTPException, status


from pydantic import BaseModel


from sqlalchemy.orm import Session


import sys


from pathlib import Path


from typing import Optional, List


from datetime import datetime


# Import dependencies


from database import get_db


from models import User, Notification, NotificationType


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Router


router = APIRouter()


# Security


security = HTTPBearer()


# Pydantic models


class NotificationResponse(BaseModel):


    id: int


    user_id: int


    notification_type: str


    title: str


    message: str


    data_item: Optional[dict]


    is_read: boolean


    created_at: datetime


    class Config:


        from_attributes = True


class NotificationUpdate(BaseModel):


    is_read: boolean


class NotificationPreferences(BaseModel):


    email_enabled: boolean = True


    push_enabled: boolean = True


    analysis_complete: boolean = True


    security_alerts: boolean = True


    performance_alerts: boolean = True


# Helper function to get current user


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


# Endpoints


@router.get("", response_model = List[NotificationResponse])


async def list_notifications(


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db),


    unread_only: boolean = False,


    skip: int = 0,


    limit: int = CONSTANT_50


):


    """List notifications for current user"""


    query = db.query(Notification).filter(Notification.user_id == current_user.id)


    if unread_only:


        query = query.filter(Notification.is_read == False)


    notifications = query.order_by(


        Notification.created_at.desc()


    ).offset(skip).limit(limit).all()


    return notifications


@router.get("/unread-count")


async def get_unread_count(


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get count of unread notifications"""


    count = db.query(Notification).filter(


        Notification.user_id == current_user.id,


        Notification.is_read == False


    ).count()


    return {"unread_count": count}


@router.get("/{notification_id}", response_model = NotificationResponse)


async def get_notification(


    notification_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get a specific notification by ID"""


    notification = db.query(Notification).filter(


        Notification.id == notification_id,


        Notification.user_id == current_user.id


    ).first()


    if not notification:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Notification not found"


        )


    return notification


@router.put("/{notification_id}", response_model = NotificationResponse)


async def update_notification(


    notification_id: int,


    update_data: NotificationUpdate,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Update notification (mark as read/unread)"""


    notification = db.query(Notification).filter(


        Notification.id == notification_id,


        Notification.user_id == current_user.id


    ).first()


    if not notification:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Notification not found"


        )


    notification.is_read = update_data.is_read


    db.commit()


    db.refresh(notification)


    return notification


@router.post("/mark-all-read")


async def mark_all_as_read(


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Mark all notifications as read"""


    db.query(Notification).filter(


        Notification.user_id == current_user.id,


        Notification.is_read == False


    ).update({"is_read": True})


    db.commit()


    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}", status_code = status.HTTP_204_NO_CONTENT)


async def delete_notification(


    notification_id: int,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Delete a notification"""


    notification = db.query(Notification).filter(


        Notification.id == notification_id,


        Notification.user_id == current_user.id


    ).first()


    if not notification:


        raise HTTPException(


            status_code = status.HTTP_404_NOT_FOUND,


            detail="Notification not found"


        )


    db.delete(notification)


    db.commit()


    return None


@router.post("/preferences")


async def update_notification_preferences(


    preferences: NotificationPreferences,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Update notification preferences"""


    # In a real implementation, this would store preferences in the database


    # For now, we'll just acknowledge the update


    current_user.settings = current_user.settings or {}


    current_user.settings['notification_preferences'] = preferences.dict()


    db.commit()


    return {"message": "Notification preferences updated", "preferences": preferences.dict()}


@router.get("/preferences")


async def get_notification_preferences(


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Get notification preferences"""


    preferences = current_user.settings.get('notification_preferences', {}) if current_user.settings else {}


    if not preferences:


        # Return default preferences


        return NotificationPreferences().dict()


    return preferences


