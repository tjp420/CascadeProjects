#!/usr/bin/env python3
"""
GGUF AI Dashboard Server
Web server for GGUF AI integration with dashboard interface
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import threading
import time

# Set AI Provider to GGUF
os.environ['AI_PROVIDER'] = 'gguf'

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from gguf_service import get_gguf_service, is_gguf_available
    from ai_blob_manager import get_ai_blob_manager
    GGUF_AVAILABLE = True
except ImportError:
    GGUF_AVAILABLE = False

class GGUFRequestHandler(SimpleHTTPRequestHandler):
    """Custom request handler for GGUF AI dashboard"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.gguf_service = None
        self.blob_manager = None
        self._initialize_services()
    
    def _initialize_services(self):
        """Initialize GGUF services"""
        if GGUF_AVAILABLE:
            try:
                self.gguf_service = get_gguf_service()
                self.blob_manager = get_ai_blob_manager()
            except Exception as e:
                print(f"Error initializing services: {e}")
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/' or self.path == '/dashboard.html':
            self.serve_dashboard()
        elif self.path == '/api/ai-assistant':
            self.serve_ai_info()
        elif self.path == '/api/model-info':
            self.serve_model_info()
        elif self.path == '/api/stats':
            self.serve_stats()
        else:
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/api/ask-ai':
            self.handle_ask_ai()
        elif self.path == '/api/analyze-code':
            self.handle_analyze_code()
        elif self.path == '/api/recommendations':
            self.handle_recommendations()
        else:
            self.send_error(404, "API endpoint not found")
    
    def serve_dashboard(self):
        """Serve the dashboard HTML"""
        dashboard_path = Path(__file__).parent / 'dashboard.html'
        if dashboard_path.exists():
            self.send_response(200, 'text/html', dashboard_path.read_text(encoding='utf-8'))
        else:
            self.send_error(404, "Dashboard not found")
    
    def serve_ai_info(self):
        """Serve AI assistant information"""
        info = {
            "status": "online",
            "type": "local_gguf",
            "model": "unbreakable-oracle",
            "provider": "gguf",
            "available": GGUF_AVAILABLE and is_gguf_available(),
            "features": [
                "Code analysis",
                "AI assistance",
                "Recommendations",
                "Local processing",
                "No API keys required"
            ]
        }
        self.send_json_response(info)
    
    def serve_model_info(self):
        """Serve model information"""
        model_info = {
            "name": "unbreakable-oracle",
            "type": "GGUF",
            "size": "19.2 MB",
            "family": "llama",
            "hash": "sha256-dde5aa3fc5ffc17176b5e8bdc82f587b24b2678c6c66101bf7da77af9f7ccdff",
            "status": "active",
            "loaded": GGUF_AVAILABLE and is_gguf_available(),
            "location": "blobs/sha256-dde5aa3fc5ffc17176b5e8bdc82f587b24b2678c6c66101bf7da77af9f7ccdff"
        }
        self.send_json_response(model_info)
    
    def serve_stats(self):
        """Serve system statistics"""
        if self.blob_manager:
            try:
                stats = self.blob_manager.get_blob_statistics()
                stats_response = {
                    "total_blobs": stats.get("total_blobs", 0),
                    "total_size": stats.get("total_size", 0),
                    "blob_types": len(stats.get("blob_types", {})),
                    "architectures": len(stats.get("architectures", {})),
                    "operating_systems": len(stats.get("operating_systems", {})),
                    "model_families": len(stats.get("model_families", {})),
                    "file_types": len(stats.get("file_types", {})),
                    "timestamp": stats.get("timestamp", datetime.now().isoformat())
                }
                self.send_json_response(stats_response)
            except Exception as e:
                error_response = {"error": f"Failed to get stats: {str(e)}"}
                self.send_json_response(error_response)
        else:
            error_response = {"error": "Blob manager not initialized"}
            self.send_json_response(error_response)
    
    def handle_ask_ai(self):
        """Handle AI assistant requests"""
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            question = data.get('question', '')
            
            if not question:
                self.send_json_response({"error": "Question is required"})
                return
            
            if self.gguf_service:
                response = self.gguf_service.get_ai_assistance(question)
                self.send_json_response({
                    "question": question,
                    "response": response,
                    "timestamp": datetime.now().isoformat()
                })
            else:
                self.send_json_response({"error": "GGUF service not available"})
                
        except Exception as e:
            self.send_json_response({"error": f"Failed to process request: {str(e)}"})
    
    def handle_analyze_code(self):
        """Handle code analysis requests"""
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            code = data.get('code', '')
            context = data.get('context', '')
            
            if not code:
                self.send_json_response({"error": "Code is required"})
                return
            
            if self.gguf_service:
                response = self.gguf_service.analyze_code(code, context)
                self.send_json_response({
                    "code": code,
                    "context": context,
                    "analysis": response,
                    "timestamp": datetime.now().isoformat()
                })
            else:
                self.send_json_response({"error": "GGUF service not available"})
                
        except Exception as e:
            self.send_json_response({"error": f"Failed to analyze code: {str(e)}"})
    
    def handle_recommendations(self):
        """Handle recommendation requests"""
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            analysis = data.get('analysis', {})
            
            if self.gguf_service:
                recommendations = self.gguf_service.generate_recommendations(analysis)
                self.send_json_response({
                    "analysis": analysis,
                    "recommendations": recommendations,
                    "timestamp": datetime.now().isoformat()
                })
            else:
                self.send_json_response({"error": "GGUF service not available"})
                
        except Exception as e:
            self.send_json_response({"error": f"Failed to generate recommendations: {str(e)}"})
    
    def send_json_response(self, data):
        """Send JSON response"""
        self.send_response(200, 'application/json', json.dumps(data, indent=2))
    
    def send_response(self, code, content_type, content):
        """Send HTTP response"""
        self.send_response_only(code)
        self.send_header('Content-type', content_type)
        self.send_header('Content-Length', str(len(content.encode('utf-8'))))
        self.end_headers()
        self.wfile.write(content.encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override log message to reduce console spam"""
        pass

def run_server(host='127.0.0.1', port=54425):
    """Run the GGUF dashboard server"""
    server_address = (host, port)
    httpd = HTTPServer(server_address, GGUFRequestHandler)
    
    print(f"🤖 GGUF AI Dashboard Server")
    print(f"🌐 Server running at: http://{host}:{port}")
    print(f"📊 Dashboard: http://{host}:{port}/dashboard.html")
    print(f"🔑 Model: unbreakable-oracle (GGUF)")
    print(f"🏠 Local AI: No API keys required")
    print(f"💰 Cost: Free")
    print(f"🔒 Privacy: All processing stays local")
    print(f"⚡ Press Ctrl+C to stop the server")
    print(f"=" * 50)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n👋 Server stopped")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
