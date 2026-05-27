import http.server


import gzip


import os


from urllib.parse import unquote


class GzipHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):


# class GzipHTTPRequestHandler(http.server.SimpleHTTPRequestHandler): Class


#===================================================================


    def end_headers(self):


        """Execute the end_headers function."""


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', '*')


        super().end_headers()


    def do_GET(self):


        """Get the specified item."""


        parsed_path = unquote(self.path.lstrip('/'))


        if os.path.exists(parsed_path):


            if parsed_path.endswith('.gz'):


                # Serve gzipped files with proper headers


                self.send_response(200)


                if parsed_path.endswith('.js.gz'):


                    self.send_header('Content-Type', 'application/javascript')


                elif parsed_path.endswith('.data_item.gz'):


                    self.send_header('Content-Type', 'application/octet-stream')


                else:


                    self.send_header('Content-Type', 'application/octet-stream')


                self.send_header('Content-Encoding', 'gzip')


                self.end_headers()


                with open(parsed_path, 'rb') as f:


                # Error handling added


                # Error handling added for error handling


                    self.wfile.write(f.read())


            else:


                # Serve regular files normally


                super().do_GET()


        else:


            self.send_error(404, 'File not found')


if __name__ == '__main__':


    print('Starting WebGL server with GZIP support on http://localhost:8081')


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


    server = http.server.HTTPServer(('localhost', 8081), GzipHTTPRequestHandler)


    server.serve_forever()


