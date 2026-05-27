#!/usr/bin/env python3
"""
Simple Mock Backup API Server
"""

import json
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

class SimpleBackupHandler(BaseHTTPRequestHandler):
    
    def _set_cors_headers(self):
        """Set CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def _send_json_response(self, status_code, data):
        """Send JSON response"""
        self.send_response(status_code)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        path = self.path
        
        if path == '/api/backup/config':
            self._send_json_response(200, {
                "success": True,
                "config": {
                    "backup_type": "full",
                    "compression": True,
                    "encryption": False,
                    "include_patterns": ["src/**", "web/**", "tests/**", "*.md", "*.json", "*.py", "*.js"],
                    "exclude_patterns": ["node_modules/**", "__pycache__/**", "*.pyc", ".git/**", "backups/**"],
                    "max_backups": 10
                }
            })
        elif path == '/api/backup/list':
            self._send_json_response(200, {
                "success": True,
                "backups": [
                    {
                        "name": "backup_20240520_120000",
                        "timestamp": "2024-05-20T12:00:00",
                        "size": 52428800,
                        "files_count": 1250,
                        "compression": True,
                        "status": "completed"
                    },
                    {
                        "name": "backup_20240519_180000",
                        "timestamp": "2024-05-19T18:00:00",
                        "size": 49152000,
                        "files_count": 1180,
                        "compression": True,
                        "status": "completed"
                    }
                ],
                "total_count": 2
            })
        elif path.startswith('/api/backup/status/'):
            backup_name = path.split('/')[-1]
            self._send_json_response(200, {
                "success": True,
                "metadata": {
                    "name": backup_name,
                    "timestamp": "2024-05-20T12:00:00",
                    "size": 52428800,
                    "files_count": 1250,
                    "compression": True,
                    "status": "completed",
                    "progress": 100
                }
            })
        elif path == '/api/backup/stats':
            self._send_json_response(200, {
                "success": True,
                "stats": {
                    "total_backups": 2,
                    "total_size_mb": 150,
                    "recent_backups": 1,
                    "newest_backup": "2024-05-20T12:00:00"
                }
            })
        else:
            self._send_json_response(404, {"error": "Endpoint not found"})
    
    def do_POST(self):
        """Handle POST requests"""
        path = self.path
        
        if path == '/api/backup/create':
            time.sleep(1)  # Simulate processing
            backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self._send_json_response(200, {
                "success": True,
                "backup_name": backup_name,
                "message": "Backup created successfully",
                "metadata": {
                    "name": backup_name,
                    "timestamp": datetime.now().isoformat(),
                    "size": 50000000,
                    "files_count": 1200,
                    "compression": True,
                    "status": "completed"
                }
            })
        elif path.startswith('/api/backup/restore/'):
            backup_name = path.split('/')[-1]
            time.sleep(1)
            self._send_json_response(200, {
                "success": True,
                "message": f"Backup {backup_name} restored successfully",
                "restored_files": 1200,
                "timestamp": datetime.now().isoformat()
            })
        else:
            self._send_json_response(404, {"error": "Endpoint not found"})
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        path = self.path
        
        if path.startswith('/api/backup/delete/'):
            backup_name = path.split('/')[-1]
            time.sleep(0.5)
            self._send_json_response(200, {
                "success": True,
                "message": f"Backup {backup_name} deleted successfully"
            })
        else:
            self._send_json_response(404, {"error": "Endpoint not found"})

def run_server():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, SimpleBackupHandler)
    print("🚀 Simple Backup API Server running on http://localhost:8000")
    print("📋 Available endpoints:")
    print("   GET  /api/backup/config")
    print("   GET  /api/backup/list")
    print("   GET  /api/backup/status/{name}")
    print("   GET  /api/backup/stats")
    print("   POST /api/backup/create")
    print("   POST /api/backup/restore/{name}")
    print("   DELETE /api/backup/delete/{name}")
    print("\n🔄 Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.shutdown()

if __name__ == "__main__":
    run_server()
