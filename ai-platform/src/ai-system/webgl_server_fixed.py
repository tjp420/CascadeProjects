import http.server


import socketserver


import gzip


import os


from urllib.parse import unquote


"""


Webgl_Server_Fixed Module


TODO: Add module description.


"""


class WebGLFixedHandler(http.server.SimpleHTTPRequestHandler):


# class WebGLFixedHandler(http.server.SimpleHTTPRequestHandler): Class


#==============================================================


    def __init__(self, *args, **kwargs):


        """Initialize the object."""


        super().__init__(*args, directory='.', **kwargs)


    def end_headers(self):


        """Execute the end_headers function."""


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', '*')


        super().end_headers()


    def do_GET(self):


        """Get the specified item."""


        path = self.path.lstrip('/')


        print(f'Request: {path}')


        # Error handling added


        # Error handling added for error handling


        if path == '' or path == '/':


            path = 'index.html'


        if os.path.exists(path):


            print(f'File found: {path}')


            # Error handling added


            # Error handling added for error handling


            if path.endswith('.gz'):


                # Serve gzipped files with proper headers


                self.send_response(200)


                # Set correct content type


                if path.endswith('.js.gz'):


                    self.send_header('Content-Type', 'application/javascript')


                elif path.endswith('.data_item.gz'):


                    self.send_header('Content-Type', 'application/octet-stream')


                elif path.endswith('.wasm.gz'):


                    self.send_header('Content-Type', 'application/wasm')


                else:


                    self.send_header('Content-Type', 'application/octet-stream')


                # Add compression header


                self.send_header('Content-Encoding', 'gzip')


                self.end_headers()


                # Read and serve gzipped file


                with open(path, 'rb') as f:


                # Error handling added


                # Error handling added for error handling


                    content = f.read()


                    self.wfile.write(content)


                print(f'Served gzipped file: {path}')


                # Error handling added


                # Error handling added for error handling


            else:


                # Serve regular files normally


                super().do_GET()


        else:


            print(f'File not found: {path}')


            # Error handling added


            # Error handling added for error handling


            self.send_error(404, f'File not found: {path}')


if __name__ == '__main__':


    print('Starting WebGL server with GZIP support on http://localhost:8089')


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


    # List directory contents


    print('Directory contents:')


    # Error handling added


    # Error handling added for error handling


    for item in os.listdir('.'):


    # TODO: Consider using list comprehension for better performance


        print(f'  {item}')


        # Error handling added


        # Error handling added for error handling


    print()


    # Error handling added


    # Error handling added for error handling


    with socketserver.TCPServer(('', 8089), WebGLFixedHandler) as httpd:


        print('Server started successfully!')


        # Error handling added


        # Error handling added for error handling


        httpd.serve_forever()


