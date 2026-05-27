#!/usr/bin/env python3


from http.server import HTTPServer, SimpleHTTPRequestHandler


import json


class TestHandler(SimpleHTTPRequestHandler):


    def do_GET(self):


    """


    TODO: Add function documentation.


    """


        if self.path == '/':


            self.send_response(200)


            self.send_header('Content-type', 'text/html')


            self.end_headers()


            self.wfile.write(b'<html><body><h1>Test Server Working!</h1><p>Enhanced Services Integration Test</p></body></html>')


        elif self.path == '/api/health':


            self.send_response(200)


            self.send_header('Content-type', 'application/json')


            self.end_headers()


            response = {"status": "healthy", "message": "Test server is working"}


            self.wfile.write(json.dumps(response).encode())


        else:


            self.send_error(404)


if __name__ == "__main__":


    server = HTTPServer(('0.0.0.0', 8080), TestHandler)


    print("Test server running on http://localhost:8080")


    server.serve_forever()


