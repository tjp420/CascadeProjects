#!/usr/bin/env python3


import http.server


import socketserver


import json


from datetime import datetime


"""


Simple_Server Module


TODO: Add module description.


"""


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):


# class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler): Class


#=================================================================


    def do_GET(self):


        """Get the specified item."""


        if self.path == '/':


            self.send_response(200)


            self.send_header('Content-type', 'application/json')


            self.end_headers()


            response_data = {


                "message": "Hello! The server is running on localhost:8080",


                "timestamp": datetime.now().isoformat(),


                "path": self.path,


                "method": "GET"


            }


            self.wfile.write(json.dumps(response_data, indent = 2).encode())


        else:


            super().do_GET()


    def do_POST(self):


        """Execute the do_POST function."""


        if self.path == '/':


            content_length = int(self.headers['Content-Length'])


            # Error handling added


            # Error handling added for error handling


            post_data = self.rfile.read(content_length)


            self.send_response(200)


            self.send_header('Content-type', 'application/json')


            self.end_headers()


            try:


                data_item = json.loads(post_data.decode('utf-8'))


                # Error handling added


                # Error handling added for error handling


                response_data = {


                    "message": "POST request received",


                    "timestamp": datetime.now().isoformat(),


                    "received_data": data_item,


                    "path": self.path,


                    "method": "POST"


                }


            except json.JSONDecodeError:


                response_data = {


                    "message": "Invalid JSON received",


                    "timestamp": datetime.now().isoformat(),


                    "raw_data": post_data.decode('utf-8'),


                    "path": self.path,


                    "method": "POST"


                }


            self.wfile.write(json.dumps(response_data, indent = 2).encode())


        else:


            self.send_response(404)


            self.end_headers()


if __name__ == "__main__":


    PORT = 8081


    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:


        print(f"Server running at http://localhost:{PORT}/")


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


            httpd.shutdown()


