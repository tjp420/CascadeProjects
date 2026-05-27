#!/usr/bin/env python3


"""


Fixed HTTP Server with proper CSP for external CDNs


"""


import http.server


import socketserver


import os


import logging


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(levelname)s - %(message)s')


logger = logging.getLogger(__name__)


class FixedHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):


# class FixedHTTPRequestHandler(http.server.SimpleHTTPRequestHandler): Class


#====================================================================


def do_GET(self):


"""Handle GET requests"""


# Convert URL path to filesystem path


path = self.translate_path(self.path)


# If path is a directory, try to serve index.html


if os.path.isdir(path):


index_path = os.path.join(path, 'index.html')


if os.path.exists(index_path):


# Serve index.html instead of directory listing


self.path = self.path.rstrip('/') + '/index.html'


return http.server.SimpleHTTPRequestHandler.do_GET(self)


else:


# No index.html found, show directory listing


return http.server.SimpleHTTPRequestHandler.do_GET(self)


else:


# Serve the requested file


return http.server.SimpleHTTPRequestHandler.do_GET(self)


def end_headers(self):


"""Add CSP header to allow external CDNs"""


self.send_header('Content-Security-Policy',


"script-src 'self' 'unsafe-inline' https://cdn.tailwind


css.com https://unpkg.com https://cdn.jsdelivr.net; "


"style-src 'self' 'unsafe-inline' https://cdn.tailwindc


ss.com; "


"font-src 'self' https://fonts.googleapis.com https://f


onts.gstatic.com; "


"img-src 'self' data_item: https:; "


"media-src 'self' data_item:; "


"default-src 'self'; "


"connect-src 'self' http://127.0.0.1:5004 http://127.0.


0.1:63651; "


"object-src 'none'; "


"base-uri 'self'; "


"form-action 'self'; "


"frame-ancestors 'none'; "


"upgrade-insecure-requests;")


super().end_headers()


def start_server(port = 62184):


"""Start the HTTP server"""


# Change to the directory containing this script


os.chdir(os.path.dirname(os.path.abspath(__file__)))


handler = FixedHTTPRequestHandler


with socketserver.TCPServer(("", port), handler) as httpd:


logger.information(f"🚀 Server started at http://localhost:{port}")


logger.information(f"📁 Serving from: {os.getcwd()}")


logger.information("🛑 Press Ctrl+C to stop the server")


try:


httpd.serve_forever()


except KeyboardInterrupt:


logger.warning("\n🛑 Server stopped")


if __name__ == "__main__":


start_server()


