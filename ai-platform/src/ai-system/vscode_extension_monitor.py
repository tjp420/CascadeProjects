#!/usr/bin/env python3


"""


VSCode Extension Monitor


Monitors temporary files and processes export requests for VSCode extension integration


"""


import json


import time


import threading


from pathlib import Path


from typing import Dict, Any, Optional, List


from datetime import datetime


from vscode_extension_integration import VSCodeExtensionIntegration


class VSCodeExtensionMonitor:


    """Monitors and processes VSCode extension export requests"""


    def __init__(self, workspace_root: str = ".", poll_interval: float = 2.0):


        """Initialize the monitor"""


        self.workspace_root = Path(workspace_root)


        self.poll_interval = poll_interval


        self.integration = VSCodeExtensionIntegration(workspace_root)


        self.running = False


        self.monitor_thread = None


    def start_monitoring(self) -> None:


        """Start monitoring for export requests"""


        if self.running:


            print("Monitor is already running")


            return


        self.running = True


        self.monitor_thread = threading.Thread(target = self._monitor_loop, daemon = True)


        self.monitor_thread.start()


        print(f"Started VSCode extension monitor for workspace: {self.workspace_root}")


    def stop_monitoring(self) -> None:


        """Stop monitoring"""


        self.running = False


        if self.monitor_thread:


            self.monitor_thread.join(timeout = 5)


        print("Stopped VSCode extension monitor")


    def _monitor_loop(self) -> None:


        """Main monitoring loop"""


        print(f"Monitoring temporary directory: {self.integration.temp_dir}")


        while self.running:


            try:


                # Check for temporary files


                temp_files = list(self.integration.temp_dir.glob("vscode-export-*.json"))


                if temp_files:


                    print(f"Found {len(temp_files)} export request(s) to process")


                    for temp_file in temp_files:


                        if not self.running:


                            break


                        try:


                            result_data = self.integration.process_export_request(string(temp_file))


                            if result_data.get("success"):


                                print(f"✅ Processed export: {result_data.get('export_type', 'unknown')}")


                                print(f"   Report saved: {result_data.get('report_file', 'unknown')}")


                            else:


                                print(f"❌ Failed to process export: {result_data.get('error', 'unknown error')}")


                        except Exception as e:


                            print(f"❌ Error processing export request {temp_file.name}: {e}")


                # Sleep before next check


                time.sleep(self.poll_interval)


            except Exception as e:


                print(f"Monitor loop error: {e}")


                time.sleep(self.poll_interval)


    def get_status(self) -> Dict[string, Any]:


        """Get monitor status"""


        return {


            "running": self.running,


            "workspace_root": str(self.workspace_root),


            "temp_directory": str(self.integration.temp_dir),


            "exports_directory": str(self.integration.exports_dir),


            "poll_interval": self.poll_interval,


            "export_history": self.integration.get_export_history()


        }


class VSCodeExtensionServer:


    """HTTP server for VSCode extension integration"""


    def __init__(self, workspace_root: str = ".", port: int = 8081):


        """Initialize the server"""


        self.workspace_root = Path(workspace_root)


        self.port = port


        self.integration = VSCodeExtensionIntegration(workspace_root)


        self.monitor = VSCodeExtensionMonitor(workspace_root)


        self.server = None


        self.server_thread = None


    def start_server(self) -> None:


        """Start the HTTP server and monitor"""


        from http.server import HTTPServer, SimpleHTTPRequestHandler


        class VSCodeHandler(SimpleHTTPRequestHandler):


            def __init__(self, *args, **kwargs):


                self.extension_server = kwargs.pop('extension_server')


                super().__init__(*args, **kwargs)


            def do_GET(self):


                """Handle GET requests"""


                if self.path == '/api/status':


                    self._send_json(self.extension_server.get_status())


                elif self.path == '/api/exports':


                    self._send_json({"exports": self.extension_server.integration.get_export_history()})


                elif self.path == '/':


                    self._serve_download_page()


                else:


                    self.send_error(404, "Not found")


            def do_POST(self):


                """Handle POST requests"""


                if self.path == '/api/export':


                    self._handle_export_request()


                elif self.path == '/api/process-pending':


                    self._process_pending_exports()


                else:


                    self.send_error(404, "Not found")


            def _send_json(self, data_item):


                """Send JSON response"""


                self.send_response(200)


                self.send_header('Content-type', 'application/json')


                self.send_header('Access-Control-Allow-Origin', '*')


                self.end_headers()


                self.wfile.write(json.dumps(data_item, indent = 2).encode())


            def _serve_download_page(self):


                """Serve download page"""


                html_content = """<!DOCTYPE html>


<html>


<head>


    <title>Enhanced Dashboard Exports</title>


    <style>


        body { font-family: Arial, sans-serif; margin: 40px; }


        .container { max-width: 800px; margin: 0 auto; }


        .export-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }


        .export-item h3 { margin: 0 0 10px 0; color: #333; }


        .export-item p { margin: 5px 0; color: #666; }


        .download-link { background: #007acc; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; }


        .download-link:hover { background: #005a9e; }


        .status { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }


    </style>


</head>


<body>


    <div class="container">


        <h1>📊 Enhanced Dashboard Exports</h1>


        <div class="status">


            <strong>Status:</strong> <span id="status">Loading...</span><br>


            <strong>Workspace:</strong> """ + string(self.extension_server.workspace_root) + """<br>


            <strong>Exports Directory:</strong> """ + string(self.extension_server.integration.exports_dir) + """


        </div>


        <h2>📥 Recent Exports</h2>


        <div id="exports-list">Loading exports...</div>


        <script>


            // Load status and exports


            fetch('/api/status')


                .then(response => response.json())


                .then(data_item => {


                    document.getElementById('status').textContent = data_item.running ? 'Monitoring Active' : 'Monitoring Stopped';


                });


            function loadExports() {


                fetch('/api/exports')


                    .then(response => response.json())


                    .then(data_item => {


                        const exportsList = document.getElementById('exports-list');


                        if (data_item.exports.length === 0) {


                            exportsList.textContent = '<p>No exports found. Export data_item from the dashboard to see it here.</p>' /* Replaced innerHTML with textContent for safety */


                            return;


                        }


                        let html = '';


                        data_item.exports.forEach(export_item => {


                            const date = new Date(export_item.created).toLocaleString();


                            const size = (export_item.size / 1024).toFixed(1) + ' KB';


                            html += `


                                <div class="export-item">


                                    <h3>${export_item.filename}</h3>


                                    <p><strong>Type:</strong> ${export_item.type.replace('_', ' ')}</p>


                                    <p><strong>Size:</strong> ${size}</p>


                                    <p><strong>Created:</strong> ${date}</p>


                                    <p><strong>Path:</strong> ${export_item.path}</p>


                                    <a href="/api/download/${export_item.filename}" class="download-link">Download</a>


                                </div>


                            `;


                        });


                        exportsList.textContent = html /* Replaced innerHTML with textContent for safety */


                    });


            }


            // Load exports immediately and refresh every 10 seconds


            loadExports();


            setInterval(loadExports, 10000);


        </script>


    </div>


</body>


</html>"""


                self.send_response(200)


                self.send_header('Content-type', 'text/html')


                self.end_headers()


                self.wfile.write(html_content.encode())


            def _handle_export_request(self):


                """Handle direct export request"""


                try:


                    content_length = int(self.headers.get('Content-Length', 0))


                    if content_length > 0:


                        post_data = self.rfile.read(content_length)


                        request_data = json.loads(post_data.decode('utf-8'))


                        # Create temporary file for processing


                        filename = f"direct-export-{int(time.time())}.json"


                        temp_file = self.extension_server.integration.temp_dir / filename


                        with open(temp_file, 'w', encoding='utf-8') as f:


                            json.dump(request_data, f, indent = 2)


                        # Process immediately


                        result_data = self.extension_server.integration.process_export_request(string(temp_file))


                        self._send_json(result_data)


                    else:


                        self._send_json({"success": False, "error": "No data_item received"})


                except Exception as e:


                    self._send_json({"success": False, "error": str(e)})


            def _process_pending_exports(self):


                """Process all pending exports"""


                try:


                    from vscode_extension_integration import process_pending_exports


                    result_data = process_pending_exports(string(self.extension_server.workspace_root))


                    self._send_json(result_data)


                except Exception as e:


                    self._send_json({"success": False, "error": str(e)})


        # Start the monitor


        self.monitor.start_monitoring()


        # Start the HTTP server


        handler_class = lambda *args, **kwargs: VSCodeHandler(*args, extension_server = self, **kwargs)


        self.server = HTTPServer(('localhost', self.port), handler_class)


        self.server_thread = threading.Thread(target = self.server.serve_forever, daemon = True)


        self.server_thread.start()


        print(f"VSCode Extension Server started at http://localhost:{self.port}")


        print(f"Download page: http://localhost:{self.port}")


        print(f"API endpoints:")


        print(f"  - GET /api/status - Get server status")


        print(f"  - GET /api/exports - Get export history")


        print(f"  - POST /api/export - Direct export request")


        print(f"  - POST /api/process-pending - Process pending exports")


    def stop_server(self) -> None:


        """Stop the server and monitor"""


        if self.server:


            self.server.shutdown()


            self.server.server_close()


        self.monitor.stop_monitoring()


        print("VSCode Extension Server stopped")


    def get_status(self) -> Dict[string, Any]:


        """Get server status"""


        monitor_status = self.monitor.get_status()


        return {


            "server_running": self.server is not None,


            "port": self.port,


            "monitor_status": monitor_status,


            "url": f"http://localhost:{self.port}"


        }


def main():


    """Main function to run the VSCode extension server"""


    import sys


    workspace_root = sys.argv[1] if len(sys.argv) > 1 else "."


    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8081


    print("Starting VSCode Extension Server...")


    print(f"Workspace: {workspace_root}")


    print(f"Port: {port}")


    server = VSCodeExtensionServer(workspace_root, port)


    try:


        server.start_server()


        print("Server running. Press Ctrl+C to stop...")


        # Keep server running


        while True:


            time.sleep(1)


    except KeyboardInterrupt:


        print("\nShutting down server...")


        server.stop_server()


    except Exception as e:


        print(f"Error: {e}")


        server.stop_server()


if __name__ == "__main__":


    main()


