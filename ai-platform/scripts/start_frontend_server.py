#!/usr/bin/env python3


"""


Simple HTTP Server for Frontend Dashboard


Serves static files for the AI Coding Intelligence Dashboard


"""


import http.server


import socketserver


import os


from pathlib import Path


import sys


class FrontendHandler(http.server.SimpleHTTPRequestHandler):


    """HTTP request handler for frontend files"""


    def __init__(self, *args, **kwargs):


    """


// NOTE: Add function documentation.


    """


        self.web_dir = Path(__file__).parent


        super().__init__(*args, **kwargs)


    def do_GET(self):


        """Handle GET requests"""


        try:


            # Parse the path


            path = self.path.lstrip('/')


            # Default to index.html if root path


            if not path or path == '/':


                path = 'dashboard.html'


            # Security check - prevent directory traversal


            if '..' in path:


                self.send_error(403, "Forbidden")


                return


            # Construct the full file path


            file_path = self.web_dir / path


            # Check if file exists


            if file_path.exists() and file_path.is_file():


                # Determine content type


                content_type = self.guess_content_type(file_path)


                # Serve the file


                self.send_response(200)


                self.send_header('Content-Type', content_type)


                self.send_header('Access-Control-Allow-Origin', '*')


                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


                self.send_header('Access-Control-Allow-Headers', 'Content-Type')


                self.end_headers()


                with open(file_path, 'rb') as f:


                    self.wfile.write(f.read())


            else:


                # File not found


                self.send_error(404, "File not found")


        except Exception as e:


            print(f"Error serving file: {e}")


            self.send_error(500, f"Internal server error: {e}")


    def do_OPTIONS(self):


        """Handle OPTIONS requests for CORS"""


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Headers', 'Content-Type')


        self.end_headers()


    def guess_content_type(self, file_path):


        """Guess the content type based on file extension"""


        ext = file_path.suffix.lower()


        content_types = {


            '.html': 'text/html',


            '.css': 'text/css',


            '.js': 'application/javascript',


            '.json': 'application/json',


            '.png': 'image/png',


            '.jpg': 'image/jpeg',


            '.jpeg': 'image/jpeg',


            '.gif': 'image/gif',


            '.svg': 'image/svg+xml',


            '.ico': 'image/x-icon',


            '.txt': 'text/plain',


            '.md': 'text/markdown'


        }


        return content_types.get(ext, 'application/octet-stream')


def find_free_port(start_port = 57220):


    """Find a free port starting from the given port"""


    for port in range(start_port, start_port + 100):


        try:


            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:


                s.bind(('localhost', port))


                s.listen(1)


                s.close()


                return port


        except OSError:


            continue


    return start_port


def run_server(port = 57220):


    """Run the HTTP server"""


    # Find a free port if the specified port is taken


    actual_port = port


    try:


        server_address = ('', actual_port)


        httpd = http.server.HTTPServer(server_address, FrontendHandler)


    except OSError:


        print(f"Port {actual_port} is taken. Finding a free port...")


        actual_port = find_free_port(port)


        server_address = ('', actual_port)


        httpd = http.server.HTTPServer(server_address, FrontendHandler)


    print(f"🌐 Frontend Server running on port {actual_port}")


    print(f"📊 Dashboard available at: http://localhost:{actual_port}/dashboard.html")


    print(f"🔗 API Server should be running on port 8081")


    print(f"")


    print(f"Press Ctrl+C to stop the server")


    print(f"")


    try:


        httpd.serve_forever()


    except KeyboardInterrupt:


        print("\n🛑 Server stopped by user")


    finally:


        httpd.server_close()


if __name__ == "__main__":


    run_server()


