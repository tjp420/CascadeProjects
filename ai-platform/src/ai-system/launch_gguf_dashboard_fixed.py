#!/usr/bin/env python3
"""
GGUF Dashboard Launcher - Fixed Version
Finds an available port and starts the dashboard server
"""

import socket
import subprocess
import sys
import os
import time
import webbrowser
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

def find_available_port(start_port=54426, max_port=54450):
    """Find an available port in the given range"""
    for port in range(start_port, max_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return None

def launch_dashboard():
    """Launch the GGUF dashboard"""
    print("🤖 GGUF AI Dashboard Launcher")
    print("=" * 40)
    
    # Find available port
    port = find_available_port()
    if not port:
        print("❌ No available ports found")
        return
    
    print(f"🌐 Starting dashboard on port {port}")
    print(f"📊 Dashboard will be available at: http://127.0.0.1:{port}/dashboard.html")
    print(f"🔑 Model: unbreakable-oracle (GGUF)")
    print(f"🏠 Local AI: No API keys required")
    print(f"💰 Cost: Free")
    print(f"🔒 Privacy: All processing stays local")
    print(f"⚡ Press Ctrl+C to stop the server")
    print(f"=" * 40)
    
    # Create a simple server that serves the dashboard
    class DashboardHandler(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/' or self.path == '/dashboard.html':
                dashboard_path = os.path.join(os.path.dirname(__file__), 'dashboard.html')
                if os.path.exists(dashboard_path):
                    with open(dashboard_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    self.send_response(200, content)
                else:
                    self.send_error(404, "Dashboard not found")
            else:
                super().do_GET()
        
        def send_response(self, code, content):
            self.send_response_only(code)
            self.send_header('Content-type', 'text/html')
            self.send_header('Content-Length', str(len(content.encode('utf-8'))))
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
        
        def log_message(self, format, *args):
            pass  # Reduce console spam
    
    # Start server
    try:
        server = HTTPServer(('127.0.0.1', port), DashboardHandler)
        print(f"🚀 Server started successfully!")
        print(f"🌐 Open your browser and go to: http://127.0.0.1:{port}/dashboard.html")
        
        # Auto-open browser after a short delay
        def open_browser():
            time.sleep(2)
            webbrowser.open(f'http://127.0.0.1:{port}/dashboard.html')
        
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()
        
        # Run server
        server.serve_forever()
        
    except KeyboardInterrupt:
        print(f"\n👋 Server stopped")
    except Exception as e:
        print(f"❌ Error starting server: {e}")

if __name__ == "__main__":
    launch_dashboard()
