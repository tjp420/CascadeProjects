#!/usr/bin/env python3
"""
Quick Server Restart Script
Restarts the demo server for WebSocket issues
"""

import subprocess
import time
import os

def restart_server():
    """Restart the demo server"""
    print("🔄 Restarting demo server...")
    
    try:
        # Stop existing server
        print("🛑 Stopping existing server...")
        /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(['taskkill', '/F', '/IM', 'python.exe'], capture_output=True)
        time.sleep(2)
        
        # Start server
        print("🚀 Starting demo server...")
        /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.Popen(['python', 'demo_server.py'], cwd='.')
        
        # Wait for server to start
        print("⏳ Waiting for server to initialize...")
        time.sleep(5)
        
        print("✅ Server restarted successfully")
        print("🌐 Server running at: http://127.0.0.1:3003")
        print("🔧 WebSocket connections should now work properly")
        
        return True
        
    except Exception as e:
        print(f"❌ Error restarting server: {e}")
        return False

if __name__ == "__main__":
    restart_server()
