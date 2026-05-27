#!/usr/bin/env python3
"""
Mock Backup API Server
Simulates the backup API endpoints for development/testing
"""

import json
import os
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import random

class MockBackupAPI(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/api/backup/config':
            self.handle_get_config()
        elif path == '/api/backup/list':
            self.handle_get_list()
        elif path.startswith('/api/backup/status/'):
            backup_name = path.split('/')[-1]
            self.handle_get_status(backup_name)
        elif path == '/api/backup/stats':
            self.handle_get_stats()
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())
            return
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Enable CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        if path == '/api/backup/create':
            self.handle_create_backup()
        elif path.startswith('/api/backup/restore/'):
            backup_name = path.split('/')[-1]
            self.handle_restore_backup(backup_name)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Enable CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        if path.startswith('/api/backup/delete/'):
            backup_name = path.split('/')[-1]
            self.handle_delete_backup(backup_name)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def handle_get_config(self):
        """Handle backup configuration endpoint"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        config = {
            "success": True,
            "config": {
                "backup_type": "full",
                "compression": True,
                "encryption": False,
                "encryption_type": "aes256",
                "include_patterns": [
                    "src/**",
                    "web/**", 
                    "tests/**",
                    "*.md",
                    "*.json",
                    "*.py",
                    "*.js",
                    ".env.example"
                ],
                "exclude_patterns": [
                    "node_modules/**",
                    "__pycache__/**",
                    "*.pyc",
                    ".git/**",
                    "backups/**",
                    "dist/**",
                    "build/**",
                    ".pytest_cache/**",
                    "*.log"
                ],
                "max_backups": 10,
                "auto_cleanup": True
            }
        }
        self.wfile.write(json.dumps(config).encode())
    
    def handle_get_list(self):
        """Handle backup list endpoint"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        backups = [
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
            },
            {
                "name": "backup_20240518_120000",
                "timestamp": "2024-05-18T12:00:00", 
                "size": 47185920,
                "files_count": 1150,
                "compression": True,
                "status": "completed"
            }
        ]
        
        response = {
            "success": True,
            "backups": backups,
            "total_count": len(backups)
        }
        self.wfile.write(json.dumps(response).encode())
    
    def handle_get_status(self, backup_name):
        """Handle backup status endpoint"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        status = {
            "success": True,
            "metadata": {
                "name": backup_name,
                "timestamp": "2024-05-20T12:00:00",
                "size": 52428800,
                "files_count": 1250,
                "compression": True,
                "status": "completed",
                "progress": 100,
                "checksum": "abc123def456"
            }
        }
        self.wfile.write(json.dumps(status).encode())
    
    def handle_get_stats(self):
        """Handle backup statistics endpoint"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        stats = {
            "success": True,
            "stats": {
                "total_backups": 3,
                "total_size_mb": 150,
                "recent_backups": 1,
                "newest_backup": "2024-05-20T12:00:00",
                "oldest_backup": "2024-05-18T12:00:00"
            }
        }
        self.wfile.write(json.dumps(stats).encode())
    
    def handle_create_backup(self):
        """Handle backup creation endpoint"""
        # Simulate processing time
        time.sleep(1)
        
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        response = {
            "success": True,
            "backup_name": backup_name,
            "message": "Backup created successfully",
            "metadata": {
                "name": backup_name,
                "timestamp": datetime.now().isoformat(),
                "size": random.randint(40000000, 60000000),
                "files_count": random.randint(1100, 1300),
                "compression": True,
                "status": "completed"
            }
        }
        self.wfile.write(json.dumps(response).encode())
    
    def handle_restore_backup(self, backup_name):
        """Handle backup restoration endpoint"""
        time.sleep(1)
        
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            "success": True,
            "message": f"Backup {backup_name} restored successfully",
            "restored_files": 1250,
            "timestamp": datetime.now().isoformat()
        }
        self.wfile.write(json.dumps(response).encode())
    
    def handle_delete_backup(self, backup_name):
        """Handle backup deletion endpoint"""
        time.sleep(0.5)
        
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        response = {
            "success": True,
            "message": f"Backup {backup_name} deleted successfully"
        }
        self.wfile.write(json.dumps(response).encode())

def run_mock_backup_server():
    """Run the mock backup API server"""
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, MockBackupAPI)
    print("🚀 Mock Backup API Server running on http://localhost:8000")
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
        print("\n🛑 Mock Backup API Server stopped")
        httpd.shutdown()

if __name__ == "__main__":
    run_mock_backup_server()
