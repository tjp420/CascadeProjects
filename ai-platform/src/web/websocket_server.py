#!/usr/bin/env python3
"""
WebSocket Server for Real-time Updates
Fixes WebSocket connection issues by providing a standalone WebSocket server
"""

import asyncio
import websockets
import json
import logging
from pathlib import Path
import sys

# Add the api directory to path for imports
sys.path.append(str(Path(__file__).parent / 'api'))

from websocket_manager import manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketServer:
    """Standalone WebSocket server for real-time updates"""
    
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.clients = {}
        self.running = False
    
    async def register_client(self, websocket, path):
        """Register a new WebSocket client"""
        client_id = f"client_{len(self.clients)}"
        self.clients[client_id] = websocket
        
        logger.info(f"WebSocket client connected: {client_id} from {path}")
        
        # Send welcome message
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "Connected to M&A Dashboard WebSocket Server",
            "client_id": client_id,
            "timestamp": asyncio.get_event_loop().time()
        }))
        
        try:
            # Keep connection alive and handle messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_message(client_id, data)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON format",
                        "client_id": client_id
                    }))
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            # Clean up disconnected client
            if client_id in self.clients:
                del self.clients[client_id]
    
    async def handle_message(self, client_id, data):
        """Handle incoming WebSocket messages"""
        message_type = data.get("type", "unknown")
        
        if message_type == "ping":
            # Respond to ping with pong
            await self.clients[client_id].send(json.dumps({
                "type": "pong",
                "timestamp": asyncio.get_event_loop().time()
            }))
        elif message_type == "subscribe":
            # Handle subscription to specific updates
            subscription = data.get("subscription", "general")
            await self.clients[client_id].send(json.dumps({
                "type": "subscribed",
                "subscription": subscription,
                "message": f"Subscribed to {subscription} updates",
                "timestamp": asyncio.get_event_loop().time()
            }))
        elif message_type == "status":
            # Send server status
            await self.clients[client_id].send(json.dumps({
                "type": "status_response",
                "status": "healthy",
                "connected_clients": len(self.clients),
                "server": "M&A Dashboard WebSocket Server",
                "timestamp": asyncio.get_event_loop().time()
            }))
        else:
            # Echo back unknown messages
            await self.clients[client_id].send(json.dumps({
                "type": "echo",
                "original_message": data,
                "message": f"Received message type: {message_type}",
                "timestamp": asyncio.get_event_loop().time()
            }))
    
    async def broadcast_message(self, message):
        """Broadcast message to all connected clients"""
        if not self.clients:
            return
        
        disconnected_clients = []
        for client_id, websocket in self.clients.items():
            try:
                await websocket.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.append(client_id)
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected_clients:
            if client_id in self.clients:
                del self.clients[client_id]
    
    async def send_periodic_updates(self):
        """Send periodic status updates to keep connections alive"""
        while self.running:
            await asyncio.sleep(30)  # Send update every 30 seconds
            
            if self.clients:
                status_message = {
                    "type": "heartbeat",
                    "status": "healthy",
                    "connected_clients": len(self.clients),
                    "timestamp": asyncio.get_event_loop().time()
                }
                await self.broadcast_message(status_message)
    
    async def start_server(self):
        """Start the WebSocket server"""
        self.running = True
        
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        # Start the periodic updates task
        updates_task = asyncio.create_task(self.send_periodic_updates())
        
        try:
            # Start the WebSocket server
            async with websockets.serve(self.register_client, self.host, self.port):
                logger.info(f"WebSocket server running at ws://{self.host}:{self.port}")
                await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            logger.info("Shutting down WebSocket server...")
        except Exception as e:
            logger.error(f"WebSocket server error: {e}")
        finally:
            self.running = False
            updates_task.cancel()
            logger.info("WebSocket server stopped")

def main():
    """Main function to run the WebSocket server"""
    server = WebSocketServer()
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\nWebSocket server stopped by user")

if __name__ == "__main__":
    main()
