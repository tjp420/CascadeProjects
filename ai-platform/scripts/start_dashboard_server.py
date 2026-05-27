#!/usr/bin/env python3


"""


Dashboard Server Starter


Fixed server that runs on port 57220 to fix 502 Bad Gateway error


"""


import os


import sys


import http.server


import socketserver


import json


import urllib.parse


from datetime import datetime


import threading


import time


class DashboardServer(http.server.SimpleHTTPRequestHandler):


    def __init__(self, *args, **kwargs):


    """


// NOTE: Add function documentation.


    """


        super().__init__(*args, directory=".", **kwargs)


    def do_GET(self):


        """Handle GET requests"""


        try:


            # Parse the URL


            parsed_url = urllib.parse.urlparse(self.path)


            # Handle different endpoints


            if parsed_url.path == '/':


                self.serve_file('final_100_complete.html')


            elif parsed_url.path == '/dashboard.html':


                self.serve_file('final_100_complete.html')


            elif parsed_url.path == '/dashboard_direct.html':


                self.serve_file('dashboard_direct.html')


            elif parsed_url.path == '/final_100_complete.html':


                self.serve_file('final_100_complete.html')


            elif parsed_url.path == '/see_100_complete.html':


                self.serve_file('see_100_complete.html')


            elif parsed_url.path.startswith('/api/'):


                self.handle_api_request(parsed_url)


            else:


                # Try to serve static files


                self.serve_static_file(parsed_url.path[1:])  # Remove leading slash


        except Exception as e:


            print(f"Error handling request: {e}")


            self.send_error(500, f"Internal Server Error: {e}")


    def serve_file(self, filename):


        """Serve a specific file"""


        try:


            if os.path.exists(filename):


                self.send_response(200)


                self.send_header('Content-type', self.get_content_type(filename))


                self.send_header('Access-Control-Allow-Origin', '*')


                self.end_headers()


                with open(filename, 'rb') as f:


                    self.wfile.write(f.read())


            else:


                self.send_error(404, f"File not found: {filename}")


        except Exception as e:


            print(f"Error serving file {filename}: {e}")


            self.send_error(500, f"Error serving file: {e}")


    def serve_static_file(self, filename):


        """Serve static files with proper content types"""


        try:


            if os.path.exists(filename):


                self.send_response(200)


                self.send_header('Content-type', self.get_content_type(filename))


                self.send_header('Access-Control-Allow-Origin', '*')


                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')


                self.send_header('Pragma', 'no-cache')


                self.send_header('Expires', '0')


                self.end_headers()


                with open(filename, 'rb') as f:


                    self.wfile.write(f.read())


            else:


                # If file doesn't exist, serve the main dashboard


                self.serve_file('final_100_complete.html')


        except Exception as e:


            print(f"Error serving static file {filename}: {e}")


            self.serve_file('final_100_complete.html')


    def handle_api_request(self, parsed_url):


        """Handle API requests"""


        try:


            # Return mock API data_item for dashboard


            api_data = {


                "totalFiles": 7780,


                "totalDirectories": 156,


                "projectDepth": 5,


                "linesOfCode": 15678,


                "codeQuality": 82,


                "testCoverage": 80,


                "technicalDebt": "Low",


                "maintainability": "Excellent",


                "healthScore": 95,


                "developmentVelocity": "High",


                "teamProductivity": 95,


                "projectComplexity": "Medium",


                "languages": ["Python", "JavaScript", "HTML", "CSS"],


                "frameworks": ["Flask", "React", "Jest", "ESLint", "Prettier"],


                "fileTypes": {


                    ".eslintrc.js": 1,


                    ".prettierrc": 1,


                    "jest.config.js": 1,


                    "package.json": 1,


                    "README.md": 1,


                    ".test.js": 2,


                    ".spec.js": 0,


                    "json": 1,


                    "js": 1000,


                    "py": 500,


                    "html": 200,


                    "css": 150,


                    "md": 1,


                    "yml": 1,


                    "yaml": 1,


                    "toml": 1,


                    "lock": 1,


                    "DEVELOPER_GUIDE.md": 1,


                    "ARCHITECTURE.md": 1,


                    "API_DOCUMENTATION.md": 1,


                    "DEPLOYMENT_GUIDE.md": 1,


                    "dashboard.test.js": 1,


                    "api.test.js": 1,


                    "utils.test.js": 1,


                    "performance.test.js": 1


                },


                "timestamp": datetime.now().isoformat()


            }


            self.send_response(200)


            self.send_header('Content-type', 'application/json')


            self.send_header('Access-Control-Allow-Origin', '*')


            self.end_headers()


            self.wfile.write(json.dumps(api_data, indent = 2).encode())


        except Exception as e:


            print(f"Error handling API request: {e}")


            self.send_error(500, f"API Error: {e}")


    def get_content_type(self, filename):


        """Get content type based on file extension"""


        if filename.endswith('.html'):


            return 'text/html'


        elif filename.endswith('.css'):


            return 'text/css'


        elif filename.endswith('.js'):


            return 'application/javascript'


        elif filename.endswith('.json'):


            return 'application/json'


        elif filename.endswith('.png'):


            return 'image/png'


        elif filename.endswith('.jpg') or filename.endswith('.jpeg'):


            return 'image/jpeg'


        elif filename.endswith('.gif'):


            return 'image/gif'


        elif filename.endswith('.svg'):


            return 'image/svg+xml'


        else:


            return 'text/plain'


def start_server():


    """Start the dashboard server"""


    PORT = 57220


    HOST = '127.0.0.1'


    print(f"🚀 Starting Dashboard Server...")


    print(f"📡 Server will run on: http://{HOST}:{PORT}")


    print(f"🎯 Dashboard URL: http://{HOST}:{PORT}/")


    print(f"📎 Legacy completion page: http://{HOST}:{PORT}/final_100_complete.html")


    print(f"📊 Direct Dashboard: http://{HOST}:{PORT}/dashboard_direct.html")


    print(f"🔄 Refresh Page: http://{HOST}:{PORT}/see_100_complete.html")


    print(f"🛑 Press Ctrl+C to stop the server")


    print()


    try:


        # Change to the web directory


        web_dir = os.path.join(os.path.dirname(__file__), 'web')


        if os.path.exists(web_dir):


            os.chdir(web_dir)


            print(f"📁 Changed to directory: {os.getcwd()}")


        else:


            print(f"⚠️ Web directory not found: {web_dir}")


            print(f"📁 Current directory: {os.getcwd()}")


        # Create server


        with socketserver.TCPServer((HOST, PORT), DashboardServer) as httpd:


            print(f"✅ Server successfully started on port {PORT}")


            print(f"🌐 Server is ready to accept connections")


            print()


            # Start server


            httpd.serve_forever()


    except KeyboardInterrupt:


        print(f"\n🛑 Server stopped by user")


    except Exception as e:


        print(f"❌ Error starting server: {e}")


        print(f"🔧 Possible solutions:")


        print(f"   1. Check if port {PORT} is already in use")


        print(f"   2. Make sure Python is installed")


        print(f"   3. Check file permissions")


        return False


    return True


if __name__ == "__main__":


    success = start_server()


    if not success:


        sys.exit(1)


