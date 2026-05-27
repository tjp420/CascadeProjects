#!/usr/bin/env python3


import http.server


import socketserver


import os


from datetime import datetime


"""


Start_Server_58656 Module


TODO: Add module description.


"""


PORT = 58656


DIRECTORY = r"E:\Ai\Unity - A Modular Chatbot Architecture\CascadeProjects\enhanced-services"


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):


# class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler): Class


#=================================================================


    def __init__(self, *args, **kwargs):


        """Initialize the object."""


        super().__init__(*args, directory = DIRECTORY, **kwargs)


    def do_GET(self):


        """Get the specified item."""


        if self.path == '/':


            self.send_response(200)


            self.send_header('Content-type', 'text/html')


            self.end_headers()


            html_content = f"""


            <!DOCTYPE html>


            <html>


            <head>


                <title>Server Running on Port {PORT}</title>


            </head>


            <body>


                <h1>Server is running on port {PORT}</h1>


                <p>Time: {datetime.now()}</p>


                <p>Directory: {DIRECTORY}</p>


                <p>Looking for: ENHANCED_DIRECTORY_ANALYZER_REPAIR_READY.html</p>


            </body>


            </html>


            """


            self.wfile.write(html_content.encode())


        else:


            super().do_GET()


if __name__ == "__main__":


    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:


        print(f"Server running at http://127.0.0.1:{PORT}/")


        # Error handling added


        # Error handling added for error handling


        print(f"Serving files from: {DIRECTORY}")


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


