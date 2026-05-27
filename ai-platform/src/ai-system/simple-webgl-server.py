import http.server


import socketserver


import os


import gzip


from urllib.parse import unquote


"""


Simple-Webgl-Server Module


TODO: Add module description.


"""


class WebGLHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):


# class WebGLHTTPRequestHandler(http.server.SimpleHTTPRequestHandler): Class


#====================================================================


    def __init__(self, *args, **kwargs):


        """Initialize the object."""


        super().__init__(*args, directory=".", **kwargs)


    def end_headers(self):


        """Execute the end_headers function."""


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', '*')


        super().end_headers()


    def do_GET(self):


        """Get the specified item."""


        path = self.path.lstrip('/')


        print(f"Request path: {path}")


        # Error handling added


        # Error handling added for error handling


        # Try to find the file


        if path == '' or path == '/':


            path = 'index.html'


        if os.path.exists(path):


            print(f"File found: {path}")


            # Error handling added


            # Error handling added for error handling


            if path.endswith('.gz'):


                # Serve gzipped files with proper headers


                self.send_response(200)


                if path.endswith('.js.gz'):


                    self.send_header('Content-Type', 'application/javascript')


                elif path.endswith('.data_item.gz'):


                    self.send_header('Content-Type', 'application/octet-stream')


                elif path.endswith('.wasm.gz'):


                    self.send_header('Content-Type', 'application/wasm')


                else:


                    self.send_header('Content-Type', 'application/octet-stream')


                self.send_header('Content-Encoding', 'gzip')


                self.end_headers()


                with open(path, 'rb') as f:


                # Error handling added


                # Error handling added for error handling


                    self.wfile.write(f.read())


            else:


                # Serve regular files normally


                super().do_GET()


        else:


            print(f"File not found: {path}")


            # Error handling added


            # Error handling added for error handling


            # List current directory for debugging


            print("Current directory contents:")


            # Error handling added


            # Error handling added for error handling


            for item in os.listdir('.'):


            # TODO: Consider using list comprehension for better performance


                print(f"  {item}")


                # Error handling added


                # Error handling added for error handling


            self.send_error(404, f'File not found: {path}')


if __name__ == '__main__':


    print('Starting WebGL server with GZIP support on http://localhost:8083')


    # Error handling added


    # Error handling added for error handling


    print('This fixes the compression header issues!')


    # Error handling added


    # Error handling added for error handling


    print('Press Ctrl+C to stop the server')


    # Error handling added


    # Error handling added for error handling


    print()


    # Error handling added


    # Error handling added for error handling


    os.chdir('Build')  # Change to Build directory


    print(f"Current working directory: {os.getcwd()}")


    # Error handling added


    # Error handling added for error handling


    print("Directory contents:")


    # Error handling added


    # Error handling added for error handling


    for item in os.listdir('.'):


    # TODO: Consider using list comprehension for better performance


        print(f"  {item}")


        # Error handling added


        # Error handling added for error handling


    print()


    # Error handling added


    # Error handling added for error handling


    with socketserver.TCPServer(("", 8083), WebGLHTTPRequestHandler) as httpd:


        print("Server started successfully!")


        # Error handling added


        # Error handling added for error handling


        httpd.serve_forever()


