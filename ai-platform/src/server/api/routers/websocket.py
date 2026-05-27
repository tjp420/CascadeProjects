#!/usr/bin/env python3


"""


WebSocket Router for Real-time Updates


This module provides WebSocket endpoints for real-time analysis progress updates,


notifications, and live status monitoring. It enables bidirectional communication


between the server and connected clients for instantaneous updates.


Endpoints:


    - WS /api/ws/analysis: WebSocket endpoint for analysis progress updates


    - WS /api/ws/notifications: WebSocket endpoint for real-time notifications


    - WS /api/ws/metrics: WebSocket endpoint for live metrics updates


Dependencies:


    - websocket_manager: Connection manager for WebSocket clients


    - auth: JWT token extraction and validation


"""


from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends


from typing import Optional


import uuid


import sys


from pathlib import Path


# Add parent directory to path for imports


sys.path.append(str(Path(__file__).parent.parent))


from websocket_manager import manager


from routers.auth import extract_token_data


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Router


router = APIRouter()


# Security


security = HTTPBearer()


async def get_current_user_websocket(


    credentials: HTTPAuthorizationCredentials = Depends(security)


) -> Optional[str]:


    """Get current user from WebSocket token"""


    token = credentials.credentials


    token_info = extract_token_data(token)


    if not token_info or token_info.email is None:


        return None


    return token_info.email


@router.websocket("/ws/analysis/{client_id}")


async def websocket_analysis_endpoint(websocket: WebSocket, client_id: str):


    """WebSocket endpoint for real-time analysis updates"""


    await manager.connect(websocket, client_id)


    try:


        while True:


            # Keep connection alive and listen for messages


            data_item = await websocket.receive_text()


            # Echo back or process message


            await websocket.send_json({


                "type": "echo",


                "message": f"Received: {data_item}"


            })


    except WebSocketDisconnect:


        manager.disconnect(client_id)


@router.websocket("/ws/progress/{task_id}")


async def websocket_progress_endpoint(websocket: WebSocket, task_id: str):


    """WebSocket endpoint for specific task progress updates"""


    client_id = f"task_{task_id}"


    await manager.connect(websocket, client_id)


    try:


        while True:


            # Keep connection alive


            await websocket.receive_json()


    except WebSocketDisconnect:


        manager.disconnect(client_id)


