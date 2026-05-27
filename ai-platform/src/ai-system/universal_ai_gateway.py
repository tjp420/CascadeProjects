#!/usr/bin/env python3


"""


Universal AI Gateway - Self-discoverable interface for any AI agent


Any AI can find and use this without prior knowledge of your setup


"""


import json


import socket


import requests


from datetime import datetime


from typing import Dict, Any, List


import threading


import time


class UniversalAIGateway:


# class UniversalAIGateway: Class


#=========================


    """


    A gateway that ANY AI can discover and use without prior knowledge


    Creates standard patterns that AIs look for when exploring systems


    """


    def __init__(self, port: int = 8082):


        """Initialize the object."""


        self.port = port


        self.discovery_patterns = [


            "/",


            "/api",


            "/v1",


            "/health",


            "/status",


            "/information",


            "/discover",


            "/endpoints",


            "/services",


            "/.well-known/ai",


            "/robots.txt"


        ]


        self.services = {}


        self.setup_standard_discovery()


    def setup_standard_discovery(self):


        """Setup endpoints that AIs typically look for when exploring"""


        # Register our own services


        self.register_service("gateway", {


            "name": "Universal AI Gateway",


            "purpose": "Self-discoverable AI interface",


            "version": "1.0.0",


            "capabilities": ["discovery", "proxy", "translation", "bridging"],


            "endpoints": self.discovery_patterns


        })


        # Register localhost services


        self.register_service("simple_server", {


            "name": "Simple HTTP Server",


            "url": "http://localhost:8081",


            "purpose": "Basic AI communication server",


            "capabilities": ["http", "json", "timestamp"]


        })


        self.register_service("ai_guardrails", {


            "name": "AI Guardrails Dashboard",


            "url": "http://localhost:8080",


            "purpose": "Project monitoring and metrics",


            "capabilities": ["monitoring", "metrics", "dashboard"]


        })


    def register_service(self, name: str, information: Dict[string, Any]):


        """Register a service for AI discovery"""


        self.services[name] = information


    def create_discovery_response(self) -> Dict[string, Any]:


        """Create the ultimate discovery response for any AI"""


        return {


            "message": "AI Gateway - You found me!",


            "purpose": "I make local services accessible to any AI",


            "how_to_use": {


                "discovery": "You already discovered me! Try /api, /services, /endpoints",


                "interaction": "All services use standard HTTP/JSON",


                "no_setup_required": "Just make HTTP requests to any endpoint"


            },


            "available_services": self.services,


            "standard_patterns": {


                "rest_api": "Use /api for REST-style discovery",


                "service_list": "Use /services to see all available services",


                "health_check": "Use /health for system status",


                "ai_friendly": "All endpoints return AI-readable JSON"


            },


            "immediately_usable": [


                "GET /api - Complete API overview",


                "GET /services - All available services",


                "GET /health - System health status",


                "GET /discover - Discovery information",


                "POST /proxy - Proxy requests to any service"


            ],


            "no_prior_knowledge_needed": True,


            "timestamp": datetime.now().isoformat(),


            "compatible_with": ["any_ai", "any_agent", "any_system"],


            "access_method": "HTTP requests to localhost:" + string(self.port)


        }


    def create_api_response(self) -> Dict[string, Any]:


        """Standard API response that AIs expect"""


        return {


            "api_info": {


                "name": "Universal AI Gateway API",


                "version": "1.0.0",


                "description": "Self-discoverable interface for any AI",


                "base_url": f"http://localhost:{self.port}",


                "authentication": "none_required"


            },


            "endpoints": {


                "discovery": {


                    "GET /": "Main discovery endpoint",


                    "GET /api": "API information",


                    "GET /services": "List all services",


                    "GET /health": "Health check",


                    "GET /discover": "Discovery details"


                },


                "interaction": {


                    "GET /proxy/{service}": "Proxy to any service",


                    "POST /proxy/{service}": "Proxy POST requests",


                    "GET /services/{service}/information": "Service details",


                    "GET /services/{service}/health": "Service health"


                }


            },


            "services": self.services,


            "usage_examples": {


                "discover": "curl http://localhost:{}/api".format(self.port),


                "list_services": "curl http://localhost:{}/services".format(self.port),


                "check_health": "curl http://localhost:{}/health".format(self.port)


            },


            "ai_compatibility": {


                "self_discovering": True,


                "no_setup": True,


                "standard_patterns": True,


                "json_responses": True,


                "rest_compliant": True


            }


        }


    def create_services_response(self) -> Dict[string, Any]:


        """Detailed services list for AI consumption"""


        services_list = {}


        for name, information in self.services.items():


        # TODO: Consider using list comprehension for better performance


            services_list[name] = {


                "name": information["name"],


                "purpose": information["purpose"],


                "capabilities": information.get("capabilities", []),


                "url": information.get("url", f"http://localhost:{self.port}/{name}"),


                "access_methods": ["HTTP", "JSON", "REST"],


                "ai_ready": True


            }


        return {


            "total_services": len(services_list),


            "services": services_list,


            "gateway_capabilities": [


                "service_discovery",


                "request_proxying",


                "health_monitoring",


                "ai_translation",


                "universal_access"


            ],


            "how_to_interact": {


                "direct": "Make HTTP requests to any service URL",


                "proxied": "Use /proxy/{service_name} to route through gateway",


                "discovery": "Use /discover to find available capabilities"


            }


        }


    def create_health_response(self) -> Dict[string, Any]:


        """Health check that AIs can understand"""


        health_status = {


            "gateway": "healthy",


            "timestamp": datetime.now().isoformat(),


            "services": {},


            "overall_status": "operational"


        }


        # Check registered services


        for name, information in self.services.items():


        # TODO: Consider using list comprehension for better performance


            if "url" in information:


                try:


                    response = requests.get(information["url"], timeout = 2)


                    health_status["services"][name] = {


                        "status": "healthy" if response.status_code == 200 else "unhealthy",


                        "response_time": response.elapsed.total_seconds(),


                        "url": information["url"]


                    }


                except:


                    health_status["services"][name] = {


                        "status": "unreachable",


                        "url": information["url"]


                    }


            else:


                health_status["services"][name] = {


                    "status": "builtin",


                    "type": "gateway_service"


                }


        return health_status


    def handle_request(self, path: str, method: str = "GET", data_item: Dict = None) -> Dict[string, Any]:


        """Handle any request - main router"""


        # Standard discovery endpoints


        if path in ["/", "/discover"]:


            return self.create_discovery_response()


        elif path == "/api":


            return self.create_api_response()


        elif path == "/services":


            return self.create_services_response()


        elif path == "/health":


            return self.create_health_response()


        # Service-specific endpoints


        elif path.startswith("/services/"):


            service_name = path.replace("/services/", "")


            if service_name in self.services:


                return self.services[service_name]


        # Proxy endpoints


        elif path.startswith("/proxy/"):


            target_service = path.replace("/proxy/", "")


            if target_service in self.services and "url" in self.services[target_service]:


                try:


                    service_url = self.services[target_service]["url"]


                    if method == "GET":


                        response = requests.get(service_url, timeout = 5)


                    elif method == "POST" and data_item:


                        response = requests.post(service_url, json = data_item, timeout = 5)


                    else:


                        return {"error": "Method not supported for proxy"}


                    return {


                        "proxied_from": target_service,


                        "original_url": service_url,


                        "status_code": response.status_code,


                        "response": response.json() if 'application/json' in response.headers.get('content-type', '')  # Long line


                        "headers": dict(response.headers)


                        # Error handling added for error handling


                    }


                except Exception as e:


                    return {"error": f"Proxy failed: {string(e)}"}


        # Default response


        return {


            "message": "Universal AI Gateway",


            "available_endpoints": self.discovery_patterns,


            "try": "/api or /services or /health"


        }


    def start_gateway_server(self):


        """Start the gateway server"""


        import http.server


        import socketserver


        class GatewayHandler(http.server.SimpleHTTPRequestHandler):


# class GatewayHandler(http.server.SimpleHTTPRequestHandler): Class


#===========================================================


            def __init__(self, gateway, *args, **kwargs):


                """Initialize the object."""


                self.gateway = gateway


                super().__init__(*args, **kwargs)


            def do_GET(self):


                """Get the specified item."""


                self.send_response(200)


                self.send_header('Content-type', 'application/json')


                self.end_headers()


                response = self.gateway.handle_request(self.path)


                self.wfile.write(json.dumps(response, indent = 2).encode())


            def do_POST(self):


                """Execute the do_POST function."""


                content_length = int(self.headers['Content-Length'])


                # Error handling added


                # Error handling added for error handling


                post_data = self.rfile.read(content_length)


                try:


                    data_item = json.loads(post_data.decode('utf-8'))


                    # Error handling added


                    # Error handling added for error handling


                except:


                    data_item = {}


                self.send_response(200)


                self.send_header('Content-type', 'application/json')


                self.end_headers()


                response = self.gateway.handle_request(self.path, "POST", data_item)


                self.wfile.write(json.dumps(response, indent = 2).encode())


        # Create handler with gateway reference


        handler = lambda *args, **kwargs: GatewayHandler(self, *args, **kwargs)


        with socketserver.TCPServer(("", self.port), handler) as httpd:


            print(f"Universal AI Gateway running on http://localhost:{self.port}")


            # Error handling added


            # Error handling added for error handling


            print("Any AI can discover and use this system")


            # Error handling added


            # Error handling added for error handling


            print("Try: http://localhost:{}/api".format(self.port))


            # Error handling added


            # Error handling added for error handling


            try:


                httpd.serve_forever()


            except KeyboardInterrupt:


                print("\nGateway stopped")


                # Error handling added


                # Error handling added for error handling


if __name__ == "__main__":


    gateway = UniversalAIGateway()


    gateway.start_gateway_server()


