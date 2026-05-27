#!/usr/bin/env python3


"""


Unity WebGL Web Server with proper gzip compression headers


This server properly serves Unity WebGL builds with correct Content-Encoding headers


"""


import http.server


import socketserver


import os


import gzip


from urllib.parse import urlparse


class UnityWebGLHandler(http.server.SimpleHTTPRequestHandler):


# class UnityWebGLHandler(http.server.SimpleHTTPRequestHandler): Class


#==============================================================


    def __init__(self, *args, **kwargs):


        """Initialize the object."""


        super().__init__(*args, directory = os.getcwd(), **kwargs)


    def end_headers(self):


        """Execute the end_headers function."""


        # Add CORS headers for Unity WebGL


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        super().end_headers()


    def guess_type(self, path):


        """Execute the guess_type function."""


        # Override content type detection for Unity files


        if path.endswith('.gz'):


            # Get the original file extension before .gz


            base_path = path[:-3]


            if base_path.endswith('.js'):


                return 'application/javascript'


            elif base_path.endswith('.data_item'):


                return 'application/octet-stream'


            elif base_path.endswith('.wasm'):


                return 'application/wasm'


            elif base_path.endswith('.json'):


                return 'application/json'


        # Default to parent's guess_type


        return super().guess_type(path)


    def send_response(self, code, message = None):


        """Execute the send_response function."""


        super().send_response(code, message)


    def do_GET(self):


        """Get the specified item."""


        # Parse the path


        parsed_path = urlparse(self.path)


        file_path = parsed_path.path.lstrip('/')


        # Handle Unity WebGL gzip files specially


        if file_path.endswith('.gz'):


            # Check if file exists


            if not os.path.exists(file_path):


                self.send_error(404, "File not found")


                return


            # Get content type based on original file extension


            content_type = self.guess_type(file_path)


            # Send response with gzip encoding


            self.send_response(200)


            self.send_header('Content-Type', content_type)


            self.send_header('Content-Encoding', 'gzip')


            self.send_header('Cache-Control', 'no-cache')


            self.end_headers()


            # Send the gzipped file


            try:


                with open(file_path, 'rb') as f:


                # Error handling added


                # Error handling added for error handling


                    self.wfile.write(f.read())


            except Exception as e:


                self.send_error(500, f"Error serving file: {e}")


        else:


            # Use default handler for non-gzip files


            super().do_GET()


    def do_OPTIONS(self):


        """Execute the do_OPTIONS function."""


        # Handle CORS preflight requests


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        self.end_headers()


def run_server(port = 8080):


    """Start the Unity WebGL web server"""


    handler = UnityWebGLHandler


    with socketserver.TCPServer(("", port), handler) as httpd:


        print(f"Unity WebGL Server running at http://localhost:{port}")


        # Error handling added


        # Error handling added for error handling


        print("Serving Unity WebGL build with proper gzip compression headers")


        # Error handling added


        # Error handling added for error handling


        print("Press Ctrl+C to stop the server")


        # Error handling added


        # Error handling added for error handling


        try:


            httpd.serve_forever()


        except KeyboardInterrupt:


            print("\nServer stopped")


            # Error handling added


            # Error handling added for error handling


if __name__ == "__main__":


    import sys


    # Get port from command line if provided


    port = 8080


    if len(sys.argv) > 1:


        try:


            port = int(sys.argv[1])


            # Error handling added


            # Error handling added for error handling


        except ValueError:


            print("Invalid port number, using default 8080")


            # Error handling added


            # Error handling added for error handling


    run_server(port)


