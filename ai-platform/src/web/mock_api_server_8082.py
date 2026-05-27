#!/usr/bin/env python3


"""


Mock API Server for AI Coding Dashboard (Port 8082)


Provides mock responses when the real backend is not available


"""


import json


import http.server


import socketserver


from urllib.parse import urlparse, parse_qs


import datetime


class MockAPIHandler(http.server.SimpleHTTPRequestHandler):


    def do_GET(self):


        """Handle GET requests"""


        parsed_url = urlparse(self.path)


        # CORS headers


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')


        self.send_header('Content-Type', 'application/json')


        self.end_headers()


        # Mock responses for different endpoints


        if '/health' in self.path:


            response = {"status": "healthy", "timestamp": datetime.datetime.now().isoformat()}


        elif '/api/auth/me' in self.path:


            response = {


                "id": 1,


                "email": "admin@dashboard.local",


                "role": "ADMIN",


                "full_name": "Admin User"


            }


        elif '/api/analysis/quality' in self.path:


            response = {


                "overall_score": 85,


                "maintainability": "Good",


                "complexity": "Medium",


                "test_coverage": "78%",


                "code_smells": 12,


                "duplications": 5


            }


        elif '/api/analysis/security' in self.path:


            response = {


                "security_score": 92,


                "vulnerabilities": 2,


                "security_issues": [


                    {"severity": "medium", "description": "Potential SQL injection"},


                    {"severity": "low", "description": "Outdated dependency"}


                ]


            }


        elif '/api/analysis/code-structure' in self.path:


            response = {


                "files": 156,


                "directories": 23,


                "lines_of_code": 15420,


                "languages": {"Python": 65, "JavaScript": 25, "HTML": 10}


            }


        elif '/api/analysis/performance' in self.path:


            response = {


                "response_time": 120,


                "throughput": 1000,


                "memory_usage": "45%",


                "cpu_usage": "30%"


            }


        elif '/api/analysis/recommendations' in self.path:


            response = {


                "recommendations": [


                    {"priority": "high", "title": "Refactor large function", "description": "Function exceeds 50 lines"},


                    {"priority": "medium", "title": "Add unit tests", "description": "Coverage below 80%"}


                ]


            }


        elif '/api/analysis/results/' in self.path:


            response = {


                "analysis_id": "mock_analysis_123",


                "status": "completed",


                "results": {


                    "overall_score": 85,


                    "metrics": {


                        "code_quality": 85,


                        "security": 92,


                        "performance": 78


                    }


                }


            }


        elif '/api/analysis/technical-debt' in self.path:


            response = {


                "technical_debt_score": 25,


                "debt_items": [


                    {"type": "code_smell", "count": 12, "effort": "2d"},


                    {"type": "duplication", "count": 5, "effort": "1d"}


                ]


            }


        elif '/api/project/overview' in self.path:


            response = {


                "name": "Sample Project",


                "description": "AI Coding Dashboard",


                "last_analysis": datetime.datetime.now().isoformat(),


                "status": "active"


            }


        elif '/api/projects' in self.path:


            response = {


                "projects": [


                    {"id": 1, "name": "Sample Python Project", "status": "active"},


                    {"id": 2, "name": "JavaScript Dashboard", "status": "active"}


                ]


            }


        elif '/api/notifications' in self.path:


            response = {


                "notifications": [


                    {"id": 1, "type": "information", "message": "Analysis completed", "read": False}


                ]


            }


        elif '/api/analysis/project/overview' in self.path:


            response = {


                "timestamp": datetime.datetime.now().isoformat(),


                "project": {


                    "name": "CascadeProjects",


                    "overview": {


                        "name": "CascadeProjects",


                        "totalFiles": 150,


                        "linesOfCode": 15678,


                        "lines_of_code": 15678,


                        "overview": {


                            "message": "Real-time project analysis",


                            "path": "/api/analysis/project/overview"


                        },


                        "metrics": {


                            "codeQuality": 82,


                            "testCoverage": 65,


                            "securityScore": 85,


                            "performanceScore": 65


                        }


                    },


                    "metrics": {


                        "totalFiles": 150,


                        "linesOfCode": 15678,


                        "codeQuality": 82,


                        "testCoverage": 65,


                        "securityScore": 85,


                        "performanceScore": 65


                    }


                },


                "analysis": {


                    "codeQuality": {


                        "overall_score": 85,


                        "maintainability": "Good",


                        "complexity": "Medium",


                        "test_coverage": "78%",


                        "code_smells": 12,


                        "duplications": 5


                    },


                    "security": {


                        "security_score": 92,


                        "vulnerabilities": 2,


                        "security_issues": [


                            {


                                "severity": "medium",


                                "description": "Potential SQL injection"


                            },


                            {


                                "severity": "low",


                                "description": "Outdated dependency"


                            }


                        ]


                    },


                    "performance": {


                        "response_time": 120,


                        "throughput": 1000,


                        "memory_usage": "45%",


                        "cpu_usage": "30%"


                    }


                },


                "activity": [


                    {


                        "id": 1,


                        "type": "information",


                        "message": "Analysis completed",


                        "read": False


                    }


                ],


                "recommendations": []


            }


        else:


            response = {"message": "Mock endpoint", "path": self.path}


        self.wfile.write(json.dumps(response).encode())


    def do_POST(self):


        """Handle POST requests"""


        parsed_url = urlparse(self.path)


        # CORS headers


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')


        self.send_header('Content-Type', 'application/json')


        self.end_headers()


        # Handle login


        if '/api/auth/login' in self.path:


            # Read the request body


            content_length = int(self.headers.get('Content-Length', 0))


            post_data = self.rfile.read(content_length).decode('utf-8')


            response = {


                "access_token": "mock_token_12345",


                "refresh_token": "mock_refresh_token",


                "expires_in": 3600,


                "user": {


                    "id": 1,


                    "email": "admin@dashboard.local",


                    "role": "ADMIN",


                    "full_name": "Admin User"


                }


            }


        elif '/api/auth/logout' in self.path:


            response = {"message": "Logged out successfully"}


        elif '/api/auth/refresh' in self.path:


            response = {


                "access_token": "mock_refreshed_token",


                "expires_in": 3600


            }


        else:


            response = {"message": "Mock POST endpoint", "path": self.path}


        self.wfile.write(json.dumps(response).encode())


    def do_OPTIONS(self):


        """Handle OPTIONS requests for CORS"""


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')


        self.end_headers()


def run_server(port = 8082):


    """Run the mock API server"""


    with socketserver.TCPServer(("", port), MockAPIHandler) as httpd:


        print(f"Mock API server running on port {port}")


        print(f"Access at: http://localhost:{port}")


        try:


            httpd.serve_forever()


        except KeyboardInterrupt:


            print("\nServer stopped")


if __name__ == "__main__":


    run_server()


