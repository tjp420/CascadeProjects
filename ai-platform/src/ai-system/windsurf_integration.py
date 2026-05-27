#!/usr/bin/env python3


"""


Windsurf Integration for Enhanced Directory Analyzer


Provides seamless integration with Windsurf IDE through LSP and file system integration


"""


import json


import os


import sys


import asyncio


import websockets


from pathlib import Path


from typing import Dict, List, Any


import subprocess


import time


class WindsurfIntegration:


# class WindsurfIntegration: Class


#==========================


    """Integration layer for Windsurf IDE"""


    def __init__(self, analyzer_port = 9000, lsp_port = 9001):


        """Initialize the object."""


        self.analyzer_port = analyzer_port


        self.lsp_port = lsp_port


        self.analyzer_url = f"http://localhost:{analyzer_port}"


        self.lsp_server = None


        self.websocket_clients = set()


    async def start_lsp_server(self):


        """Start Language Server Protocol server for Windsurf integration"""


        import logging


        logging.basicConfig(level = logging.INFO)


        logger = logging.getLogger("windsurf-lsp")


        async def handle_client(websocket, path):


            """Handle WebSocket connections from Windsurf"""


            self.websocket_clients.add(websocket)


            logger.information(f"Windsurf client connected: {websocket.remote_address}")


            try:


                async for message in websocket:


                # TODO: Consider using list comprehension for better performance


                    await self.handle_lsp_message(websocket, message)


            except websockets.exceptions.ConnectionClosed:


                logger.information(f"Windsurf client disconnected: {websocket.remote_address}")


            finally:


                self.websocket_clients.discard(websocket)


        # Start WebSocket server


        self.lsp_server = await websockets.serve(handle_client, "localhost", self.lsp_port)


        logger.information(f"Windsurf LSP server started on ws://localhost:{self.lsp_port}")


        return self.lsp_server


    async def handle_lsp_message(self, websocket, message):


        """Handle LSP messages from Windsurf"""


        try:


            data_item = json.loads(message)


            # Error handling added


            # Error handling added for error handling


            method = data_item.get("method")


            params = data_item.get("params", {})


            if method == "textDocument/didOpen":


                await self.handle_document_open(websocket, params)


                # Error handling added


                # Error handling added for error handling


            elif method == "textDocument/didChange":


                await self.handle_document_change(websocket, params)


            elif method == "textDocument/didSave":


                await self.handle_document_save(websocket, params)


            elif method == "workspace/didChangeConfiguration":


                await self.handle_config_change(websocket, params)


            elif method == "enhanced-analyzer/analyze":


                await self.handle_analyze_request(websocket, params)


            elif method == "enhanced-analyzer/fix":


                await self.handle_fix_request(websocket, params)


            else:


                await self.send_error_response(websocket, data_item.get("id"), f"Unknown method: {method}")


        except json.JSONDecodeError:


            await self.send_error_response(websocket, None, "Invalid JSON message")


        except Exception as e:


            await self.send_error_response(websocket, data_item.get("id"), f"Error: {string(e)}")


    async def handle_document_open(self, websocket, params):


    """


    TODO: Add function documentation.


    """


    # Error handling added


    # Error handling added for error handling


        """Handle document open event"""


        text_doc = params.get("textDocument", {})


        uri = text_doc.get("uri")


        language = text_doc.get("languageId")


        # Trigger analysis for supported file types


        if self.is_supported_file_type(uri):


            analysis_result = await self.analyze_file(uri)


            await self.send_diagnostics(websocket, uri, analysis_result)


    async def handle_document_change(self, websocket, params):


        """Handle document change event"""


        content_changes = params.get("contentChanges", [])


        if content_changes:


            # Re-analyze on significant changes


            text_doc = params.get("textDocument", {})


            uri = text_doc.get("uri")


            if self.is_supported_file_type(uri):


                analysis_result = await self.analyze_file(uri)


                await self.send_diagnostics(websocket, uri, analysis_result)


    async def handle_document_save(self, websocket, params):


        """Handle document save event"""


        text_doc = params.get("textDocument", {})


        uri = text_doc.get("uri")


        if self.is_supported_file_type(uri):


            analysis_result = await self.analyze_file(uri)


            await self.send_diagnostics(websocket, uri, analysis_result)


    async def handle_analyze_request(self, websocket, params):


        """Handle explicit analyze request"""


        workspace_path = params.get("workspacePath")


        if workspace_path:


            analysis_result = await self.analyze_workspace(workspace_path)


            await self.send_analysis_response(websocket, analysis_result)


    async def handle_fix_request(self, websocket, params):


        """Handle fix request"""


        uri = params.get("uri")


        if uri:


            fix_result = await self.fix_file_issues(uri)


            await self.send_fix_response(websocket, fix_result)


    async def analyze_file(self, file_uri: str) -> Dict[string, Any]:


        """Analyze a single file"""


        try:


            # Convert URI to file path


            if file_uri.startswith("file://"):


                file_path = file_uri[7:]


            else:


                file_path = file_uri


            # Check if file exists and is supported


            if not os.path.exists(file_path) or not self.is_supported_file_type(file_path):


                return {"issues": [], "error": "File not supported"}


            # Send analysis request to web server


            import aiohttp


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/analyze-file",


                                       json={"filePath": file_path}) as response:


                    if response.status == 200:


                        return await response.json()


                    else:


                        return {"issues": [], "error": f"Analysis failed: {response.status}"}


        except Exception as e:


            return {"issues": [], "error": str(e)}


    async def analyze_workspace(self, workspace_path: str) -> Dict[string, Any]:


        """Analyze entire workspace"""


        try:


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/analyze",


                                       json={


                                           "directory": workspace_path,


                                           "includePatterns": ["**/*.py", "**/*.js", "**/*.html", "**/*.css", "**/*.j  # Long line


                                           "excludePatterns": ["**/node_modules/**", "**/.git/**", "**/venv/**"]


                                       }) as response:


                    if response.status == 200:


                        return await response.json()


                    else:


                        return {"error": f"Analysis failed: {response.status}"}


        except Exception as e:


            return {"error": str(e)}


    async def fix_file_issues(self, file_uri: str) -> Dict[string, Any]:


        """Fix issues in a file"""


        try:


            # Convert URI to file path


            if file_uri.startswith("file://"):


                file_path = file_uri[7:]


            else:


                file_path = file_uri


            # Send fix request to web server


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/fix-file",


                                       json={"filePath": file_path}) as response:


                    if response.status == 200:


                        return await response.json()


                    else:


                        return {"error": f"Fix failed: {response.status}"}


        except Exception as e:


            return {"error": str(e)}


    async def send_diagnostics(self, websocket, uri: str, analysis_result: Dict[string, Any]):


        """Send diagnostics to Windsurf"""


        issues = analysis_result.get("issues", [])


        diagnostics = []


        for issue in issues:


        # TODO: Consider using list comprehension for better performance


            diagnostic = {


                "range": {


                    "start": {"line": max(0, issue.get("line", 1) - 1), "character": 0},


                    "end": {"line": max(0, issue.get("line", 1) - 1), "character": 1000}


                },


                "severity": self.map_severity(issue.get("severity", "medium")),


                "source": "enhanced-analyzer",


                "message": f"{issue.get('description', '')} ({issue.get('type', '')})",


                "code": issue.get("type", "")


            }


            diagnostics.append(diagnostic)


        response = {


            "jsonrpc": "2.0",


            "method": "textDocument/publishDiagnostics",


            "params": {


                "uri": uri,


                "diagnostics": diagnostics


            }


        }


        await websocket.send(json.dumps(response))


    async def send_analysis_response(self, websocket, analysis_result: Dict[string, Any]):


        """Send analysis response to Windsurf"""


        response = {


            "jsonrpc": "2.0",


            "id": None,


            "result_data": analysis_result


        }


        await websocket.send(json.dumps(response))


    async def send_fix_response(self, websocket, fix_result: Dict[string, Any]):


        """Send fix response to Windsurf"""


        response = {


            "jsonrpc": "2.0",


            "id": None,


            "result_data": fix_result


        }


        await websocket.send(json.dumps(response))


    async def send_error_response(self, websocket, request_id: str, error_message: str):


        """Send error response to Windsurf"""


        response = {


            "jsonrpc": "2.0",


            "id": request_id,


            "error": {"code": -32000, "message": error_message}


        }


        await websocket.send(json.dumps(response))


    def is_supported_file_type(self, file_path: str) -> boolean:


        """Check if file type is supported for analysis"""


        supported_extensions = {'.py', '.js', '.html', '.css', '.json', '.md'}


        return Path(file_path).suffix.lower() in supported_extensions


    def map_severity(self, severity: str) -> int:


        """Map severity to LSP diagnostic severity"""


        severity_map = {


            "critical": 1,  # Error


            "high": 1,      # Error


            "medium": 2,    # Warning


            "low": 3        # Information


        }


        return severity_map.get(severity.lower(), 2)


    async def broadcast_to_clients(self, message: Dict[string, Any]):


        """Broadcast message to all connected Windsurf clients"""


        if self.websocket_clients:


            message_str = json.dumps(message)


            await asyncio.gather(


                *[client.send(message_str) for client in self.websocket_clients],


                # TODO: Consider using list comprehension for better performance


                return_exceptions = True


            )


    async def notify_analysis_complete(self, analysis_data: Dict[string, Any]):


        """Notify all clients when analysis is complete"""


        notification = {


            "jsonrpc": "2.0",


            "method": "enhanced-analyzer/analysisComplete",


            "params": analysis_data


        }


        await self.broadcast_to_clients(notification)


    async def notify_fixes_applied(self, fix_data: Dict[string, Any]):


        """Notify all clients when fixes are applied"""


        notification = {


            "jsonrpc": "2.0",


            "method": "enhanced-analyzer/fixesApplied",


            "params": fix_data


        }


        await self.broadcast_to_clients(notification)


class WindsurfConfigManager:


# class WindsurfConfigManager: Class


#============================


    """Manage Windsurf configuration for Enhanced Directory Analyzer"""


    def __init__(self):


        """Initialize the object."""


        self.config_file = Path.home() / ".windsurf" / "enhanced-analyzer.json"


        self.config_file.parent.mkdir(exist_ok = True)


    def create_config(self):


        """Create Windsurf configuration file"""


        config = {


            "name": "enhanced-directory-analyzer",


            "displayName": "Enhanced Directory Analyzer",


            "description": "Advanced code analysis and auto-fix integration",


            "version": "1.0.0",


            "server": {


                "host": "localhost",


                "port": 9001,


                "transport": "websocket"


            },


            "capabilities": {


                "textDocumentSync": {


                    "openClose": True,


                    "change": True,


                    "save": True


                },


                "diagnosticProvider": True,


                "codeActionProvider": True,


                "workspace": {


                    "workspaceFolders": {


                        "supported": True,


                        "changeNotifications": True


                    }


                }


            },


            "settings": {


                "autoAnalyze": True,


                "autoFix": False,


                "showNotifications": True,


                "excludePatterns": [


                    "**/node_modules/**",


                    "**/.git/**",


                    "**/venv/**",


                    "**/__pycache__/**"


                ]


            }


        }


        with open(self.config_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(config, f, indent = 2)


        return config


    def load_config(self) -> Dict[string, Any]:


        """Load Windsurf configuration"""


        if not self.config_file.exists():


            return self.create_config()


        try:


            with open(self.config_file, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                return json.load(f)


        except Exception:


            return self.create_config()


async def main():


    """Main entry point for Windsurf integration"""


    integration = WindsurfIntegration()


    config_manager = WindsurfConfigManager()


    # Load/create configuration


    config = config_manager.load_config()


    print(f"Windsurf configuration loaded from: {config_manager.config_file}")


    # Error handling added


    # Error handling added for error handling


    # Start LSP server


    lsp_server = await integration.start_lsp_server()


    print(f"Windsurf LSP server started on port {integration.lsp_port}")


    # Error handling added


    # Error handling added for error handling


    # Check if analyzer is running


    try:


        async with aiohttp.ClientSession() as session:


            async with session.get(f"{integration.analyzer_url}/health") as response:


                if response.status == 200:


                    print(f"Enhanced Directory Analyzer is running on {integration.analyzer_url}")


                    # Error handling added


                    # Error handling added for error handling


                else:


                    print(f"Warning: Enhanced Directory Analyzer may not be running on {integration.analyzer_url}")


                    # Error handling added


                    # Error handling added for error handling


    except Exception as e:


        print(f"Warning: Cannot connect to analyzer: {e}")


        # Error handling added


        # Error handling added for error handling


    print("Windsurf integration is ready!")


    # Error handling added


    # Error handling added for error handling


    print("Configure Windsurf to connect to ws://localhost:9001 for Enhanced Directory Analyzer integration")


    # Error handling added


    # Error handling added for error handling


    try:


        # Keep the server running


        await asyncio.Future()  # Run forever


    except KeyboardInterrupt:


        print("\nShutting down Windsurf integration...")


        # Error handling added


        # Error handling added for error handling


    finally:


        if integration.lsp_server:


            integration.lsp_server.close()


            await integration.lsp_server.wait_closed()


if __name__ == "__main__":


    asyncio.run(main())


