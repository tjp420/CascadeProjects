#!/usr/bin/env python3
"""
Simple WebSocket Server using built-in libraries
Fixes WebSocket connection issues without external dependencies
"""

import asyncio
import json
import logging
import socket
import threading
import time
from pathlib import Path
import sys
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleWebSocketServer:
    """Simple WebSocket server implementation"""
    
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.clients = {}
        self.running = False
        self.server_socket = None
        
    def generate_accept_key(self, client_key):
        """Generate WebSocket accept key"""
        import hashlib
        import base64
        
        MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        combined = client_key + MAGIC_STRING
        sha1_hash = hashlib.sha1(combined.encode()).digest()
        return base64.b64encode(sha1_hash).decode()
    
    def parse_websocket_frame(self, data):
        """Parse WebSocket frame (simplified)"""
        if len(data) < 2:
            return None, None
            
        first_byte = data[0]
        second_byte = data[1]
        
        # Extract opcode and payload length
        opcode = first_byte & 0x0F
        masked = (second_byte & 0x80) != 0
        payload_length = second_byte & 0x7F
        
        # Extended payload length
        if payload_length == 126:
            if len(data) < 4:
                return None, None
            payload_length = int.from_bytes(data[2:4], 'big')
            offset = 4
        elif payload_length == 127:
            if len(data) < 10:
                return None, None
            payload_length = int.from_bytes(data[2:10], 'big')
            offset = 10
        else:
            offset = 2
        
        # Masking key
        if masked:
            if len(data) < offset + 4:
                return None, None
            mask_key = data[offset:offset+4]
            offset += 4
        else:
            mask_key = None
        
        # Payload data
        if len(data) < offset + payload_length:
            return None, None
            
        payload = data[offset:offset+payload_length]
        
        # Unmask payload if needed
        if masked and mask_key:
            payload = bytes([payload[i] ^ mask_key[i % 4] for i in range(len(payload))])
        
        return opcode, payload.decode('utf-8', errors='ignore')
    
    def create_websocket_frame(self, message):
        """Create WebSocket frame for sending"""
        payload = message.encode('utf-8')
        payload_length = len(payload)
        
        frame = bytearray()
        
        # First byte: FIN=1, opcode=1 (text)
        frame.append(0x81)
        
        # Payload length
        if payload_length < 126:
            frame.append(payload_length)
        elif payload_length < 65536:
            frame.append(126)
            frame.extend(payload_length.to_bytes(2, 'big'))
        else:
            frame.append(127)
            frame.extend(payload_length.to_bytes(8, 'big'))
        
        # Payload (no mask for server-to-client)
        frame.extend(payload)
        
        return bytes(frame)
    
    def handle_client(self, client_socket, client_address):
        """Handle individual WebSocket client"""
        client_id = f"client_{client_address[0]}_{client_address[1]}_{int(time.time())}"
        self.clients[client_id] = client_socket
        
        logger.info(f"WebSocket client connected: {client_id}")
        
        try:
            # Perform WebSocket handshake
            data = client_socket.recv(4096).decode()
            
            if "Upgrade: websocket" not in data:
                logger.error(f"Invalid WebSocket handshake from {client_id}")
                return
            
            # Extract client key
            lines = data.split('\n')
            client_key = None
            for line in lines:
                if line.startswith('Sec-WebSocket-Key:'):
                    client_key = line.split(':')[1].strip()
                    break
            
            if not client_key:
                logger.error(f"No WebSocket key from {client_id}")
                return
            
            # Send handshake response
            accept_key = self.generate_accept_key(client_key)
            response = (
                "HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept_key}\r\n"
                "\r\n"
            )
            client_socket.send(response.encode())
            
            # Send welcome message
            welcome_msg = {
                "type": "welcome",
                "message": "Connected to M&A Dashboard WebSocket Server",
                "client_id": client_id,
                "timestamp": time.time()
            }
            client_socket.send(self.create_websocket_frame(json.dumps(welcome_msg)))
            
            # Handle messages
            while self.running:
                try:
                    data = client_socket.recv(4096)
                    if not data:
                        break
                    
                    opcode, message = self.parse_websocket_frame(data)
                    
                    if opcode == 0x8:  # Close frame
                        break
                    elif opcode == 0x1 and message:  # Text frame
                        try:
                            msg_data = json.loads(message)
                            response = self.handle_message(client_id, msg_data)
                            if response:
                                client_socket.send(self.create_websocket_frame(json.dumps(response)))
                        except json.JSONDecodeError:
                            error_response = {
                                "type": "error",
                                "message": "Invalid JSON format",
                                "client_id": client_id
                            }
                            client_socket.send(self.create_websocket_frame(json.dumps(error_response)))
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"Error handling message from {client_id}: {e}")
                    break
                
        except Exception as e:
            logger.error(f"Error with client {client_id}: {e}")
        finally:
            # Clean up
            if client_id in self.clients:
                del self.clients[client_id]
            client_socket.close()
            logger.info(f"WebSocket client disconnected: {client_id}")
    
    def handle_message(self, client_id, data):
        """Handle incoming WebSocket messages"""
        message_type = data.get("type", "unknown")
        
        if message_type == "ping":
            return {
                "type": "pong",
                "timestamp": time.time()
            }
        elif message_type == "subscribe":
            subscription = data.get("subscription", "general")
            return {
                "type": "subscribed",
                "subscription": subscription,
                "message": f"Subscribed to {subscription} updates",
                "timestamp": time.time()
            }
        elif message_type == "status":
            return {
                "type": "status_response",
                "status": "healthy",
                "connected_clients": len(self.clients),
                "server": "M&A Dashboard WebSocket Server",
                "timestamp": time.time()
            }
        else:
            return {
                "type": "echo",
                "original_message": data,
                "message": f"Received message type: {message_type}",
                "timestamp": time.time()
            }
    
    def broadcast_message(self, message):
        """Broadcast message to all connected clients"""
        if not self.clients:
            return
        
        message_str = json.dumps(message)
        frame = self.create_websocket_frame(message_str)
        
        disconnected_clients = []
        for client_id, client_socket in self.clients.items():
            try:
                client_socket.send(frame)
            except Exception as e:
                logger.error(f"Error broadcasting to {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected_clients:
            if client_id in self.clients:
                del self.clients[client_id]
    
    def send_heartbeat(self):
        """Send periodic heartbeat messages"""
        while self.running:
            time.sleep(30)  # Send heartbeat every 30 seconds
            
            if self.clients:
                heartbeat_msg = {
                    "type": "heartbeat",
                    "status": "healthy",
                    "connected_clients": len(self.clients),
                    "timestamp": time.time()
                }
                self.broadcast_message(heartbeat_msg)
    
    def start_server(self):
        """Start the WebSocket server"""
        self.running = True
        
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            
            logger.info(f"WebSocket server started on {self.host}:{self.port}")
            logger.info(f"Connect to: ws://{self.host}:{self.port}")
            
            # Start heartbeat thread
            heartbeat_thread = threading.Thread(target=self.send_heartbeat, daemon=True)
            heartbeat_thread.start()
            
            # Accept connections
            while self.running:
                try:
                    client_socket, client_address = self.server_socket.accept()
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, client_address),
                        daemon=True
                    )
                    client_thread.start()
                except Exception as e:
                    if self.running:
                        logger.error(f"Error accepting connection: {e}")
                        
        except Exception as e:
            logger.error(f"Server error: {e}")
        finally:
            self.running = False
            if self.server_socket:
                self.server_socket.close()
            logger.info("WebSocket server stopped")

def main():
    """Main function to run the WebSocket server"""
    server = SimpleWebSocketServer()
    
    try:
        server.start_server()
    except KeyboardInterrupt:
        logger.info("WebSocket server stopped by user")
        server.running = False

if __name__ == "__main__":
    main()
