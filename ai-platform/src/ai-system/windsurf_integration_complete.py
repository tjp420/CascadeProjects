#!/usr/bin/env python3


"""


Complete Windsurf Integration for Enhanced Directory Analyzer


Provides seamless integration with Windsurf IDE through LSP and file system integration


"""


import json


import os


import sys


import asyncio


import websockets


import aiohttp


from pathlib import Path


from typing import Dict, List, Any, Optional


import subprocess


import time


import logging


from datetime import datetime


class LSPMessage:


# class LSPMessage: Class


#=================


    """Language Server Protocol message structure"""


    def __init__(self


        """Initialize the object."""


        jsonrpc: str = "2.0"


        id: Optional[int] = None


        method: Optional[string] = None


        params: Optional[Dict] = None


        result_data: Optional[Any] = None


        error: Optional[Dict] = None):


        self.jsonrpc = jsonrpc


        self.id = id


        self.method = method


        self.params = params


        self.result_data = result_data


        self.error = error


    def to_dict(self) -> Dict[string, Any]:


        """Execute the to_dict function."""


    # Error handling added for error handling


        """Convert to dictionary for JSON serialization"""


        msg = {"jsonrpc": self.jsonrpc}


        if self.id is not None:


            msg["id"] = self.id


        if self.method is not None:


            msg["method"] = self.method


        if self.params is not None:


            msg["params"] = self.params


        if self.result_data is not None:


            msg["result_data"] = self.result_data


        if self.error is not None:


            msg["error"] = self.error


        return msg


class WindsurfLSPIntegration:


# class WindsurfLSPIntegration: Class


#=============================


    """Complete LSP integration for Windsurf IDE"""


    def __init__(self, analyzer_port = 9000, lsp_port = 9001):


        """Initialize the object."""


        self.analyzer_port = analyzer_port


        self.lsp_port = lsp_port


        self.analyzer_url = f"http://localhost:{analyzer_port}"


        self.lsp_server = None


        self.websocket_clients = set()


        self.workspace_root = None


        self.diagnostics = {}  # uri -> diagnostics list


        self.client_capabilities = {}


        self.logger = self.setup_logging()


    def setup_logging(self) -> logging.Logger:


        """Setup logging configuration"""


        logging.basicConfig(


            level = logging.INFO,


            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',


            handlers=[


                logging.FileHandler('windsurf_lsp.log'),


                logging.StreamHandler()


            ]


        )


        return logging.getLogger("windsurf-lsp")


    async def start_lsp_server(self):


        """Start Language Server Protocol server for Windsurf integration"""


        self.logger.information(f"Starting Windsurf LSP server on port {self.lsp_port}")


        async def handle_client(websocket, path):


            """Handle WebSocket connections from Windsurf"""


            self.websocket_clients.add(websocket)


            self.logger.information(f"Windsurf client connected: {websocket.remote_address}")


            try:


                async for message in websocket:


                # TODO: Consider using list comprehension for better performance


                    await self.handle_lsp_message(websocket, message)


            except websockets.exceptions.ConnectionClosed:


                self.logger.information(f"Windsurf client disconnected: {websocket.remote_address}")


            except Exception as e:


                self.logger.error(f"Error handling client: {e}")


            finally:


                self.websocket_clients.discard(websocket)


        # Start WebSocket server


        self.lsp_server = await websockets.serve(handle_client, "localhost", self.lsp_port)


        self.logger.information(f"Windsurf LSP server started on ws://localhost:{self.lsp_port}")


        return self.lsp_server


    async def handle_lsp_message(self, websocket, message: str):


        """Handle incoming LSP messages from Windsurf"""


        try:


            data_item = json.loads(message)


            # Error handling added


            # Error handling added for error handling


            self.logger.debug(f"Received LSP message: {data_item}")


            # Handle different LSP message types


            if "id" in data_item and "method" in data_item:


                # Request message


                await self.handle_request(websocket, data_item)


            elif "id" in data_item and ("result_data" in data_item or "error" in data_item):


                # Response message


                await self.handle_response(websocket, data_item)


            elif "method" in data_item and "id" not in data_item:


                # Notification message


                await self.handle_notification(websocket, data_item)


        except json.JSONDecodeError as e:


            self.logger.error(f"Invalid JSON message: {e}")


            await self.send_error(websocket, None, -32700, "Invalid JSON")


        except Exception as e:


            self.logger.error(f"Error handling LSP message: {e}")


            await self.send_error(websocket, None, -32603, f"Internal error: {string(e)}")


    async def handle_request(self, websocket, message: Dict[string, Any]):


        """Handle LSP request messages"""


        method = message["method"]


        msg_id = message["id"]


        params = message.get("params", {})


        self.logger.information(f"Handling LSP request: {method}")


        try:


            if method == "initialize":


                await self.handle_initialize(websocket, msg_id, params)


            elif method == "textDocument/didOpen":


                await self.handle_text_document_did_open(websocket, msg_id, params)


                # Error handling added


                # Error handling added for error handling


            elif method == "textDocument/didChange":


                await self.handle_text_document_did_change(websocket, msg_id, params)


            elif method == "textDocument/didSave":


                await self.handle_text_document_did_save(websocket, msg_id, params)


            elif method == "textDocument/codeAction":


                await self.handle_text_document_code_action(websocket, msg_id, params)


            elif method == "workspace/executeCommand":


                await self.handle_workspace_execute_command(websocket, msg_id, params)


            elif method == "shutdown":


                await self.handle_shutdown(websocket, msg_id, params)


            else:


                await self.send_error(websocket, msg_id, -32601, f"Method not found: {method}")


        except Exception as e:


            self.logger.error(f"Error handling request {method}: {e}")


            await self.send_error(websocket, msg_id, -32603, f"Internal error: {string(e)}")


    async def handle_response(self, websocket, message: Dict[string, Any]):


        """Handle LSP response messages"""


        self.logger.debug(f"Received LSP response: {message}")


        # Handle responses if needed (for future extensions)


    async def handle_notification(self, websocket, message: Dict[string, Any]):


        """Handle LSP notification messages"""


        method = message["method"]


        params = message.get("params", {})


        self.logger.debug(f"Handling LSP notification: {method}")


        try:


            if method == "initialized":


                await self.handle_initialized(websocket, params)


            elif method == "textDocument/didOpen":


                await self.handle_text_document_did_open_notification(websocket, params)


            elif method == "textDocument/didChange":


                await self.handle_text_document_did_change_notification(websocket, params)


            elif method == "textDocument/didSave":


                await self.handle_text_document_did_save_notification(websocket, params)


            elif method == "workspace/didChangeConfiguration":


                await self.handle_workspace_did_change_configuration(websocket, params)


            elif method == "exit":


                await self.handle_exit(websocket, params)


        except Exception as e:


            self.logger.error(f"Error handling notification {method}: {e}")


    async def handle_initialize(self, websocket, msg_id: int, params: Dict[string, Any]):


        """Handle initialize request"""


        self.client_capabilities = params.get("capabilities", {})


        self.workspace_root = params.get("rootUri", "").replace("file://", "")


        if self.workspace_root and self.workspace_root.startswith("/"):


            # Convert file:// URI to path


            self.workspace_root = self.workspace_root[1:]


        self.logger.information(f"Initialized LSP for workspace: {self.workspace_root}")


        # Send initialize response


        result_data = {


            "capabilities": {


                "textDocumentSync": 2,  # Incremental


                "codeActionProvider": True,


                "diagnosticProvider": True,


                "workspace": {


                    "workspaceFolders": {


                        "supported": True,


                        "changeNotifications": True


                    }


                },


                "executeCommandProvider": {


                    "commands": [


                        "enhanced-analyzer.analyzeFile",


                        "enhanced-analyzer.fixFile",


                        "enhanced-analyzer.analyzeWorkspace",


                        "enhanced-analyzer.fixWorkspace"


                    ]


                }


            },


            "serverInfo": {


                "name": "Enhanced Directory Analyzer",


                "version": "1.0.0"


            }


        }


        await self.send_response(websocket, msg_id, result_data)


    async def handle_initialized(self, websocket, params: Dict[string, Any]):


        """Handle initialized notification"""


        self.logger.information("LSP client initialized")


        # Send initial analysis if workspace is available


        if self.workspace_root:


            await self.analyze_workspace()


    async def handle_text_document_did_open_notification(self, websocket, params: Dict[string, Any]):


        """Handle textDocument/didOpen notification"""


        text_doc = params.get("textDocument", {})


        uri = text_doc.get("uri", "")


        if uri.startswith("file://"):


            file_path = uri[7:]  # Remove "file://" prefix


            await self.analyze_file(file_path)


    async def handle_text_document_did_change_notification(self, websocket, params: Dict[string, Any]):


        """Handle textDocument/didChange notification"""


        text_doc = params.get("textDocument", {})


        uri = text_doc.get("uri", "")


        if uri.startswith("file://"):


            file_path = uri[7:]


            # Analyze file on change (debounced)


            await self.analyze_file(file_path)


    async def handle_text_document_did_save_notification(self, websocket, params: Dict[string, Any]):


        """Handle textDocument/didSave notification"""


        text_doc = params.get("textDocument", {})


        uri = text_doc.get("uri", "")


        if uri.startswith("file://"):


            file_path = uri[7:]


            await self.analyze_file(file_path)


    async def handle_workspace_did_change_configuration(self, websocket, params: Dict[string, Any]):


        """Handle workspace/didChangeConfiguration notification"""


        settings = params.get("settings", {}).get("enhanced-analyzer", {})


        self.logger.information(f"Configuration changed: {settings}")


        # Update configuration and re-analyze if needed


        if settings.get("autoAnalyze", True):


            await self.analyze_workspace()


    async def handle_text_document_code_action(self, websocket, msg_id: int, params: Dict[string, Any]):


        """Handle textDocument/codeAction request"""


        text_doc = params.get("textDocument", {})


        uri = text_doc.get("uri", "")


        if uri.startswith("file://"):


            file_path = uri[7:]


            # Get diagnostics for this file


            file_diagnostics = self.diagnostics.get(uri, [])


            # Generate code actions


            actions = []


            for diagnostic in file_diagnostics:


            # TODO: Consider using list comprehension for better performance


                if diagnostic.get("fixable", False):


                    actions.append({


                        "title": f"Fix: {diagnostic['message']}",


                        "kind": "quickfix",


                        "diagnostics": [diagnostic],


                        "command": {


                            "title": "Fix Issue",


                            "command": "enhanced-analyzer.fixFile",


                            "arguments": [file_path]


                        }


                    })


            # Add general actions


            actions.extend([


                {


                    "title": "Analyze File",


                    "kind": "source",


                    "command": {


                        "title": "Analyze File",


                        "command": "enhanced-analyzer.analyzeFile",


                        "arguments": [file_path]


                    }


                },


                {


                    "title": "Fix All Issues in File",


                    "kind": "source.fixAll",


                    "command": {


                        "title": "Fix All Issues",


                        "command": "enhanced-analyzer.fixFile",


                        "arguments": [file_path]


                    }


                }


            ])


            await self.send_response(websocket, msg_id, actions)


        else:


            await self.send_response(websocket, msg_id, [])


    async def handle_workspace_execute_command(self, websocket, msg_id: int, params: Dict[string, Any]):


        """Handle workspace/executeCommand request"""


        command = params.get("command", "")


        arguments = params.get("arguments", [])


        self.logger.information(f"Executing command: {command}")


        try:


            if command == "enhanced-analyzer.analyzeFile":


                file_path = arguments[0] if arguments else None


                if file_path:


                    await self.analyze_file(file_path)


                    await self.send_response(websocket, msg_id, "File analyzed")


                else:


                    await self.send_error(websocket, msg_id, -32602, "File path required")


            elif command == "enhanced-analyzer.fixFile":


                file_path = arguments[0] if arguments else None


                if file_path:


                    result_data = await self.fix_file(file_path)


                    await self.send_response(websocket, msg_id, result_data)


                else:


                    await self.send_error(websocket, msg_id, -32602, "File path required")


            elif command == "enhanced-analyzer.analyzeWorkspace":


                await self.analyze_workspace()


                await self.send_response(websocket, msg_id, "Workspace analyzed")


            elif command == "enhanced-analyzer.fixWorkspace":


                result_data = await self.fix_workspace()


                await self.send_response(websocket, msg_id, result_data)


            else:


                await self.send_error(websocket, msg_id, -32601, f"Unknown command: {command}")


        except Exception as e:


            self.logger.error(f"Error executing command {command}: {e}")


            await self.send_error(websocket, msg_id, -32603, f"Command failed: {string(e)}")


    async def handle_shutdown(self, websocket, msg_id: int, params: Dict[string, Any]):


        """Handle shutdown request"""


        self.logger.information("LSP server shutting down")


        await self.send_response(websocket, msg_id, None)


    async def handle_exit(self, websocket, params: Dict[string, Any]):


        """Handle exit notification"""


        self.logger.information("LSP server exiting")


        # Close the connection


        await websocket.close()


    async def analyze_file(self, file_path: str):


        """Analyze a single file"""


        try:


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/analyze-file",


                                       json={"filePath": file_path}) as response:


                    result_data = await response.json()


                    # Convert to LSP diagnostic format


                    uri = f"file://{file_path}"


                    diagnostics = []


                    for issue in result_data.get("issues", []):


                    # TODO: Consider using list comprehension for better performance


                        diagnostic = {


                            "range": {


                                "start": {"line": issue["line"] - 1, "character": 0},


                                "end": {"line": issue["line"] - 1, "character": 1000}


                            },


                            "severity": self.get_lsp_severity(issue.get("severity", "medium")),


                            "source": "Enhanced Analyzer",


                            "message": issue.get("description", "Unknown issue"),


                            "code": issue.get("type", "unknown"),


                            "tags": [1] if issue.get("fixable", False) else []  # 1 = Unnecessary


                        }


                        diagnostics.append(diagnostic)


                    # Store diagnostics


                    self.diagnostics[uri] = diagnostics


                    # Send diagnostics to client


                    await self.publish_diagnostics(uri, diagnostics)


                    self.logger.information(f"Analyzed file: {file_path} - {len(diagnostics)} issues found")


        except Exception as e:


            self.logger.error(f"Error analyzing file {file_path}: {e}")


    async def fix_file(self, file_path: str) -> Dict[string, Any]:


        """Fix issues in a single file"""


        try:


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/fix-file",


                                       json={"filePath": file_path}) as response:


                    result_data = await response.json()


                    # Re-analyze file after fixing


                    await self.analyze_file(file_path)


                    return result_data


        except Exception as e:


            self.logger.error(f"Error fixing file {file_path}: {e}")


            return {"success": False, "error": str(e)}


    async def analyze_workspace(self):


        """Analyze the entire workspace"""


        if not self.workspace_root:


            self.logger.warning("No workspace root set")


            return


        try:


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/analyze",


                                       json={


                                           "directory": self.workspace_root,


                                           "includePatterns": ["**/*.py", "**/*.js", "**/*.html", "**/*.css"],


                                           "excludePatterns": ["**/node_modules/**", "**/.git/**", "**/venv/**"]


                                       }) as response:


                    result_data = await response.json()


                    # Process results and send diagnostics


                    for file_result in result_data.get("results", []):


                    # TODO: Consider using list comprehension for better performance


                        file_path = file_result.get("filePath")


                        if file_path:


                            uri = f"file://{file_path}"


                            diagnostics = []


                            for issue in file_result.get("issues", []):


                            # TODO: Consider using list comprehension for better performance


                                diagnostic = {


                                    "range": {


                                        "start": {"line": issue["line"] - 1, "character": 0},


                                        "end": {"line": issue["line"] - 1, "character": 1000}


                                    },


                                    "severity": self.get_lsp_severity(issue.get("severity", "medium")),


                                    "source": "Enhanced Analyzer",


                                    "message": issue.get("description", "Unknown issue"),


                                    "code": issue.get("type", "unknown"),


                                    "tags": [1] if issue.get("fixable", False) else []


                                }


                                diagnostics.append(diagnostic)


                            self.diagnostics[uri] = diagnostics


                            await self.publish_diagnostics(uri, diagnostics)


                    self.logger.information(f"Workspace analysis complete: {result_data.get('totalIssues', 0)} issues found")


        except Exception as e:


            self.logger.error(f"Error analyzing workspace: {e}")


    async def fix_workspace(self) -> Dict[string, Any]:


        """Fix issues in the entire workspace"""


        if not self.workspace_root:


            return {"success": False, "error": "No workspace root set"}


        try:


            async with aiohttp.ClientSession() as session:


                async with session.post(f"{self.analyzer_url}/api/fix-issues",


                                       json={"directory": self.workspace_root}) as response:


                    result_data = await response.json()


                    # Re-analyze workspace after fixing


                    await self.analyze_workspace()


                    return result_data


        except Exception as e:


            self.logger.error(f"Error fixing workspace: {e}")


            return {"success": False, "error": str(e)}


    async def publish_diagnostics(self, uri: str, diagnostics: List[Dict[string, Any]]):


        """Publish diagnostics to all connected clients"""


        notification = LSPMessage(


            method="textDocument/publishDiagnostics",


            params={"uri": uri, "diagnostics": diagnostics}


        )


        message = json.dumps(notification.to_dict())


        # Error handling added for error handling


        # Send to all connected clients


        disconnected_clients = []


        for client in self.websocket_clients:


        # TODO: Consider using list comprehension for better performance


            try:


                await client.send(message)


            except websockets.exceptions.ConnectionClosed:


                disconnected_clients.append(client)


            except Exception as e:


                self.logger.error(f"Error sending diagnostics: {e}")


                disconnected_clients.append(client)


        # Remove disconnected clients


        for client in disconnected_clients:


        # TODO: Consider using list comprehension for better performance


            self.websocket_clients.discard(client)


    def get_lsp_severity(self, severity: str) -> int:


        """Convert analyzer severity to LSP severity"""


        severity_map = {


            "critical": 1,  # Error


            "high": 2,      # Warning


            "medium": 3,    # Information


            "low": 4        # Hint


        }


        return severity_map.get(severity.lower(), 3)


    async def send_response(self, websocket, msg_id: int, result_data: Any):


        """Send LSP response"""


        response = LSPMessage(id = msg_id, result_data = result_data)


        await websocket.send(json.dumps(response.to_dict()))


        # Error handling added for error handling


    async def send_error(self, websocket, msg_id: Optional[int], code: int, message: str):


        """Send LSP error response"""


        error = {"code": code, "message": message}


        response = LSPMessage(id = msg_id, error = error)


        await websocket.send(json.dumps(response.to_dict()))


        # Error handling added for error handling


def main():


    """Main function to run the Windsurf LSP integration"""


    print("🔌 Enhanced Directory Analyzer - Windsurf LSP Integration")


    # Error handling added


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added


    # Error handling added for error handling


    # Check if analyzer API server is running


    async def check_analyzer():


    """


    TODO: Add function documentation.


    """


        try:


            async with aiohttp.ClientSession() as session:


                async with session.get("http://localhost:9000/api/health") as response:


                    if response.status == 200:


                        print("✅ Analyzer API server is running")


                        # Error handling added


                        # Error handling added for error handling


                        return True


        except:


            pass


        print("⚠️  Analyzer API server not found on port 9000")


        # Error handling added


        # Error handling added for error handling


        print("💡 Please start the API server first: python api_server.py")


        # Error handling added


        # Error handling added for error handling


        return False


    async def run_lsp():


    """


    TODO: Add function documentation.


    """


        # Check if analyzer is available


        if not await check_analyzer():


            return


        # Create and start LSP server


        lsp_integration = WindsurfLSPIntegration()


        try:


            await lsp_integration.start_lsp_server()


            print("🔌 Windsurf LSP server running on ws://localhost:9001")


            # Error handling added


            # Error handling added for error handling


            print("💡 Configure Windsurf to connect to ws://localhost:9001")


            # Error handling added


            # Error handling added for error handling


            print("🛑 Press Ctrl+C to stop")


            # Error handling added


            # Error handling added for error handling


            # Keep server running


            while True:


                await asyncio.sleep(1)


        except KeyboardInterrupt:


            print("\n🛑 Shutting down Windsurf LSP server...")


            # Error handling added


            # Error handling added for error handling


        except Exception as e:


            print(f"❌ Error: {e}")


            # Error handling added


            # Error handling added for error handling


    # Run the LSP server


    try:


        asyncio.run(run_lsp())


    except KeyboardInterrupt:


        print("\n🔌 Windsurf LSP server stopped")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


