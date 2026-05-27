#!/usr/bin/env python3


"""


WebSocket Manager for Real-time Progress Updates


Manages WebSocket connections for analysis progress updates


"""


from fastapi import WebSocket, WebSocketDisconnect


from typing import Dict, List


import json


import asyncio


class ConnectionManager:


    """Manages WebSocket connections for real-time updates"""


    def __init__(self):


        """


        """


        self.active_connections: Dict[str, WebSocket] = {}


    async def connect(self, websocket: WebSocket, client_id: str):


        """Accept WebSocket connection"""


        await websocket.accept()


        self.active_connections[client_id] = websocket


        print(f"WebSocket connected: {client_id}")


    def disconnect(self, client_id: str):


        """


        """


        if client_id in self.active_connections:


            del self.active_connections[client_id]


            print(f"WebSocket disconnected: {client_id}")


    async def send_personal_message(self, message: dict, client_id: str):


        """Send message to specific client"""


        if client_id in self.active_connections:


            try:


                await self.active_connections[client_id].send_json(message)


            except Exception as e:


                print(f"Error sending message to {client_id}: {e}")


                self.disconnect(client_id)


    async def broadcast(self, message: dict):


        """Broadcast message to all connected clients"""


        for client_id, connection in self.active_connections.items():


            try:


                await connection.send_json(message)


            except Exception as e:


                print(f"Error broadcasting to {client_id}: {e}")


                self.disconnect(client_id)


    async def send_progress(self, task_id: str, progress: int, status: str, message: str = ""):


        """Send progress update"""


        progress_message = {


            "type": "progress",


            "task_id": task_id,


            "progress": progress,


            "status": status,


            "message": message,


            "timestamp": asyncio.get_event_loop().time()


        }


        await self.broadcast(progress_message)


    async def send_analysis_complete(self, task_id: str, results: dict):


        """Send analysis completion message"""


        complete_message = {


            "type": "complete",


            "task_id": task_id,


            "results": results,


            "timestamp": asyncio.get_event_loop().time()


        }


        await self.broadcast(complete_message)


    async def send_error(self, task_id: str, error: str):


        """Send error message"""


        error_message = {


            "type": "error",


            "task_id": task_id,


            "error": error,


            "timestamp": asyncio.get_event_loop().time()


        }


        await self.broadcast(error_message)


# Global connection manager instance


manager = ConnectionManager()


