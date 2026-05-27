#!/usr/bin/env python3


"""


Simple HTTP Server for AI Coding Intelligence Dashboard


Properly serves ES6 modules with correct MIME types


"""


import http.server


import socketserver


import os


import sys


from pathlib import Path


class DashboardHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):


    def __init__(self, *args, **kwargs):


    """


// NOTE: Add function documentation.


    """


        # Handle different Python versions


        if 'directory' in kwargs:


            super().__init__(*args, **kwargs)


        else:


            super().__init__(*args, directory = os.getcwd(), **kwargs)


    def end_headers(self):


    """


// NOTE: Add function documentation.


    """


        # Add CORS headers for local development


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        super().end_headers()


    def guess_type(self, path):


        """Override guess_type to handle ES6 modules correctly"""


        # In Python 3.13+, guess_type returns a single string instead of tuple


        result_data = super().guess_type(path)


        if isinstance(result_data, tuple):


            mimetype, encoding = result_data


        else:


            mimetype = result_data


            encoding = None


        # Handle ES6 modules


        if path.endswith('.js'):


            return 'application/javascript', encoding


        # Handle other common types


        if path.endswith('.mjs'):


            return 'application/javascript', encoding


        if path.endswith('.json'):


            return 'application/json', encoding


        return mimetype, encoding


    def log_message(self, format, *args):


        """Custom log message for better debugging"""


        print(f"[{self.log_date_time_string()}] {format % args}")


def find_free_port(start_port = 8000, max_port = 9000):


    """Find a free port starting from start_port"""


    for port in range(start_port, max_port):


        try:


            with socketserver.TCPServer(("", port), None) as httpd:


                return port


        except OSError:


            continue


    return None


def main():


    """


// NOTE: Add function documentation.


    """


    # Get port from command line arguments or use default


    port = 8000


    if len(sys.argv) > 1:


        try:


            port = int(sys.argv[1])


        except ValueError:


            print(f"Invalid port number: {sys.argv[1]}")


            sys.exit(1)


    # Find free port if specified port is taken


    if not find_free_port(port, port + 1):


        print(f"Port {port} is in use, finding alternative...")


        port = find_free_port(port + 1, 9000)


        if not port:


            print("No available ports found")


            sys.exit(1)


    # Change to the directory containing this script


    script_dir = Path(__file__).parent


    os.chdir(script_dir)


    print(f"🚀 Starting AI Coding Intelligence Dashboard Server")


    print(f"📁 Serving directory: {os.getcwd()}")


    print(f"🌐 Server running at: http://localhost:{port}")


    print(f"📚 Documentation portal: http://localhost:{port}/documentation_portal.html")


    print(f"📊 Main dashboard: http://localhost:{port}/index.html")


    print(f"⏹️  Press Ctrl+C to stop the server")


    print("-" * 60)


    try:


        # Create server


        with socketserver.TCPServer(("", port), DashboardHTTPRequestHandler) as httpd:


            httpd.serve_forever()


    except KeyboardInterrupt:


        print("\n⏹️  Server stopped by user")


    except Exception as e:


        print(f"❌ Server error: {e}")


        sys.exit(1)


if __name__ == "__main__":


    main()


